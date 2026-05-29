export interface IContentstackEntryClient {
  getEntries<T = unknown>(contentTypeUid: string, params?: object): Promise<T[]>
  getEntry<T = unknown>(contentTypeUid: string, entryUid: string): Promise<T>
}
