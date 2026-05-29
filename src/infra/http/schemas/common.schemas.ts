import { z } from 'zod'

function getFirstHeaderValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  const [firstValue] = value as readonly unknown[]
  return firstValue
}

const HeaderValueSchema = z.preprocess(
  (value: unknown): unknown => getFirstHeaderValue(value),
  z.string().min(1, 'Header is required'),
)

const OptionalHeaderValueSchema = z.preprocess(
  (value: unknown): unknown => getFirstHeaderValue(value),
  z.string().min(1, 'Header is required').optional(),
)

const EmailHeaderValueSchema = z.preprocess(
  (value: unknown): unknown => getFirstHeaderValue(value),
  z.email(),
)

export const ChannelHeaderSchema = z.object({
  'x-channel': HeaderValueSchema.describe(
    'Sales channel code used to scope the request. Common values: WW, TUC',
  ).meta({
    example: 'WW',
  }),
})

export const CorrelatorHeaderSchema = z.object({
  'x-correlator-id': HeaderValueSchema.describe('Request correlation id for tracing').meta({
    example: '9a288f92-8814-429f-b790-5466760a2d4c',
  }),
})

export const OptionalCorrelatorHeaderSchema = z.object({
  'x-correlator-id': OptionalHeaderValueSchema.describe('Request correlation id for tracing').meta({
    example: '9a288f92-8814-429f-b790-5466760a2d4c',
  }),
})

export const ApiKeyHeaderSchema = z.object({
  'x-api-key': HeaderValueSchema.describe('API key used to authorize the request').meta({
    example: 'template-api-key',
  }),
})

export const UserEmailHeaderSchema = z.object({
  'x-user-email': EmailHeaderValueSchema.describe(
    'Trusted current user email passed from upstream authentication',
  ).meta({
    example: 'user@example.com',
  }),
})

export const RequiredHeadersSchema = z.object({
  ...ChannelHeaderSchema.shape,
  ...CorrelatorHeaderSchema.shape,
})

export const RequiredHeadersWithJourneySchema = z.object({
  ...RequiredHeadersSchema.shape,
  'x-journey': OptionalHeaderValueSchema.default('prebook')
    .describe('Journey identifier. Defaults to prebook when omitted')
    .meta({
      example: 'prebook',
    }),
})

export const CorrelatorWithFilenameHeaderSchema = z.object({
  ...CorrelatorHeaderSchema.shape,
  'x-filename': HeaderValueSchema.describe('Original uploaded filename including extension').meta({
    example: 'import-file.xlsx',
  }),
})

export function createApiSuccessResponseSchema<TSchema extends z.ZodType>(
  data: TSchema,
): z.ZodObject<{ success: z.ZodLiteral<true>; data: TSchema }> {
  return z.object({
    success: z.literal(true),
    data,
  })
}

export function createApiEmptySuccessResponseSchema(): z.ZodObject<{
  success: z.ZodLiteral<true>
}> {
  return z.object({
    success: z.literal(true),
  })
}

export function createApiErrorResponseSchema<TCode extends z.ZodType>(
  code: TCode,
): z.ZodObject<{
  success: z.ZodLiteral<false>
  error: z.ZodObject<{
    code: TCode
    message: z.ZodString
    timestamp: z.ZodString
  }>
}>
export function createApiErrorResponseSchema<TCode extends z.ZodType, TDetails extends z.ZodType>(
  code: TCode,
  details: TDetails,
): z.ZodObject<{
  success: z.ZodLiteral<false>
  error: z.ZodObject<{
    code: TCode
    message: z.ZodString
    timestamp: z.ZodString
    details: TDetails
  }>
}>
export function createApiErrorResponseSchema<TCode extends z.ZodType>(
  code: TCode,
  details?: z.ZodType,
): z.ZodTypeAny {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code,
      message: z.string(),
      timestamp: z.string(),
      ...(details ? { details } : {}),
    }),
  })
}

export const ValidationErrorDetailsSchema = z.array(
  z.object({
    field: z.string(),
    issue: z.string(),
    message: z.string(),
  }),
)

export function createValidationErrorResponseSchema(): z.ZodTypeAny {
  return createApiErrorResponseSchema(z.literal('VALIDATION_ERROR'), ValidationErrorDetailsSchema)
}

export function createMissingHeadersResponseSchema(
  example: unknown,
  summary = '400 Missing required headers',
): z.ZodTypeAny {
  return createApiErrorResponseSchema(z.literal('MISSING_REQUIRED_HEADERS')).meta({
    'x-examples': {
      missingHeaders: {
        summary,
        value: example,
      },
    },
  })
}
