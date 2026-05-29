import type { Category } from '@commercetools/platform-sdk'

export type GetCategoriesInput = {
  limit?: number
  offset?: number
  sort?: string[]
  where?: string[]
  expand?: string[]
}

export interface ICommercetoolsCategoryClient {
  getCategories(input?: GetCategoriesInput): Promise<Category[]>
}
