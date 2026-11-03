// アプリから書き出したCSVを、初期データ src/data/seed.json に変換する
//   使い方: node scripts/csv-to-seed.mjs <書き出したCSV>
// 記録が空の端末で初めて開いたとき、このデータが自動で読み込まれる。
import { readFileSync, writeFileSync } from 'node:fs'

const [, , csvPath] = process.argv
if (!csvPath) {
  console.error('使い方: node scripts/csv-to-seed.mjs <CSVファイル>')
  process.exit(1)
}

function parseCsv(text) {
  const out = []
  let row = [], cell = '', q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); out.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); out.push(row) }
  const [header, ...rows] = out.filter((r) => r.some((x) => x.trim()))
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

// CSVに「完結／連載中」は含まれないため、連載中の作品名をここで指定する（それ以外は完結）
const ONGOING_TITLES = new Set(['ONE PIECE', 'さむわんへるつ', 'しのびごと', '願いのアストロ'])

const rows = parseCsv(readFileSync(csvPath, 'utf8'))
const ownership = {}
const years = new Map() // year -> number[][]
const series = new Map() // id -> { title, max, extras }

for (const r of rows) {
  const id = r.issue_id
  if (r.status === 'owned' || r.status === 'not_owned') {
    ownership[id] = { issueId: id, status: r.status, updatedAt: r.updated_at || new Date().toISOString() }
  }
  if (/^\d{4}-\d+(-\d+)*$/.test(id) && r.catalog !== 'カタログ外') {
    const [y, ...nums] = id.split('-').map(Number)
    if (!years.has(y)) years.set(y, [])
    years.get(y).push(nums)
  } else if (id.startsWith('jc:') && r.catalog !== 'カタログ外') {
    const [, sid, ...rest] = id.split(':')
    const s = series.get(sid) ?? { title: r.title, max: 0, extras: [] }
    if (rest[0] === 'x') s.extras.push(rest[1])
    else s.max = Math.max(s.max, Number(rest[0]))
    series.set(sid, s)
  }
}

// 1〜52号の単号（同梱の暫定雛形）と違う年だけ、刊行号データの編集として保存
const catalogOverrides = {}
for (const [y, list] of years) {
  const isDefault = list.length === 52 && list.every((n, i) => n.length === 1 && n[0] === i + 1)
  if (isDefault) continue
  catalogOverrides[y] = {
    year: y,
    verification: 'provisional',
    issues: list
      .sort((a, b) => a[0] - b[0])
      .map((nums) => ({ id: `${y}-${nums.join('-')}`, year: y, numbers: nums, verification: 'provisional' })),
  }
}

const base = Date.parse('2026-11-03T00:00:00Z')
const comicsSeries = [...series.entries()].map(([id, s], i) => ({
  id,
  title: s.title,
  status: ONGOING_TITLES.has(s.title) ? 'ongoing' : 'completed',
  volumeCount: s.max,
  extras: s.extras,
  verification: 'provisional',
  createdAt: new Date(base + i * 1000).toISOString(),
}))

const seed = { ownership, catalogOverrides, comicsSeries }
writeFileSync('src/data/seed.json', JSON.stringify(seed))
console.log(
  `所持記録 ${Object.keys(ownership).length}件 / 刊行号データ編集 ${Object.keys(catalogOverrides).length}年分 / コミックス ${comicsSeries.length}作品 → src/data/seed.json`,
)
