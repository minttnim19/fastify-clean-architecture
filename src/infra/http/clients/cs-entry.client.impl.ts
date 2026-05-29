import { ContentstackClient } from '@/infra/http/clients/cs.client'

import type { IContentstackEntryClient } from '@/domain/clients/cs-entry.client'

export class ContentstackEntryClient implements IContentstackEntryClient {
  private readonly stack = ContentstackClient.getInstance().stack

  async getEntries<T = unknown>(contentTypeUid: string, params?: object): Promise<T[]> {
    const result = await this.stack
      .contentType(contentTypeUid)
      .entry()
      .query({ ...params })
      .find()

    return result.items as T[]
  }

  async getEntry<T = unknown>(contentTypeUid: string, entryUid: string): Promise<T> {
    const result = await this.stack.contentType(contentTypeUid).entry(entryUid).fetch()

    return result as T
  }
}
