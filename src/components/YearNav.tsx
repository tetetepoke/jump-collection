import { FIRST_YEAR, LAST_YEAR, YEARS } from '../data/catalog'
import type { CatalogYear, OwnershipMap } from '../types'
import { computeStats } from '../hooks/useCollection'

interface Props {
  year: number
  onChange: (year: number) => void
  getYear: (year: number) => CatalogYear
  ownership: OwnershipMap
}

export function YearNav({ year, onChange, getYear, ownership }: Props) {
  const btn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line text-xl active:bg-mist disabled:opacity-25'
  return (
    <div className="flex items-center gap-3">
      <button className={btn} onClick={() => onChange(year - 1)} disabled={year <= FIRST_YEAR} aria-label="前年">
        ‹
      </button>
      <label className="relative flex-1">
        <span className="sr-only">年を選択</span>
        <select
          value={year}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tabular h-12 w-full appearance-none rounded-full border border-line bg-paper text-center font-serif text-2xl tracking-wider"
        >
          {YEARS.map((y) => {
            const s = computeStats(getYear(y).issues, ownership)
            return (
              <option key={y} value={y}>
                {y}年 ({s.owned}/{s.total})
              </option>
            )
          })}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-sub">▼</span>
      </label>
      <button className={btn} onClick={() => onChange(year + 1)} disabled={year >= LAST_YEAR} aria-label="翌年">
        ›
      </button>
    </div>
  )
}
