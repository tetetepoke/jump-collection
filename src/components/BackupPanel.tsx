import { useRef } from 'react'
import type { CatalogYear, ComicSeries, OwnershipMap } from '../types'
import { download, parseCsv, parseJson, timestamp, toCsv, toJson } from '../lib/backup'

interface Props {
  ownership: OwnershipMap
  overrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  onRestore: (o: OwnershipMap, c?: Record<number, CatalogYear>, cs?: ComicSeries[]) => void
  notify: (msg: string) => void
}

export function BackupPanel({ ownership, overrides, comicsSeries, onRestore, notify }: Props) {
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const recordCount = Object.keys(ownership).length

  const handleFile = async (file: File, kind: 'json' | 'csv') => {
    try {
      const text = await file.text()
      if (kind === 'json') {
        const data = parseJson(text)
        const n = Object.keys(data.ownership).length
        if (!confirm(`JSONから復元します（所持記録 ${n}件・刊行号データ編集 ${Object.keys(data.catalogOverrides).length}年分・コミックス ${data.comicsSeries.length}作品）。\n現在の記録は上書きされます。よろしいですか？`)) return
        onRestore(data.ownership, data.catalogOverrides, data.comicsSeries)
        notify(`JSONから復元しました（${n}件）`)
      } else {
        const map = parseCsv(text)
        const n = Object.keys(map).length
        if (!confirm(`CSVから所持記録 ${n}件を復元します。\n現在の所持記録は上書きされます（刊行号データ・コミックスの作品登録は変更しません。作品が未登録の巻は表示されません）。よろしいですか？`)) return
        onRestore(map)
        notify(`CSVから復元しました（${n}件）`)
      }
    } catch (e) {
      alert(`復元できませんでした: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const row = 'flex h-14 w-full items-center justify-between rounded-xl border border-line px-4 text-left text-sm active:bg-mist'

  return (
    <div className="space-y-6 pb-6">
      <section>
        <p className="text-xs leading-relaxed text-sub">
          記録はこの端末のブラウザ（localStorage）に自動保存されています。現在 {recordCount}件。
          ブラウザのデータ削除や機種変更に備え、定期的に書き出してください。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">書き出し</h3>
        <button className={row} onClick={() => download(`jump-collection-${timestamp()}.json`, toJson(ownership, overrides, comicsSeries), 'application/json')}>
          <span>
            JSONで保存<span className="block text-[11px] text-sub">完全バックアップ（所持記録＋刊行号データ＋コミックス作品）</span>
          </span>
          <span className="text-sub">↓</span>
        </button>
        <button className={row} onClick={() => download(`jump-collection-${timestamp()}.csv`, toCsv(ownership, overrides, comicsSeries), 'text/csv')}>
          <span>
            CSVで保存<span className="block text-[11px] text-sub">雑誌・コミックス全冊の一覧・Excel/Numbersで閲覧可</span>
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
            CSVから復元<span className="block text-[11px] text-sub">所持記録のみ上書き</span>
          </span>
          <span className="text-sub">↑</span>
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
