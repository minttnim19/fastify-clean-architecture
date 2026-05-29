import { beforeEach, describe, expect, it, vi } from 'vitest'

const contentTypeQueryFind = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ items: [{ id: 'ct-1' }] })),
)
const contentTypeQuery = vi.hoisted(() => vi.fn(() => ({ find: contentTypeQueryFind })))
const contentTypeFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ id: 'ct-2' })))
const contentType = vi.hoisted(() =>
  vi.fn((uid?: string) => (uid ? { fetch: contentTypeFetch } : { query: contentTypeQuery })),
)

vi.mock('@/infra/http/clients/cs.client', () => ({
  ContentstackClient: {
    getInstance: () => ({ stack: { contentType } }),
  },
}))

describe('ContentstackContentTypeClient', () => {
  beforeEach(() => {
    contentType.mockClear()
    contentTypeQuery.mockClear()
    contentTypeQueryFind.mockClear()
    contentTypeFetch.mockClear()
  })

  it('returns content types list', async () => {
    const { ContentstackContentTypeClient } =
      await import('@/infra/http/clients/cs-content-type.client.impl.js')
    const client = new ContentstackContentTypeClient()

    const items = await client.getContentTypes()

    expect(contentType).toHaveBeenCalledWith()
    expect(contentTypeQuery).toHaveBeenCalledWith()
    expect(contentTypeQueryFind).toHaveBeenCalledWith()
    expect(items).toEqual([{ id: 'ct-1' }])
  })

  it('returns content type by uid', async () => {
    const { ContentstackContentTypeClient } =
      await import('@/infra/http/clients/cs-content-type.client.impl.js')
    const client = new ContentstackContentTypeClient()

    const item = await client.getContentType('uid-1')

    expect(contentType).toHaveBeenCalledWith('uid-1')
    expect(contentTypeFetch).toHaveBeenCalledWith()
    expect(item).toEqual({ id: 'ct-2' })
  })
})
