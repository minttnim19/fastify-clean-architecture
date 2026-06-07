import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'

import { create as createAxiosInstance, isAxiosError } from 'axios'

import { env } from '@/infra/config/env'
import { requestContext } from '@/infra/http/context/request-context'
import { createLogModel, logger } from '@/infra/logger/col-logger'

import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

type RequestMetadata = {
  logModel?: ReturnType<typeof createLogModel>
  method?: string
  endpoint?: string
  request?: unknown
}
type InternalConfigWithMeta = InternalAxiosRequestConfig & { metadata?: RequestMetadata }
type ResponseConfigWithMeta = AxiosRequestConfig & { metadata?: RequestMetadata }

export type HttpClientOptions = {
  baseURL?: string
  timeoutMs?: number
  headers?: Record<string, string>
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message))
  }
  return new Error(String(error))
}

function resolveEndpoint(baseURL?: string, url?: string): string {
  if (url && /^(?:[a-z]+:)?\/\//i.test(url)) return url
  if (baseURL && url) return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
  return url ?? baseURL ?? ''
}

function resolveLogModel(): ReturnType<typeof createLogModel> | undefined {
  const ctx = requestContext.get()
  if (!ctx?.correlatorId && !ctx?.channel) return undefined
  return createLogModel({ txid: ctx?.correlatorId, channel: ctx?.channel })
}

function toMetadata(config: InternalAxiosRequestConfig): RequestMetadata {
  const { url, baseURL } = config
  return {
    logModel: resolveLogModel(),
    method: config.method?.toUpperCase(),
    endpoint: resolveEndpoint(baseURL, typeof url === 'string' ? url : undefined),
    request: config.data,
  }
}

function createAxios(options?: HttpClientOptions): AxiosInstance {
  const instance = createAxiosInstance({
    baseURL: options?.baseURL,
    timeout: options?.timeoutMs ?? env.HTTP_TIMEOUT_MS,
    httpAgent: new HttpAgent({ keepAlive: true }),
    httpsAgent: new HttpsAgent({ keepAlive: true }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
  })

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { url, baseURL } = config
    const cfg = config as InternalConfigWithMeta
    cfg.metadata = toMetadata(config)

    // Guard: prevent relative path if no baseURL configured
    const isAbsolute = typeof url === 'string' && /^(?:[a-z]+:)?\/\//i.test(url)
    if (!baseURL && url && !isAbsolute) {
      throw new Error(
        `HTTP client called with relative URL "${url}" but no baseURL is set. Pass an absolute URL or create a client with baseURL.`,
      )
    }
    return cfg
  })

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const cfg = response.config as ResponseConfigWithMeta
      const meta = cfg.metadata
      meta?.logModel?.logStep('HTTP client request', {
        activity_name: 'http-client-request',
        method: meta.method ?? cfg.method?.toUpperCase(),
        endpoint: meta.endpoint ?? resolveEndpoint(cfg.baseURL, cfg.url),
        step_request: meta.request ?? cfg.data,
        step_response: response.data,
        result_code: String(response.status),
      })

      return response
    },
    (error: unknown) => {
      if (isAxiosError(error)) {
        const cfg = error.config as ResponseConfigWithMeta | undefined
        cfg?.metadata?.logModel?.logStep('HTTP client request error', {
          activity_name: 'http-client-request',
          error,
        })
      } else {
        logger.warn({ error }, 'Unknown HTTP error')
      }

      return Promise.reject(toError(error))
    },
  )

  return instance
}

export const httpClient: AxiosInstance = createAxios()

export type HttpRequestConfig = AxiosRequestConfig

export function createHttpClient(options?: HttpClientOptions): AxiosInstance {
  return createAxios(options)
}

export async function httpGet<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T> {
  const res = await httpClient.get<T>(url, config)
  return res.data
}

export async function httpPost<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: HttpRequestConfig,
): Promise<T> {
  const res = await httpClient.post<T>(url, body, config)
  return res.data
}

export async function httpPut<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: HttpRequestConfig,
): Promise<T> {
  const res = await httpClient.put<T>(url, body, config)
  return res.data
}

export async function httpDelete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T> {
  const res = await httpClient.delete<T>(url, config)
  return res.data
}
