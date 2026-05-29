import { CommerceToolsClient } from '@/infra/http/clients/ctp.client'

import type {
  GetCategoriesInput,
  ICommercetoolsCategoryClient,
} from '@/domain/clients/ctp-category.client'
import type { Category } from '@commercetools/platform-sdk'

export class CommercetoolsCategoryClient implements ICommercetoolsCategoryClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot

  async getCategories(input: GetCategoriesInput = {}): Promise<Category[]> {
    const { body } = await this.apiRoot
      .categories()
      .get({
        queryArgs: {
          ...(input.limit !== undefined && { limit: input.limit }),
          ...(input.offset !== undefined && { offset: input.offset }),
          ...(input.sort && input.sort.length > 0 && { sort: input.sort }),
          ...(input.where && input.where.length > 0 && { where: input.where }),
          ...(input.expand && input.expand.length > 0 && { expand: input.expand }),
        },
      })
      .execute()

    return body.results
  }
}
