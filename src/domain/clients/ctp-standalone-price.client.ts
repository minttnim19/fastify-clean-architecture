import type { StandalonePrice } from '@commercetools/platform-sdk'

export interface ICommercetoolsStandalonePriceClient {
  getStandalonePriceById(id: string): Promise<StandalonePrice>
}
