import { AxiosError } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { DomainError } from '@/domain/errors/domain.errors'
import { errorHandler } from '@/infra/http/plugins/error-handler.plugin'

import type { FastifyInstance } from 'fastify'

type ReplyMock = {
  status: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

const makeReply = (): ReplyMock => {
  const reply: ReplyMock = {
    status: vi.fn(),
    send: vi.fn(),
  }
  reply.status.mockReturnValue(reply)
  return reply
}

describe('error-handler plugin', () => {
  const setup = (): {
    handler: (err: unknown, req: unknown, reply: ReplyMock) => void
    notFound: (req: unknown, reply: ReplyMock) => void
  } => {
    const setErrorHandler = vi.fn()
    const setNotFoundHandler = vi.fn()
    const fastify = {
      setErrorHandler,
      setNotFoundHandler,
    } as unknown as FastifyInstance

    errorHandler(fastify, {}, () => {})

    const handler = setErrorHandler.mock.calls[0][0]
    const notFound = setNotFoundHandler.mock.calls[0][0]
    return { handler, notFound }
  }

  it('handles DomainError', () => {
    const { handler } = setup()
    const reply = makeReply()

    handler(new DomainError('boom', 'E_BANG', 418), {}, reply)

    expect(reply.status).toHaveBeenCalledWith(418)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.code).toBe('E_BANG')
    expect(payload.error.message).toBe('boom')
  })

  it('handles AxiosError variants', () => {
    const { handler } = setup()

    const cases = [
      {
        error: (): AxiosError => {
          const e = new AxiosError('timeout', 'ECONNABORTED') as AxiosError & {
            isAxiosError?: boolean
          }
          e.isAxiosError = true
          e.response = { status: 504 } as AxiosError['response']
          return e
        },
        status: 504,
        code: 'UPSTREAM_TIMEOUT',
      },
      {
        error: (): AxiosError => {
          const e = new AxiosError('bad') as AxiosError & { isAxiosError?: boolean }
          e.isAxiosError = true
          return e
        },
        status: 502,
        code: 'UPSTREAM_ERROR',
      },
    ]

    for (const { error, status, code } of cases) {
      const reply = makeReply()
      handler(error(), {}, reply)
      expect(reply.status).toHaveBeenCalledWith(status)
      const payload = reply.send.mock.calls[0][0]
      expect(payload.error.code).toBe(code)
    }
  })

  it('handles ZodError variants', () => {
    const { handler } = setup()

    const cases = [
      {
        build: (): z.ZodError | undefined => {
          try {
            z.object({ name: z.string() }).parse({ name: 1 })
          } catch (err) {
            return err as z.ZodError
          }
        },
        field: 'name',
      },
      {
        build: (): z.ZodError | undefined => {
          try {
            z.string().parse(1)
          } catch (err) {
            return err as z.ZodError
          }
        },
        field: 'unknown',
      },
    ]

    for (const { build, field } of cases) {
      const reply = makeReply()
      const zodError = build()
      if (!zodError) throw new Error('Expected zod error')

      handler(zodError, {}, reply)

      expect(reply.status).toHaveBeenCalledWith(422)
      const payload = reply.send.mock.calls[0][0]
      expect(payload.error.code).toBe('VALIDATION_ERROR')
      expect(payload.error.details[0].field).toBe(field)
    }
  })

  it('handles Fastify validation errors', () => {
    const { handler } = setup()
    const reply = makeReply()
    const error = {
      message: 'Bad Request',
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      validationContext: 'querystring',
      validation: [
        {
          instancePath: '/field',
          keyword: 'required',
          message: 'Required',
        },
      ],
    }

    handler(error, {}, reply)

    expect(reply.status).toHaveBeenCalledWith(422)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.details[0].field).toBe('field')
  })

  it('formats missing required headers inside message for Fastify header validation errors', () => {
    const { handler } = setup()
    const reply = makeReply()
    const error = {
      message: 'Bad Request',
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      validationContext: 'headers',
      validation: [
        {
          instancePath: '/x-channel',
          keyword: 'invalid_type',
          message: 'Invalid input',
        },
        {
          instancePath: '/x-correlator-id',
          keyword: 'invalid_type',
          message: 'Invalid input',
        },
      ],
    }

    handler(error, {}, reply)

    expect(reply.status).toHaveBeenCalledWith(400)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.code).toBe('MISSING_REQUIRED_HEADERS')
    expect(payload.error.message).toBe('Missing required headers: x-channel, x-correlator-id')
    expect(payload.error.details).toBeUndefined()
  })

  it('handles Fastify non-validation errors', () => {
    const { handler } = setup()

    const cases = [
      {
        error: { message: 'Not found', code: 'FST_ERR_NOT_FOUND' },
        status: 500,
        code: 'NOT_FOUND',
      },
      {
        error: { message: 'Teapot', statusCode: 418 },
        status: 418,
        code: 'INTERNAL_ERROR',
      },
    ]

    for (const { error, status, code } of cases) {
      const reply = makeReply()
      handler(error, {}, reply)
      expect(reply.status).toHaveBeenCalledWith(status)
      const payload = reply.send.mock.calls[0][0]
      expect(payload.error.code).toBe(code)
    }
  })

  it('maps HTTP status codes and nullish messages for non-validation errors', () => {
    const { handler } = setup()

    const cases = [
      { error: { message: 'Bad request', statusCode: 400 }, status: 400, code: 'BAD_REQUEST' },
      { error: { message: 'Unauthorized', statusCode: 401 }, status: 401, code: 'UNAUTHORIZED' },
      { error: { message: 'Forbidden', statusCode: 403 }, status: 403, code: 'FORBIDDEN' },
      { error: { message: 'Conflict', statusCode: 409 }, status: 409, code: 'CONFLICT' },
      {
        error: { message: 'Too many requests', statusCode: 429 },
        status: 429,
        code: 'RATE_LIMITED',
      },
      { error: { message: undefined, statusCode: 500 }, status: 500, code: 'INTERNAL_ERROR' },
    ]

    for (const { error, status, code } of cases) {
      const reply = makeReply()
      handler(error, {}, reply)

      expect(reply.status).toHaveBeenCalledWith(status)
      const payload = reply.send.mock.calls[0][0]
      expect(payload.error.code).toBe(code)
      expect(payload.error.message).toBe(error.message ?? 'An unexpected error occurred')
    }
  })

  it('uses missingProperty for validation field when instancePath is empty', () => {
    const { handler } = setup()
    const reply = makeReply()
    const error = {
      message: 'Bad Request',
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      validationContext: 'params',
      validation: [
        {
          instancePath: '',
          keyword: 'required',
          message: 'Required',
          params: { missingProperty: 'name' },
        },
      ],
    }

    handler(error, {}, reply)

    expect(reply.status).toHaveBeenCalledWith(422)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.details[0].field).toBe('name')
  })

  it('falls back to unknown field when validation has no path or missingProperty', () => {
    const { handler } = setup()
    const reply = makeReply()
    const error = {
      message: 'Bad Request',
      code: 'FST_ERR_VALIDATION',
      statusCode: 400,
      validationContext: 'body',
      validation: [
        {
          instancePath: '',
          keyword: 'required',
          message: 'Required',
          params: {},
        },
      ],
    }

    handler(error, {}, reply)

    expect(reply.status).toHaveBeenCalledWith(422)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.details[0].field).toBe('unknown')
  })

  it('uses default message when error message is empty', () => {
    const { handler } = setup()
    const reply = makeReply()
    const error = {
      message: '',
    }

    handler(error, {}, reply)

    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.message).toBe('An unexpected error occurred')
  })

  it('handles not found route', () => {
    const { notFound } = setup()
    const reply = makeReply()

    notFound({}, reply)

    expect(reply.status).toHaveBeenCalledWith(404)
    const payload = reply.send.mock.calls[0][0]
    expect(payload.error.code).toBe('NOT_FOUND')
  })
})
