import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CollectionKind } from './types'
import { FIRST_YEAR, LAST_YEAR, YEARS } from './data/catalog'
import { useCollection } from './hooks/useCollection'
import { MagazineView, magazineOverall } from './components/MagazineView'
import { ComicsView } from './components/ComicsView'
import { InsertView } from './components/InsertView'
import { INSERT_DEFS, insertCount } from './data/inserts'
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
  const [kind, setKind] = useState<CollectionKind>(() => {
    const v = readLS(KIND_KEY)
    if (v === 'comics' || v === 'magazine') return v
    if (v && INSERT_DEFS.some((d) => `ins:${d.id}` === v)) return v as CollectionKind
    return 'magazine'
  })
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
            <p className="text-[10px] tracking-[0.35em] text-sub">
              {kind === 'magazine' ? 'WEEKLY SHONEN JUMP' : kind === 'comics' ? 'JUMP COMICS' : 'JUMP COMICS INSERT'}
            </p>
            <h1 className="mt-1 font-serif text-[22px] tracking-[0.08em]">コレクション</h1>
          </div>
          <button onClick={() => setBackupOpen(true)} className="flex h-11 items-center gap-2 rounded-full border border-line px-4 text-xs active:bg-mist">
            {c.sync.kind !== 'unavailable' && (
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${
                  c.sync.kind === 'synced' ? 'bg-owned' : c.sync.kind === 'error' ? 'bg-red-600' : c.sync.kind === 'connecting' ? 'bg-amber-500' : 'bg-line'
                }`}
              />
            )}
            {c.sync.kind === 'synced' ? '同期中' : 'データ'}
          </button>
        </div>

        <div className="-mx-5 mt-4 overflow-x-auto px-5 [scrollbar-width:none]" role="tablist" aria-label="コレクションの切り替え">
          <div className="flex w-max gap-1.5">
            {(
              [
                ['magazine', '週刊少年ジャンプ'],
                ['comics', 'ジャンプコミックス'],
                ...INSERT_DEFS.map((d) => [`ins:${d.id}`, d.title] as const),
              ] as [CollectionKind, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                ref={(el) => {
                  if (el && kind === k) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                }}
                onClick={() => setKind(k)}
                className={`h-10 whitespace-nowrap rounded-full border px-4 text-[13px] tracking-wide transition-colors ${
                  kind === k ? 'border-ink bg-ink font-semibold text-white' : 'border-line text-sub'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
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
      ) : kind.startsWith('ins:') ? (
        (() => {
          const def = INSERT_DEFS.find((d) => `ins:${d.id}` === kind)!
          return (
            <InsertView
              key={def.id}
              collectionId={def.id}
              count={insertCount(def.id, c.inserts)}
              ownership={c.ownership}
              toggle={c.toggle}
              onLongPress={onLongPress}
              onCountChange={(count) => c.upsertInsert({ id: def.id, count, updatedAt: '' })}
              notify={notify}
            />
          )
        })()
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

      <Sheet open={backupOpen} title="同期・バックアップ" onClose={() => setBackupOpen(false)}>
        <BackupPanel
          ownership={c.ownership}
          overrides={c.overrides}
          comicsSeries={c.comicsSeries}
          inserts={c.inserts}
          onRestore={c.replaceAll}
          notify={notify}
          sync={c.sync}
          onSignIn={c.signIn}
          onSignOut={c.signOut}
        />
      </Sheet>
    </div>
  )
}
