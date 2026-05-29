import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeGet = vi.hoisted(() => vi.fn())
const executePost = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn(() => ({ execute: executeGet })))
const post = vi.hoisted(() => vi.fn(() => ({ execute: executePost })))
const withContainerAndKey = vi.hoisted(() => vi.fn(() => ({ get })))
const customObjects = vi.hoisted(() => vi.fn(() => ({ withContainerAndKey, post })))

vi.mock('@/infra/http/clients/ctp.client', () => ({
  CommerceToolsClient: {
    getInstance: () => ({ apiRoot: { customObjects } }),
    isNotFound: (error: { statusCode?: number }) => error?.statusCode === 404,
  },
}))

describe('CommercetoolsCustomObjectClient', () => {
  beforeEach(() => {
    customObjects.mockClear()
    withContainerAndKey.mockClear()
    get.mockClear()
    post.mockClear()
    executeGet.mockReset()
    executePost.mockReset()
  })

  it('gets custom object and trims inputs', async () => {
    const { CommercetoolsCustomObjectClient } =
      await import('@/infra/http/clients/ctp-custom-object.client.impl.js')
    const client = new CommercetoolsCustomObjectClient()

    executeGet.mockResolvedValueOnce({ body: { id: 'obj-1' } })
    const result = await client.getCustomObject(' container ', ' key ')

    expect(customObjects).toHaveBeenCalledWith()
    expect(withContainerAndKey).toHaveBeenCalledWith({ container: 'container', key: 'key' })
    expect(get).toHaveBeenCalledWith()
    expect(executeGet).toHaveBeenCalledWith()
    expect(result).toEqual({ id: 'obj-1' })
  })

  it('returns null on not found', async () => {
    const { CommercetoolsCustomObjectClient } =
      await import('@/infra/http/clients/ctp-custom-object.client.impl.js')
    const client = new CommercetoolsCustomObjectClient()

    executeGet.mockRejectedValueOnce({ statusCode: 404 })
    const result = await client.getCustomObject('container', 'key')

    expect(result).toBeNull()
  })

  it('throws on non-not-found errors', async () => {
    const { CommercetoolsCustomObjectClient } =
      await import('@/infra/http/clients/ctp-custom-object.client.impl.js')
    const client = new CommercetoolsCustomObjectClient()

    executeGet.mockRejectedValueOnce(new Error('boom'))

    await expect(client.getCustomObject('container', 'key')).rejects.toThrow('boom')
  })

  it('creates or updates custom object and trims inputs', async () => {
    const { CommercetoolsCustomObjectClient } =
      await import('@/infra/http/clients/ctp-custom-object.client.impl.js')
    const client = new CommercetoolsCustomObjectClient()

    executePost.mockResolvedValueOnce({ body: { id: 'obj-2' } })
    const result = await client.createOrUpdateCustomObject({
      container: ' container ',
      key: ' key ',
      value: 1,
      version: 2,
    })

    expect(customObjects).toHaveBeenCalledWith()
    expect(post).toHaveBeenCalledWith({
      body: { container: 'container', key: 'key', value: 1, version: 2 },
    })
    expect(executePost).toHaveBeenCalledWith()
    expect(result).toEqual({ id: 'obj-2' })
  })
})
