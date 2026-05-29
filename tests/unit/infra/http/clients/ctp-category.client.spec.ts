import { beforeEach, describe, expect, it, vi } from 'vitest'

const categoryExecute = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ body: { results: [{ id: 'category-1' }] } })),
)
const categoryGet = vi.hoisted(() => vi.fn(() => ({ execute: categoryExecute })))
const categories = vi.hoisted(() => vi.fn(() => ({ get: categoryGet })))

vi.mock('@/infra/http/clients/ctp.client', () => ({
  CommerceToolsClient: {
    getInstance: () => ({ apiRoot: { categories } }),
  },
}))

describe('CommercetoolsCategoryClient', () => {
  beforeEach(() => {
    categories.mockClear()
    categoryGet.mockClear()
    categoryExecute.mockClear()
  })

  it('gets categories with query args', async () => {
    const { CommercetoolsCategoryClient } =
      await import('@/infra/http/clients/ctp-category.client.impl.js')
    const client = new CommercetoolsCategoryClient()

    const result = await client.getCategories({
      limit: 10,
      offset: 20,
      sort: ['name.en asc'],
      where: ['parent is not defined'],
      expand: ['parent'],
    })

    expect(categories).toHaveBeenCalledWith()
    expect(categoryGet).toHaveBeenCalledWith({
      queryArgs: {
        limit: 10,
        offset: 20,
        sort: ['name.en asc'],
        where: ['parent is not defined'],
        expand: ['parent'],
      },
    })
    expect(categoryExecute).toHaveBeenCalledWith()
    expect(result).toEqual([{ id: 'category-1' }])
  })
})
