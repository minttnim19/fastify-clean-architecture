import { AxiosError } from 'axios'
import fp from 'fastify-plugin'
import { ZodError } from 'zod'

import { DomainError } from '@/domain/errors/domain.errors'
import { normalizeValidationError } from '@/infra/http/utils/validation-error'

import type { ApiResponse } from '@/shared/types'
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const FASTIFY_ERROR_MAP: Record<string, string> = {
  FST_ERR_VALIDATION: 'VALIDATION_ERROR',
  FST_ERR_NOT_FOUND: 'NOT_FOUND',
}

const HTTP_ERROR_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
}

function resolveErrorCode(error: FastifyError): { code: string; status: number } {
  if (error.code && FASTIFY_ERROR_MAP[error.code]) {
    const status = error.statusCode ?? 500
    return { code: FASTIFY_ERROR_MAP[error.code], status }
  }
  const status = error.statusCode ?? 500
  return { code: HTTP_ERROR_MAP[status] ?? 'INTERNAL_ERROR', status }
}

function parseZodDetails(
  error: ZodError,
): Array<{ field: string; issue: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    issue: issue.code,
    message: issue.message,
  }))
}

function getErrorMessage(message: string | undefined): string {
  return message === ''
    ? 'An unexpected error occurred'
    : (message ?? 'An unexpected error occurred')
}

function errorHandlerPlugin(fastify: FastifyInstance, _opts: object, done: () => void): void {
  fastify.setErrorHandler(
    (
      error: FastifyError | DomainError | Error | AxiosError,
      _request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      if (error instanceof DomainError) {
        const payload: ApiResponse<never> = {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        }
        return reply.status(error.statusCode).send(payload)
      }

      if (error instanceof AxiosError && error.isAxiosError) {
        const status = error.response?.status ?? 502
        const message = error.message
        const code =
          status === 408 || status === 504 || error.code === 'ECONNABORTED'
            ? 'UPSTREAM_TIMEOUT'
            : 'UPSTREAM_ERROR'

        const payload: ApiResponse<never> = {
          success: false,
          error: {
            code,
            message,
            timestamp: new Date().toISOString(),
          },
        }
        return reply.status(status).send(payload)
      }

      if (error instanceof ZodError) {
        const details = parseZodDetails(error)
        const payload: ApiResponse<never> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            timestamp: new Date().toISOString(),
            details,
          },
        }
        return reply.status(422).send(payload)
      }

      const fastifyError = error as FastifyError
      const { code, status } = resolveErrorCode(fastifyError)
      const validationError = normalizeValidationError(fastifyError)

      const payload: ApiResponse<never> = {
        success: false,
        error: {
          code: validationError?.code ?? code,
          message: validationError?.message ?? getErrorMessage(error.message),
          timestamp: new Date().toISOString(),
          ...(validationError?.details && { details: validationError.details }),
        },
      }
      return reply.status(validationError?.status ?? status).send(payload)
    },
  )

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const payload: ApiResponse<never> = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        timestamp: new Date().toISOString(),
      },
    }
    return reply.status(404).send(payload)
  })

  done()
}

export const errorHandler = fp(errorHandlerPlugin, { name: 'error-handler' })
