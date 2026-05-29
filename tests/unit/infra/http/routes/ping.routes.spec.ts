import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pingRoutes } from '@/infra/http/routes/ping.routes'
import { PingRouteSchema } from '@/infra/http/schemas/ping.schemas'

import type { FastifyInstance } from 'fastify'

const executeMock = vi.hoisted(() => vi.fn())

vi.mock('@/application/use-cases/ping.use-case', () => ({
  PingUseCase: class {
    execute = executeMock
  },
}))

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

describe('ping routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeMock.mockReset()
  })

  it('registers ping route with schema and returns pong', async () => {
    const routes: RegisteredRoute[] = []
    const get = vi.fn((path, options, handler) => {
      routes.push({ path, options, handler })
    })
    const fastify = { get } as unknown as FastifyInstance

    pingRoutes(fastify)

    expect(get).toHaveBeenCalledWith(
      '/ping',
      expect.objectContaining({ schema: PingRouteSchema }),
      expect.any(Function),
    )

    const reply = createReply()
    executeMock.mockReturnValue({ message: 'pong' })

    await routes[0]?.handler({}, reply)

    expect(executeMock).toHaveBeenCalledOnce()
    expect(reply.send).toHaveBeenCalledWith({ message: 'pong' })
  })
})
