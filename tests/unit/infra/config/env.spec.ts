import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

const buildBaseEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  SWAGGER_ENABLED: 'false',
  SWAGGER_USERNAME: '',
  SWAGGER_PASSWORD: '',
  X_API_KEY: '',
  REDIS_URL: 'redis://redis:6379/0',
  REDIS_CLUSTER_MODE: 'false',
  REDIS_NODES: '',
  REDIS_USERNAME: '',
  REDIS_PASSWORD: '',
  REDIS_TLS: 'false',
  CACHE_TTL_SECONDS: '3600',
  CTP_CLIENT_ID: 'ctp-client-id',
  CTP_CLIENT_SECRET: 'ctp-client-secret',
  CTP_PROJECT_KEY: 'ctp-project',
  CS_AUTHORIZATION: 'cs-auth',
  CS_API_KEY: 'cs-api-key',
})

const loadEnv = async (overrides: Record<string, unknown> = {}) => {
  vi.resetModules()
  process.env = {
    PATH: ORIGINAL_ENV.PATH,
    TZ: ORIGINAL_ENV.TZ,
    ...buildBaseEnv(),
    ...overrides,
  }

  return import('@/infra/config/env.js')
}

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('parses required values and applies defaults/coercions', async () => {
    const { env } = await loadEnv({
      TRUST_PROXY: 'yes',
      LOG_TO_FILE: 'on',
      REDIS_CLUSTER_MODE: 'true',
      REDIS_NODES: 'host1:7000,host2:7001',
      REDIS_USERNAME: 'redis-user',
      REDIS_PASSWORD: 'redis-pass',
      REDIS_TLS: '1',
      CACHE_TTL_SECONDS: '7200',
      PORT: '4000',
      HTTP_TIMEOUT_MS: '5000',
      CS_ENVIRONMENTS: 'dev, staging,production',
    })

    expect(env.NODE_ENV).toBe('test')
    expect(env.PORT).toBe(4000)
    expect(env.HOST).toBe('0.0.0.0')
    expect(env.TRUST_PROXY).toBe(true)
    expect(env.LOG_TO_FILE).toBe(true)
    expect(env.REDIS_URL).toBe('redis://redis:6379/0')
    expect(env.REDIS_CLUSTER_MODE).toBe(true)
    expect(env.REDIS_NODES).toBe('host1:7000,host2:7001')
    expect(env.REDIS_USERNAME).toBe('redis-user')
    expect(env.REDIS_PASSWORD).toBe('redis-pass')
    expect(env.REDIS_TLS).toBe(true)
    expect(env.CACHE_TTL_SECONDS).toBe(7200)
    expect(env.HTTP_TIMEOUT_MS).toBe(5000)
    expect(env.CS_ENVIRONMENTS).toEqual(['dev', 'staging', 'production'])
    expect(env.RATE_LIMIT_MAX).toBe(100)
    expect(env.SWAGGER_ENABLED).toBe(false)
    expect(env.SWAGGER_USERNAME).toBe('')
    expect(env.SWAGGER_PASSWORD).toBe('')
    expect(env.X_API_KEY).toBe('')
    expect(env.LOG_LEVEL).toBe('info')
  })

  it('falls back to defaults for empty or omitted csv and boolean env values', async () => {
    const { env } = await loadEnv({
      TRUST_PROXY: '0',
      LOG_TO_FILE: 'false',
      REDIS_CLUSTER_MODE: 'off',
      REDIS_TLS: 'no',
      CS_ENVIRONMENTS: '',
    })

    expect(env.TRUST_PROXY).toBe(false)
    expect(env.LOG_TO_FILE).toBe(false)
    expect(env.REDIS_URL).toBe('redis://redis:6379/0')
    expect(env.REDIS_CLUSTER_MODE).toBe(false)
    expect(env.REDIS_TLS).toBe(false)
    expect(env.CACHE_TTL_SECONDS).toBe(3600)
    expect(env.CS_ENVIRONMENTS).toEqual([])
  })

  it('throws when required env values are invalid', async () => {
    await expect(
      loadEnv({
        CTP_AUTH_URL: 'not-a-url',
      }),
    ).rejects.toThrow()
  })

  it('throws when boolean-like env values are unrecognized', async () => {
    await expect(
      loadEnv({
        TRUST_PROXY: 'sometimes',
      }),
    ).rejects.toThrow()
  })

  it('requires swagger credentials when swagger is enabled', async () => {
    await expect(
      loadEnv({
        SWAGGER_ENABLED: 'true',
      }),
    ).rejects.toThrow()

    const { env } = await loadEnv({
      SWAGGER_ENABLED: 'true',
      SWAGGER_USERNAME: 'swagger',
      SWAGGER_PASSWORD: 'secret',
    })

    expect(env.SWAGGER_ENABLED).toBe(true)
    expect(env.SWAGGER_USERNAME).toBe('swagger')
    expect(env.SWAGGER_PASSWORD).toBe('secret')
  })

  it('supports array values for csv env parsing and rejects unsupported types', async () => {
    const { env } = await loadEnv({
      CS_ENVIRONMENTS: ['dev', ' qa ', 123],
      TRUST_PROXY: true,
    })

    expect(env.CS_ENVIRONMENTS).toEqual(['dev', 'qa', '123'])
    expect(env.TRUST_PROXY).toBe(true)

    await expect(
      loadEnv({
        CS_ENVIRONMENTS: { invalid: true },
      }),
    ).rejects.toThrow()
  })

  it('uses default values for optional env keys', async () => {
    const { env } = await loadEnv({
      CTP_AUTH_URL: undefined,
      CTP_API_URL: undefined,
      CTP_SCOPES: undefined,
      CS_REGION: undefined,
      CS_BRANCH: undefined,
    })

    expect(env.CTP_AUTH_URL).toBe('https://auth.europe-west1.gcp.commercetools.com')
    expect(env.CTP_API_URL).toBe('https://api.europe-west1.gcp.commercetools.com')
    expect(env.CTP_SCOPES).toBeUndefined()
    expect(env.CS_REGION).toBe('us')
    expect(env.CS_BRANCH).toBe('main')
  })

  it('parses x api key when provided', async () => {
    const { env } = await loadEnv({
      X_API_KEY: 'my-secure-key',
    })

    expect(env.X_API_KEY).toBe('my-secure-key')
  })
})
