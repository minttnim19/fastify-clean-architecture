import { CommerceToolsClient } from '@/infra/http/clients/ctp.client'

import type { ICommercetoolsStandalonePriceClient } from '@/domain/clients/ctp-standalone-price.client'
import type { StandalonePrice } from '@commercetools/platform-sdk'

export class CommercetoolsStandalonePriceClient implements ICommercetoolsStandalonePriceClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot

  async getStandalonePriceById(id: string): Promise<StandalonePrice> {
    const { body } = await this.apiRoot.standalonePrices().withId({ ID: id }).get().execute()
    return body
  }
}
