import { describe, expect, it, vi } from 'vitest'

import { onResponse } from '@/infra/http/plugins/on-response.plugin'

import type { FastifyInstance } from 'fastify'

type RequestLike = {
  url: string
  method: string
  hasError?: boolean
  body?: unknown
  responseBody?: unknown
  logModel?: { logStep: (...args: unknown[]) => void }
}

describe('onResponse plugin', () => {
  it('logs response details with and without statusCode', () => {
    const addHook = vi.fn()
    const fastify = { addHook } as unknown as FastifyInstance

    onResponse(fastify, {}, () => {})

    const hook = addHook.mock.calls[0][1]
    const logStep = vi.fn()

    const cases = [
      { reply: { statusCode: 200 }, expectedCode: '200' },
      { reply: {}, expectedCode: '0' },
    ]

    for (const { reply, expectedCode } of cases) {
      const request: RequestLike = {
        url: '/health',
        method: 'GET',
        body: { ok: true },
        responseBody: { ok: true },
        logModel: { logStep },
      }

      hook(request, reply, () => {})
      const [message, payload] = logStep.mock.calls.at(-1) as unknown as [
        string,
        Record<string, unknown>,
      ]

      expect(message).toBe('Request completed')
      expect(payload).toMatchObject({
        activity_name: 'request-completed',
        endpoint: '/health',
        method: 'GET',
        result_code: expectedCode,
      })
    }
  })

  it('logs error response details when request has error', () => {
    const addHook = vi.fn()
    const fastify = { addHook } as unknown as FastifyInstance
    const done = vi.fn()

    onResponse(fastify, {}, done)

    const hook = addHook.mock.calls[0][1]
    const hookDone = vi.fn()
    const logStep = vi.fn()
    const cases = [
      { reply: { statusCode: 500 }, expectedCode: '500' },
      { reply: {}, expectedCode: '0' },
    ]

    for (const { reply, expectedCode } of cases) {
      const request: RequestLike = {
        hasError: true,
        url: '/products',
        method: 'POST',
        body: { sku: 'sku-1' },
        responseBody: { message: 'failed' },
        logModel: { logStep },
      }

      hook(request, reply, hookDone)
      expect(logStep).toHaveBeenLastCalledWith('Request completed with error', {
        activity_name: 'request-error',
        endpoint: '/products',
        method: 'POST',
        step_request: { sku: 'sku-1' },
        step_response: { message: 'failed' },
        result_code: expectedCode,
      })
    }

    expect(done).toHaveBeenCalledOnce()
    expect(hookDone).toHaveBeenCalledTimes(cases.length)
  })

  it('finishes hook when log model is missing', () => {
    const addHook = vi.fn()
    const fastify = { addHook } as unknown as FastifyInstance

    onResponse(fastify, {}, () => {})

    const hook = addHook.mock.calls[0][1]
    const hookDone = vi.fn()

    hook({ url: '/health', method: 'GET' }, { statusCode: 204 }, hookDone)

    expect(hookDone).toHaveBeenCalledOnce()
  })
})
