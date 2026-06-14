import fp from 'fastify-plugin'

import { parseJson } from '@/shared/utils/json'
import { getBooleanField, isRecord } from '@/shared/utils/object'

import type { ApiResponse } from '@/shared/types'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!isRecord(value) || getBooleanField(value, 'success') === undefined) {
    return false
  }

  if (value.error === undefined) {
    return true
  }

  return isRecord(value.error) && typeof value.error.message === 'string'
}

function getApiErrorMessage(value: unknown): string | undefined {
  const response = typeof value === 'string' ? parseJson(value) : value

  if (!isApiResponse(response)) {
    return undefined
  }

  return response.error?.message
}

function onResponsePlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, hookDone) => {
    if (request.hasError) {
      const resultDesc = getApiErrorMessage(request.responseBody)

      request.logModel?.logStep('Request completed with error', {
        activity_name: 'request-error',
        endpoint: request.url,
        method: request.method,
        step_request: request.body,

        step_response: request.responseBody,
        result_code: String(reply.statusCode || 0),
        ...(resultDesc ? { result_desc: resultDesc } : {}),
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
