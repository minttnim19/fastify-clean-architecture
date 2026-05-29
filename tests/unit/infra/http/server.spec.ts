import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildAppMock = vi.hoisted(() => vi.fn())
const infoMock = vi.hoisted(() => vi.fn())
const errorMock = vi.hoisted(() => vi.fn())

vi.mock('@/infra/config/env', () => ({
  env: {
    PORT: 3000,
    HOST: '0.0.0.0',
  },
}))

vi.mock('@/infra/http/app', () => ({
  buildApp: buildAppMock,
}))

vi.mock('@/infra/logger/col-logger', () => ({
  logger: {
    info: infoMock,
    error: errorMock,
  },
}))

type AppDouble = {
  listen: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

const loadServer = async () => {
  vi.resetModules()
  await import('@/infra/http/server.js')
}

describe('server bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts listening, registers process handlers, and shuts down gracefully once', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: (...args: unknown[]) => unknown,
    ) => {
      handlers.set(event, handler)
      return process
    }) as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const app: AppDouble = {
      listen: vi.fn((options, callback: (err: Error | null, address: string) => void) => {
        callback(null, 'http://0.0.0.0:3000')
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
    buildAppMock.mockResolvedValue(app)

    await loadServer()

    expect(buildAppMock).toHaveBeenCalledOnce()
    expect(app.listen).toHaveBeenCalledWith({ port: 3000, host: '0.0.0.0' }, expect.any(Function))
    expect(infoMock).toHaveBeenCalledWith('Server is listening on http://0.0.0.0:3000')
    expect(handlers.has('SIGINT')).toBe(true)
    expect(handlers.has('SIGTERM')).toBe(true)
    expect(handlers.has('uncaughtException')).toBe(true)
    expect(handlers.has('unhandledRejection')).toBe(true)

    await handlers.get('SIGTERM')?.()
    await handlers.get('SIGTERM')?.()

    expect(infoMock).toHaveBeenCalledWith('Received SIGTERM. Starting graceful shutdown.')
    expect(app.close).toHaveBeenCalledOnce()
    expect(exitSpy).toHaveBeenCalledWith(0)

    onSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('exits with code 1 when startup fails to bind host or port', async () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation((() => process) as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const startupError = new Error('EADDRINUSE')
    const app: AppDouble = {
      listen: vi.fn((options, callback: (err: Error, address?: string) => void) => {
        callback(startupError)
      }),
      close: vi.fn(),
    }
    buildAppMock.mockResolvedValue(app)

    await loadServer()

    expect(errorMock).toHaveBeenCalledWith(
      { err: startupError },
      'Server startup failed: unable to bind host/port',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)

    onSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('logs and exits when shutdown, uncaught exceptions, or unhandled rejections fail', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: (...args: unknown[]) => unknown,
    ) => {
      handlers.set(event, handler)
      return process
    }) as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const closeError = new Error('close failed')
    const uncaughtError = new Error('boom')
    const rejectionReason = new Error('rejected')
    const app: AppDouble = {
      listen: vi.fn((options, callback: (err: Error | null, address: string) => void) => {
        callback(null, 'http://0.0.0.0:3000')
      }),
      close: vi.fn().mockRejectedValue(closeError),
    }
    buildAppMock.mockResolvedValue(app)

    await loadServer()

    await handlers.get('SIGINT')?.()
    handlers.get('uncaughtException')?.(uncaughtError)
    handlers.get('unhandledRejection')?.(rejectionReason)

    expect(errorMock).toHaveBeenCalledWith(
      { err: closeError },
      'Graceful shutdown failed: error while closing server',
    )
    expect(errorMock).toHaveBeenCalledWith(
      { err: uncaughtError },
      'Uncaught exception: terminating process',
    )
    expect(errorMock).toHaveBeenCalledWith(
      { reason: rejectionReason },
      'Unhandled promise rejection: terminating process',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)

    onSpy.mockRestore()
    exitSpy.mockRestore()
  })
})
