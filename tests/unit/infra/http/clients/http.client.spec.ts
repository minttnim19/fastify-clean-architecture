import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosCreate = vi.hoisted(() => vi.fn())
const isAxiosError = vi.hoisted(() => vi.fn())
const loggerError = vi.hoisted(() => vi.fn())
const loggerWarn = vi.hoisted(() => vi.fn())
const createLogModel = vi.hoisted(() => vi.fn())
const logStep = vi.hoisted(() => vi.fn())
const requestContextGet = vi.hoisted(() => vi.fn())

type AxiosConfigLike = {
  url?: string
  baseURL?: string
  method?: string
  data?: unknown
  metadata?: {
    logModel?: { logStep: (...args: unknown[]) => void }
    method?: string
    endpoint?: string
    request?: unknown
  }
}
type AxiosResponseLike = { data?: unknown; status?: number; config: AxiosConfigLike }
type AxiosErrorLike = Error & {
  code?: string
  config?: AxiosConfigLike
  response?: { status?: number }
}

vi.mock('axios', () => ({
  default: { create: axiosCreate },
  create: axiosCreate,
  isAxiosError,
}))

vi.mock('@/infra/config/env', () => ({
  env: {
    HTTP_TIMEOUT_MS: 1234,
  },
}))

vi.mock('@/infra/logger/col-logger', () => ({
  createLogModel,
  logger: {
    error: loggerError,
    warn: loggerWarn,
  },
}))

vi.mock('@/infra/http/context/request-context', () => ({
  requestContext: {
    get: requestContextGet,
  },
}))

const makeAxiosInstance = () => {
  let onRequest: ((config: AxiosConfigLike) => AxiosConfigLike) | undefined
  let onResponse: ((response: AxiosResponseLike) => AxiosResponseLike) | undefined
  let onError: ((error: unknown) => Promise<never>) | undefined

  const instance = {
    interceptors: {
      request: {
        use: vi.fn((fn) => {
          onRequest = fn
        }),
      },
      response: {
        use: vi.fn((success, error) => {
          onResponse = success
          onError = error
        }),
      },
    },
    get: vi.fn(() => Promise.resolve({ data: 'get-ok' })),
    post: vi.fn(() => Promise.resolve({ data: 'post-ok' })),
    put: vi.fn(() => Promise.resolve({ data: 'put-ok' })),
    delete: vi.fn(() => Promise.resolve({ data: 'delete-ok' })),
  }

  return {
    instance,
    getOnRequest: () => onRequest,
    getOnResponse: () => onResponse,
    getOnError: () => onError,
  }
}

describe('http.client', () => {
  beforeEach(() => {
    vi.resetModules()
    axiosCreate.mockReset()
    isAxiosError.mockReset()
    loggerError.mockReset()
    loggerWarn.mockReset()
    createLogModel.mockReset()
    logStep.mockReset()
    requestContextGet.mockReset()
    createLogModel.mockReturnValue({ logStep })
    requestContextGet.mockReturnValue(undefined)
  })

  it('creates axios clients with defaults and options', async () => {
    const { instance } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)

    const { createHttpClient } = await import('@/infra/http/clients/http.client.js')

    createHttpClient({
      baseURL: 'https://example.test',
      timeoutMs: 5000,
      headers: { 'X-Test': '1' },
    })

    expect(axiosCreate).toHaveBeenCalledTimes(2)

    const firstCall = axiosCreate.mock.calls[0]?.[0]
    expect(firstCall).toEqual(
      expect.objectContaining({
        timeout: 1234,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
        httpAgent: expect.any(Object),
        httpsAgent: expect.any(Object),
      }),
    )

    const secondCall = axiosCreate.mock.calls[1]?.[0]
    expect(secondCall).toEqual(
      expect.objectContaining({
        baseURL: 'https://example.test',
        timeout: 5000,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Test': '1',
        }),
        httpAgent: expect.any(Object),
        httpsAgent: expect.any(Object),
      }),
    )
  })

  it('sets request metadata and allows absolute url', async () => {
    const { instance, getOnRequest } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    requestContextGet.mockReturnValue({ correlatorId: 'c1', channel: 'ch1' })

    await import('@/infra/http/clients/http.client.js')

    const onRequest = getOnRequest()
    if (!onRequest) throw new Error('Missing request interceptor')

    const config = onRequest({ url: 'https://example.test/path', method: 'get', data: { a: 1 } })
    expect(config.metadata).toEqual(
      expect.objectContaining({
        logModel: expect.any(Object),
        method: 'GET',
        endpoint: 'https://example.test/path',
        request: { a: 1 },
      }),
    )
    expect(createLogModel).toHaveBeenCalledWith({ txid: 'c1', channel: 'ch1' })
  })

  it('resolves endpoint from baseURL and relative url', async () => {
    const { instance, getOnRequest } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    requestContextGet.mockReturnValue({ correlatorId: 'c1', channel: 'ch1' })

    await import('@/infra/http/clients/http.client.js')

    const onRequest = getOnRequest()
    if (!onRequest) throw new Error('Missing request interceptor')

    const config = onRequest({ baseURL: 'https://example.test', url: '/rel', method: 'post' })
    expect(config.metadata?.endpoint).toBe('https://example.test/rel')
  })

  it('resolves endpoint from baseURL when url is missing', async () => {
    const { instance, getOnRequest } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    requestContextGet.mockReturnValue({ correlatorId: 'c1', channel: 'ch1' })

    await import('@/infra/http/clients/http.client.js')

    const onRequest = getOnRequest()
    if (!onRequest) throw new Error('Missing request interceptor')

    const config = onRequest({ baseURL: 'https://example.test', method: 'get' })
    expect(config.metadata?.endpoint).toBe('https://example.test')
  })

  it('resolves empty endpoint when url and baseURL are missing', async () => {
    const { instance, getOnRequest } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    requestContextGet.mockReturnValue({ correlatorId: 'c1', channel: 'ch1' })

    await import('@/infra/http/clients/http.client.js')

    const onRequest = getOnRequest()
    if (!onRequest) throw new Error('Missing request interceptor')

    const config = onRequest({ method: 'get' })
    expect(config.metadata?.endpoint).toBe('')
  })

  it('rejects relative url when baseURL is missing', async () => {
    const { instance, getOnRequest } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)

    await import('@/infra/http/clients/http.client.js')

    const onRequest = getOnRequest()
    if (!onRequest) throw new Error('Missing request interceptor')

    expect(() => onRequest({ url: '/relative' })).toThrow('HTTP client called with relative URL')
  })

  it('passes through successful responses', async () => {
    const { instance, getOnResponse } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    requestContextGet.mockReturnValue({ correlatorId: 'c1', channel: 'ch1' })

    await import('@/infra/http/clients/http.client.js')

    const onResponse = getOnResponse()
    if (!onResponse) throw new Error('Missing response interceptor')

    const response = {
      data: { ok: true },
      status: 200,
      config: {
        metadata: {
          logModel: { logStep },
          method: 'GET',
          endpoint: 'https://example.test/path',
          request: { a: 1 },
        },
      },
    }
    expect(onResponse(response)).toBe(response)
    expect(logStep).toHaveBeenCalledWith(
      'HTTP client request',
      expect.objectContaining({
        activity_name: 'http-client-request',
        method: 'GET',
        endpoint: 'https://example.test/path',
        step_request: { a: 1 },
        step_response: { ok: true },
        result_code: '200',
      }),
    )
  })

  it('uses response config values when metadata is missing', async () => {
    const { instance, getOnResponse } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)

    await import('@/infra/http/clients/http.client.js')

    const onResponse = getOnResponse()
    if (!onResponse) throw new Error('Missing response interceptor')

    const response = {
      data: { ok: true },
      status: 201,
      config: {
        method: 'post',
        baseURL: 'https://example.test',
        url: '/fallback',
        data: { a: 2 },
        metadata: {
          logModel: { logStep },
        },
      },
    }

    onResponse(response)

    expect(logStep).toHaveBeenCalledWith(
      'HTTP client request',
      expect.objectContaining({
        activity_name: 'http-client-request',
        method: 'POST',
        endpoint: 'https://example.test/fallback',
        step_request: { a: 2 },
        step_response: { ok: true },
        result_code: '201',
      }),
    )
  })

  it('logs axios errors and rethrows', async () => {
    const { instance, getOnError } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    isAxiosError.mockReturnValue(true)

    await import('@/infra/http/clients/http.client.js')

    const onError = getOnError()
    if (!onError) throw new Error('Missing response error interceptor')

    const error = new Error('boom') as AxiosErrorLike
    error.code = 'ECONN'
    error.config = { url: '/test', metadata: { logModel: { logStep } } }
    error.response = { status: 500 }

    await expect(onError(error)).rejects.toThrow('boom')
    expect(logStep).toHaveBeenCalledWith(
      'HTTP client request error',
      expect.objectContaining({
        activity_name: 'http-client-request',
        error,
      }),
    )
  })

  it('logs axios errors without metadata start', async () => {
    const { instance, getOnError } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    isAxiosError.mockReturnValue(true)

    await import('@/infra/http/clients/http.client.js')

    const onError = getOnError()
    if (!onError) throw new Error('Missing response error interceptor')

    const error = new Error('boom-2') as AxiosErrorLike
    error.code = 'ETIMEDOUT'
    error.config = { url: '/test-2', metadata: {} }
    error.response = { status: 504 }

    await expect(onError(error)).rejects.toThrow('boom-2')
    expect(logStep).not.toHaveBeenCalled()
  })

  it('logs non-axios errors and normalizes message', async () => {
    const { instance, getOnError } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)
    isAxiosError.mockReturnValue(false)

    await import('@/infra/http/clients/http.client.js')

    const onError = getOnError()
    if (!onError) throw new Error('Missing response error interceptor')

    await expect(onError({ message: 'bad' })).rejects.toThrow('bad')
    await expect(onError(123)).rejects.toThrow('123')

    expect(loggerWarn).toHaveBeenCalledWith({ error: { message: 'bad' } }, 'Unknown HTTP error')
    expect(loggerWarn).toHaveBeenCalledWith({ error: 123 }, 'Unknown HTTP error')
  })

  it('wraps http methods and returns data', async () => {
    const { instance } = makeAxiosInstance()
    axiosCreate.mockImplementation(() => instance)

    const { httpGet, httpPost, httpPut, httpDelete } =
      await import('@/infra/http/clients/http.client.js')

    await expect(httpGet('/get')).resolves.toBe('get-ok')
    await expect(httpPost('/post', { a: 1 })).resolves.toBe('post-ok')
    await expect(httpPut('/put', { a: 2 })).resolves.toBe('put-ok')
    await expect(httpDelete('/delete')).resolves.toBe('delete-ok')

    expect(instance.get).toHaveBeenCalledWith('/get', undefined)
    expect(instance.post).toHaveBeenCalledWith('/post', { a: 1 }, undefined)
    expect(instance.put).toHaveBeenCalledWith('/put', { a: 2 }, undefined)
    expect(instance.delete).toHaveBeenCalledWith('/delete', undefined)
  })
})
