import { timingSafeEqual } from 'node:crypto'

import { jsonSchemaTransform } from 'fastify-type-provider-zod'

import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger'
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui'
import type { onRequestHookHandler } from 'fastify'

type SwaggerAuthConfig = {
  username?: string
  password?: string
}

type BasicAuthCredentials = {
  username: string
  password: string
}

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Template XYZ Service',
      description: 'Template API documentation for health, metrics, and ping endpoints.',
      version: '1.0.0',
    },
    servers: [
      {
        url: '/xyz',
        description: 'Application base path',
      },
    ],
  },
  transform: jsonSchemaTransform,
}

function safeCompare(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  if (valueBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(valueBuffer, expectedBuffer)
}

function parseBasicAuthHeader(authorization?: string): BasicAuthCredentials | undefined {
  if (!authorization?.startsWith('Basic ')) return undefined

  const encoded = authorization.slice('Basic '.length)
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const separatorIndex = decoded.indexOf(':')

  if (separatorIndex < 0) return undefined

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  }
}

function createSwaggerAuthHook(config: Required<SwaggerAuthConfig>): onRequestHookHandler {
  return (request, reply, done) => {
    const credentials = parseBasicAuthHeader(request.headers.authorization)
    const isAuthorized =
      credentials !== undefined &&
      safeCompare(credentials.username, config.username) &&
      safeCompare(credentials.password, config.password)

    if (isAuthorized) {
      done()
      return
    }

    reply
      .header('WWW-Authenticate', 'Basic realm="Swagger Documentation"')
      .status(401)
      .send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          timestamp: new Date().toISOString(),
        },
      })
  }
}

export function createSwaggerUiOptions(config: SwaggerAuthConfig = {}): FastifySwaggerUiOptions {
  const options: FastifySwaggerUiOptions = {
    routePrefix: '/xyz/docs',
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  }

  if (config.username && config.password) {
    options.uiHooks = {
      onRequest: createSwaggerAuthHook({
        username: config.username,
        password: config.password,
      }),
    }
  }

  return options
}

export const swaggerUiOptions = createSwaggerUiOptions()
