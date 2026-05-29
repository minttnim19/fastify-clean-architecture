import { describe, expect, it, vi } from 'vitest'

import type { CommerceToolsClient as CommerceToolsClientType } from '@/infra/http/clients/ctp.client'

type SetupResult = {
  CommerceToolsClient: typeof CommerceToolsClientType
  apiRoot: { marker: string }
  builderInstance: {
    withProjectKey: ReturnType<typeof vi.fn>
    withClientCredentialsFlow: ReturnType<typeof vi.fn>
    withHttpMiddleware: ReturnType<typeof vi.fn>
    build: ReturnType<typeof vi.fn>
  }
  ClientBuilder: ReturnType<typeof vi.fn>
  createApiBuilderFromCtpClient: ReturnType<typeof vi.fn>
  withProjectKey: ReturnType<typeof vi.fn>
  restoreFetch: () => void
}

async function setup(
  envOverrides?: Partial<Record<string, string | undefined>>,
): Promise<SetupResult> {
  vi.resetModules()

  const previousFetch = globalThis.fetch
  globalThis.fetch = vi.fn<typeof fetch>()

  const apiRoot = { marker: 'apiRoot' }
  const withProjectKey = vi.fn(() => apiRoot)
  const createApiBuilderFromCtpClient = vi.fn(() => ({ withProjectKey }))

  const builderInstance = {
    withProjectKey: vi.fn().mockReturnThis(),
    withClientCredentialsFlow: vi.fn().mockReturnThis(),
    withHttpMiddleware: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({ client: true })),
  }
  const ClientBuilder = vi.fn(function ClientBuilderMock() {
    return builderInstance
  })

  vi.doMock('@commercetools/platform-sdk', () => ({ createApiBuilderFromCtpClient }))
  vi.doMock('@commercetools/sdk-client-v2', () => ({ ClientBuilder }))
  vi.doMock('@/infra/config/env', () => ({
    env: {
      CTP_PROJECT_KEY: 'project-key',
      CTP_AUTH_URL: 'https://auth.example',
      CTP_CLIENT_ID: 'client-id',
      CTP_CLIENT_SECRET: 'client-secret',
      CTP_SCOPES: undefined,
      CTP_API_URL: 'https://api.example',
      ...envOverrides,
    },
  }))

  const { CommerceToolsClient } = await import('@/infra/http/clients/ctp.client.js')

  return {
    CommerceToolsClient,
    apiRoot,
    builderInstance,
    ClientBuilder,
    createApiBuilderFromCtpClient,
    withProjectKey,
    restoreFetch: () => {
      globalThis.fetch = previousFetch
    },
  }
}

describe('CommerceToolsClient', () => {
  it('builds api client with scopes when provided', async () => {
    const ctx = await setup({ CTP_SCOPES: 'scope:one' })

    try {
      const instance = ctx.CommerceToolsClient.getInstance()

      expect(ctx.ClientBuilder).toHaveBeenCalledTimes(1)
      expect(ctx.builderInstance.withProjectKey).toHaveBeenCalledWith('project-key')
      expect(ctx.builderInstance.withClientCredentialsFlow).toHaveBeenCalledWith({
        host: 'https://auth.example',
        projectKey: 'project-key',
        credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
        scopes: ['scope:one'],
        fetch: globalThis.fetch,
      })
      expect(ctx.builderInstance.withHttpMiddleware).toHaveBeenCalledWith({
        host: 'https://api.example',
        fetch: globalThis.fetch,
      })
      expect(ctx.createApiBuilderFromCtpClient).toHaveBeenCalledWith({ client: true })
      expect(ctx.withProjectKey).toHaveBeenCalledWith({ projectKey: 'project-key' })
      expect(instance.apiRoot).toBe(ctx.apiRoot)
    } finally {
      ctx.restoreFetch()
    }
  })

  it('builds api client without scopes when not provided', async () => {
    const ctx = await setup({ CTP_SCOPES: undefined })

    try {
      ctx.CommerceToolsClient.getInstance()

      expect(ctx.builderInstance.withClientCredentialsFlow).toHaveBeenCalledWith({
        host: 'https://auth.example',
        projectKey: 'project-key',
        credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
        scopes: undefined,
        fetch: globalThis.fetch,
      })
    } finally {
      ctx.restoreFetch()
    }
  })

  it('returns the same singleton instance', async () => {
    const ctx = await setup()

    try {
      const first = ctx.CommerceToolsClient.getInstance()
      const second = ctx.CommerceToolsClient.getInstance()

      expect(first).toBe(second)
      expect(ctx.ClientBuilder).toHaveBeenCalledTimes(1)
    } finally {
      ctx.restoreFetch()
    }
  })

  it('detects CT http errors and not found', async () => {
    const ctx = await setup()

    try {
      const { CommerceToolsClient } = ctx

      expect(CommerceToolsClient.isCTHttpError({ statusCode: 400 })).toBe(true)
      expect(CommerceToolsClient.isCTHttpError({ statusCode: '400' })).toBe(false)
      expect(CommerceToolsClient.isCTHttpError(null)).toBe(false)
      expect(CommerceToolsClient.isNotFound({ statusCode: 404 })).toBe(true)
      expect(CommerceToolsClient.isNotFound({ statusCode: 500 })).toBe(false)
    } finally {
      ctx.restoreFetch()
    }
  })
})
