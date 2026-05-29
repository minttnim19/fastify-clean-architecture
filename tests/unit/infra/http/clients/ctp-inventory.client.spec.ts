import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infra/config/env', () => ({
  env: {
    INVENTORY_CHUNK_SIZE: 100,
  },
}))

const execute = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn(() => ({ execute })))
const post = vi.hoisted(() => vi.fn(() => ({ execute })))
const withId = vi.hoisted(() => vi.fn(() => ({ post })))
const inventory = vi.hoisted(() => vi.fn(() => ({ get, withId })))

vi.mock('@/infra/http/clients/ctp.client', () => ({
  CommerceToolsClient: {
    getInstance: () => ({ apiRoot: { inventory } }),
  },
}))

describe('CommercetoolsInventoryClient', () => {
  beforeEach(() => {
    inventory.mockClear()
    get.mockClear()
    withId.mockClear()
    post.mockClear()
    execute.mockReset()
  })

  it('returns empty list when channelIds is empty', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    const result = await client.getInventoryBySupplyChannelIds([])

    expect(result).toEqual([])
    expect(inventory).not.toHaveBeenCalled()
  })

  it('fetches inventory by channel ids in chunks', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    execute.mockResolvedValue({ body: { total: 1, results: [{ id: 'inv-1' }] } })

    const channelIds = Array.from({ length: 21 }, (_, i) => `id-${i}`)
    const result = await client.getInventoryBySupplyChannelIds(channelIds)

    expect(inventory).toHaveBeenCalledWith()
    const expectedChunks = Math.ceil(channelIds.length / 100)
    expect(get).toHaveBeenCalledTimes(expectedChunks)
    expect(result).toEqual(Array.from({ length: expectedChunks }, () => ({ id: 'inv-1' })))
  })

  it('handles empty results and missing total when fetching by channel ids', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    execute.mockResolvedValueOnce({ body: { results: [] } })
    const result = await client.getInventoryBySupplyChannelIds(['id-1'])

    expect(result).toEqual([])
  })

  it('continues pagination when offset is below total', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    execute
      .mockResolvedValueOnce({ body: { total: 3, results: [{ id: 'inv-a' }] } })
      .mockResolvedValueOnce({ body: { total: 3, results: [{ id: 'inv-b' }] } })
      .mockResolvedValueOnce({ body: { total: 3, results: [{ id: 'inv-c' }] } })

    const result = await client.getInventoryBySupplyChannelIds(['id-1'])

    expect(get).toHaveBeenCalledTimes(3)
    expect(result).toEqual([{ id: 'inv-a' }, { id: 'inv-b' }, { id: 'inv-c' }])
  })

  it('gets inventory by sku and supply channel id', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    execute.mockResolvedValueOnce({ body: { results: [{ id: 'inv-2' }] } })
    const result = await client.getInventoryBySkuAndSupplyChannelId('sku-1', 'channel-1')

    expect(inventory).toHaveBeenCalledWith()
    expect(get).toHaveBeenCalledWith({
      queryArgs: {
        where: 'sku="sku-1" and supplyChannel(id="channel-1")',
        limit: 1,
        offset: 0,
        withTotal: true,
      },
    })
    expect(result).toEqual({ id: 'inv-2' })

    execute.mockResolvedValueOnce({ body: { results: [] } })
    const empty = await client.getInventoryBySkuAndSupplyChannelId('sku-2', 'channel-2')
    expect(empty).toBeNull()
  })

  it('adds quantity to inventory', async () => {
    const { CommercetoolsInventoryClient } =
      await import('@/infra/http/clients/ctp-inventory.client.impl.js')
    const client = new CommercetoolsInventoryClient()

    execute.mockResolvedValueOnce({ body: { id: 'inv-3' } })

    const result = await client.addQuantity(' inv-3 ', 7, 4)

    expect(withId).toHaveBeenCalledWith({ ID: 'inv-3' })
    expect(post).toHaveBeenCalledWith({
      body: { version: 7, actions: [{ action: 'addQuantity', quantity: 4 }] },
    })
    expect(result).toEqual({ id: 'inv-3' })
  })
})
