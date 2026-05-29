import { describe, expect, it } from 'vitest'

import { PingUseCase } from '@/application/use-cases/ping.use-case'

describe('PingUseCase', () => {
  it('returns pong response', () => {
    const useCase = new PingUseCase()

    expect(useCase.execute()).toEqual({ message: 'pong' })
  })
})
