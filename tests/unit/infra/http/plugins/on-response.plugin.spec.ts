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

function setupHook(done: () => void = () => {}) {
  const addHook = vi.fn()
  const fastify = { addHook } as unknown as FastifyInstance

  onResponse(fastify, {}, done)

  return addHook.mock.calls[0][1]
}

describe('onResponse plugin', () => {
  it('logs response details with and without statusCode', () => {
    const hook = setupHook()
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
    const done = vi.fn()
    const hook = setupHook(done)
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

  it('uses ApiResponse error message as error result description', () => {
    const hook = setupHook()
    const logStep = vi.fn()
    const request: RequestLike = {
      hasError: true,
      url: '/products',
      method: 'POST',
      responseBody: {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product was not found',
        },
      },
      logModel: { logStep },
    }

    hook(request, { statusCode: 404 }, () => {})

    expect(logStep).toHaveBeenCalledWith('Request completed with error', {
      activity_name: 'request-error',
      endpoint: '/products',
      method: 'POST',
      step_request: undefined,
      step_response: {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product was not found',
        },
      },
      result_code: '404',
      result_desc: 'Product was not found',
    })
  })

  it('uses JSON string ApiResponse error message as error result description', () => {
    const hook = setupHook()
    const logStep = vi.fn()
    const request: RequestLike = {
      hasError: true,
      url: '/products',
      method: 'POST',
      responseBody: '{"success":false,"error":{"message":"failed"}}',
      logModel: { logStep },
    }

    hook(request, { statusCode: 500 }, () => {})

    const [, payload] = logStep.mock.calls[0] as [string, Record<string, unknown>]

    expect(payload).toMatchObject({
      result_desc: 'failed',
      step_response: '{"success":false,"error":{"message":"failed"}}',
    })
  })

  it('does not use successful ApiResponse as error result description', () => {
    const hook = setupHook()
    const logStep = vi.fn()
    const request: RequestLike = {
      hasError: true,
      url: '/products',
      method: 'POST',
      responseBody: { success: true },
      logModel: { logStep },
    }

    hook(request, { statusCode: 500 }, () => {})

    const [, payload] = logStep.mock.calls[0] as [string, Record<string, unknown>]

    expect(payload).not.toHaveProperty('result_desc')
  })

  it('does not use invalid string response body as error result description', () => {
    const hook = setupHook()
    const logStep = vi.fn()
    const request: RequestLike = {
      hasError: true,
      url: '/products',
      method: 'POST',
      responseBody: 'failed',
      logModel: { logStep },
    }

    hook(request, { statusCode: 500 }, () => {})

    const [, payload] = logStep.mock.calls[0] as [string, Record<string, unknown>]

    expect(payload).not.toHaveProperty('result_desc')
  })

  it('finishes hook when log model is missing', () => {
    const hook = setupHook()
    const hookDone = vi.fn()

    hook({ url: '/health', method: 'GET' }, { statusCode: 204 }, hookDone)

    expect(hookDone).toHaveBeenCalledOnce()
  })
})
