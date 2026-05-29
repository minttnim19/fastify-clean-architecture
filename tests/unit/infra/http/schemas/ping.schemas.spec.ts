import { describe, expect, it } from 'vitest'

import { PingRouteSchema } from '@/infra/http/schemas/ping.schemas'

describe('ping schemas', () => {
  it('documents pong response schema', () => {
    expect(PingRouteSchema.summary).toBe('Ping')
    expect(PingRouteSchema.response[200].parse({ message: 'pong' })).toEqual({
      message: 'pong',
    })
    expect(() => PingRouteSchema.response[200].parse({ message: 'ping' })).toThrow()
  })
})
