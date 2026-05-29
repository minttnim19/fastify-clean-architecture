import 'dotenv/config'
import { z } from 'zod'

const BoolFromEnv = z.preprocess((v) => {
  if (typeof v === 'string') {
    const x = v.trim().toLowerCase()
    if (['1', 'true', 'y', 'yes', 'on'].includes(x)) return true
    if (['0', 'false', 'n', 'no', 'off', ''].includes(x)) return false
  }
  return v
}, z.boolean())

const CsvToStringArray = z.preprocess((value) => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0)
  }

  if (value === undefined || value === null) {
    return []
  }

  return value
}, z.array(z.string()).default([]))

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    TRUST_PROXY: BoolFromEnv.default(false),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    LOG_PATH: z.string().default('./logs'),
    LOG_TO_FILE: BoolFromEnv.default(false),
    LOG_CHANNEL: z.string().default('hlc'),
    LOG_PRODUCT: z.string().default('xyz'),
    SERVICE_TYPE: z.string().default(''),
    INVENTORY_CHUNK_SIZE: z.coerce.number().default(20),

    // Redis
    REDIS_URL: z.string().default('redis://redis:6379/0'),
    REDIS_CLUSTER_MODE: BoolFromEnv.default(false),
    REDIS_NODES: z.string().default(''),
    REDIS_USERNAME: z.string().default(''),
    REDIS_PASSWORD: z.string().default(''),
    REDIS_TLS: BoolFromEnv.default(false),
    CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

    // CORS
    CORS_ORIGIN: z.string().default('*'),

    // Rate limit
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    // Swagger
    SWAGGER_ENABLED: BoolFromEnv.default(false),
    SWAGGER_USERNAME: z.string().default(''),
    SWAGGER_PASSWORD: z.string().default(''),
    X_API_KEY: z.string().default(''),

    // HTTP client
    HTTP_TIMEOUT_MS: z.coerce.number().min(1).default(10000),

    // Commercetools (optional)
    CTP_AUTH_URL: z.url().default('https://auth.europe-west1.gcp.commercetools.com'),
    CTP_API_URL: z.url().default('https://api.europe-west1.gcp.commercetools.com'),
    CTP_CLIENT_ID: z.string(),
    CTP_CLIENT_SECRET: z.string(),
    CTP_PROJECT_KEY: z.string(),
    CTP_SCOPES: z.string().optional(),

    // Contentstack (optional)
    CS_AUTHORIZATION: z.string(),
    CS_API_KEY: z.string(),
    CS_REGION: z.string().default('us'),
    CS_BRANCH: z.string().default('main'),
    CS_ENVIRONMENTS: CsvToStringArray,
  })
  .superRefine((env, ctx) => {
    if (!env.SWAGGER_ENABLED) return

    if (env.SWAGGER_USERNAME.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_USERNAME'],
        message: 'SWAGGER_USERNAME is required when SWAGGER_ENABLED is true',
      })
    }

    if (env.SWAGGER_PASSWORD.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_PASSWORD'],
        message: 'SWAGGER_PASSWORD is required when SWAGGER_ENABLED is true',
      })
    }
  })

export const env = EnvSchema.parse(process.env)
