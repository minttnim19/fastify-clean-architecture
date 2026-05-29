import type { InventoryEntry } from '@commercetools/platform-sdk'

export interface ICommercetoolsInventoryClient {
  getInventoryBySupplyChannelIds(channelIds: string[]): Promise<InventoryEntry[]>
  getInventoryBySkuAndSupplyChannelId(
    sku: string,
    supplyChannelId: string,
  ): Promise<InventoryEntry | null>
  addQuantity(inventoryId: string, version: number, quantity: number): Promise<InventoryEntry>
}
