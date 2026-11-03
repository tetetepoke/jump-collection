import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComicSeries, Filter, OwnershipMap } from '../types'
import { volumesOf } from '../data/comics'
import { computeStats, statusOf } from '../hooks/useCollection'
import { StatsPanel } from './StatsPanel'
import { FilterTabs } from './FilterTabs'
import { IssueGrid } from './IssueGrid'
import { Sheet } from './Sheet'
import { Legend } from './Legend'
import { SeriesAdd, SeriesEdit } from './SeriesForms'

interface Props {
  series: ComicSeries[]
  ownership: OwnershipMap
  toggle: (id: string) => void
  onLongPress: (id: string) => void
  upsertSeries: (s: ComicSeries) => void
  addSeriesMany: (list: ComicSeries[]) => void
  removeSeries: (id: string) => void
  notify: (msg: string) => void
}

const SELECTED_KEY = 'jump-collection:ui:series'
type ListFilter = 'all' | 'incomplete' | 'complete'
type Sort = 'added' | 'title' | 'progress'

const EMPTY_TEXT: Record<Filter, string> = {
  all: '巻が登録されていません。編集から巻数を設定してください',
  owned: '所持済みの巻はまだありません',
  not_owned: '未所持として記録した巻はありません',
  unknown: '未確認の巻はありません',
}

export function ComicsView(p: Props) {
  const { series, ownership } = p
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY)
    } catch {
      return null
    }
  })
  const [sheet, setSheet] = useState<null | 'add' | 'edit'>(null)
  const selected = series.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
      else localStorage.removeItem(SELECTED_KEY)
    } catch {
      /* noop */
    }
    window.scrollTo({ top: 0 })
  }, [selectedId])

  return (
    <>
      {selected ? (
        <SeriesDetail
          series={selected}
          ownership={ownership}
          toggle={p.toggle}
          onLongPress={p.onLongPress}
          onBack={() => setSelectedId(null)}
          onEdit={() => setSheet('edit')}
          onAddVolume={() => {
            p.upsertSeries({ ...selected, volumeCount: selected.volumeCount + 1, verification: 'provisional', source: undefined })
            p.notify(`${selected.volumeCount + 1}巻を追加しました`)
          }}
        />
      ) : (
        <SeriesList series={series} ownership={ownership} onOpen={setSelectedId} onAdd={() => setSheet('add')} />
      )}

      <Sheet open={sheet === 'add'} title="作品を追加" onClose={() => setSheet(null)}>
        <SeriesAdd
          existing={series}
          onAdd={(list) => {
            p.addSeriesMany(list)
            setSheet(null)
            if (list.length === 1) setSelectedId(list[0].id)
            p.notify(`${list.length}作品を追加しました（暫定）`)
          }}
        />
      </Sheet>

      {selected && (
        <Sheet open={sheet === 'edit'} title="作品データ" onClose={() => setSheet(null)}>
          <SeriesEdit
            key={selected.id + selected.volumeCount + selected.verification}
            series={selected}
            onSave={(s) => {
              p.upsertSeries(s)
              setSheet(null)
              p.notify(s.verification === 'confirmed' ? '確定データとして保存しました' : '保存しました（暫定）')
            }}
            onDelete={() => {
              p.removeSeries(selected.id)
              setSheet(null)
              setSelectedId(null)
              p.notify('作品を削除しました')
            }}
          />
        </Sheet>
      )}
    </>
  )
}

// ───────── 作品一覧 ─────────

function SeriesList({
  series,
  ownership,
  onOpen,
  onAdd,
}: {
  series: ComicSeries[]
  ownership: OwnershipMap
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')
  const [sort, setSort] = useState<Sort>('added')

  const rows = useMemo(
    () => series.map((s) => ({ s, stats: computeStats(volumesOf(s), ownership) })),
    [series, ownership],
  )
  const isComplete = (st: { owned: number; total: number }) => st.total > 0 && st.owned === st.total

  const summary = useMemo(() => {
    let owned = 0
    let total = 0
    let complete = 0
    for (const r of rows) {
      owned += r.stats.owned
      total += r.stats.total
      if (isComplete(r.stats)) complete++
    }
    return { owned, total, complete, rate: total ? (owned / total) * 100 : 0 }
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter((r) => !q || r.s.title.toLowerCase().includes(q))
    if (filter === 'complete') list = list.filter((r) => isComplete(r.stats))
    if (filter === 'incomplete') list = list.filter((r) => !isComplete(r.stats))
    if (sort === 'title') list = [...list].sort((a, b) => a.s.title.localeCompare(b.s.title, 'ja'))
    if (sort === 'progress') list = [...list].sort((a, b) => b.stats.rate - a.stats.rate)
    return list
  }, [rows, query, filter, sort])

  if (series.length === 0) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-serif text-lg">まだ作品が登録されていません</p>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-sub">
          集めている作品を追加してください。完結作品は一覧から選んで、まとめて追加することもできます。
        </p>
        <button onClick={onAdd} className="mt-6 h-12 w-full rounded-full bg-ink text-sm font-semibold text-white active:opacity-80">
          作品を追加
        </button>
      </main>
    )
  }

  return (
    <main className="space-y-4 px-5 pt-4">
      <section className="rounded-2xl border border-line px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-sub">所持冊数</p>
            <p className="tabular mt-1 font-serif text-3xl leading-none">
              {summary.owned}
              <span className="ml-1 text-base text-sub">/ {summary.total}冊</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] tracking-[0.2em] text-sub">全巻コンプ</p>
            <p className="tabular mt-1 font-serif text-3xl leading-none text-owned">
              {summary.complete}
              <span className="ml-1 text-base text-sub">/ {series.length}作品</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist">
          <div className="h-full rounded-full bg-owned transition-[width] duration-300" style={{ width: `${summary.rate}%` }} />
        </div>
      </section>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="作品名で検索"
          className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-base"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-11 rounded-full border border-line bg-paper px-3 text-xs"
          aria-label="並び順"
        >
          <option value="added">追加順</option>
          <option value="title">作品名順</option>
          <option value="progress">所持率順</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-mist p-1">
        {(
          [
            ['all', 'すべて'],
            ['incomplete', '未コンプ'],
            ['complete', 'コンプ済み'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-10 rounded-full text-[12px] ${filter === k ? 'bg-paper font-semibold shadow-sm' : 'text-sub'}`}>
            {l}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {visible.map(({ s, stats }) => {
          const done = isComplete(stats)
          return (
            <li key={s.id}>
              <button onClick={() => onOpen(s.id)} className="block w-full px-4 py-3.5 text-left active:bg-mist">
                <div className="flex items-start gap-2">
                  <span className="flex-1 font-serif text-[15px] leading-snug">{s.title}</span>
                  {done && <span className="shrink-0 rounded-full bg-owned px-2 py-0.5 text-[10px] text-white">○ コンプ</span>}
                  <span className="shrink-0 text-sub">›</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-owned" style={{ width: `${stats.rate}%` }} />
                  </div>
                  <span className="tabular w-16 text-right text-[11px] text-sub">
                    {stats.owned}/{stats.total}巻
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1.5 text-[10px] text-sub">
                  <span className={`rounded border px-1.5 ${s.verification === 'confirmed' ? 'border-owned text-owned' : 'border-dashed border-sub'}`}>
                    {s.verification === 'confirmed' ? '確定' : '暫定'}
                  </span>
                  <span className="rounded border border-line px-1.5">{s.status === 'completed' ? '完結' : '連載中'}</span>
                  {stats.unknown > 0 && <span className="px-0.5">未確認 {stats.unknown}</span>}
                </div>
              </button>
            </li>
          )
        })}
        {visible.length === 0 && <li className="px-4 py-10 text-center text-sm text-sub">該当する作品はありません</li>}
      </ul>

      <button onClick={onAdd} className="h-12 w-full rounded-full border border-ink text-sm active:bg-mist">
        ＋ 作品を追加
      </button>
    </main>
  )
}

// ───────── 作品詳細（巻グリッド） ─────────

function SeriesDetail({
  series,
  ownership,
  toggle,
  onLongPress,
  onBack,
  onEdit,
  onAddVolume,
}: {
  series: ComicSeries
  ownership: OwnershipMap
  toggle: (id: string) => void
  onLongPress: (id: string) => void
  onBack: () => void
  onEdit: () => void
  onAddVolume: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const items = useMemo(() => volumesOf(series), [series])
  const stats = useMemo(() => computeStats(items, ownership), [items, ownership])
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => statusOf(ownership, i.id) === filter)),
    [items, ownership, filter],
  )
  const getStatus = useCallback((id: string) => statusOf(ownership, id), [ownership])

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-line bg-paper/95 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="-ml-2 flex h-11 shrink-0 items-center rounded-full px-2 text-sm text-sub active:bg-mist">
            ‹ 作品一覧
          </button>
          <h2 className="min-w-0 flex-1 truncate text-right font-serif text-base">{series.title}</h2>
        </div>
      </div>

      <main className="space-y-5 px-5 pt-5">
        <StatsPanel
          verification={series.verification}
          source={series.source}
          provisionalNote={`巻数は未確認です（${series.status === 'completed' ? '完結・全' : '連載中・既刊'}${series.volumeCount}巻として登録）。冊数・率も暫定値です。`}
          stats={stats}
        />
        <FilterTabs value={filter} onChange={setFilter} stats={stats} />
        <IssueGrid items={visible} statusOf={getStatus} onTap={toggle} onLongPress={onLongPress} emptyText={EMPTY_TEXT[filter]} />
        {series.status === 'ongoing' && (
          <button onClick={onAddVolume} className="h-12 w-full rounded-full border border-ink text-sm active:bg-mist">
            ＋ 新刊を追加（{series.volumeCount + 1}巻）
          </button>
        )}
        <Legend unit="巻" />
        <button onClick={onEdit} className="h-12 w-full rounded-full border border-line text-sm active:bg-mist">
          作品データを編集
        </button>
      </main>
    </>
  )
}
