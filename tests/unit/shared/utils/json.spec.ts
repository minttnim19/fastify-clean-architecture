import { describe, expect, it } from 'vitest'

import { parseJson, stringifyUnknown } from '@/shared/utils/json'

describe('parseJson', () => {
  it('parses valid JSON strings', () => {
    expect(parseJson('{"success":false,"error":{"message":"failed"}}')).toEqual({
      success: false,
      error: { message: 'failed' },
    })
  })

  it('returns undefined for invalid JSON strings', () => {
    expect(parseJson('failed')).toBeUndefined()
  })
})

describe('stringifyUnknown', () => {
  it('keeps strings unchanged', () => {
    expect(stringifyUnknown('value')).toBe('value')
  })

  it('returns empty string for nullish values', () => {
    expect(stringifyUnknown(null)).toBe('')
    expect(stringifyUnknown(undefined)).toBe('')
  })

  it('stringifies serializable values', () => {
    expect(stringifyUnknown({ ok: true })).toBe('{"ok":true}')
  })

  it('returns fallback text for circular values', () => {
    const value: Record<string, unknown> = {}
    value['self'] = value

    expect(stringifyUnknown(value)).toBe('[Circular or Non-serializable]')
  })
})
