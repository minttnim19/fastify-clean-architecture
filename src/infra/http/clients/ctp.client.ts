import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk'
import { ClientBuilder } from '@commercetools/sdk-client-v2'

import { env } from '@/infra/config/env'
import { getNumberField, isRecord } from '@/shared/utils/object'

import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk'

export interface CTHttpError {
  statusCode: number
  message: string
  body?: {
    message?: string
    errors?: Array<{ code: string; message: string }>
  }
}

export class CommerceToolsClient {
  private static instance: CommerceToolsClient
  public readonly apiRoot: ByProjectKeyRequestBuilder

  private constructor() {
    const projectKey = env.CTP_PROJECT_KEY

    const ctpClient = new ClientBuilder()
      .withProjectKey(projectKey)
      .withClientCredentialsFlow({
        host: env.CTP_AUTH_URL,
        projectKey,
        credentials: {
          clientId: env.CTP_CLIENT_ID,
          clientSecret: env.CTP_CLIENT_SECRET,
        },
        scopes: env.CTP_SCOPES ? [env.CTP_SCOPES] : undefined,
        fetch,
      })
      .withHttpMiddleware({
        host: env.CTP_API_URL,
        fetch,
      })
      .build()

    this.apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({ projectKey })
  }

  public static getInstance(): CommerceToolsClient {
    if (!CommerceToolsClient.instance) {
      CommerceToolsClient.instance = new CommerceToolsClient()
    }
    return CommerceToolsClient.instance
  }

  static isCTHttpError(error: unknown): error is CTHttpError {
    return isRecord(error) && getNumberField(error, 'statusCode') !== undefined
  }

  static isNotFound(error: unknown): boolean {
    return CommerceToolsClient.isCTHttpError(error) && error.statusCode === 404
  }
}
