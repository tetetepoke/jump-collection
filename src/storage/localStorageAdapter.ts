import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap } from '../types'
import type { StorageAdapter } from './adapter'

export const OWNERSHIP_KEY = 'jump-collection:ownership:v1'
export const CATALOG_KEY = 'jump-collection:catalog-overrides:v1'
export const COMICS_KEY = 'jump-collection:comics-series:v1'
export const INSERTS_KEY = 'jump-collection:inserts:v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage への保存に失敗しました', e)
    throw e
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async loadOwnership(): Promise<OwnershipMap> {
    return read<OwnershipMap>(OWNERSHIP_KEY, {})
  }
  async saveOwnership(map: OwnershipMap): Promise<void> {
    write(OWNERSHIP_KEY, map)
  }
  async loadCatalogOverrides(): Promise<Record<number, CatalogYear>> {
    return read<Record<number, CatalogYear>>(CATALOG_KEY, {})
  }
  async saveCatalogOverrides(overrides: Record<number, CatalogYear>): Promise<void> {
    write(CATALOG_KEY, overrides)
  }
  async loadComicsSeries(): Promise<ComicSeries[]> {
    return read<ComicSeries[]>(COMICS_KEY, [])
  }
  async saveComicsSeries(series: ComicSeries[]): Promise<void> {
    write(COMICS_KEY, series)
  }
  async loadInserts(): Promise<Record<string, InsertCollection>> {
    return read<Record<string, InsertCollection>>(INSERTS_KEY, {})
  }
  async saveInserts(inserts: Record<string, InsertCollection>): Promise<void> {
    write(INSERTS_KEY, inserts)
  }
}
