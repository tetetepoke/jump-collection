/**
 * 【将来用の雛形・未使用】Supabase で複数端末同期する場合の実装例。
 *
 * 使うときは:
 *   1. npm i @supabase/supabase-js
 *   2. 下記テーブルを作成（RLS で user_id = auth.uid() に制限）
 *
 *      create table ownership (
 *        user_id    uuid references auth.users not null,
 *        issue_id   text not null,
 *        status     text not null check (status in ('owned','not_owned')),
 *        updated_at timestamptz not null,
 *        primary key (user_id, issue_id)
 *      );
 *      create table comics_series (
 *        user_id uuid references auth.users not null,
 *        id      text not null,
 *        data    jsonb not null,
 *        primary key (user_id, id)
 *      );
 *      create table catalog_overrides (
 *        user_id uuid references auth.users not null,
 *        year    int  not null,
 *        data    jsonb not null,
 *        primary key (user_id, year)
 *      );
 *
 *   3. このファイルを supabaseAdapter.ts にリネームしてコメントを外し、
 *      src/storage/index.ts のアダプタを差し替える。
 *
 * 所持記録は updatedAt を持っているので、端末間の競合は「新しい方を採用」で解決できる。
 */

export {}

/*
import { createClient } from '@supabase/supabase-js'
import type { CatalogYear, ComicSeries, OwnershipMap } from '../types'
import type { StorageAdapter } from './adapter'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export class SupabaseAdapter implements StorageAdapter {
  async loadOwnership(): Promise<OwnershipMap> {
    const { data, error } = await supabase.from('ownership').select('issue_id,status,updated_at')
    if (error) throw error
    return Object.fromEntries(
      data.map((r) => [r.issue_id, { issueId: r.issue_id, status: r.status, updatedAt: r.updated_at }]),
    )
  }
  async saveOwnership(map: OwnershipMap): Promise<void> {
    const rows = Object.values(map).map((r) => ({ issue_id: r.issueId, status: r.status, updated_at: r.updatedAt }))
    const { error } = await supabase.from('ownership').upsert(rows)
    if (error) throw error
  }
  async loadCatalogOverrides(): Promise<Record<number, CatalogYear>> {
    const { data, error } = await supabase.from('catalog_overrides').select('year,data')
    if (error) throw error
    return Object.fromEntries(data.map((r) => [r.year, r.data as CatalogYear]))
  }
  async saveCatalogOverrides(overrides: Record<number, CatalogYear>): Promise<void> {
    const rows = Object.values(overrides).map((c) => ({ year: c.year, data: c }))
    const { error } = await supabase.from('catalog_overrides').upsert(rows)
    if (error) throw error
  }
  async loadComicsSeries(): Promise<ComicSeries[]> {
    const { data, error } = await supabase.from('comics_series').select('data')
    if (error) throw error
    return data.map((r) => r.data as ComicSeries)
  }
  async saveComicsSeries(series: ComicSeries[]): Promise<void> {
    // 削除の反映が必要なら、差分を取って delete も行う
    const { error } = await supabase.from('comics_series').upsert(series.map((s) => ({ id: s.id, data: s })))
    if (error) throw error
  }
}
*/
