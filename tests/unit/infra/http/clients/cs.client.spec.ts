import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMock = vi.hoisted(() => vi.fn())
const stackMock = vi.hoisted(() => vi.fn())

vi.mock('@contentstack/management', () => ({
  client: clientMock,
}))

vi.mock('@/infra/config/env', () => ({
  env: {
    CS_AUTHORIZATION: 'auth-1',
    CS_API_KEY: 'api-key-1',
    CS_BRANCH: 'main',
  },
}))

describe('ContentstackClient', () => {
  beforeEach(() => {
    vi.resetModules()
    clientMock.mockReset()
    stackMock.mockReset()
    clientMock.mockReturnValue({ stack: stackMock })
    stackMock.mockReturnValue({ __stack: true })
  })

  it('creates stack once and caches singleton', async () => {
    const { ContentstackClient } = await import('@/infra/http/clients/cs.client.js')

    const first = ContentstackClient.getInstance()
    const second = ContentstackClient.getInstance()

    expect(first).toBe(second)
    expect(clientMock).toHaveBeenCalledWith({ authorization: 'auth-1' })
    expect(stackMock).toHaveBeenCalledWith({
      api_key: 'api-key-1',
      management_token: 'auth-1',
      branch_uid: 'main',
    })
    expect(first.stack).toEqual({ __stack: true })
  })
})
