import type {
  Product,
  ProductProjection,
  ProductProjectionPagedSearchResponse,
} from '@commercetools/platform-sdk'

export type GetProductsInput = {
  limit?: number
  staged?: boolean
  expand?: string[]
}

export type SearchProductsByCategoryIdsInput = {
  categoryIds: string[]
  limit?: number
  staged?: boolean
  expand?: string[]
  sort?: string[]
}

export interface ICommercetoolsProductClient {
  getProductById(productId: string): Promise<Product>
  getProducts(input?: GetProductsInput): Promise<ProductProjectionPagedSearchResponse>
  searchProductsByCategoryIds(input: SearchProductsByCategoryIdsInput): Promise<ProductProjection[]>
}
