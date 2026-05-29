import { CommerceToolsClient } from '@/infra/http/clients/ctp.client'

import type { ICommercetoolsCustomObjectClient } from '@/domain/clients/ctp-custom-object.client'
import type { CustomObject } from '@commercetools/platform-sdk'

export class CommercetoolsCustomObjectClient implements ICommercetoolsCustomObjectClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot

  async getCustomObject(container: string, key: string): Promise<CustomObject | null> {
    try {
      const { body } = await this.apiRoot
        .customObjects()
        .withContainerAndKey({ container: container.trim(), key: key.trim() })
        .get()
        .execute()
      return body
    } catch (error) {
      if (CommerceToolsClient.isNotFound(error)) return null
      throw error
    }
  }

  async createOrUpdateCustomObject(input: {
    container: string
    key: string
    value: unknown
    version: number
  }): Promise<CustomObject> {
    const { body } = await this.apiRoot
      .customObjects()
      .post({
        body: {
          container: input.container.trim(),
          key: input.key.trim(),
          value: input.value,
          version: input.version,
        },
      })
      .execute()
    return body
  }
}
