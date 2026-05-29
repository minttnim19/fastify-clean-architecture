import { HealthzRouteSchema } from '@/infra/http/schemas/healthz.schemas'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function healthzRoutes(fastify: FastifyInstance): void {
  const handler = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    })
  }

  fastify.get('/', { schema: HealthzRouteSchema }, handler)
  fastify.get('/healthz', { schema: HealthzRouteSchema }, handler)
}
