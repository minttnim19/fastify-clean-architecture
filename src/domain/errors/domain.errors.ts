export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export function createDomainError(message: string, code: string, statusCode: number): DomainError {
  return new DomainError(message, code, statusCode)
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND', 404)
  }
}

export class CorrelatorNotFoundError extends DomainError {
  constructor(resource: string, correlatorId: string) {
    super(`${resource} with correlatorId '${correlatorId}' not found`, 'NOT_FOUND', 404)
  }
}

export class KeyNotFoundError extends DomainError {
  constructor(resource: string, key: string) {
    super(`${resource} with key '${key}' not found`, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 422)
  }
}

export class BadRequestError extends DomainError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
}
