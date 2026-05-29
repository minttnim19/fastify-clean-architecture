import { beforeEach, describe, expect, it, vi } from 'vitest'

const envMock = vi.hoisted(() => ({
  X_API_KEY: '',
}))

vi.mock('@/infra/config/env', () => ({
  env: envMock,
}))

import { UnauthorizedError } from '@/domain/errors/domain.errors'
import { validateApiKey } from '@/infra/http/guards/api-key.guard'

const createRequest = (
  headers: Record<string, string> = {},
): Parameters<typeof validateApiKey>[0] => ({ headers }) as Parameters<typeof validateApiKey>[0]

describe('api key guard', () => {
  beforeEach(() => {
    envMock.X_API_KEY = ''
  })

  it('allows request when api key validation is disabled', () => {
    expect(() => validateApiKey(createRequest())).not.toThrow()
  })

  it('rejects request when x-api-key does not match configured value', () => {
    envMock.X_API_KEY = 'expected-key'

    expect(() => validateApiKey(createRequest({ 'x-api-key': 'wrong-key' }))).toThrow(
      UnauthorizedError,
    )
  })

  it('allows request when x-api-key matches configured value', () => {
    envMock.X_API_KEY = 'expected-key'

    expect(() => validateApiKey(createRequest({ 'x-api-key': 'expected-key' }))).not.toThrow()
  })
})
