import 'fastify'

import type { LogModel } from '@/infra/logger/col-logger'
import type { Registry } from 'prom-client'

declare module 'fastify' {
  interface FastifyInstance {
    metricsRegistry: Registry
  }

  interface FastifyRequest {
    logModel?: LogModel
    hasError?: boolean
    responseError?: FastifyError
    metricsStartTime?: bigint
    responseBody?: unknown
  }
}
