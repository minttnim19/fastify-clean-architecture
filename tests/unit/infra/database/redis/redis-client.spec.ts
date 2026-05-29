import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
vi.mock('@/infra/logger/col-logger', () => ({ logger }))

const ioredisCtor = vi.hoisted(() => vi.fn())
const clusterCtor = vi.hoisted(() => vi.fn())

vi.mock('ioredis', () => {
  class IORedisMock {
    on = vi.fn()
    constructor(...args: unknown[]) {
      ioredisCtor(...args)
    }
  }
  class ClusterMock {
    on = vi.fn()
    constructor(...args: unknown[]) {
      clusterCtor(...args)
    }
  }

  return {
    default: IORedisMock,
    Cluster: ClusterMock,
  }
})

describe('createRedisClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('creates single Redis client when cluster mode is off', async () => {
    const testUser = 'test-user'
    const testPass = 'test-pass'
    vi.doMock('@/infra/config/env', () => ({
      env: {
        REDIS_CLUSTER_MODE: false,
        REDIS_URL: `redis://${testUser}:${testPass}@localhost:6379`,
        REDIS_USERNAME: testUser,
        REDIS_PASSWORD: testPass,
        REDIS_TLS: false,
      },
    }))

    const { createRedisClient } = await import('@/infra/database/redis/redis-client.js')
    const client = createRedisClient() as unknown as { on: ReturnType<typeof vi.fn> }

    const [, options] = ioredisCtor.mock.calls[0]
    expect(ioredisCtor).toHaveBeenCalledWith(`redis://${testUser}:${testPass}@localhost:6379`, {
      retryStrategy: expect.any(Function),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      username: testUser,
      password: testPass,
      tls: undefined,
    })
    expect(options.retryStrategy(1)).toBe(2000)

    expect(client.on).toHaveBeenCalledTimes(4)

    const onCalls = client.on.mock.calls as Array<[string, (...args: unknown[]) => void]>
    const connectHandler = onCalls.find((c) => c[0] === 'connect')?.[1]
    const readyHandler = onCalls.find((c) => c[0] === 'ready')?.[1]
    const errorHandler = onCalls.find((c) => c[0] === 'error')?.[1]
    const endHandler = onCalls.find((c) => c[0] === 'end')?.[1]

    connectHandler?.()
    readyHandler?.()
    errorHandler?.(new Error('boom'))
    endHandler?.()
    expect(logger.info).toHaveBeenCalledWith(
      { label: 'redis://*********:*********@localhost:6379' },
      'Redis connecting',
    )
  })

  it('creates Redis cluster client when cluster mode is on', async () => {
    vi.doMock('@/infra/config/env', () => ({
      env: {
        REDIS_CLUSTER_MODE: true,
        REDIS_NODES: 'host1:7000,host2',
        REDIS_USERNAME: '',
        REDIS_PASSWORD: '',
        REDIS_TLS: true,
      },
    }))

    const { createRedisClient } = await import('@/infra/database/redis/redis-client.js')
    const client = createRedisClient() as unknown as { on: ReturnType<typeof vi.fn> }

    const [, options] = clusterCtor.mock.calls[0]
    const dnsCb = vi.fn()
    options.dnsLookup('host', dnsCb)
    expect(dnsCb).toHaveBeenCalledWith(null, 'host')
    expect(options.clusterRetryStrategy(2)).toBe(4000)

    expect(clusterCtor).toHaveBeenCalledWith(
      [
        { host: 'host1', port: 7000 },
        { host: 'host2', port: 6379 },
      ],
      {
        dnsLookup: expect.any(Function),
        slotsRefreshTimeout: 10000,
        scaleReads: 'slave',
        clusterRetryStrategy: expect.any(Function),
        redisOptions: {
          username: undefined,
          password: undefined,
          tls: {},
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        },
      },
    )

    expect(client.on).toHaveBeenCalledTimes(4)
  })

  it('creates Redis cluster client without tls and credentials', async () => {
    vi.doMock('@/infra/config/env', () => ({
      env: {
        REDIS_CLUSTER_MODE: true,
        REDIS_NODES: 'host1:7000',
        REDIS_USERNAME: '',
        REDIS_PASSWORD: '',
        REDIS_TLS: false,
      },
    }))

    const { createRedisClient } = await import('@/infra/database/redis/redis-client.js')
    createRedisClient()

    const [, options] = clusterCtor.mock.calls[0]
    expect(options.redisOptions).toMatchObject({
      username: undefined,
      password: undefined,
      tls: undefined,
    })
  })

  it('throws when cluster mode is on but nodes are empty', async () => {
    vi.doMock('@/infra/config/env', () => ({
      env: {
        REDIS_CLUSTER_MODE: true,
        REDIS_NODES: '',
      },
    }))

    const { createRedisClient } = await import('@/infra/database/redis/redis-client.js')

    expect(() => createRedisClient()).toThrow('REDIS_CLUSTER_MODE=true but REDIS_NODES is empty')
  })

  it('logs sanitized redis url labels', async () => {
    const cases = [
      {
        env: {
          REDIS_CLUSTER_MODE: false,
          REDIS_URL: 'redis://localhost:6379',
          REDIS_USERNAME: '',
          REDIS_PASSWORD: '',
          REDIS_TLS: true,
        },
        expectedLabel: 'redis://localhost:6379',
      },
      {
        env: {
          REDIS_CLUSTER_MODE: false,
          REDIS_URL: 'not-a-url',
          REDIS_USERNAME: '',
          REDIS_PASSWORD: '',
          REDIS_TLS: false,
        },
        expectedLabel: '(invalid)',
      },
    ]

    for (const { env, expectedLabel } of cases) {
      vi.resetModules()
      vi.clearAllMocks()
      vi.doMock('@/infra/config/env', () => ({ env }))

      const { createRedisClient } = await import('@/infra/database/redis/redis-client.js')
      const client = createRedisClient() as unknown as { on: ReturnType<typeof vi.fn> }

      const onCalls = client.on.mock.calls as Array<[string, (...args: unknown[]) => void]>
      const connectHandler = onCalls.find((c) => c[0] === 'connect')?.[1]
      connectHandler?.()
      expect(logger.info).toHaveBeenCalledWith({ label: expectedLabel }, 'Redis connecting')
    }
  })
})
