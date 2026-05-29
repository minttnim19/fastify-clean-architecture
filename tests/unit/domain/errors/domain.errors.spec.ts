import { describe, expect, it } from 'vitest'

import {
  BadRequestError,
  CorrelatorNotFoundError,
  ConflictError,
  createDomainError,
  DomainError,
  ForbiddenError,
  KeyNotFoundError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/domain.errors'

describe('Domain errors', () => {
  it('DomainError sets name/code/status', () => {
    const error = new DomainError('boom', 'E_BANG', 418)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('DomainError')
    expect(error.code).toBe('E_BANG')
    expect(error.statusCode).toBe(418)
  })

  it('createDomainError creates a DomainError', () => {
    const error = createDomainError('bad', 'E_BAD', 400)

    expect(error).toBeInstanceOf(DomainError)
    expect(error.message).toBe('bad')
    expect(error.code).toBe('E_BAD')
  })

  it('NotFoundError formats message and sets status', () => {
    const error = new NotFoundError('reserve', 'abc')

    expect(error.code).toBe('NOT_FOUND')
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe("reserve with id 'abc' not found")
  })

  it('formats correlator and key not found errors', () => {
    expect(new CorrelatorNotFoundError('reserve', 'cor-1').message).toBe(
      "reserve with correlatorId 'cor-1' not found",
    )
    expect(new KeyNotFoundError('reserve', 'key-1').message).toBe(
      "reserve with key 'key-1' not found",
    )
  })

  it('Other domain errors set correct codes and status', () => {
    expect(new ConflictError('conflict').code).toBe('CONFLICT')
    expect(new ConflictError('conflict').statusCode).toBe(409)
    expect(new ValidationError('bad').code).toBe('VALIDATION_ERROR')
    expect(new ValidationError('bad').statusCode).toBe(422)
    expect(new BadRequestError('bad request').code).toBe('BAD_REQUEST')
    expect(new BadRequestError('bad request').statusCode).toBe(400)
    expect(new UnauthorizedError().code).toBe('UNAUTHORIZED')
    expect(new UnauthorizedError().statusCode).toBe(401)
    expect(new ForbiddenError().code).toBe('FORBIDDEN')
    expect(new ForbiddenError().statusCode).toBe(403)
  })

  it('supports explicit unauthorized and forbidden messages', () => {
    expect(new UnauthorizedError('Denied').message).toBe('Denied')
    expect(new ForbiddenError('Blocked').message).toBe('Blocked')
  })
})
