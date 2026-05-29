import { ContentstackClient } from '@/infra/http/clients/cs.client'

import type { IContentstackAssetClient } from '@/domain/clients/cs-asset.client'

export class ContentstackAssetClient implements IContentstackAssetClient {
  private readonly stack = ContentstackClient.getInstance().stack

  async getAssets<T = unknown>(): Promise<T[]> {
    const result = await this.stack.asset().query().find()

    return result.items as T[]
  }

  async getAsset<T = unknown>(uid: string): Promise<T> {
    const result = await this.stack.asset(uid).fetch()

    return result as T
  }
}
