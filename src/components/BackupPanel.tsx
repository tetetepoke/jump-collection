import { useRef } from 'react'
import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap } from '../types'
import { download, mergeImport, parseCsvFull, parseJson, timestamp, toCsv, toJson, type ImportData } from '../lib/backup'
import seed from '../data/seed.json'
import type { SyncState } from '../hooks/useCollection'
import { SyncPanel } from './SyncPanel'

interface Props {
  ownership: OwnershipMap
  overrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  inserts: Record<string, InsertCollection>
  onRestore: (o: OwnershipMap, c?: Record<number, CatalogYear>, cs?: ComicSeries[], ins?: Record<string, InsertCollection>) => void
  notify: (msg: string) => void
  sync: SyncState
  onSignIn: () => void
  onSignOut: () => void
}

export function BackupPanel({ ownership, overrides, comicsSeries, inserts, onRestore, notify, sync, onSignIn, onSignOut }: Props) {
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const recordCount = Object.keys(ownership).length

  const handleFile = async (file: File, kind: 'json' | 'csv') => {
    try {
      const text = await file.text()
      if (kind === 'json') {
        const data = parseJson(text)
        const n = Object.keys(data.ownership).length
        if (!confirm(`JSONから復元します（所持記録 ${n}件・刊行号データ編集 ${Object.keys(data.catalogOverrides).length}年分・コミックス ${data.comicsSeries.length}作品・折込冊子 ${Object.keys(data.inserts).length}種）。\n現在の記録は上書きされます${sync.kind === 'synced' ? '（同期中の全端末に反映されます）' : ''}。よろしいですか？`)) return
        onRestore(data.ownership, data.catalogOverrides, data.comicsSeries, data.inserts)
        notify(`JSONから復元しました（${n}件）`)
      } else {
        importData(parseCsvFull(text), 'CSV')
      }
    } catch (e) {
      alert(`復元できませんでした: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /** 今の記録を消さずに取り込む */
  function importData(imp: ImportData, from: string) {
    const n = Object.keys(imp.ownership).length
    if (
      !confirm(
        `${from}の記録を取り込みます（所持記録 ${n}件・コミックス ${imp.comicsSeries.length}作品・合併号などの編集 ${Object.keys(imp.catalogOverrides).length}年分）。\n今の記録は消えません。同じ号は新しく記録した方を残します。よろしいですか？`,
      )
    )
      return
    const merged = mergeImport({ ownership, catalogOverrides: overrides, comicsSeries, inserts }, imp)
    onRestore(merged.ownership, merged.catalogOverrides, merged.comicsSeries, merged.inserts)
    notify(`${from}から取り込みました（${merged.added}件を更新）`)
  }

  const row = 'flex h-14 w-full items-center justify-between rounded-xl border border-line px-4 text-left text-sm active:bg-mist'

  return (
    <div className="space-y-6 pb-6">
      <SyncPanel sync={sync} onSignIn={onSignIn} onSignOut={onSignOut} />
      <section>
        <p className="text-xs leading-relaxed text-sub">
          記録はこの端末のブラウザ（localStorage）に自動保存されています{sync.kind === 'synced' ? '（クラウドにも同期中）' : ''}。現在 {recordCount}件。
          ブラウザのデータ削除や機種変更に備え、定期的に書き出してください。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">書き出し</h3>
        <button className={row} onClick={() => download(`jump-collection-${timestamp()}.json`, toJson(ownership, overrides, comicsSeries, inserts), 'application/json')}>
          <span>
            JSONで保存<span className="block text-[11px] text-sub">完全バックアップ（所持記録＋刊行号データ＋コミックス作品＋折込冊子の号数）</span>
          </span>
          <span className="text-sub">↓</span>
        </button>
        <button className={row} onClick={() => download(`jump-collection-${timestamp()}.csv`, toCsv(ownership, overrides, comicsSeries, inserts), 'text/csv')}>
          <span>
            CSVで保存<span className="block text-[11px] text-sub">雑誌・コミックス・折込冊子の全冊一覧・Excel/Numbersで閲覧可</span>
          </span>
          <span className="text-sub">↓</span>
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">復元</h3>
        <button className={row} onClick={() => jsonInput.current?.click()}>
          <span>
            JSONから復元<span className="block text-[11px] text-sub">現在の記録を上書き</span>
          </span>
          <span className="text-sub">↑</span>
        </button>
        <button className={row} onClick={() => csvInput.current?.click()}>
          <span>
            CSVから取り込む<span className="block text-[11px] text-sub">今の記録に統合（作品・合併号も）</span>
          </span>
          <span className="text-sub">↑</span>
        </button>
        <button
          className={row}
          onClick={() =>
            importData(
              {
                ownership: seed.ownership as OwnershipMap,
                catalogOverrides: seed.catalogOverrides as unknown as Record<number, CatalogYear>,
                comicsSeries: seed.comicsSeries as ComicSeries[],
                insertCounts: {},
              },
              '11月3日',
            )
          }
        >
          <span>
            11月3日の記録を取り込む<span className="block text-[11px] text-sub">アプリに入れてある記録（雑誌58件・コミックス39作品）</span>
          </span>
          <span className="text-sub">↓</span>
        </button>
        <input
          ref={jsonInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f, 'json')
            e.target.value = ''
          }}
        />
        <input
          ref={csvInput}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f, 'csv')
            e.target.value = ''
          }}
        />
      </section>

      <section className="rounded-xl bg-mist p-4 text-xs leading-relaxed text-sub">
        <p className="font-semibold text-ink">ホーム画面に追加</p>
        <p className="mt-1">
          iPhone: Safariの共有ボタン →「ホーム画面に追加」
          <br />
          Android: Chromeのメニュー →「ホーム画面に追加」/「アプリをインストール」
        </p>
      </section>
    </div>
  )
}
