import { beforeEach, describe, expect, it, vi } from 'vitest'

const collectDefaultMetricsMock = vi.hoisted(() => vi.fn())
const linearBucketsMock = vi.hoisted(() => vi.fn(() => [0.05, 0.1, 0.15]))
const clearMock = vi.hoisted(() => vi.fn())
const counterIncMock = vi.hoisted(() => vi.fn())
const histogramObserveMock = vi.hoisted(() => vi.fn())

const registryInstance = vi.hoisted(() => ({
  clear: clearMock,
}))

const registryCtorMock = vi.hoisted(() =>
  vi.fn(function RegistryMock(this: object) {
    return registryInstance
  }),
)

const counterCtorMock = vi.hoisted(() =>
  vi.fn(function CounterMock(this: object) {
    return {
      inc: counterIncMock,
    }
  }),
)

const histogramCtorMock = vi.hoisted(() =>
  vi.fn(function HistogramMock(this: object) {
    return {
      observe: histogramObserveMock,
    }
  }),
)

vi.mock('prom-client', () => ({
  Counter: counterCtorMock,
  Histogram: histogramCtorMock,
  Registry: registryCtorMock,
  collectDefaultMetrics: collectDefaultMetricsMock,
  linearBuckets: linearBucketsMock,
}))

import { metrics } from '@/infra/http/plugins/metrics.plugin'

import type { FastifyInstance, FastifyRequest } from 'fastify'

type HookName = 'onRequest' | 'onResponse' | 'onClose'

describe('metrics plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers registry, default metrics, and metric collectors', () => {
    const hooks = new Map<HookName, (...args: unknown[]) => void>()
    const fastify = {
      decorate: vi.fn(),
      addHook: vi.fn((name: HookName, handler: (...args: unknown[]) => void) => {
        hooks.set(name, handler)
      }),
    } as unknown as FastifyInstance
    const done = vi.fn()

    metrics(fastify, {}, done)

    expect(registryCtorMock).toHaveBeenCalledOnce()
    expect(collectDefaultMetricsMock).toHaveBeenCalledWith({
      register: registryInstance,
      prefix: 'prebook_',
    })
    expect(linearBucketsMock).toHaveBeenCalledWith(0.05, 0.05, 20)
    expect(counterCtorMock).toHaveBeenCalledWith({
      name: 'prebook_http_requests_total',
      help: 'Total number of HTTP requests handled by Fastify.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [registryInstance],
    })
    expect(histogramCtorMock).toHaveBeenCalledWith({
      name: 'prebook_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.15],
      registers: [registryInstance],
    })
    expect(fastify.decorate).toHaveBeenCalledWith('metricsRegistry', registryInstance)
    expect(hooks.has('onRequest')).toBe(true)
    expect(hooks.has('onResponse')).toBe(true)
    expect(hooks.has('onClose')).toBe(true)
    expect(done).toHaveBeenCalledOnce()
  })

  it('captures request start time on onRequest', () => {
    const hooks = new Map<HookName, (...args: unknown[]) => void>()
    const fastify = {
      decorate: vi.fn(),
      addHook: vi.fn((name: HookName, handler: (...args: unknown[]) => void) => {
        hooks.set(name, handler)
      }),
    } as unknown as FastifyInstance

    const bigintSpy = vi.spyOn(process.hrtime, 'bigint').mockReturnValue(123n)

    metrics(fastify, {}, () => {})

    const request: Partial<FastifyRequest> & { metricsStartTime?: bigint } = {}
    const hookDone = vi.fn()

    hooks.get('onRequest')?.(request, {}, hookDone)

    expect(request.metricsStartTime).toBe(123n)
    expect(hookDone).toHaveBeenCalledOnce()

    bigintSpy.mockRestore()
  })

  it('records request metrics on onResponse and falls back when start time is missing', () => {
    const hooks = new Map<HookName, (...args: unknown[]) => void>()
    const fastify = {
      decorate: vi.fn(),
      addHook: vi.fn((name: HookName, handler: (...args: unknown[]) => void) => {
        hooks.set(name, handler)
      }),
    } as unknown as FastifyInstance

    const bigintSpy = vi.spyOn(process.hrtime, 'bigint').mockReturnValue(1_500_000_000n)

    metrics(fastify, {}, () => {})

    const hookDone = vi.fn()
    const requestWithStart = {
      method: 'GET',
      url: '/xyz/api/v1/orders?status=open',
      routeOptions: { url: '/api/v1/orders' },
      metricsStartTime: 500_000_000n,
    }
    const reply = { statusCode: 200 }

    hooks.get('onResponse')?.(requestWithStart, reply, hookDone)

    expect(counterIncMock).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      route: '/api/v1/orders',
      status_code: '200',
    })
    expect(histogramObserveMock).toHaveBeenNthCalledWith(
      1,
      {
        method: 'GET',
        route: '/api/v1/orders',
        status_code: '200',
      },
      1,
    )

    const requestWithoutStart = {
      method: 'POST',
      url: '/xyz/api/v1/messages',
      routeOptions: { url: '/api/v1/messages' },
    }

    hooks.get('onResponse')?.(requestWithoutStart, { statusCode: 202 }, hookDone)

    expect(counterIncMock).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      route: '/api/v1/messages',
      status_code: '202',
    })
    expect(histogramObserveMock).toHaveBeenNthCalledWith(
      2,
      {
        method: 'POST',
        route: '/api/v1/messages',
        status_code: '202',
      },
      0,
    )
    expect(hookDone).toHaveBeenCalledTimes(2)

    bigintSpy.mockRestore()
  })

  it('uses a stable label for unmatched api routes', () => {
    const hooks = new Map<HookName, (...args: unknown[]) => void>()
    const fastify = {
      decorate: vi.fn(),
      addHook: vi.fn((name: HookName, handler: (...args: unknown[]) => void) => {
        hooks.set(name, handler)
      }),
    } as unknown as FastifyInstance

    metrics(fastify, {}, () => {})

    const hookDone = vi.fn()
    hooks.get('onResponse')?.(
      {
        method: 'GET',
        url: '/xyz/api/v1/orders/12345?expand=true',
        routeOptions: {},
        metricsStartTime: 100n,
      },
      { statusCode: 404 },
      hookDone,
    )

    expect(counterIncMock).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/unmatched',
      status_code: '404',
    })
    expect(histogramObserveMock).toHaveBeenCalledWith(
      {
        method: 'GET',
        route: '/api/unmatched',
        status_code: '404',
      },
      expect.any(Number),
    )
    expect(hookDone).toHaveBeenCalledOnce()
  })

  it('skips collecting metrics for non-api endpoints and clears registry on close', () => {
    const hooks = new Map<HookName, (...args: unknown[]) => void>()
    const fastify = {
      decorate: vi.fn(),
      addHook: vi.fn((name: HookName, handler: (...args: unknown[]) => void) => {
        hooks.set(name, handler)
      }),
    } as unknown as FastifyInstance

    metrics(fastify, {}, () => {})

    const responseHookDone = vi.fn()
    const skippedRequests = [
      {
        method: 'GET',
        url: '/xyz/metrics',
        routeOptions: { url: '/metrics' },
        metricsStartTime: 100n,
      },
      {
        method: 'GET',
        url: '/xyz/healthz',
        routeOptions: { url: '/healthz' },
        metricsStartTime: 100n,
      },
      {
        method: 'GET',
        url: '/xyz/docs',
        routeOptions: { url: '/docs' },
        metricsStartTime: 100n,
      },
      {
        method: 'GET',
        url: '/xyz/healthz?full=true',
        routeOptions: {},
        metricsStartTime: 100n,
      },
    ]

    for (const request of skippedRequests) {
      hooks.get('onResponse')?.(request, { statusCode: 200 }, responseHookDone)
    }

    expect(counterIncMock).not.toHaveBeenCalled()
    expect(histogramObserveMock).not.toHaveBeenCalled()
    expect(responseHookDone).toHaveBeenCalledTimes(4)

    const closeHookDone = vi.fn()
    hooks.get('onClose')?.(fastify, closeHookDone)

    expect(clearMock).toHaveBeenCalledOnce()
    expect(closeHookDone).toHaveBeenCalledOnce()
  })
})
