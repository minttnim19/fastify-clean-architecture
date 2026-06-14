import { describe, expect, it, vi } from 'vitest'

import { onError } from '@/infra/http/plugins/on-error.plugin'

import type { FastifyInstance } from 'fastify'

type RequestLike = {
  hasError?: boolean
  responseError?: Error
  logModel?: { logStep: (...args: unknown[]) => void }
}

describe('onError plugin', () => {
  it('stores error details without writing a step log', () => {
    const addHook = vi.fn()
    const fastify = {
      addHook,
    } as unknown as FastifyInstance

    onError(fastify, {}, () => {})

    const hook = addHook.mock.calls[0][1]
    const logStep = vi.fn()
    const request: RequestLike = {
      logModel: { logStep },
    }
    const error = new Error('boom')

    hook(request, {}, error, () => {})

    expect(request.hasError).toBe(true)
    expect(request.responseError).toBe(error)
    expect(logStep).not.toHaveBeenCalled()
  })
})
