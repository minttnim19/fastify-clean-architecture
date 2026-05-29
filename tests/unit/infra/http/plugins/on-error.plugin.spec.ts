import { describe, expect, it, vi } from 'vitest'

import { onError } from '@/infra/http/plugins/on-error.plugin'

import type { FastifyInstance } from 'fastify'

type RequestLike = { logModel?: { logStep: (...args: unknown[]) => void } }

describe('onError plugin', () => {
  it('logs error details when logModel exists', () => {
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

    hook(request, {}, new Error('boom'), () => {})

    expect(logStep).toHaveBeenCalledOnce()
    const [message, payload] = logStep.mock.calls[0]
    expect(message).toBe('Request error')
    expect(payload.activity_name).toBe('request-error')
  })
})
