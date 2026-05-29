import fp from 'fastify-plugin'
import { Counter, Histogram, Registry, collectDefaultMetrics, linearBuckets } from 'prom-client'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const APP_BASE_PATH = '/xyz'
const API_ROUTE_PREFIX = '/api/'
const API_PATH_PREFIX = `${APP_BASE_PATH}${API_ROUTE_PREFIX}`
const UNMATCHED_API_ROUTE = '/api/unmatched'

function resolveRouteLabel(request: FastifyRequest): string {
  if (request.routeOptions.url) {
    return request.routeOptions.url
  }

  const pathname = request.url.split('?')[0]
  return pathname.startsWith(API_PATH_PREFIX) ? UNMATCHED_API_ROUTE : pathname
}

function shouldCollectMetrics(route: string): boolean {
  return route.startsWith(API_ROUTE_PREFIX)
}

function metricsPlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  const registry = new Registry()
  collectDefaultMetrics({ register: registry, prefix: 'prebook_' })

  const httpRequestCount = new Counter({
    name: 'prebook_http_requests_total',
    help: 'Total number of HTTP requests handled by Fastify.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  })

  const httpRequestDuration = new Histogram({
    name: 'prebook_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: linearBuckets(0.05, 0.05, 20),
    registers: [registry],
  })

  fastify.decorate('metricsRegistry', registry)

  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, hookDone) => {
    request.metricsStartTime = process.hrtime.bigint()
    hookDone()
  })

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, hookDone) => {
    const route = resolveRouteLabel(request)

    if (shouldCollectMetrics(route)) {
      const statusCode = String(reply.statusCode)
      const startTime = request.metricsStartTime
      const durationNs = startTime === undefined ? 0 : Number(process.hrtime.bigint() - startTime)

      httpRequestCount.inc({
        method: request.method,
        route,
        status_code: statusCode,
      })

      httpRequestDuration.observe(
        {
          method: request.method,
          route,
          status_code: statusCode,
        },
        durationNs / 1_000_000_000,
      )
    }

    hookDone()
  })

  fastify.addHook('onClose', (_instance, hookDone) => {
    registry.clear()
    hookDone()
  })

  done()
}

export const metrics = fp(metricsPlugin, { name: 'metrics' })
