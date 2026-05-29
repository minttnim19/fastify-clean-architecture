import { beforeEach, describe, expect, it, vi } from 'vitest'

const assetQueryFind = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ items: [{ id: 'asset-1' }] })),
)
const assetQuery = vi.hoisted(() => vi.fn(() => ({ find: assetQueryFind })))
const assetFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ id: 'asset-2' })))
const asset = vi.hoisted(() =>
  vi.fn((uid?: string) => (uid ? { fetch: assetFetch } : { query: assetQuery })),
)

vi.mock('@/infra/http/clients/cs.client', () => ({
  ContentstackClient: {
    getInstance: () => ({ stack: { asset } }),
  },
}))

describe('ContentstackAssetClient', () => {
  beforeEach(() => {
    asset.mockClear()
    assetQuery.mockClear()
    assetQueryFind.mockClear()
    assetFetch.mockClear()
  })

  it('returns assets list', async () => {
    const { ContentstackAssetClient } = await import('@/infra/http/clients/cs-asset.client.impl.js')
    const client = new ContentstackAssetClient()

    const items = await client.getAssets()

    expect(asset).toHaveBeenCalledWith()
    expect(assetQuery).toHaveBeenCalledWith()
    expect(assetQueryFind).toHaveBeenCalledWith()
    expect(items).toEqual([{ id: 'asset-1' }])
  })

  it('returns asset by uid', async () => {
    const { ContentstackAssetClient } = await import('@/infra/http/clients/cs-asset.client.impl.js')
    const client = new ContentstackAssetClient()

    const item = await client.getAsset('uid-1')

    expect(asset).toHaveBeenCalledWith('uid-1')
    expect(assetFetch).toHaveBeenCalledWith()
    expect(item).toEqual({ id: 'asset-2' })
  })
})
