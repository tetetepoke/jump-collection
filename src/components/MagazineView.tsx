import { useCallback, useMemo, useState } from 'react'
import type { CatalogYear, CollectionItem, Filter, OwnershipMap } from '../types'
import { YEARS, issueLabel } from '../data/catalog'
import { computeStats, statusOf, type Migration } from '../hooks/useCollection'
import { YearNav } from './YearNav'
import { StatsPanel } from './StatsPanel'
import { FilterTabs } from './FilterTabs'
import { IssueGrid } from './IssueGrid'
import { Sheet } from './Sheet'
import { CatalogEditor } from './CatalogEditor'
import { Legend } from './Legend'

interface Props {
  year: number
  onYearChange: (y: number) => void
  ownership: OwnershipMap
  overrides: Record<number, CatalogYear>
  getYear: (y: number) => CatalogYear
  toggle: (id: string) => void
  onLongPress: (id: string) => void
  setYearCatalog: (c: CatalogYear, m?: Migration) => void
  resetYearCatalog: (y: number) => void
  notify: (msg: string) => void
}

const EMPTY_TEXT: Record<Filter, string> = {
  all: 'この年の刊行号データがありません',
  owned: '所持済みの号はまだありません',
  not_owned: '未所持として記録した号はありません',
  unknown: '未確認の号はありません',
}

export function MagazineView(p: Props) {
  const { year, ownership } = p
  const [filter, setFilter] = useState<Filter>('all')
  const [editorOpen, setEditorOpen] = useState(false)

  const catalog = p.getYear(year)
  const stats = useMemo(() => computeStats(catalog.issues, ownership), [catalog, ownership])

  const items: CollectionItem[] = useMemo(
    () =>
      catalog.issues.map((i) => ({
        id: i.id,
        main: i.numbers.join('・'),
        sub: i.numbers.length > 1 ? '合併号' : '号',
        label: issueLabel(i.numbers),
        provisional: i.verification === 'provisional',
      })),
    [catalog],
  )
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => statusOf(ownership, i.id) === filter)),
    [items, ownership, filter],
  )
  const getStatus = useCallback((id: string) => statusOf(ownership, id), [ownership])

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <YearNav year={year} onChange={p.onYearChange} getYear={p.getYear} ownership={ownership} />
      </div>

      <main className="space-y-5 px-5 pt-5">
        <StatsPanel
          verification={catalog.verification}
          source={catalog.source}
          provisionalNote="この年の刊行号データは未確定です。1〜52号を仮に並べた雛形で、合併号や実際の刊行号とは一致しない可能性があります。冊数・率も暫定値です。"
          stats={stats}
        />
        <FilterTabs value={filter} onChange={setFilter} stats={stats} />
        <IssueGrid items={visible} statusOf={getStatus} onTap={p.toggle} onLongPress={p.onLongPress} emptyText={EMPTY_TEXT[filter]} />
        <Legend unit="号" />
        <button onClick={() => setEditorOpen(true)} className="h-12 w-full rounded-full border border-line text-sm active:bg-mist">
          {year}年の刊行号データを編集
        </button>
      </main>

      <Sheet open={editorOpen} title={`${year}年 刊行号データ`} onClose={() => setEditorOpen(false)}>
        <CatalogEditor
          key={year}
          catalog={catalog}
          isOverridden={year in p.overrides}
          ownership={ownership}
          onSave={(cat, mig) => {
            p.setYearCatalog(cat, mig)
            p.notify(cat.verification === 'confirmed' ? '確定データとして保存しました' : '刊行号データを更新しました（暫定）')
          }}
          onReset={(y) => {
            p.resetYearCatalog(y)
            p.notify('同梱データに戻しました')
          }}
        />
      </Sheet>
    </>
  )
}

export function magazineOverall(getYear: (y: number) => CatalogYear, ownership: OwnershipMap) {
  let owned = 0
  let total = 0
  let confirmedYears = 0
  for (const y of YEARS) {
    const cy = getYear(y)
    const s = computeStats(cy.issues, ownership)
    owned += s.owned
    total += s.total
    if (cy.verification === 'confirmed') confirmedYears++
  }
  return { owned, total, confirmedYears }
}
