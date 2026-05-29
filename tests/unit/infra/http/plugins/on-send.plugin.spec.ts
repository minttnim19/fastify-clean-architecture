import { describe, expect, it, vi } from 'vitest'

import { onSend } from '@/infra/http/plugins/on-send.plugin'

import type { FastifyInstance } from 'fastify'

type RequestLike = { responseBody?: unknown }

describe('onSend plugin', () => {
  it('stores payload on request.responseBody', () => {
    const addHook = vi.fn()
    const fastify = { addHook } as unknown as FastifyInstance

    onSend(fastify, {}, () => {})

    const hook = addHook.mock.calls[0][1]
    const request: RequestLike = {}
    const payload = { ok: true }

    hook(request, {}, payload, () => {})

    expect(request.responseBody).toEqual(payload)
  })
})
