import { useCallback, useMemo, useState } from 'react'
import type { Filter, OwnershipMap } from '../types'
import { INSERT_DEFS, insertItems } from '../data/inserts'
import { computeStats, statusOf } from '../hooks/useCollection'
import { StatsPanel } from './StatsPanel'
import { FilterTabs } from './FilterTabs'
import { IssueGrid } from './IssueGrid'
import { Legend } from './Legend'

interface Props {
  collectionId: string
  count: number
  ownership: OwnershipMap
  toggle: (id: string) => void
  onLongPress: (id: string) => void
  onCountChange: (count: number) => void
  notify: (msg: string) => void
}

const EMPTY_TEXT: Record<Filter, string> = {
  all: '号がありません',
  owned: '所持済みの号はまだありません',
  not_owned: '未所持として記録した号はありません',
  unknown: '未確認の号はありません',
}

/** 折込冊子: Vol.1〜最新号をタップでチェックするだけの画面 */
export function InsertView({ collectionId, count, ownership, toggle, onLongPress, onCountChange, notify }: Props) {
  const def = INSERT_DEFS.find((d) => d.id === collectionId)!
  const [filter, setFilter] = useState<Filter>('all')

  const items = useMemo(() => insertItems(collectionId, count), [collectionId, count])
  const stats = useMemo(() => computeStats(items, ownership), [items, ownership])
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => statusOf(ownership, i.id) === filter)),
    [items, ownership, filter],
  )
  const getStatus = useCallback((id: string) => statusOf(ownership, id), [ownership])

  return (
    <main className="space-y-5 px-5 pt-5">
      <StatsPanel stats={stats} />
      <FilterTabs value={filter} onChange={setFilter} stats={stats} />
      <IssueGrid items={visible} statusOf={getStatus} onTap={toggle} onLongPress={onLongPress} emptyText={EMPTY_TEXT[filter]} />

      <button
        onClick={() => {
          onCountChange(count + 1)
          notify(`Vol.${count + 1} を追加しました`)
        }}
        className="h-12 w-full rounded-full border border-ink text-sm active:bg-mist"
      >
        ＋ 新しい号を追加（Vol.{count + 1}）
      </button>

      <Legend unit="号" hideProvisional />

      {count > def.defaultCount && (
        <button
          onClick={() => {
            if (confirm(`最後に追加した Vol.${count} を一覧から外しますか？\n（所持記録は残り、追加し直すと元に戻ります）`)) {
              onCountChange(count - 1)
              notify(`Vol.${count} を外しました`)
            }
          }}
          className="h-11 w-full text-xs text-sub underline underline-offset-4"
        >
          追加しすぎたとき: Vol.{count} を外す
        </button>
      )}
    </main>
  )
}
