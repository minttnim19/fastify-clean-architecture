import { ContentstackClient } from '@/infra/http/clients/cs.client'

import type { IContentstackContentTypeClient } from '@/domain/clients/cs-content-type.client'

export class ContentstackContentTypeClient implements IContentstackContentTypeClient {
  private readonly stack = ContentstackClient.getInstance().stack

  async getContentTypes<T = unknown>(): Promise<T[]> {
    const result = await this.stack.contentType().query().find()

    return result.items as T[]
  }

  async getContentType<T = unknown>(uid: string): Promise<T> {
    const result = await this.stack.contentType(uid).fetch()

    return result as T
  }
}
