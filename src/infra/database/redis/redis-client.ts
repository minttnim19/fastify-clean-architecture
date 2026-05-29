import IORedis, { Cluster } from 'ioredis'

import { env } from '@/infra/config/env'
import { logger } from '@/infra/logger/col-logger'

export type RedisLike = IORedis | Cluster

export function createRedisClient(): RedisLike {
  if (env.REDIS_CLUSTER_MODE) {
    const nodes = parseRedisNodes(env.REDIS_NODES)
    if (nodes.length === 0) {
      throw new Error('REDIS_CLUSTER_MODE=true but REDIS_NODES is empty')
    }

    const cluster = new Cluster(nodes, {
      dnsLookup: (addr, cb) => cb(null, addr),
      slotsRefreshTimeout: 10000,
      scaleReads: 'slave',
      clusterRetryStrategy: (times) => Math.min(1000 * 2 ** times, 30000),
      redisOptions: {
        username: env.REDIS_USERNAME || undefined,
        password: env.REDIS_PASSWORD || undefined,
        tls: env.REDIS_TLS ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      },
    })

    attachLogs(cluster, `RedisCluster(${env.REDIS_NODES})`)
    return cluster
  }

  const client = new IORedis(env.REDIS_URL, {
    retryStrategy(times) {
      return Math.min(1000 * 2 ** times, 15000)
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    username: env.REDIS_USERNAME || undefined,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
  })

  attachLogs(client, sanitize(env.REDIS_URL))
  return client
}

function attachLogs(r: RedisLike, label: string): void {
  r.on('connect', () => logger.info({ label }, 'Redis connecting'))
  r.on('ready', () => logger.info({ label }, 'Redis ready'))
  r.on('error', (err: unknown) => logger.error({ label, err }, 'Redis error'))
  r.on('end', () => logger.warn({ label }, 'Redis connection ended'))
}

function sanitize(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = '*'.repeat(Math.max(u.password.length, 4))
    if (u.username) u.username = '*'.repeat(Math.max(u.username.length, 4))
    return u.toString()
  } catch {
    return '(invalid)'
  }
}

function parseRedisNodes(val?: string | null): Array<{ host: string; port: number }> {
  if (!val) return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [host, portStr] = pair.split(':')
      const port = Number(portStr ?? '6379')
      return { host, port }
    })
}
