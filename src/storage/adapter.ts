import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap } from '../types'

/**
 * 保存先の抽象化。
 * 初期版は LocalStorageAdapter を使う。将来 Supabase 等で複数端末同期する場合は
 * 同じインターフェースを実装したアダプタを作り、src/storage/index.ts で差し替える。
 * すべて Promise を返すのはリモート保存を想定しているため。
 */
export interface StorageAdapter {
  /** 所持記録（号ID → 状態） */
  loadOwnership(): Promise<OwnershipMap>
  saveOwnership(map: OwnershipMap): Promise<void>

  /** ユーザーが編集した刊行号データ（年 → カタログ）。所持記録とは別キーに保存 */
  loadCatalogOverrides(): Promise<Record<number, CatalogYear>>
  saveCatalogOverrides(overrides: Record<number, CatalogYear>): Promise<void>

  /** ジャンプコミックスのシリーズ一覧（刊行データ側）。所持記録とは別キーに保存 */
  loadComicsSeries(): Promise<ComicSeries[]>
  saveComicsSeries(series: ComicSeries[]): Promise<void>

  /** 折込冊子コレクション（コレクションID → 最新号）。所持記録とは別キーに保存 */
  loadInserts(): Promise<Record<string, InsertCollection>>
  saveInserts(inserts: Record<string, InsertCollection>): Promise<void>
}
