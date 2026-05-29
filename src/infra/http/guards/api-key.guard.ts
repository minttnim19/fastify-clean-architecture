import { UnauthorizedError } from '@/domain/errors/domain.errors'
import { env } from '@/infra/config/env'

import type { FastifyRequest } from 'fastify'

export function validateApiKey(request: FastifyRequest): Promise<void> {
  if (env.X_API_KEY.length > 0 && request.headers['x-api-key'] !== env.X_API_KEY) {
    throw new UnauthorizedError('A valid x-api-key header is required')
  }
  return Promise.resolve()
}
