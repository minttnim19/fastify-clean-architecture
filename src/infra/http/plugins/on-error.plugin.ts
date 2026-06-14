import fp from 'fastify-plugin'

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

function onErrorPlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook(
    'onError',
    (request: FastifyRequest, _reply: FastifyReply, error: FastifyError, hookDone) => {
      request.hasError = true
      request.responseError = error

      hookDone()
    },
  )

  done()
}

export const onError = fp(onErrorPlugin, { name: 'on-error' })
