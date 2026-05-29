import type { CustomObject } from '@commercetools/platform-sdk'

export interface ICommercetoolsCustomObjectClient {
  getCustomObject(container: string, key: string): Promise<CustomObject | null>
  createOrUpdateCustomObject(input: {
    container: string
    key: string
    value: unknown
    version: number
  }): Promise<CustomObject>
}
