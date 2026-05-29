import { describe, expect, it, vi } from 'vitest'

import { healthzRoutes } from '@/infra/http/routes/healthz.routes'
import { HealthzRouteSchema } from '@/infra/http/schemas/healthz.schemas'

import type { FastifyInstance } from 'fastify'

type RegisteredRoute = {
  path: string
  options: { schema: unknown }
  handler: (...args: unknown[]) => unknown
}

const createReply = () => {
  const reply = {
    send: vi.fn(),
  }

  reply.send.mockReturnValue(reply)

  return reply
}

describe('healthz routes', () => {
  it('registers routes with schema and returns health payload', async () => {
    const routes: RegisteredRoute[] = []
    const get = vi.fn((path, options, handler) => {
      routes.push({ path, options, handler })
    })
    const fastify = { get } as unknown as FastifyInstance
    const uptimeSpy = vi.spyOn(process, 'uptime').mockReturnValue(12.34)

    healthzRoutes(fastify)

    expect(get).toHaveBeenNthCalledWith(
      1,
      '/',
      expect.objectContaining({ schema: HealthzRouteSchema }),
      expect.any(Function),
    )
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/healthz',
      expect.objectContaining({ schema: HealthzRouteSchema }),
      expect.any(Function),
    )

    const rootRoute = routes.find((route) => route.path === '/')
    expect(rootRoute).toBeDefined()

    const reply = createReply()
    await rootRoute?.handler({}, reply)

    expect(reply.send).toHaveBeenCalledWith({
      status: 'ok',
      timestamp: expect.any(String),
      uptime: 12.34,
      environment: process.env.NODE_ENV,
    })

    uptimeSpy.mockRestore()
  })
})
