import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockProductSearchResponse = {
  body: {
    limit: number
    offset: number
    count: number
    total?: number
    results: Array<{ id: string }>
    facets: Record<string, unknown>
  }
}

const execute = vi.hoisted(() => vi.fn(() => Promise.resolve({ body: { id: 'product-1' } })))
const get = vi.hoisted(() => vi.fn(() => ({ execute })))
const withId = vi.hoisted(() => vi.fn(() => ({ get })))
const products = vi.hoisted(() => vi.fn(() => ({ withId })))
const productSearchExecute = vi.hoisted(() =>
  vi.fn<() => Promise<MockProductSearchResponse>>(() =>
    Promise.resolve({
      body: {
        limit: 100,
        offset: 0,
        count: 1,
        total: 1,
        results: [{ id: 'product-1' }],
        facets: {},
      },
    }),
  ),
)
const productSearchGet = vi.hoisted(() => vi.fn(() => ({ execute: productSearchExecute })))
const search = vi.hoisted(() => vi.fn(() => ({ get: productSearchGet })))
const productProjections = vi.hoisted(() => vi.fn(() => ({ search })))

vi.mock('@/infra/http/clients/ctp.client', () => ({
  CommerceToolsClient: {
    getInstance: () => ({ apiRoot: { products, productProjections } }),
  },
}))

describe('CommercetoolsProductClient', () => {
  beforeEach(() => {
    products.mockClear()
    withId.mockClear()
    get.mockClear()
    execute.mockClear()
    productProjections.mockClear()
    search.mockClear()
    productSearchGet.mockClear()
    productSearchExecute.mockClear()
  })

  it('gets product by id with expand query', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.getProductById('product-1')

    expect(products).toHaveBeenCalledWith()
    expect(withId).toHaveBeenCalledWith({ ID: 'product-1' })
    expect(get).toHaveBeenCalledWith({
      queryArgs: {
        expand: ['productType'],
      },
    })
    expect(execute).toHaveBeenCalledWith()
    expect(result).toEqual({ id: 'product-1' })
  })

  it('searches products by category ids', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      limit: 100,
      staged: true,
      expand: ['categories[*]'],
    })

    expect(productProjections).toHaveBeenCalledWith()
    expect(search).toHaveBeenCalledWith()
    expect(productSearchGet).toHaveBeenCalledWith({
      queryArgs: {
        limit: 100,
        staged: true,
        expand: ['categories[*]'],
        filter: ['categories.id:"category-1"'],
      },
    })
    expect(result).toEqual([{ id: 'product-1' }])
  })

  it('passes sort arguments to product search', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
      sort: ['categoryOrderHints.category-1 asc'],
    })

    expect(productSearchGet).toHaveBeenCalledWith({
      queryArgs: {
        staged: true,
        sort: ['categoryOrderHints.category-1 asc'],
        filter: ['categories.id:"category-1"'],
      },
    })
  })

  it('searches all product pages by category ids when limit is omitted', async () => {
    productSearchExecute
      .mockResolvedValueOnce({
        body: {
          limit: 2,
          offset: 0,
          count: 2,
          total: 3,
          results: [{ id: 'product-1' }, { id: 'product-2' }],
          facets: {},
        },
      })
      .mockResolvedValueOnce({
        body: {
          limit: 2,
          offset: 2,
          count: 1,
          total: 3,
          results: [{ id: 'product-3' }],
          facets: {},
        },
      })

    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
      expand: ['categories[*]'],
    })

    expect(productSearchGet).toHaveBeenNthCalledWith(1, {
      queryArgs: {
        staged: true,
        expand: ['categories[*]'],
        filter: ['categories.id:"category-1"'],
      },
    })
    expect(productSearchGet).toHaveBeenNthCalledWith(2, {
      queryArgs: {
        limit: 2,
        offset: 2,
        staged: true,
        expand: ['categories[*]'],
        filter: ['categories.id:"category-1"'],
      },
    })
    expect(result).toEqual([{ id: 'product-1' }, { id: 'product-2' }, { id: 'product-3' }])
  })

  it('gets all product projections without filters', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.getProducts({
      limit: 100,
      staged: true,
      expand: ['categories[*]'],
    })

    expect(productProjections).toHaveBeenCalledWith()
    expect(search).toHaveBeenCalledWith()
    expect(productSearchGet).toHaveBeenCalledWith({
      queryArgs: {
        limit: 100,
        staged: true,
        expand: ['categories[*]'],
      },
    })
    expect(result).toEqual({
      limit: 100,
      offset: 0,
      count: 1,
      total: 1,
      results: [{ id: 'product-1' }],
      facets: {},
    })
  })

  it('gets all product projections with empty input', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    await client.getProducts()

    expect(productSearchGet).toHaveBeenCalledWith({
      queryArgs: {},
    })
  })

  it('returns empty product search response when category ids are empty', async () => {
    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: [],
      limit: 100,
      staged: true,
    })

    expect(productProjections).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('returns the first page when total results fit in a single page', async () => {
    productSearchExecute.mockResolvedValueOnce({
      body: {
        limit: 2,
        offset: 0,
        count: 2,
        total: 2,
        results: [{ id: 'product-1' }, { id: 'product-2' }],
        facets: {},
      },
    })

    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
    })

    expect(result).toEqual([{ id: 'product-1' }, { id: 'product-2' }])
    expect(productSearchGet).toHaveBeenCalledTimes(1)
  })

  it('stops paging when the next page is empty', async () => {
    productSearchExecute
      .mockResolvedValueOnce({
        body: {
          limit: 2,
          offset: 0,
          count: 2,
          total: 4,
          results: [{ id: 'product-1' }, { id: 'product-2' }],
          facets: {},
        },
      })
      .mockResolvedValueOnce({
        body: {
          limit: 2,
          offset: 2,
          count: 0,
          total: 4,
          results: [],
          facets: {},
        },
      })

    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
    })

    expect(result).toEqual([{ id: 'product-1' }, { id: 'product-2' }])
    expect(productSearchGet).toHaveBeenNthCalledWith(2, {
      queryArgs: {
        limit: 2,
        offset: 2,
        staged: true,
        filter: ['categories.id:"category-1"'],
      },
    })
  })

  it('falls back to result lengths when page limits or totals are missing', async () => {
    productSearchExecute
      .mockResolvedValueOnce({
        body: {
          limit: 0,
          offset: 0,
          count: 1,
          total: 3,
          results: [{ id: 'product-1' }],
          facets: {},
        },
      })
      .mockResolvedValueOnce({
        body: {
          limit: 0,
          offset: 1,
          count: 1,
          total: 3,
          results: [{ id: 'product-2' }],
          facets: {},
        },
      })
      .mockResolvedValueOnce({
        body: {
          limit: 0,
          offset: 2,
          count: 1,
          total: 3,
          results: [{ id: 'product-3' }],
          facets: {},
        },
      })

    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
    })

    expect(result).toEqual([{ id: 'product-1' }, { id: 'product-2' }, { id: 'product-3' }])
    expect(productSearchGet).toHaveBeenNthCalledWith(2, {
      queryArgs: {
        limit: 1,
        offset: 1,
        staged: true,
        filter: ['categories.id:"category-1"'],
      },
    })
    expect(productSearchGet).toHaveBeenNthCalledWith(3, {
      queryArgs: {
        limit: 1,
        offset: 2,
        staged: true,
        filter: ['categories.id:"category-1"'],
      },
    })
  })

  it('falls back to first page result length when total is omitted', async () => {
    productSearchExecute.mockResolvedValueOnce({
      body: {
        limit: 1,
        offset: 0,
        count: 1,
        results: [{ id: 'product-1' }],
        facets: {},
      },
    })

    const { CommercetoolsProductClient } =
      await import('@/infra/http/clients/ctp-product.client.impl.js')
    const client = new CommercetoolsProductClient()

    const result = await client.searchProductsByCategoryIds({
      categoryIds: ['category-1'],
      staged: true,
    })

    expect(result).toEqual([{ id: 'product-1' }])
    expect(productSearchGet).toHaveBeenCalledOnce()
  })
})
