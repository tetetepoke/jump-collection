import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap, OwnershipRecord, OwnershipStatus } from '../types'
import { YEARS, effectiveYear, issueLabel } from '../data/catalog'
import { COMICS_ID_PREFIX, volumesOf } from '../data/comics'
import { INSERT_DEFS, INSERT_ID_PREFIX, insertCount, insertItems } from '../data/inserts'

export const BACKUP_APP_ID = 'jump-collection'
/** v2: comicsSeries、v3: inserts を追加（古い版も読み込み可） */
export const BACKUP_SCHEMA_VERSION = 3

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  ownership: OwnershipMap
  catalogOverrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  inserts: Record<string, InsertCollection>
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
  inserts: Record<string, InsertCollection>,
): string {
  const file: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ownership,
    catalogOverrides,
    comicsSeries,
    inserts,
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
    inserts: data.inserts && typeof data.inserts === 'object' ? data.inserts : {},
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
  inserts: Record<string, InsertCollection>,
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
  for (const def of INSERT_DEFS) {
    for (const v of insertItems(def.id, insertCount(def.id, inserts))) {
      seen.add(v.id)
      const rec = ownership[v.id]
      const status: OwnershipStatus = rec?.status ?? 'unknown'
      rows.push([def.title, v.id, '', '', `Vol.${v.main}`, status, STATUS_JA[status], '確定', rec?.updatedAt ?? ''])
    }
  }
  // 刊行データ編集で消えた号・巻の所持記録も失わないよう出力する
  for (const rec of Object.values(ownership)) {
    if (seen.has(rec.issueId)) continue
    if (rec.issueId.startsWith(INSERT_ID_PREFIX)) {
      rows.push(['折込冊子', rec.issueId, '', '', '', rec.status, STATUS_JA[rec.status], 'カタログ外', rec.updatedAt])
    } else if (rec.issueId.startsWith(COMICS_ID_PREFIX)) {
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
    if (!id || !(/^\d{4}-\d+(-\d+)*$/.test(id) || id.startsWith(COMICS_ID_PREFIX) || id.startsWith(INSERT_ID_PREFIX))) continue
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

// ───────── 取り込み（今の記録と統合） ─────────

/** 取り込むデータ。CSV・同梱の初期データの両方をこの形にしてから統合する */
export interface ImportData {
  ownership: OwnershipMap
  catalogOverrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  /** 折込冊子の最新号（コレクションID → 号数） */
  insertCounts: Record<string, number>
}

export interface CurrentData {
  ownership: OwnershipMap
  catalogOverrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  inserts: Record<string, InsertCollection>
}

/** このアプリが書き出したCSVから、所持記録・合併号の設定・コミックス作品・折込冊子の号数を読み取る */
export function parseCsvFull(text: string): ImportData {
  const ownership = parseCsv(text)
  const [header, ...rows] = parseCsvLines(text)
  const col = (name: string) => header.indexOf(name)
  const iId = col('issue_id')
  const iTitle = col('title')
  const iCatalog = col('catalog')

  const years = new Map<number, number[][]>()
  const series = new Map<string, { title: string; max: number; extras: string[] }>()
  const insertCounts: Record<string, number> = {}

  for (const r of rows) {
    const id = r[iId]?.trim() ?? ''
    if ((iCatalog >= 0 ? r[iCatalog] : '') === 'カタログ外') continue
    if (/^\d{4}-\d+(-\d+)*$/.test(id)) {
      const [y, ...nums] = id.split('-').map(Number)
      if (!years.has(y)) years.set(y, [])
      years.get(y)!.push(nums)
    } else if (id.startsWith(COMICS_ID_PREFIX)) {
      const [, sid, ...rest] = id.split(':')
      const s = series.get(sid) ?? { title: (iTitle >= 0 ? r[iTitle] : '') || sid, max: 0, extras: [] }
      if (rest[0] === 'x') s.extras.push(rest.slice(1).join(':'))
      else s.max = Math.max(s.max, Number(rest[0]) || 0)
      series.set(sid, s)
    } else if (id.startsWith(INSERT_ID_PREFIX)) {
      const [, cid, vol] = id.split(':')
      insertCounts[cid] = Math.max(insertCounts[cid] ?? 0, Number(vol) || 0)
    }
  }

  const catalogOverrides: Record<number, CatalogYear> = {}
  for (const [y, list] of years) {
    const isDefault = list.length === 52 && list.every((n, i) => n.length === 1 && n[0] === i + 1)
    if (isDefault) continue
    catalogOverrides[y] = {
      year: y,
      verification: 'provisional',
      issues: list
        .sort((a, b) => a[0] - b[0])
        .map((nums) => ({ id: `${y}-${nums.join('-')}`, year: y, numbers: nums, verification: 'provisional' as const })),
    }
  }

  const base = Date.now()
  const comicsSeries: ComicSeries[] = [...series.entries()].map(([id, s], i) => ({
    id,
    title: s.title,
    status: 'completed',
    volumeCount: s.max,
    extras: s.extras,
    verification: 'provisional',
    createdAt: new Date(base + i).toISOString(),
  }))

  return { ownership, catalogOverrides, comicsSeries, insertCounts }
}

/**
 * 今の記録に取り込むデータを統合する（今の記録は消さない）。
 * - 所持記録: 同じ号は更新日時が新しい方
 * - 合併号などの刊行号データ: 今の端末で編集していない年だけ取り込む
 * - コミックス: 未登録の作品を追加。登録済みなら巻数が多い方に広げる
 * - 折込冊子: 号数が多い方
 */
export function mergeImport(cur: CurrentData, imp: ImportData): CurrentData & { added: number } {
  const ownership = { ...cur.ownership }
  let added = 0
  for (const [id, r] of Object.entries(imp.ownership)) {
    const l = ownership[id]
    if (!l || r.updatedAt > l.updatedAt) {
      if (!l || l.status !== r.status) added++
      ownership[id] = r
    }
  }

  const catalogOverrides = { ...cur.catalogOverrides }
  for (const [y, cat] of Object.entries(imp.catalogOverrides)) {
    if (!(y in catalogOverrides)) catalogOverrides[Number(y)] = cat
  }

  const comicsSeries = [...cur.comicsSeries]
  for (const s of imp.comicsSeries) {
    const i = comicsSeries.findIndex((x) => x.id === s.id)
    if (i < 0) comicsSeries.push(s)
    else {
      const x = comicsSeries[i]
      const extras = [...new Set([...x.extras, ...s.extras])]
      if (s.volumeCount > x.volumeCount || extras.length > x.extras.length) {
        comicsSeries[i] = { ...x, volumeCount: Math.max(x.volumeCount, s.volumeCount), extras }
      }
    }
  }

  const inserts = { ...cur.inserts }
  for (const [id, n] of Object.entries(imp.insertCounts)) {
    const now = inserts[id]?.count ?? 0
    if (n > now && INSERT_DEFS.some((d) => d.id === id && n > d.defaultCount)) {
      inserts[id] = { id, count: n, updatedAt: new Date().toISOString() }
    }
  }

  return { ownership, catalogOverrides, comicsSeries, inserts, added }
}
