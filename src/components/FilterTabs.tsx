import type { Filter } from '../types'
import type { Stats } from '../hooks/useCollection'

interface Props {
  value: Filter
  onChange: (f: Filter) => void
  stats: Stats
}

export function FilterTabs({ value, onChange, stats }: Props) {
  const items: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: stats.total },
    { key: 'owned', label: '所持済み', count: stats.owned },
    { key: 'not_owned', label: '未所持', count: stats.notOwned },
    { key: 'unknown', label: '未確認', count: stats.unknown },
  ]
  return (
    <div className="grid grid-cols-4 gap-1 rounded-full bg-mist p-1" role="tablist">
      {items.map((it) => {
        const active = value === it.key
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`flex h-11 flex-col items-center justify-center rounded-full text-[12px] leading-tight transition-colors ${
              active ? 'bg-paper font-semibold shadow-sm' : 'text-sub'
            }`}
          >
            {it.label}
            <span className="tabular text-[10px] font-normal text-sub">{it.count}</span>
          </button>
        )
      })}
    </div>
  )
}
