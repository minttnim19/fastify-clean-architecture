import { beforeEach, describe, expect, it, vi } from 'vitest'

const fastifyFactoryMock = vi.hoisted(() => vi.fn())
const envMock = vi.hoisted(() => ({
  NODE_ENV: 'development',
  TRUST_PROXY: true,
  CORS_ORIGIN: 'https://example.com',
  RATE_LIMIT_MAX: 100,
  SWAGGER_ENABLED: true,
  SWAGGER_USERNAME: 'swagger',
  SWAGGER_PASSWORD: 'secret',
}))
const createSwaggerUiOptionsMock = vi.hoisted(() => vi.fn(() => ({ __name: 'swagger-ui-options' })))

const swaggerPlugin = vi.hoisted(() => ({ __name: 'swagger' }))
const swaggerUiPlugin = vi.hoisted(() => ({ __name: 'swagger-ui' }))
const helmetPlugin = vi.hoisted(() => ({ __name: 'helmet' }))
const corsPlugin = vi.hoisted(() => ({ __name: 'cors' }))
const rateLimitPlugin = vi.hoisted(() => ({ __name: 'rate-limit' }))
const redisPlugin = vi.hoisted(() => ({ __name: 'redis-plugin' }))

const onRequestPlugin = vi.hoisted(() => ({ __name: 'on-request' }))
const onSendPlugin = vi.hoisted(() => ({ __name: 'on-send' }))
const onResponsePlugin = vi.hoisted(() => ({ __name: 'on-response' }))
const onErrorPlugin = vi.hoisted(() => ({ __name: 'on-error' }))
const errorHandlerPlugin = vi.hoisted(() => ({ __name: 'error-handler' }))
const metricsPlugin = vi.hoisted(() => ({ __name: 'metrics-plugin' }))

const healthzRoutesMock = vi.hoisted(() => ({ __name: 'healthz-routes' }))
const metricsRoutesMock = vi.hoisted(() => ({ __name: 'metrics-routes' }))
const pingRoutesMock = vi.hoisted(() => ({ __name: 'ping-routes' }))

vi.mock('fastify', () => ({
  default: fastifyFactoryMock,
}))

vi.mock('@fastify/swagger', () => ({
  default: swaggerPlugin,
}))

vi.mock('@fastify/swagger-ui', () => ({
  default: swaggerUiPlugin,
}))

vi.mock('@fastify/helmet', () => ({
  default: helmetPlugin,
}))

vi.mock('@fastify/cors', () => ({
  default: corsPlugin,
}))

vi.mock('@fastify/rate-limit', () => ({
  default: rateLimitPlugin,
}))

vi.mock('fastify-type-provider-zod', () => ({
  serializerCompiler: { __name: 'serializer-compiler' },
  validatorCompiler: { __name: 'validator-compiler' },
}))

vi.mock('@/infra/config/env', () => ({
  env: envMock,
}))

vi.mock('@/infra/database/redis/client', () => ({
  redis: redisPlugin,
}))

vi.mock('@/infra/http/docs/swagger', () => ({
  swaggerOptions: { __name: 'swagger-options' },
  createSwaggerUiOptions: createSwaggerUiOptionsMock,
}))

vi.mock('@/infra/http/plugins/error-handler.plugin', () => ({
  errorHandler: errorHandlerPlugin,
}))

vi.mock('@/infra/http/plugins/metrics.plugin', () => ({
  metrics: metricsPlugin,
}))

vi.mock('@/infra/http/plugins/on-error.plugin', () => ({
  onError: onErrorPlugin,
}))

vi.mock('@/infra/http/plugins/on-request.plugin', () => ({
  onRequest: onRequestPlugin,
}))

vi.mock('@/infra/http/plugins/on-response.plugin', () => ({
  onResponse: onResponsePlugin,
}))

vi.mock('@/infra/http/plugins/on-send.plugin', () => ({
  onSend: onSendPlugin,
}))

vi.mock('@/infra/http/routes/healthz.routes', () => ({
  healthzRoutes: healthzRoutesMock,
}))

vi.mock('@/infra/http/routes/metrics.routes', () => ({
  metricsRoutes: metricsRoutesMock,
}))

vi.mock('@/infra/http/routes/ping.routes', () => ({
  pingRoutes: pingRoutesMock,
}))

describe('buildApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    envMock.NODE_ENV = 'development'
    envMock.TRUST_PROXY = true
    envMock.CORS_ORIGIN = 'https://example.com'
    envMock.RATE_LIMIT_MAX = 100
    envMock.SWAGGER_ENABLED = true
    envMock.SWAGGER_USERNAME = 'swagger'
    envMock.SWAGGER_PASSWORD = 'secret'
  })

  it('registers plugins and application routes', async () => {
    const apiRegister = vi.fn().mockResolvedValue(undefined)

    const fastify = {
      setValidatorCompiler: vi.fn(),
      setSerializerCompiler: vi.fn(),
      register: vi.fn(async (plugin: unknown, options?: { prefix?: string }) => {
        if (options?.prefix === '/xyz' && typeof plugin === 'function') {
          await plugin({ register: apiRegister })
        }
        return fastify
      }),
    }

    fastifyFactoryMock.mockReturnValue(fastify)

    const { buildApp } = await import('@/infra/http/app.js')
    const app = await buildApp()

    expect(app).toBe(fastify)
    expect(fastifyFactoryMock).toHaveBeenCalledWith({
      trustProxy: true,
      ajv: {
        customOptions: { coerceTypes: true, useDefaults: true },
      },
    })
    expect(fastify.setValidatorCompiler).toHaveBeenCalledOnce()
    expect(fastify.setSerializerCompiler).toHaveBeenCalledOnce()

    expect(fastify.register).toHaveBeenCalledWith(swaggerPlugin, { __name: 'swagger-options' })
    expect(createSwaggerUiOptionsMock).toHaveBeenCalledWith({
      username: 'swagger',
      password: 'secret',
    })
    expect(fastify.register).toHaveBeenCalledWith(swaggerUiPlugin, { __name: 'swagger-ui-options' })
    expect(fastify.register).toHaveBeenCalledWith(helmetPlugin)
    expect(fastify.register).toHaveBeenCalledWith(corsPlugin, { origin: 'https://example.com' })
    expect(fastify.register).toHaveBeenCalledWith(rateLimitPlugin, {
      max: 100,
      timeWindow: '1 minute',
    })
    expect(fastify.register).toHaveBeenCalledWith(redisPlugin)
    expect(fastify.register).toHaveBeenCalledWith(metricsPlugin)
    expect(fastify.register).toHaveBeenCalledWith(onRequestPlugin)
    expect(fastify.register).toHaveBeenCalledWith(onSendPlugin)
    expect(fastify.register).toHaveBeenCalledWith(onResponsePlugin)
    expect(fastify.register).toHaveBeenCalledWith(onErrorPlugin)
    expect(fastify.register).toHaveBeenCalledWith(errorHandlerPlugin)

    expect(apiRegister).toHaveBeenCalledWith(metricsRoutesMock)
    expect(apiRegister).toHaveBeenCalledWith(healthzRoutesMock)
    expect(apiRegister).toHaveBeenCalledWith(pingRoutesMock)
    expect(apiRegister).toHaveBeenCalledTimes(3)
  })

  it.each([
    { nodeEnv: 'production', swaggerEnabled: true },
    { nodeEnv: 'development', swaggerEnabled: false },
  ])('does not register swagger plugins for %o', async ({ nodeEnv, swaggerEnabled }) => {
    const fastify = {
      setValidatorCompiler: vi.fn(),
      setSerializerCompiler: vi.fn(),
      register: vi.fn(() => Promise.resolve(fastify)),
    }

    fastifyFactoryMock.mockReturnValue(fastify)
    envMock.NODE_ENV = nodeEnv
    envMock.SWAGGER_ENABLED = swaggerEnabled

    const { buildApp } = await import('@/infra/http/app.js')
    await buildApp()

    expect(fastify.register).not.toHaveBeenCalledWith(swaggerPlugin, expect.anything())
    expect(fastify.register).not.toHaveBeenCalledWith(swaggerUiPlugin, expect.anything())
    expect(createSwaggerUiOptionsMock).not.toHaveBeenCalled()
  })
})
