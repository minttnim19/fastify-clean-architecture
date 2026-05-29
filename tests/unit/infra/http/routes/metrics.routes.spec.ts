import { describe, expect, it, vi } from 'vitest'

import { metricsRoutes } from '@/infra/http/routes/metrics.routes'

import type { FastifyInstance } from 'fastify'

type RegisteredRoute = {
  path: string
  options: { schema: unknown }
  handler: (...args: unknown[]) => unknown
}

describe('metrics routes', () => {
  it('registers the metrics endpoint and returns prometheus text output', async () => {
    const routes: RegisteredRoute[] = []
    const get = vi.fn((path, options, handler) => {
      routes.push({ path, options, handler })
    })
    const fastify = {
      get,
      metricsRegistry: {
        contentType: 'text/plain; version=0.0.4; charset=utf-8',
        metrics: vi.fn().mockResolvedValue('# HELP prebook_http_requests_total test'),
      },
    } as unknown as FastifyInstance

    metricsRoutes(fastify)

    expect(get).toHaveBeenCalledWith(
      '/metrics',
      expect.objectContaining({ schema: { hide: true } }),
      expect.any(Function),
    )

    const metricsRoute = routes.find((route) => route.path === '/metrics')
    expect(metricsRoute).toBeDefined()

    const reply = {
      header: vi.fn(),
      send: vi.fn(),
    }
    reply.header.mockReturnValue(reply)
    reply.send.mockReturnValue(reply)

    await metricsRoute?.handler({}, reply)

    expect(reply.header).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8',
    )
    expect(reply.send).toHaveBeenCalledWith('# HELP prebook_http_requests_total test')
  })
})
