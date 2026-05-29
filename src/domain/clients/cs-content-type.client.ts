export interface IContentstackContentTypeClient {
  getContentTypes<T = unknown>(): Promise<T[]>
  getContentType<T = unknown>(uid: string): Promise<T>
}
