import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:crypto', () => ({
  randomUUID: (): string => 'uuid-1',
}))

const envMock = vi.hoisted(() => ({
  SERVICE_TYPE: 'service',
}))

vi.mock('@/infra/config/env', () => ({
  env: envMock,
}))

const createLogModel = vi.hoisted(() => vi.fn(() => ({ logStep: vi.fn() })))
vi.mock('@/infra/logger/col-logger', () => ({
  createLogModel,
}))

import { onRequest } from '@/infra/http/plugins/on-request.plugin'

import type { FastifyInstance } from 'fastify'

describe('onRequest plugin', () => {
  beforeEach(() => {
    envMock.SERVICE_TYPE = 'service'
  })

  it('sets correlator and journey headers with defaults', () => {
    createLogModel.mockClear()
    const fastify = { addHook: vi.fn() }
    onRequest(fastify as unknown as FastifyInstance, {}, () => {})

    const hook = fastify.addHook.mock.calls[0][1]

    const cases = [
      {
        headers: {
          'x-correlator-id': 'corr-1',
          'x-journey': 'journey-1',
        },
        expected: { correlator: 'corr-1', journey: 'journey-1' },
      },
      {
        headers: {},
        expected: { correlator: 'uuid-1', journey: 'service' },
      },
    ]

    for (const { headers, expected } of cases) {
      const reply = { header: vi.fn() }
      const request = { headers, logModel: undefined }

      hook(request, reply, () => {})

      expect(reply.header).toHaveBeenCalledWith('x-correlator-id', expected.correlator)
      expect(reply.header).toHaveBeenCalledWith('x-journey', expected.journey)
      expect(request.logModel).toBeDefined()
    }

    expect(createLogModel).toHaveBeenCalledWith({ txid: 'corr-1', service_type: 'journey-1' })
  })

  it('skips log model for healthz, metrics, and docs endpoints', () => {
    createLogModel.mockClear()
    const fastify = { addHook: vi.fn() }
    onRequest(fastify as unknown as FastifyInstance, {}, () => {})

    const hook = fastify.addHook.mock.calls[0][1]

    const cases = ['/xyz/healthz', '/xyz/metrics', '/xyz/docs', '/xyz/docs/json']

    for (const url of cases) {
      const reply = { header: vi.fn() }
      const request = { headers: {}, url, logModel: undefined }

      hook(request, reply, () => {})
      expect(request.logModel).toBeUndefined()
    }

    expect(createLogModel).not.toHaveBeenCalled()
  })
})
