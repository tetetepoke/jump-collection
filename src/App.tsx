import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CollectionKind } from './types'
import { FIRST_YEAR, LAST_YEAR, YEARS } from './data/catalog'
import { useCollection } from './hooks/useCollection'
import { MagazineView, magazineOverall } from './components/MagazineView'
import { ComicsView } from './components/ComicsView'
import { Sheet } from './components/Sheet'
import { BackupPanel } from './components/BackupPanel'

const YEAR_KEY = 'jump-collection:ui:year'
const KIND_KEY = 'jump-collection:ui:kind'

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* noop */
  }
}

function initialYear(): number {
  const y = Number(readLS(YEAR_KEY))
  return y >= FIRST_YEAR && y <= LAST_YEAR ? y : FIRST_YEAR
}

export default function App() {
  const c = useCollection()
  const [kind, setKind] = useState<CollectionKind>(() => (readLS(KIND_KEY) === 'comics' ? 'comics' : 'magazine'))
  const [year, setYear] = useState(initialYear)
  const [backupOpen, setBackupOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => writeLS(YEAR_KEY, String(year)), [year])
  useEffect(() => writeLS(KIND_KEY, kind), [kind])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200)
  }, [])

  const onLongPress = useCallback(
    (id: string) => {
      c.setUnknown(id)
      notify('未確認に戻しました')
    },
    [c.setUnknown, notify],
  )

  const overall = useMemo(() => magazineOverall(c.getYear, c.ownership), [c.getYear, c.ownership])

  if (!c.loaded) return null

  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-28">
      <header className="px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.35em] text-sub">{kind === 'magazine' ? 'WEEKLY SHONEN JUMP' : 'JUMP COMICS'}</p>
            <h1 className="mt-1 font-serif text-[22px] tracking-[0.08em]">コレクション</h1>
          </div>
          <button onClick={() => setBackupOpen(true)} className="flex h-11 items-center rounded-full border border-line px-4 text-xs active:bg-mist">
            バックアップ
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-mist p-1" role="tablist" aria-label="コレクションの切り替え">
          {(
            [
              ['magazine', '週刊少年ジャンプ'],
              ['comics', 'ジャンプコミックス'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`h-11 rounded-full text-[13px] tracking-wide transition-colors ${kind === k ? 'bg-ink font-semibold text-white' : 'text-sub'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {kind === 'magazine' && (
          <p className="tabular mt-3 text-[11px] text-sub">
            全期間 {FIRST_YEAR}–{LAST_YEAR}：所持 <span className="font-semibold text-owned">{overall.owned}</span> / {overall.total}冊
            <span className="mx-1.5 text-line">|</span>
            確定データ {overall.confirmedYears} / {YEARS.length}年
          </p>
        )}
      </header>

      {kind === 'magazine' ? (
        <MagazineView
          year={year}
          onYearChange={setYear}
          ownership={c.ownership}
          overrides={c.overrides}
          getYear={c.getYear}
          toggle={c.toggle}
          onLongPress={onLongPress}
          setYearCatalog={c.setYearCatalog}
          resetYearCatalog={c.resetYearCatalog}
          notify={notify}
        />
      ) : (
        <ComicsView
          series={c.comicsSeries}
          ownership={c.ownership}
          toggle={c.toggle}
          onLongPress={onLongPress}
          upsertSeries={c.upsertSeries}
          addSeriesMany={c.addSeriesMany}
          removeSeries={c.removeSeries}
          notify={notify}
        />
      )}

      {c.saveError && <div className="fixed inset-x-4 top-4 z-40 rounded-xl bg-red-700 px-4 py-3 text-sm text-white shadow-lg">{c.saveError}</div>}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center">
          <div className="rounded-full bg-ink px-5 py-2.5 text-sm text-white shadow-lg">{toast}</div>
        </div>
      )}

      <Sheet open={backupOpen} title="バックアップ・復元" onClose={() => setBackupOpen(false)}>
        <BackupPanel
          ownership={c.ownership}
          overrides={c.overrides}
          comicsSeries={c.comicsSeries}
          onRestore={c.replaceAll}
          notify={notify}
        />
      </Sheet>
    </div>
  )
}
