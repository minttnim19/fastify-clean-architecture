import { describe, expect, it } from 'vitest'

import { formatMissingHeadersMessage } from '@/infra/http/utils/header-validation'

describe('formatMissingHeadersMessage', () => {
  it('returns undefined when no x- headers are present', () => {
    expect(formatMissingHeadersMessage(['content-type', 'authorization'])).toBeUndefined()
  })

  it('formats singular header message', () => {
    expect(formatMissingHeadersMessage(['x-correlator-id'])).toBe(
      'Missing required header: x-correlator-id',
    )
  })

  it('formats plural header message and removes duplicates', () => {
    expect(
      formatMissingHeadersMessage(['x-channel', 'x-correlator-id', 'x-channel', 'content-type']),
    ).toBe('Missing required headers: x-channel, x-correlator-id')
  })
})
