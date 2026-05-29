import { beforeEach, describe, expect, it, vi } from 'vitest'

const entryQueryFind = vi.hoisted(() => vi.fn(() => Promise.resolve({ items: [{ id: 'e-1' }] })))
const entryQuery = vi.hoisted(() => vi.fn(() => ({ find: entryQueryFind })))
const entryFetch = vi.hoisted(() => vi.fn(() => Promise.resolve({ id: 'e-2' })))
const entry = vi.hoisted(() =>
  vi.fn((uid?: string) => (uid ? { fetch: entryFetch } : { query: entryQuery })),
)
const contentType = vi.hoisted(() => vi.fn(() => ({ entry })))

vi.mock('@/infra/http/clients/cs.client', () => ({
  ContentstackClient: {
    getInstance: () => ({ stack: { contentType } }),
  },
}))

describe('ContentstackEntryClient', () => {
  beforeEach(() => {
    contentType.mockClear()
    entry.mockClear()
    entryQuery.mockClear()
    entryQueryFind.mockClear()
    entryFetch.mockClear()
  })

  it('returns entries with params', async () => {
    const { ContentstackEntryClient } = await import('@/infra/http/clients/cs-entry.client.impl.js')
    const client = new ContentstackEntryClient()

    const items = await client.getEntries('content-type-1', { locale: 'en-us' })

    expect(contentType).toHaveBeenCalledWith('content-type-1')
    expect(entry).toHaveBeenCalledWith()
    expect(entryQuery).toHaveBeenCalledWith({ locale: 'en-us' })
    expect(entryQueryFind).toHaveBeenCalledWith()
    expect(items).toEqual([{ id: 'e-1' }])
  })

  it('returns entries with empty params when omitted', async () => {
    const { ContentstackEntryClient } = await import('@/infra/http/clients/cs-entry.client.impl.js')
    const client = new ContentstackEntryClient()

    await client.getEntries('content-type-2')

    expect(contentType).toHaveBeenCalledWith('content-type-2')
    expect(entry).toHaveBeenCalledWith()
    expect(entryQuery).toHaveBeenCalledWith({})
  })

  it('returns entry by uid', async () => {
    const { ContentstackEntryClient } = await import('@/infra/http/clients/cs-entry.client.impl.js')
    const client = new ContentstackEntryClient()

    const item = await client.getEntry('content-type-3', 'entry-1')

    expect(contentType).toHaveBeenCalledWith('content-type-3')
    expect(entry).toHaveBeenCalledWith('entry-1')
    expect(entryFetch).toHaveBeenCalledWith()
    expect(item).toEqual({ id: 'e-2' })
  })
})
