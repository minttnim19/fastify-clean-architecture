import fp from 'fastify-plugin'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

function onResponsePlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, hookDone) => {
    if (request.hasError) {
      request.logModel?.logStep('Request completed with error', {
        activity_name: 'request-error',
        endpoint: request.url,
        method: request.method,
        step_request: request.body,

        step_response: request.responseBody,
        result_code: String(reply.statusCode || 0),
      })
    } else {
      request.logModel?.logStep('Request completed', {
        activity_name: 'request-completed',
        endpoint: request.url,
        method: request.method,
        step_request: request.body,

        step_response: request.responseBody,
        result_code: String(reply.statusCode || 0),
      })
    }
    hookDone()
  })

  done()
}

export const onResponse = fp(onResponsePlugin, { name: 'on-response' })
