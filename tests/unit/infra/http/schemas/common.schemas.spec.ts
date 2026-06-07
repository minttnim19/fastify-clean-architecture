import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  ApiKeyHeaderSchema,
  ChannelHeaderSchema,
  CorrelatorHeaderSchema,
  CorrelatorWithFilenameHeaderSchema,
  OptionalCorrelatorHeaderSchema,
  RequiredHeadersWithChannelSchema,
  RequiredHeadersSchema,
  UserEmailHeaderSchema,
  createApiEmptySuccessResponseSchema,
  createApiErrorResponseSchema,
  createApiSuccessResponseSchema,
  createMissingHeadersResponseSchema,
  createValidationErrorResponseSchema,
} from '@/infra/http/schemas/common.schemas'

describe('common schemas', () => {
  it('normalizes header values and channel headers', () => {
    expect(ChannelHeaderSchema.parse({ 'x-channel': ['WW', 'TUC'] })).toEqual({
      'x-channel': 'WW',
    })
    expect(CorrelatorHeaderSchema.parse({ 'x-correlator-id': ['correlator-1'] })).toEqual({
      'x-correlator-id': 'correlator-1',
    })
    expect(OptionalCorrelatorHeaderSchema.parse({})).toEqual({})
    expect(ApiKeyHeaderSchema.parse({ 'x-api-key': ['key-1', 'key-2'] })).toEqual({
      'x-api-key': 'key-1',
    })
    expect(
      OptionalCorrelatorHeaderSchema.parse({ 'x-correlator-id': ['correlator-1', 'correlator-2'] }),
    ).toEqual({
      'x-correlator-id': 'correlator-1',
    })
    expect(
      RequiredHeadersSchema.parse({
        'x-channel': 'WW',
        'x-correlator-id': 'correlator-1',
      }),
    ).toEqual({
      'x-channel': 'WW',
      'x-correlator-id': 'correlator-1',
    })
    expect(
      RequiredHeadersWithChannelSchema.parse({
        'x-channel': 'WW',
        'x-correlator-id': 'correlator-1',
      }),
    ).toEqual({
      'x-channel': 'WW',
      'x-correlator-id': 'correlator-1',
    })
    expect(
      CorrelatorWithFilenameHeaderSchema.parse({
        'x-correlator-id': 'correlator-1',
        'x-filename': ['pickup-date.xlsx'],
      }),
    ).toEqual({
      'x-correlator-id': 'correlator-1',
      'x-filename': 'pickup-date.xlsx',
    })
    expect(UserEmailHeaderSchema.parse({ 'x-user-email': ['user@example.com'] })).toEqual({
      'x-user-email': 'user@example.com',
    })
  })

  it('validates success and error response wrappers', () => {
    expect(createApiSuccessResponseSchema(z.string()).parse({ success: true, data: 'ok' })).toEqual(
      {
        success: true,
        data: 'ok',
      },
    )
    expect(createApiEmptySuccessResponseSchema().parse({ success: true })).toEqual({
      success: true,
    })
    expect(
      createApiErrorResponseSchema(z.literal('VALIDATION_ERROR')).parse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          timestamp: '2026-04-19T00:00:00.000Z',
        },
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp: '2026-04-19T00:00:00.000Z',
      },
    })
    expect(
      createApiErrorResponseSchema(
        z.literal('VALIDATION_ERROR'),
        z.array(z.object({ field: z.string() })),
      ).parse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          timestamp: '2026-04-19T00:00:00.000Z',
          details: [{ field: 'key' }],
        },
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp: '2026-04-19T00:00:00.000Z',
        details: [{ field: 'key' }],
      },
    })
  })

  it('validates missing headers error response wrapper', () => {
    const schema = createMissingHeadersResponseSchema({
      success: false,
      error: {
        code: 'MISSING_REQUIRED_HEADERS',
        message: 'Missing required headers',
        timestamp: '2026-04-19T00:00:00.000Z',
      },
    })

    expect(
      schema.parse({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_HEADERS',
          message: 'Missing required headers',
          timestamp: '2026-04-19T00:00:00.000Z',
        },
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'MISSING_REQUIRED_HEADERS',
        message: 'Missing required headers',
        timestamp: '2026-04-19T00:00:00.000Z',
      },
    })

    const customSummarySchema = createMissingHeadersResponseSchema(
      {
        success: false,
        error: {
          code: 'MISSING_REQUIRED_HEADERS',
          message: 'Missing required headers',
          timestamp: '2026-04-19T00:00:00.000Z',
        },
      },
      'Custom summary',
    )

    expect(
      customSummarySchema.parse({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_HEADERS',
          message: 'Missing required headers',
          timestamp: '2026-04-19T00:00:00.000Z',
        },
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'MISSING_REQUIRED_HEADERS',
        message: 'Missing required headers',
        timestamp: '2026-04-19T00:00:00.000Z',
      },
    })
  })

  it('validates validation error response wrapper', () => {
    expect(
      createValidationErrorResponseSchema().parse({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          timestamp: '2026-04-19T00:00:00.000Z',
          details: [
            {
              field: 'body.name',
              issue: 'too_small',
              message: 'Name is required',
            },
          ],
        },
      }),
    ).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp: '2026-04-19T00:00:00.000Z',
        details: [
          {
            field: 'body.name',
            issue: 'too_small',
            message: 'Name is required',
          },
        ],
      },
    })
  })
})
