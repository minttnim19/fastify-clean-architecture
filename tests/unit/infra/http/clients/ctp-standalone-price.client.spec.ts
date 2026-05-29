import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() => vi.fn(() => Promise.resolve({ body: { id: 'standalone-1' } })))
const get = vi.hoisted(() => vi.fn(() => ({ execute })))
const withId = vi.hoisted(() => vi.fn(() => ({ get })))
const standalonePrices = vi.hoisted(() => vi.fn(() => ({ withId })))

vi.mock('@/infra/http/clients/ctp.client', () => ({
  CommerceToolsClient: {
    getInstance: () => ({ apiRoot: { standalonePrices } }),
  },
}))

describe('CommercetoolsStandalonePriceClient', () => {
  beforeEach(() => {
    standalonePrices.mockClear()
    withId.mockClear()
    get.mockClear()
    execute.mockClear()
  })

  it('gets standalone price by id', async () => {
    const { CommercetoolsStandalonePriceClient } =
      await import('@/infra/http/clients/ctp-standalone-price.client.impl.js')
    const client = new CommercetoolsStandalonePriceClient()

    const result = await client.getStandalonePriceById('standalone-1')

    expect(standalonePrices).toHaveBeenCalledWith()
    expect(withId).toHaveBeenCalledWith({ ID: 'standalone-1' })
    expect(get).toHaveBeenCalledWith()
    expect(execute).toHaveBeenCalledWith()
    expect(result).toEqual({ id: 'standalone-1' })
  })
})
