import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function metricsRoutes(fastify: FastifyInstance): void {
  fastify.get(
    '/metrics',
    { schema: { hide: true } },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('Content-Type', fastify.metricsRegistry.contentType)
      return reply.send(await fastify.metricsRegistry.metrics())
    },
  )
}
