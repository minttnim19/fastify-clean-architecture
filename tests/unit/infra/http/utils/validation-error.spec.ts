import { describe, expect, it } from 'vitest'

import { normalizeValidationError } from '@/infra/http/utils/validation-error'

import type { FastifyError } from 'fastify'

describe('normalizeValidationError', () => {
  it('returns undefined when error has no validation payload', () => {
    expect(normalizeValidationError({} as FastifyError)).toBeUndefined()
  })

  it('normalizes missing required headers into bad request', () => {
    const error = {
      validation: [
        {
          instancePath: '/x-correlator-id',
          keyword: 'required',
          message: 'is required',
        },
        {
          instancePath: '/x-channel',
          keyword: 'required',
          message: 'is required',
        },
      ],
    } as unknown as FastifyError

    expect(normalizeValidationError(error)).toEqual({
      code: 'MISSING_REQUIRED_HEADERS',
      message: 'Missing required headers: x-correlator-id, x-channel',
      status: 400,
    })
  })

  it('uses missingProperty when instancePath is not present', () => {
    const error = {
      validation: [
        {
          params: { missingProperty: 'x-correlator-id' },
          keyword: 'required',
          message: 'is required',
        },
      ],
    } as unknown as FastifyError

    expect(normalizeValidationError(error)).toEqual({
      code: 'MISSING_REQUIRED_HEADERS',
      message: 'Missing required header: x-correlator-id',
      status: 400,
    })
  })

  it('returns validation error with 422 for body/query/params context', () => {
    for (const validationContext of ['body', 'querystring', 'params'] as const) {
      const error = {
        validationContext,
        validation: [
          {
            instancePath: '/key',
            keyword: 'invalid_type',
            message: 'Invalid input: expected string, received undefined',
          },
        ],
      } as unknown as FastifyError

      expect(normalizeValidationError(error)).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        status: 422,
        details: [
          {
            field: 'key',
            issue: 'invalid_type',
            message: 'Invalid input: expected string, received undefined',
          },
        ],
      })
    }
  })

  it('falls back to error status code and unknown field when validation metadata is sparse', () => {
    const error = {
      statusCode: 409,
      validationContext: 'headers',
      validation: [
        {
          keyword: undefined,
          message: undefined,
          params: {},
        },
      ],
    } as unknown as FastifyError

    expect(normalizeValidationError(error)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      status: 409,
      details: [
        {
          field: 'unknown',
          issue: undefined,
          message: undefined,
        },
      ],
    })
  })

  it('falls back to 400 and empty details when validation array is empty', () => {
    const error = {
      validationContext: 'headers',
      validation: [],
    } as unknown as FastifyError

    expect(normalizeValidationError(error)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      status: 400,
      details: [],
    })
  })
})
