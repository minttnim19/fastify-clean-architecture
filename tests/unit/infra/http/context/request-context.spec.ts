import { describe, expect, it } from 'vitest'

import { requestContext } from '@/infra/http/context/request-context'

describe('requestContext', () => {
  it('returns undefined when no context is set', () => {
    expect(requestContext.get()).toBeUndefined()
  })

  it('sets context with enterWith and can read it', () => {
    requestContext.set({ correlatorId: 'c1', journey: 'j1' })
    expect(requestContext.get()).toEqual({ correlatorId: 'c1', journey: 'j1' })
  })

  it('runs callback with provided context', () => {
    const result = requestContext.run({ correlatorId: 'c2', journey: 'j2' }, () =>
      requestContext.get(),
    )
    expect(result).toEqual({ correlatorId: 'c2', journey: 'j2' })
  })
})
