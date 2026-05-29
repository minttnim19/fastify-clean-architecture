export interface IContentstackAssetClient {
  getAssets<T = unknown>(): Promise<T[]>
  getAsset<T = unknown>(uid: string): Promise<T>
}
