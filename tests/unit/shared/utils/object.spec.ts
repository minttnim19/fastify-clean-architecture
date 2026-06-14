import { describe, expect, it } from 'vitest'

import {
  getBooleanField,
  getNumberField,
  getStringField,
  isRecord,
  toRecord,
} from '@/shared/utils/object'

describe('isRecord', () => {
  it('returns true for object records', () => {
    expect(isRecord({ key: 'value' })).toBe(true)
  })

  it('returns false for null and primitive values', () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord('value')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(false)).toBe(false)
  })
})

describe('toRecord', () => {
  it('returns records for object values', () => {
    const value = { key: 'value' }

    expect(toRecord(value)).toBe(value)
  })

  it('returns undefined for non-record values', () => {
    expect(toRecord(null)).toBeUndefined()
    expect(toRecord('value')).toBeUndefined()
  })
})

describe('field getters', () => {
  it('returns typed fields when the values match', () => {
    const value = { name: 'error', status: 500, success: false }

    expect(getStringField(value, 'name')).toBe('error')
    expect(getNumberField(value, 'status')).toBe(500)
    expect(getBooleanField(value, 'success')).toBe(false)
  })

  it('returns undefined when the values do not match', () => {
    const value = { name: 404, status: '500', success: 'false' }

    expect(getStringField(value, 'name')).toBeUndefined()
    expect(getNumberField(value, 'status')).toBeUndefined()
    expect(getBooleanField(value, 'success')).toBeUndefined()
    expect(getStringField(undefined, 'name')).toBeUndefined()
    expect(getNumberField(undefined, 'status')).toBeUndefined()
    expect(getBooleanField(undefined, 'success')).toBeUndefined()
  })
})
