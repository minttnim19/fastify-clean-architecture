import { afterEach, describe, expect, it } from 'vitest'

import { resolveStepName, STEP_NAME_RULES } from '@/infra/logger/step-name-map'

describe('resolveStepName', () => {
  const originalRules = [...STEP_NAME_RULES]

  afterEach(() => {
    STEP_NAME_RULES.splice(0, STEP_NAME_RULES.length, ...originalRules)
  })

  it('returns activity when endpoint is missing', () => {
    expect(resolveStepName('ACTIVITY')).toBe('ACTIVITY')
  })

  it('returns activity when endpoint is empty string', () => {
    expect(resolveStepName('ACTIVITY', '')).toBe('ACTIVITY')
  })

  it('returns activity for empty endpoint when rules exist', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/orders/create',
      method: 'POST',
      step_name: 'CREATE_ORDER',
    })

    expect(resolveStepName('ACTIVITY', '', 'POST')).toBe('ACTIVITY')
  })

  it('matches exact rule and normalizes endpoint', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/orders/create',
      method: 'POST',
      step_name: 'CREATE_ORDER',
    })

    expect(resolveStepName('ACTIVITY', 'orders/create', 'POST')).toBe('CREATE_ORDER')
    expect(resolveStepName('ACTIVITY', 'orders/create?x=1', 'POST')).toBe('CREATE_ORDER')
  })

  it('normalizes absolute URLs before matching rules', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/orders/create',
      method: 'POST',
      step_name: 'CREATE_ORDER',
    })

    expect(resolveStepName('ACTIVITY', 'https://api.example.com/orders/create?x=1', 'POST')).toBe(
      'CREATE_ORDER',
    )
  })

  it('matches regex rule when method is compatible', () => {
    STEP_NAME_RULES.push({
      type: 'regex',
      pattern: /^\/orders\/\d+\/pay$/,
      method: 'POST',
      step_name: 'PAY_ORDER',
    })

    expect(resolveStepName('ACTIVITY', '/orders/123/pay', 'POST')).toBe('PAY_ORDER')
    expect(resolveStepName('ACTIVITY', '/orders/123/pay', 'GET')).toBe('ACTIVITY')
  })

  it('returns activity when no rules match', () => {
    expect(resolveStepName('ACTIVITY', '/unknown', 'GET')).toBe('ACTIVITY')
  })

  it('returns activity when rules exist but none match', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/orders/create',
      method: 'POST',
      step_name: 'CREATE_ORDER',
    })

    expect(resolveStepName('ACTIVITY', '/unknown', 'GET')).toBe('ACTIVITY')
  })

  it('handles invalid URL strings', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/https://%',
      step_name: 'INVALID_URL',
    })

    expect(resolveStepName('ACTIVITY', 'https://%')).toBe('INVALID_URL')
  })

  it('falls back to activity when step_name is empty', () => {
    STEP_NAME_RULES.push({
      type: 'exact',
      endpoint: '/empty-step',
      step_name: '',
    })

    expect(resolveStepName('ACTIVITY', '/empty-step')).toBe('ACTIVITY')
  })
})
