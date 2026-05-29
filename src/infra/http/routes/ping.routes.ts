import { PingUseCase } from '@/application/use-cases/ping.use-case'
import { PingRouteSchema } from '@/infra/http/schemas/ping.schemas'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function pingRoutes(fastify: FastifyInstance): void {
  const pingUseCase = new PingUseCase()

  fastify.get(
    '/ping',
    { schema: PingRouteSchema },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const data = pingUseCase.execute()

      return reply.send(data)
    },
  )
}
