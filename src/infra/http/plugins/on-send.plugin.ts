import fp from 'fastify-plugin'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

function onSendPlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook(
    'onSend',
    (request: FastifyRequest, _reply: FastifyReply, payload: unknown, hookDone) => {
      request.responseBody = payload
      hookDone()
    },
  )

  done()
}

export const onSend = fp(onSendPlugin, { name: 'on-send' })
