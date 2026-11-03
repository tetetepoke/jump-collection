import type { CollectionItem, InsertCollection } from '../types'

export const INSERT_ID_PREFIX = 'ins:'

/**
 * 折込冊子の定義。defaultCount は所有者の指定による既刊号数（2026年11月時点）。
 * 新しい号が出たら画面の「＋」で増やす（増やした分は端末・クラウドに保存される）。
 */
export const INSERT_DEFS: { id: string; title: string; defaultCount: number; ongoing: boolean }[] = [
  { id: 'comics-news', title: 'コミックスニュース', defaultCount: 260, ongoing: false },
  { id: 'jumpara', title: 'ジャンパラ', defaultCount: 195, ongoing: false },
  { id: 'jancomi-scoop', title: 'ジャンコミスクープ', defaultCount: 83, ongoing: true },
]

export function insertItemId(collectionId: string, vol: number | string): string {
  return `${INSERT_ID_PREFIX}${collectionId}:${vol}`
}

export function insertTitle(id: string): string {
  return INSERT_DEFS.find((d) => d.id === id)?.title ?? id
}

/** 保存済みの最新号（なければ既定値）。旧形式のデータは無視して既定値を使う */
export function insertCount(id: string, stored: Record<string, InsertCollection>): number {
  const c = stored[id]
  const def = INSERT_DEFS.find((d) => d.id === id)
  return c && typeof c.count === 'number' && c.count > 0 ? c.count : (def?.defaultCount ?? 0)
}

export function insertItems(id: string, count: number): CollectionItem[] {
  const title = insertTitle(id)
  return Array.from({ length: count }, (_, i) => ({
    id: insertItemId(id, i + 1),
    main: String(i + 1),
    sub: 'Vol.',
    label: `${title} Vol.${i + 1}`,
    provisional: false,
    subOnTop: true,
  }))
}
