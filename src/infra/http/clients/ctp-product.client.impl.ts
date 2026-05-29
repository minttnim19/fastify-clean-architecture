import { CommerceToolsClient } from '@/infra/http/clients/ctp.client'

import type {
  GetProductsInput,
  ICommercetoolsProductClient,
  SearchProductsByCategoryIdsInput,
} from '@/domain/clients/ctp-product.client'
import type {
  Product,
  ProductProjection,
  ProductProjectionPagedSearchResponse,
} from '@commercetools/platform-sdk'

export class CommercetoolsProductClient implements ICommercetoolsProductClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot

  private async executeProductSearch(queryArgs: {
    limit?: number
    offset?: number
    staged?: boolean
    expand?: string[]
    filter?: string[]
    sort?: string[]
  }): Promise<ProductProjectionPagedSearchResponse> {
    const { body } = await this.apiRoot.productProjections().search().get({ queryArgs }).execute()

    return body
  }

  async getProductById(productId: string): Promise<Product> {
    const { body } = await this.apiRoot
      .products()
      .withId({ ID: productId })
      .get({
        queryArgs: {
          expand: ['productType'],
        },
      })
      .execute()

    return body
  }

  async getProducts(input: GetProductsInput = {}): Promise<ProductProjectionPagedSearchResponse> {
    return this.executeProductSearch({
      ...(input.limit !== undefined && { limit: input.limit }),
      ...(input.staged !== undefined && { staged: input.staged }),
      ...(input.expand && input.expand.length > 0 && { expand: input.expand }),
    })
  }

  async searchProductsByCategoryIds(
    input: SearchProductsByCategoryIdsInput,
  ): Promise<ProductProjection[]> {
    if (input.categoryIds.length === 0) {
      return []
    }

    const quotedCategoryIds = input.categoryIds.map((id) => `"${id}"`).join(',')
    const categoryFilter = `categories.id:${quotedCategoryIds}`
    const queryArgs = {
      ...(input.limit !== undefined && { limit: input.limit }),
      ...(input.staged !== undefined && { staged: input.staged }),
      ...(input.expand && input.expand.length > 0 && { expand: input.expand }),
      ...(input.sort && input.sort.length > 0 && { sort: input.sort }),
      filter: [categoryFilter],
    }

    if (input.limit !== undefined) {
      const response = await this.executeProductSearch(queryArgs)
      return response.results
    }

    const firstPage = await this.executeProductSearch(queryArgs)
    const pageLimit = firstPage.limit > 0 ? firstPage.limit : firstPage.results.length
    const total = firstPage.total ?? firstPage.results.length

    if (pageLimit === 0 || total <= firstPage.results.length) {
      return firstPage.results
    }

    const results = [...firstPage.results]
    let offset = firstPage.offset + pageLimit

    while (offset < total) {
      const nextPage = await this.executeProductSearch({
        ...queryArgs,
        limit: pageLimit,
        offset,
      })
      results.push(...nextPage.results)

      if (nextPage.results.length === 0) {
        break
      }

      offset += nextPage.limit > 0 ? nextPage.limit : nextPage.results.length
    }

    return results
  }
}
