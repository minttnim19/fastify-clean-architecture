import * as contentstack from '@contentstack/management'

import { env } from '@/infra/config/env'

import type { Stack } from '@contentstack/management/types/stack'

export class ContentstackClient {
  private static instance: ContentstackClient

  public readonly stack: Stack

  private constructor() {
    const client = contentstack.client({ authorization: env.CS_AUTHORIZATION })

    this.stack = client.stack({
      api_key: env.CS_API_KEY,
      management_token: env.CS_AUTHORIZATION,
      branch_uid: env.CS_BRANCH,
    })
  }

  public static getInstance(): ContentstackClient {
    if (!ContentstackClient.instance) {
      ContentstackClient.instance = new ContentstackClient()
    }
    return ContentstackClient.instance
  }
}
