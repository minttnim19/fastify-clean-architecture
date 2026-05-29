import { env } from '@/infra/config/env'
import { CommerceToolsClient } from '@/infra/http/clients/ctp.client'

import type { ICommercetoolsInventoryClient } from '@/domain/clients/ctp-inventory.client'
import type { InventoryEntry, InventoryEntryUpdateAction } from '@commercetools/platform-sdk'

export class CommercetoolsInventoryClient implements ICommercetoolsInventoryClient {
  private readonly apiRoot = CommerceToolsClient.getInstance().apiRoot

  async getInventoryBySupplyChannelIds(channelIds: string[]): Promise<InventoryEntry[]> {
    if (channelIds.length === 0) return []

    const results: InventoryEntry[] = []
    const chunks = chunk(channelIds, env.INVENTORY_CHUNK_SIZE)
    for (const ids of chunks) {
      const items = await this.fetchByChannelIds(ids)
      results.push(...items)
    }
    return results
  }

  private async fetchByChannelIds(channelIds: string[]): Promise<InventoryEntry[]> {
    const limit = 500
    let offset = 0
    const results: InventoryEntry[] = []
    const where = `supplyChannel(id in (${channelIds
      .map((id) => `"${escapeWhereValue(id)}"`)
      .join(',')}))`

    while (true) {
      const { body } = await this.apiRoot
        .inventory()
        .get({
          queryArgs: {
            where,
            withTotal: true,
            limit,
            offset,
          },
        })
        .execute()

      results.push(...body.results)
      const total = body.total ?? 0
      offset += body.results.length
      if (offset >= total || body.results.length === 0) break
    }

    return results
  }

  async getInventoryBySkuAndSupplyChannelId(
    sku: string,
    supplyChannelId: string,
  ): Promise<InventoryEntry | null> {
    const where = `sku="${escapeWhereValue(sku)}" and supplyChannel(id="${escapeWhereValue(
      supplyChannelId,
    )}")`
    const { body } = await this.apiRoot
      .inventory()
      .get({
        queryArgs: {
          where,
          limit: 1,
          offset: 0,
          withTotal: true,
        },
      })
      .execute()

    return body.results[0] ?? null
  }

  async addQuantity(
    inventoryId: string,
    version: number,
    quantity: number,
  ): Promise<InventoryEntry> {
    const actions: InventoryEntryUpdateAction[] = [
      {
        action: 'addQuantity',
        quantity,
      },
    ]
    const { body } = await this.apiRoot
      .inventory()
      .withId({ ID: inventoryId.trim() })
      .post({ body: { version, actions } })
      .execute()
    return body
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function escapeWhereValue(value: string): string {
  return value.replaceAll(String.raw`\\`, String.raw`\\\\`).replaceAll('"', String.raw`\"`)
}
