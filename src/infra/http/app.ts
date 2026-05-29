import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

import { env } from '@/infra/config/env'
import { redis } from '@/infra/database/redis/client'
import { createSwaggerUiOptions, swaggerOptions } from '@/infra/http/docs/swagger'
import { errorHandler } from '@/infra/http/plugins/error-handler.plugin'
import { metrics } from '@/infra/http/plugins/metrics.plugin'
import { onError } from '@/infra/http/plugins/on-error.plugin'
import { onRequest } from '@/infra/http/plugins/on-request.plugin'
import { onResponse } from '@/infra/http/plugins/on-response.plugin'
import { onSend } from '@/infra/http/plugins/on-send.plugin'
import { healthzRoutes } from '@/infra/http/routes/healthz.routes'
import { metricsRoutes } from '@/infra/http/routes/metrics.routes'
import { pingRoutes } from '@/infra/http/routes/ping.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: env.TRUST_PROXY,
    ajv: {
      customOptions: { coerceTypes: true, useDefaults: true },
    },
  })

  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)

  if (env.NODE_ENV === 'development' && env.SWAGGER_ENABLED) {
    await fastify.register(swagger, swaggerOptions)
    await fastify.register(
      swaggerUi,
      createSwaggerUiOptions({
        username: env.SWAGGER_USERNAME,
        password: env.SWAGGER_PASSWORD,
      }),
    )
  }

  await fastify.register(helmet)
  await fastify.register(cors, { origin: env.CORS_ORIGIN })
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  })

  await fastify.register(redis)
  await fastify.register(metrics)

  await fastify.register(onRequest)
  await fastify.register(onSend)
  await fastify.register(onResponse)
  await fastify.register(onError)
  await fastify.register(errorHandler)

  await fastify.register(
    async (api) => {
      await api.register(metricsRoutes)
      await api.register(healthzRoutes)
      await api.register(pingRoutes)
    },
    { prefix: '/xyz' },
  )

  return fastify
}
