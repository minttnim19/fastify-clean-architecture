import { env } from '@/infra/config/env'
import { buildApp } from '@/infra/http/app'
import { logger } from '@/infra/logger/col-logger'

async function start(): Promise<void> {
  const app = await buildApp()

  let isShuttingDown = false

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info(`Received ${signal}. Starting graceful shutdown.`)
    try {
      await app.close()
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Graceful shutdown failed: error while closing server')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception: terminating process')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection: terminating process')
    process.exit(1)
  })

  app.listen({ port: env.PORT, host: env.HOST }, (err, address) => {
    if (err) {
      logger.error({ err }, 'Server startup failed: unable to bind host/port')
      process.exit(1)
    }
    logger.info(`Server is listening on ${address}`)
  })
}

void start()
