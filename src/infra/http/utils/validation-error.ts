import { formatMissingHeadersMessage } from '@/infra/http/utils/header-validation'

import type { FastifyError } from 'fastify'

type FastifyValidationError = NonNullable<FastifyError['validation']>[number]

type ValidationErrorDetail = {
  field: string
  issue: string | undefined
  message: string | undefined
}

type NormalizedValidationError = {
  code: string
  message: string
  status: number
  details?: ValidationErrorDetail[]
}

function getValidationField(validation: FastifyValidationError): string {
  const instancePath = validation.instancePath?.replace(/^\//, '')
  const missingProperty = (validation.params as Record<string, string>)?.missingProperty
  if (instancePath) return instancePath
  if (missingProperty) return missingProperty
  return 'unknown'
}

function parseValidationDetails(
  validationErrors: FastifyValidationError[],
): ValidationErrorDetail[] {
  return validationErrors.map((validation) => ({
    field: getValidationField(validation),
    issue: validation.keyword,
    message: validation.message,
  }))
}

function formatMissingHeadersMessageFromValidation(
  validationErrors: FastifyValidationError[],
): string | undefined {
  if (validationErrors.length === 0) return undefined

  return formatMissingHeadersMessage(
    validationErrors.map((validation) => getValidationField(validation)),
  )
}

export function normalizeValidationError(
  error: FastifyError,
): NormalizedValidationError | undefined {
  const validationErrors = error.validation
  if (!validationErrors) return undefined

  const missingHeadersMessage = formatMissingHeadersMessageFromValidation(validationErrors)
  if (missingHeadersMessage) {
    return {
      code: 'MISSING_REQUIRED_HEADERS',
      message: missingHeadersMessage,
      status: 400,
    }
  }

  return {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    status:
      error.validationContext === 'params' ||
      error.validationContext === 'querystring' ||
      error.validationContext === 'body'
        ? 422
        : (error.statusCode ?? 400),
    details: parseValidationDetails(validationErrors),
  }
}
