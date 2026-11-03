import type { CatalogYear, ComicSeries, OwnershipMap, OwnershipRecord, OwnershipStatus } from '../types'
import { YEARS, effectiveYear, issueLabel } from '../data/catalog'
import { COMICS_ID_PREFIX, volumesOf } from '../data/comics'

export const BACKUP_APP_ID = 'jump-collection'
/** v2: comicsSeries を追加（v1 も読み込み可） */
export const BACKUP_SCHEMA_VERSION = 2

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  ownership: OwnershipMap
  catalogOverrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
}

const STATUS_JA: Record<OwnershipStatus, string> = {
  owned: '所持済み',
  not_owned: '未所持',
  unknown: '未確認',
}

// ───────── JSON ─────────

export function toJson(
  ownership: OwnershipMap,
  catalogOverrides: Record<number, CatalogYear>,
  comicsSeries: ComicSeries[],
): string {
  const file: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ownership,
    catalogOverrides,
    comicsSeries,
  }
  return JSON.stringify(file, null, 2)
}

export function parseJson(text: string): BackupFile {
  const data = JSON.parse(text)
  if (data?.app !== BACKUP_APP_ID || typeof data.ownership !== 'object') {
    throw new Error('このアプリのバックアップJSONではありません')
  }
  if (data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('新しいバージョンで作成されたバックアップです。アプリを更新してください')
  }
  const ownership: OwnershipMap = {}
  for (const [id, r] of Object.entries<Partial<OwnershipRecord>>(data.ownership)) {
    if (r && (r.status === 'owned' || r.status === 'not_owned')) {
      ownership[id] = { issueId: id, status: r.status, updatedAt: r.updatedAt ?? new Date().toISOString() }
    }
  }
  return {
    app: BACKUP_APP_ID,
    schemaVersion: data.schemaVersion,
    exportedAt: data.exportedAt,
    ownership,
    catalogOverrides: data.catalogOverrides ?? {},
    comicsSeries: Array.isArray(data.comicsSeries) ? data.comicsSeries : [],
  }
}

// ───────── CSV ─────────

const CSV_HEADER = ['collection', 'issue_id', 'year', 'title', 'label', 'status', 'status_ja', 'catalog', 'updated_at']

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 全年・全号の一覧（チェックリストとしてExcel等でも使える）。所持記録のみのCSV復元に対応 */
export function toCsv(
  ownership: OwnershipMap,
  catalogOverrides: Record<number, CatalogYear>,
  comicsSeries: ComicSeries[],
): string {
  const rows: (string | number)[][] = [CSV_HEADER]
  const seen = new Set<string>()
  for (const year of YEARS) {
    for (const issue of effectiveYear(year, catalogOverrides).issues) {
      seen.add(issue.id)
      const rec = ownership[issue.id]
      const status: OwnershipStatus = rec?.status ?? 'unknown'
      rows.push([
        '週刊少年ジャンプ',
        issue.id,
        year,
        '',
        issueLabel(issue.numbers),
        status,
        STATUS_JA[status],
        issue.verification === 'confirmed' ? '確定' : '暫定',
        rec?.updatedAt ?? '',
      ])
    }
  }
  for (const series of comicsSeries) {
    for (const v of volumesOf(series)) {
      seen.add(v.id)
      const rec = ownership[v.id]
      const status: OwnershipStatus = rec?.status ?? 'unknown'
      rows.push([
        'ジャンプコミックス',
        v.id,
        '',
        series.title,
        v.sub === '巻' ? `${v.main}巻` : v.main,
        status,
        STATUS_JA[status],
        series.verification === 'confirmed' ? '確定' : '暫定',
        rec?.updatedAt ?? '',
      ])
    }
  }
  // 刊行データ編集で消えた号・巻の所持記録も失わないよう出力する
  for (const rec of Object.values(ownership)) {
    if (seen.has(rec.issueId)) continue
    if (rec.issueId.startsWith(COMICS_ID_PREFIX)) {
      rows.push(['ジャンプコミックス', rec.issueId, '', '', '', rec.status, STATUS_JA[rec.status], 'カタログ外', rec.updatedAt])
    } else {
      const [y, ...nums] = rec.issueId.split('-')
      rows.push(['週刊少年ジャンプ', rec.issueId, y, '', issueLabel(nums.map(Number)), rec.status, STATUS_JA[rec.status], 'カタログ外', rec.updatedAt])
    }
  }
  // Excel で文字化けしないよう BOM を付ける
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

function parseCsvLines(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      out.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    out.push(row)
  }
  return out.filter((r) => r.some((c) => c.trim() !== ''))
}

/** CSV から所持記録を復元する（刊行号データは復元しない） */
export function parseCsv(text: string): OwnershipMap {
  const [header, ...rows] = parseCsvLines(text)
  if (!header) throw new Error('CSVが空です')
  const idx = (name: string) => header.indexOf(name)
  const iId = idx('issue_id')
  const iStatus = idx('status')
  const iStatusJa = idx('status_ja')
  const iUpdated = idx('updated_at')
  if (iId < 0 || (iStatus < 0 && iStatusJa < 0)) {
    throw new Error('issue_id と status 列が必要です（このアプリで書き出したCSVを使ってください）')
  }
  const fromJa: Record<string, OwnershipStatus> = { 所持済み: 'owned', 未所持: 'not_owned', 未確認: 'unknown' }
  const now = new Date().toISOString()
  const map: OwnershipMap = {}
  for (const r of rows) {
    const id = r[iId]?.trim()
    if (!id || !(/^\d{4}-\d+(-\d+)*$/.test(id) || id.startsWith(COMICS_ID_PREFIX))) continue
    const raw = (iStatus >= 0 ? r[iStatus] : '')?.trim()
    const status: OwnershipStatus | undefined =
      raw === 'owned' || raw === 'not_owned' || raw === 'unknown' ? raw : fromJa[(r[iStatusJa] ?? '').trim()]
    if (status === 'owned' || status === 'not_owned') {
      map[id] = { issueId: id, status, updatedAt: (iUpdated >= 0 && r[iUpdated]?.trim()) || now }
    }
  }
  return map
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
