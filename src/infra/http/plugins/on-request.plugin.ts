import { randomUUID } from 'node:crypto'

import fp from 'fastify-plugin'

import { env } from '@/infra/config/env'
import { requestContext } from '@/infra/http/context/request-context'
import { createLogModel } from '@/infra/logger/col-logger'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const REQUEST_ID_HEADER = 'x-correlator-id'
const CHANNEL_HEADER = 'x-channel'

const parseHeader = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const skipAccessLog = (url: string): boolean => {
  const pathname = new URL(url, 'http://localhost').pathname
  return (
    pathname === '/' ||
    pathname === '/xyz' ||
    pathname === '/xyz/' ||
    pathname === '/xyz/healthz' ||
    pathname === '/xyz/metrics' ||
    pathname.startsWith('/xyz/docs')
  )
}

function onRequestPlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, hookDone) => {
    const correlatorId = parseHeader(request.headers[REQUEST_ID_HEADER]) ?? randomUUID()
    const channel = parseHeader(request.headers[CHANNEL_HEADER]) ?? env.LOG_CHANNEL

    reply.header(REQUEST_ID_HEADER, correlatorId)
    reply.header(CHANNEL_HEADER, channel)

    if (!skipAccessLog(request.url)) {
      request.logModel = createLogModel({ txid: correlatorId, channel })
    }

    requestContext.set({ correlatorId, channel })
    hookDone()
  })

  done()
}

export const onRequest = fp(onRequestPlugin, { name: 'on-request' })
