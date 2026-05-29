import { describe, expect, it, vi } from 'vitest'

import { redis } from '@/infra/database/redis/client'

const createRedisClient = vi.fn().mockReturnValue({ tag: 'redis-client' })

vi.mock('@/infra/database/redis/redis-client', () => ({
  createRedisClient: () => createRedisClient(),
}))

const register = vi.fn().mockResolvedValue(undefined)

vi.mock('@fastify/redis', () => ({
  default: { name: 'fastify-redis-mock' },
}))

type FastifyLike = { register: ReturnType<typeof vi.fn> }

describe('redis plugin', () => {
  it('registers fastify-redis with created client', async () => {
    const fastify: FastifyLike = { register }

    await redis(fastify as unknown as Parameters<typeof redis>[0])

    expect(createRedisClient).toHaveBeenCalled()
    expect(register).toHaveBeenCalledWith(
      { name: 'fastify-redis-mock' },
      {
        client: { tag: 'redis-client' },
        closeClient: true,
      },
    )
  })
})
