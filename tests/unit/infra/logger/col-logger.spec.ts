import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type LogPayload = Record<string, unknown>
type PinoConfig = {
  mixin?: () => void
  timestamp?: () => string
  formatters?: { level?: (level: string) => unknown }
}

const pinoMock = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
  const transport = vi.fn()
  type PinoFnMock = ReturnType<typeof vi.fn> & {
    stdTimeFunctions: { isoTime: ReturnType<typeof vi.fn> }
    transport: ReturnType<typeof vi.fn>
  }
  const pinoFn = vi.fn((baseConfig: PinoConfig) => {
    if (baseConfig?.mixin) baseConfig.mixin()
    if (baseConfig?.timestamp) baseConfig.timestamp()
    if (baseConfig?.formatters?.level) baseConfig.formatters.level('info')
    return logger
  }) as PinoFnMock
  pinoFn.stdTimeFunctions = { isoTime: vi.fn(() => 'iso') }
  pinoFn.transport = transport

  return { logger, transport, pinoFn }
})

vi.mock('pino', () => ({ default: pinoMock.pinoFn }))

const mockEnv = (overrides: Partial<Record<string, unknown>> = {}): void => {
  vi.doMock('@/infra/config/env', () => ({
    env: {
      LOG_LEVEL: 'info',
      LOG_PATH: '/var/log/app',
      LOG_TO_FILE: false,
      LOG_CHANNEL: 'channel',
      LOG_PRODUCT: 'product',
      SERVICE_TYPE: '',
      ...overrides,
    },
  }))
}

describe('createLogModel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:05.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses epoch seconds for Splunk time and keeps ISO timestamp fields', async () => {
    mockEnv()

    await import('@/infra/logger/col-logger.js')

    const baseConfig = pinoMock.pinoFn.mock.calls[0][0]
    const timestampFragment = baseConfig.timestamp?.()
    const timestampFields = JSON.parse(`{${timestampFragment?.slice(1)}}`) as Record<
      string,
      unknown
    >

    expect(timestampFields).toEqual({
      time: 1704067205,
      '@timestamp': '2024-01-01T00:00:05.000Z',
      timestamp: '2024-01-01T00:00:05.000Z',
    })
  })

  it('logIn writes order and step logs with computed fields', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel, LogCategory } = await import('@/infra/logger/col-logger.js')

    const startedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    const model = createLogModel({
      txid: 'tx1',
      channel: 'web',
      service_type: 'svc',
      started_at: startedAt,
    })

    model.logIn(
      'Create Order API',
      {
        endpoint: '/orders',
        method: 'POST',
        request: { a: 1 },
        response: { ok: true },
        result_code: '201',
        search_key: 'search',
        ref_id: 'ref1',
        remark: 'note',
      },
      LogCategory.ORDER,
    )

    expect(pinoMock.logger.info).toHaveBeenCalledTimes(2)

    const [orderPayload, orderMsg] = pinoMock.logger.info.mock.calls[0]
    expect(orderMsg).toBe('Create Order API')
    expect(orderPayload).toMatchObject({
      txid: 'tx1',
      step_txid: 'tx1',
      log_cat: 'order',
      channel: 'web',
      service_type: 'svc',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-01-01T00:00:05.000Z',
      result_indicator: 'INPROGRESS',
      result_code: '201',
      result_desc: 'success',
      elapsed_time: 5000,
      endpoint: '/orders',
      request: JSON.stringify({ a: 1 }),
      response: JSON.stringify({ ok: true }),
      search_key: 'search',
      ref_id: 'ref1',
      remark: 'note',
    })
    expect(orderPayload).not.toHaveProperty('step_name')

    const [stepPayload, stepMsg] = pinoMock.logger.info.mock.calls[1]
    expect(stepMsg).toBe('Create Order API')
    expect(stepPayload).toMatchObject({
      txid: 'tx1',
      log_cat: 'step',
      channel: 'web',
      service_type: 'svc',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-01-01T00:00:05.000Z',
      result_indicator: 'SUCCESS',
      result_code: '201',
      result_desc: 'success',
      elapsed_time: 5000,
      step_name: 'create-order-api',
      endpoint: '/orders',
      step_request: JSON.stringify({ a: 1 }),
      step_response: JSON.stringify({ ok: true }),
      search_key: 'search',
      remark: 'note',
    })
    expect(stepPayload.step_txid).toMatch(/^tx1_1704067205000$/)
  })

  it('logOut stringifies circular payloads and marks completion', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const startedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    const model = createLogModel({ txid: 'tx2', service_type: 'svc', started_at: startedAt })

    const circular: LogPayload & { self?: unknown } = { name: 'circle' }
    circular.self = circular

    model.logOut('Finish Order', {
      endpoint: '/orders',
      method: 'POST',
      request: circular,
      response: circular,
      result_code: '0',
    })

    expect(pinoMock.logger.info).toHaveBeenCalledTimes(2)

    const [stepPayload] = pinoMock.logger.info.mock.calls[0]
    expect(stepPayload.step_request).toBe('[Circular or Non-serializable]')
    expect(stepPayload.step_response).toBe('[Circular or Non-serializable]')

    const [orderPayload] = pinoMock.logger.info.mock.calls[1]
    expect(orderPayload).toMatchObject({
      txid: 'tx2',
      log_cat: 'order',
      result_indicator: 'COMPLETED',
      result_code: '0',
      result_desc: 'success',
      request: '[Circular or Non-serializable]',
      response: '[Circular or Non-serializable]',
    })
  })

  it('logIn preserves string request/response payloads', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-str', service_type: 'svc' })
    model.logIn('String In', { request: 'raw', response: 'resp' })

    const [orderPayload] = pinoMock.logger.info.mock.calls[0]
    expect(orderPayload.request).toBe('raw')
    expect(orderPayload.response).toBe('resp')
  })

  it('uses provided result_desc for order and step logs', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-desc', service_type: 'svc' })

    model.logIn('Override In', {
      result_code: '400',
      result_desc: 'custom in',
    })
    expect(pinoMock.logger.info.mock.calls[0][0]).toMatchObject({
      result_code: '400',
      result_desc: 'custom in',
    })
    expect(pinoMock.logger.info.mock.calls[1][0]).toMatchObject({
      result_code: '400',
      result_desc: 'custom in',
    })
    pinoMock.logger.info.mockClear()

    model.logOut('Override Out', {
      result_code: '0',
      result_desc: 'custom out',
    })
    expect(pinoMock.logger.info.mock.calls[0][0]).toMatchObject({
      result_code: '0',
      result_desc: 'custom out',
    })
    expect(pinoMock.logger.info.mock.calls[1][0]).toMatchObject({
      result_code: '0',
      result_desc: 'custom out',
    })

    model.logError('Override Error', {
      result_code: '500',
      result_desc: 'custom error',
      error: { message: 'boom', status: 503 },
    })
    expect(pinoMock.logger.error.mock.calls[0][0]).toMatchObject({
      result_code: '503',
      result_desc: 'custom error',
    })
    expect(pinoMock.logger.error.mock.calls[1][0]).toMatchObject({
      result_code: '503',
      result_desc: 'custom error',
    })
  })

  it('logError uses axios error data and logs at error level', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const startedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    const model = createLogModel({ txid: 'tx3', service_type: 'svc', started_at: startedAt })

    const axiosError = {
      isAxiosError: true,
      name: 'AxiosError',
      message: 'boom',
      code: 'ECONN',
      stack: 'stack',
      config: {
        url: '/foo',
        baseURL: 'https://api.example.com',
        method: 'post',
        headers: { h: 1 },
        params: { q: 1 },
        data: { x: 1 },
      },
      response: {
        status: 404,
        statusText: 'Not Found',
        data: { msg: 'missing' },
      },
    }

    model.logError('Call API', { error: axiosError, search_key: 'search' })

    expect(pinoMock.logger.error).toHaveBeenCalledTimes(2)

    const [stepPayload, stepMsg] = pinoMock.logger.error.mock.calls[0]
    expect(stepMsg).toBe('Call API')
    expect(stepPayload).toMatchObject({
      txid: 'tx3',
      log_cat: 'step',
      result_indicator: 'FAILED',
      result_code: '404',
      result_desc: 'boom',
      endpoint: '/foo',
      step_name: 'call-api',
      search_key: 'search',
    })
    expect(stepPayload.step_request).toContain('"headers"')
    expect(stepPayload.step_response).toContain('"status":404')

    const [orderPayload, orderMsg] = pinoMock.logger.error.mock.calls[1]
    expect(orderMsg).toBe('Call API')
    expect(orderPayload).toMatchObject({
      txid: 'tx3',
      log_cat: 'order',
      result_indicator: 'FAILED',
      result_code: '404',
      result_desc: 'failed',
      endpoint: '/foo',
      search_key: 'search',
    })
    expect(orderPayload.request).toContain('"headers"')
    expect(orderPayload.response).toContain('"status":404')
  })

  it('logError handles axios variants', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-abs', service_type: 'svc' })

    const absError = {
      isAxiosError: true,
      config: { url: 'http://example.com/abs', method: 'get' },
      response: { status: 500, statusText: 'Err', data: { ok: false } },
    }
    model.logError('Abs URL', { error: absError })
    let [stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      endpoint: 'http://example.com/abs',
      result_code: '500',
      result_desc: 'failed',
    })
    pinoMock.logger.error.mockClear()

    const reqOnlyError = {
      isAxiosError: true,
      message: 'no response',
      config: {
        url: 'http://example.com/req',
        method: 'put',
        headers: { h: 1 },
        params: { p: 1 },
        data: { d: 1 },
      },
    }
    model.logError('Req Only', { error: reqOnlyError })
    ;[stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload.step_request).toContain('"headers"')
    expect(stepPayload.step_response).toBe('')
    pinoMock.logger.error.mockClear()

    const relativeError = new Error('rel') as Error & {
      isAxiosError?: boolean
      config?: Record<string, unknown>
    }
    relativeError.isAxiosError = true
    relativeError.config = {
      url: '/relative',
      method: 'patch',
      headers: { h: 1 },
      params: { p: 1 },
      data: { d: 1 },
    }
    model.logError('Rel', { error: relativeError })
    ;[stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload.step_request).toContain('"headers"')
    pinoMock.logger.error.mockClear()

    const noConfigError = {
      isAxiosError: true,
      response: { status: 503, statusText: 'Down', data: { ok: false } },
    }
    model.logError('No Config', { error: noConfigError })
    ;[stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      result_code: '503',
      endpoint: '',
    })

    pinoMock.logger.error.mockClear()
    const invalidResponseTypes = {
      isAxiosError: true,
      message: 'bad types',
      config: { url: '/bad' },
      response: { status: '500', statusText: 123, data: { ok: false } },
    }
    model.logError('Bad Types', { error: invalidResponseTypes })
    ;[stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      result_code: '500',
      endpoint: '/bad',
      result_desc: 'bad types',
    })
  })

  it('logStep can force log level and handles non-axios errors', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const startedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    const model = createLogModel({ txid: 'tx4', service_type: 'svc', started_at: startedAt })

    model.logStep(
      'Manual Step',
      {
        endpoint: '/manual',
        method: 'GET',
        step_request: { x: 1 },
        step_response: { ok: true },
        result_code: '400',
        activity_name: 'manual',
      },
      'error',
    )

    expect(pinoMock.logger.error).toHaveBeenCalledTimes(1)
    const [payload] = pinoMock.logger.error.mock.calls[0]
    expect(payload).toMatchObject({
      txid: 'tx4',
      log_cat: 'step',
      result_indicator: 'FAILED',
      result_code: '400',
      result_desc: 'failed',
      endpoint: '/manual',
      step_name: 'manual',
    })

    const error = { name: 'Err', message: 'oops', code: 'E1', stack: 's' }
    model.logError('Non-axios', { error })

    expect(pinoMock.logger.error).toHaveBeenCalledTimes(3)
    const [errorStepPayload] = pinoMock.logger.error.mock.calls[1]
    expect(errorStepPayload).toMatchObject({
      result_code: '500',
      result_desc: 'oops',
      step_name: 'non-axios',
      endpoint: '',
    })
  })

  it('logStep uses axios error details when provided', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-axios', service_type: 'svc' })
    const axiosError = {
      isAxiosError: true,
      message: 'bad',
      stack: 'stack',
      config: {
        url: '/v1/items',
        baseURL: 'https://api.example.com',
        method: 'post',
        headers: { h: 1 },
        params: { p: 1 },
        data: { d: 1 },
      },
      response: { status: 502, statusText: 'Bad', data: { ok: false } },
    }

    model.logStep('Axios Step', { activity_name: 'axios', error: axiosError })

    const [stepPayload] = pinoMock.logger.error.mock.calls.at(-1) as unknown as [LogPayload]
    expect(stepPayload).toMatchObject({
      endpoint: '/v1/items',
      result_code: '502',
      result_desc: 'bad',
      step_name: 'axios',
    })
    expect(stepPayload.step_request).toContain('"headers"')
    expect(stepPayload.step_response).toContain('"status":502')
  })

  it('logStep uses statusCode from domain-like errors', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-domain', service_type: 'svc' })
    const domainError = {
      name: 'DomainError',
      message: 'Current order status does not allow cancellation',
      code: 'BAD_REQUEST',
      statusCode: 400,
      stack: 'domain-stack',
    }

    model.logStep('Request error', { activity_name: 'request-error', error: domainError })

    const [stepPayload] = pinoMock.logger.error.mock.calls.at(-1) as unknown as [LogPayload]
    expect(stepPayload).toMatchObject({
      result_code: '400',
      result_desc: 'Current order status does not allow cancellation',
      result_indicator: 'FAILED',
      step_name: 'request-error',
      remark: 'domain-stack',
    })
  })

  it('logStep uses status from error objects', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-status', service_type: 'svc' })
    const statusError = {
      name: 'HttpError',
      message: 'Forbidden',
      status: 403,
      stack: 'status-stack',
    }

    model.logStep('Request error', { activity_name: 'request-error', error: statusError })

    const [stepPayload] = pinoMock.logger.error.mock.calls.at(-1) as unknown as [LogPayload]
    expect(stepPayload).toMatchObject({
      result_code: '403',
      result_desc: 'Forbidden',
      result_indicator: 'FAILED',
      step_name: 'request-error',
      remark: 'status-stack',
    })
  })

  it('logError handles non-object error input', async () => {
    mockEnv()
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-nonobj' })
    model.logError('NonObj', { error: 'boom' })

    const [stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      result_code: '500',
      result_desc: 'failed',
    })
  })

  it('logError without error uses provided request/response and clone works', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const startedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    const model = createLogModel({ txid: 'tx5', service_type: 'svc', started_at: startedAt })

    model.logError('Bad Request', {
      endpoint: '/bad',
      method: 'GET',
      request: { a: 1 },
      response: { b: 2 },
      result_code: '401',
    })

    expect(pinoMock.logger.error).toHaveBeenCalledTimes(2)
    const [stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      result_code: '401',
      result_desc: 'failed',
      endpoint: '/bad',
      step_name: 'bad-request',
    })

    const [orderPayload] = pinoMock.logger.error.mock.calls[1]
    expect(orderPayload).toMatchObject({
      result_code: '401',
      result_desc: 'failed',
      endpoint: '/bad',
    })

    vi.setSystemTime(new Date('2024-01-01T00:00:10.000Z'))
    const cloned = model.clone()
    cloned.logIn('Clone In', { endpoint: '/clone' })
    const [clonePayload] = pinoMock.logger.info.mock.calls.at(-1) as unknown as [LogPayload]
    expect(clonePayload.start_date).toBe('2024-01-01T00:00:10.000Z')
  })

  it('uses randomUUID and elapsed_time fallback when started_at is falsy', async () => {
    mockEnv({ SERVICE_TYPE: 'svc' })
    const randomUUID = vi.fn(() => 'uuid-1')
    vi.doMock('node:crypto', () => ({ randomUUID }))

    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ started_at: 0 })
    model.logOut('Done', { elapsed_time: 123 })

    const [outPayload] = pinoMock.logger.info.mock.calls.at(-1) as unknown as [LogPayload]
    expect(outPayload).toMatchObject({
      txid: 'uuid-1',
      step_txid: 'uuid-1',
      start_date: '1970-01-01T00:00:00.000Z',
      elapsed_time: 123,
      result_code: '0',
    })

    model.logError('Err', { elapsed_time: 321 })
    const [errPayload] = pinoMock.logger.error.mock.calls.at(-1) as unknown as [LogPayload]
    expect(errPayload).toMatchObject({
      txid: 'uuid-1',
      elapsed_time: 321,
      result_code: '500',
    })

    model.logOut('Done Again', {})
    const [outPayloadZero] = pinoMock.logger.info.mock.calls.at(-1) as unknown as [LogPayload]
    expect(outPayloadZero.elapsed_time).toBe(0)

    model.logError('Err Again', {})
    const [errPayloadZero] = pinoMock.logger.error.mock.calls.at(-1) as unknown as [LogPayload]
    expect(errPayloadZero.elapsed_time).toBe(0)
  })

  it('logStep generates txid and handles empty error message', async () => {
    mockEnv()
    const randomUUID = vi.fn(() => 'uuid-step')
    vi.doMock('node:crypto', () => ({ randomUUID }))

    const { createLogModel } = await import('@/infra/logger/col-logger.js')
    const model = createLogModel()

    model.logStep('Step Error', { activity_name: 'step', error: {} })

    const [stepPayload] = pinoMock.logger.error.mock.calls[0]
    expect(stepPayload).toMatchObject({
      txid: 'uuid-step',
      result_code: '500',
      result_desc: 'failed',
      endpoint: '',
    })
  })

  it('logIn supports params.txid, randomUUID fallback, and elapsed_time branches', async () => {
    mockEnv()
    const randomUUID = vi.fn(() => 'uuid-in')
    vi.doMock('node:crypto', () => ({ randomUUID }))

    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ started_at: 0 })

    model.logIn('With Param Tx', { txid: 'tx-param', elapsed_time: 10 })
    const [paramPayload] = pinoMock.logger.info.mock.calls.at(0) as unknown as [LogPayload]
    expect(paramPayload.txid).toBe('tx-param')
    expect(paramPayload.elapsed_time).toBe(10)

    model.logIn('With Random Tx', { elapsed_time: 0 })
    const [randomPayload] = pinoMock.logger.info.mock.calls.at(2) as unknown as [LogPayload]
    expect(randomPayload.txid).toBe('uuid-in')
    expect(randomPayload.elapsed_time).toBe(0)
  })

  it('logIn falls back to zero elapsed_time when missing', async () => {
    mockEnv()
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ started_at: 0 })
    model.logIn('No elapsed', {})

    const [payload] = pinoMock.logger.info.mock.calls[0]
    expect(payload.elapsed_time).toBe(0)
  })

  it('logIn handles trailing separators in message', async () => {
    mockEnv()
    const { createLogModel } = await import('@/infra/logger/col-logger.js')

    const model = createLogModel({ txid: 'tx-tail', started_at: 0 })
    model.logIn('Hello-', { elapsed_time: 1 })

    const [stepPayload] = pinoMock.logger.info.mock.calls.at(-1) as unknown as [LogPayload]
    expect(stepPayload.step_name).toBe('hello')
  })
})

describe('setupLogger (module init)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('enables file transport when writable', async () => {
    mockEnv({
      LOG_TO_FILE: true,
      LOG_LEVEL: 'debug',
      LOG_PATH: '/var/log/app',
    })

    const mkdirSync = vi.fn()
    const accessSync = vi.fn()
    vi.doMock('node:fs', () => ({
      default: { constants: { W_OK: 2 }, mkdirSync, accessSync },
      constants: { W_OK: 2 },
      mkdirSync,
      accessSync,
    }))

    process.env.HOSTNAME = 'host-1'

    await import('@/infra/logger/col-logger.js')

    expect(mkdirSync).toHaveBeenCalledWith('/var/log/app', { recursive: true })
    expect(accessSync).toHaveBeenCalledWith('/var/log/app', 2)
    expect(pinoMock.transport).toHaveBeenCalledTimes(1)
    const transportArgs = pinoMock.transport.mock.calls[0][0]
    expect(transportArgs.targets[0].options.file).toBe('/var/log/app/app.host-1.log')
  })

  it('uses an empty hostname suffix when HOSTNAME is unset', async () => {
    mockEnv({
      LOG_TO_FILE: true,
      LOG_PATH: '/var/log/app',
    })

    const mkdirSync = vi.fn()
    const accessSync = vi.fn()
    vi.doMock('node:fs', () => ({
      default: { constants: { W_OK: 2 }, mkdirSync, accessSync },
      constants: { W_OK: 2 },
      mkdirSync,
      accessSync,
    }))

    delete process.env.HOSTNAME

    await import('@/infra/logger/col-logger.js')

    const transportArgs = pinoMock.transport.mock.calls[0][0]
    expect(transportArgs.targets[0].options.file).toBe('/var/log/app/app..log')
  })

  it('disables file transport when directory is not writable', async () => {
    mockEnv({ LOG_TO_FILE: true, LOG_PATH: '/no-access' })

    const mkdirSync = vi.fn(() => {
      throw new Error('no access')
    })
    const accessSync = vi.fn()
    vi.doMock('node:fs', () => ({
      default: { constants: { W_OK: 2 }, mkdirSync, accessSync },
      constants: { W_OK: 2 },
      mkdirSync,
      accessSync,
    }))

    await import('@/infra/logger/col-logger.js')

    expect(pinoMock.transport).not.toHaveBeenCalled()
    expect(pinoMock.pinoFn).toHaveBeenCalledTimes(1)
  })
})
