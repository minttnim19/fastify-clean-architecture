import fastifyRedis from '@fastify/redis'
import fp from 'fastify-plugin'

import { createRedisClient } from '@/infra/database/redis/redis-client'

import type { FastifyInstance } from 'fastify'

async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  const client = createRedisClient()

  await fastify.register(fastifyRedis, {
    client,
    closeClient: true,
  })
}

export const redis = fp(redisPlugin, { name: 'redis' })
