import { useState } from 'react'
import type { CatalogYear, Issue, OwnershipMap } from '../types'
import { builtinYear, issueLabel, makeIssue, sortIssues } from '../data/catalog'
import type { Migration } from '../hooks/useCollection'
import { statusOf } from '../hooks/useCollection'

interface Props {
  catalog: CatalogYear
  isOverridden: boolean
  ownership: OwnershipMap
  onSave: (catalog: CatalogYear, migration?: Migration) => void
  onReset: (year: number) => void
}

/**
 * 刊行号データ（カタログ）の編集。所持記録ではなく「その年に実在した号」を整える画面。
 * 編集した年は暫定扱いに戻り、出典を記入して明示的に確定するまで「確定」にはならない。
 */
export function CatalogEditor({ catalog, isOverridden, ownership, onSave, onReset }: Props) {
  const { year } = catalog
  const [newNumber, setNewNumber] = useState('')
  const [source, setSource] = useState(catalog.source ?? '')
  const builtinConfirmed = builtinYear(year).verification === 'confirmed'

  const commit = (issues: Issue[], migration?: Migration) => {
    onSave(
      {
        year,
        verification: 'provisional',
        issues: sortIssues(issues.map((i) => ({ ...i, verification: 'provisional' as const }))),
      },
      migration,
    )
  }

  const mergeWithNext = (idx: number) => {
    const a = catalog.issues[idx]
    const b = catalog.issues[idx + 1]
    const merged = makeIssue(year, [...a.numbers, ...b.numbers], 'provisional')
    const issues = [...catalog.issues]
    issues.splice(idx, 2, merged)
    commit(issues, { from: [a.id, b.id], to: [merged.id] })
  }

  const split = (idx: number) => {
    const target = catalog.issues[idx]
    const parts = target.numbers.map((n) => makeIssue(year, [n], 'provisional'))
    const issues = [...catalog.issues]
    issues.splice(idx, 1, ...parts)
    commit(issues, { from: [target.id], to: parts.map((p) => p.id) })
  }

  const remove = (idx: number) => {
    const target = catalog.issues[idx]
    const s = statusOf(ownership, target.id)
    const warn = s !== 'unknown' ? `\n※この号の所持記録（${s === 'owned' ? '所持済み' : '未所持'}）は保持され、号を戻すと復活します。` : ''
    if (!confirm(`${year}年 ${issueLabel(target.numbers)} を刊行号データから削除しますか？${warn}`)) return
    commit(catalog.issues.filter((_, i) => i !== idx))
  }

  const add = () => {
    const n = Number(newNumber)
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      alert('1〜60の号数を入力してください')
      return
    }
    if (catalog.issues.some((i) => i.numbers.includes(n))) {
      alert(`${n}号はすでに登録されています`)
      return
    }
    commit([...catalog.issues, makeIssue(year, [n], 'provisional')])
    setNewNumber('')
  }

  const confirmYear = () => {
    if (!source.trim()) {
      alert('確定するには出典（どの資料で確認したか）を入力してください')
      return
    }
    if (!confirm(`${year}年の刊行号データ（${catalog.issues.length}冊）を「確定」にします。資料で全号を確認済みですか？`)) return
    onSave({
      year,
      verification: 'confirmed',
      source: source.trim(),
      issues: catalog.issues.map((i) => ({ ...i, verification: 'confirmed' })),
    })
  }

  const unconfirm = () => commit(catalog.issues)

  const smallBtn = 'h-10 rounded-full border border-line px-3 text-xs active:bg-mist'

  return (
    <div className="space-y-6 pb-6">
      <p className="text-xs leading-relaxed text-sub">
        ここでは「{year}年に実際に刊行された号」を整えます（所持記録とは別データです）。合併号は隣の号と「合併」してください。
        編集した年は<strong className="text-ink">暫定</strong>
        扱いになり、出典を記入して確定するまで確定データとしては表示されません。
      </p>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          号の一覧 <span className="tabular font-normal text-sub">（{catalog.issues.length}冊）</span>
        </h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {catalog.issues.map((issue, idx) => (
            <li key={issue.id} className="flex items-center gap-2 px-3 py-2">
              <span className="tabular w-20 shrink-0 font-serif text-base">{issueLabel(issue.numbers)}</span>
              <div className="ml-auto flex gap-1.5">
                {idx < catalog.issues.length - 1 && (
                  <button className={smallBtn} onClick={() => mergeWithNext(idx)}>
                    次と合併
                  </button>
                )}
                {issue.numbers.length > 1 && (
                  <button className={smallBtn} onClick={() => split(idx)}>
                    分割
                  </button>
                )}
                <button className={`${smallBtn} text-red-700`} onClick={() => remove(idx)}>
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            placeholder="号数"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="tabular h-11 w-28 rounded-full border border-line px-4 text-base"
          />
          <button className="h-11 flex-1 rounded-full border border-ink text-sm active:bg-mist" onClick={add}>
            号を追加
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-mist p-4">
        <h3 className="text-sm font-semibold">確定</h3>
        {catalog.verification === 'confirmed' ? (
          <>
            <p className="mt-1 text-xs text-sub">この年は確定済みです。出典: {catalog.source || '—'}</p>
            {isOverridden && (
              <button className="mt-3 h-11 w-full rounded-full border border-line bg-paper text-sm" onClick={unconfirm}>
                暫定に戻す
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-xs leading-relaxed text-sub">
              資料（現物・目録・公式情報など）で全号を照合できた場合のみ確定してください。
            </p>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="出典（例: 国会図書館 所蔵目録で照合）"
              className="mt-3 h-11 w-full rounded-full border border-line bg-paper px-4 text-base"
            />
            <button
              className="mt-2 h-11 w-full rounded-full bg-owned text-sm font-semibold text-white active:opacity-80"
              onClick={confirmYear}
            >
              この年を確定データにする
            </button>
          </>
        )}
      </section>

      {isOverridden && (
        <button
          className="h-11 w-full rounded-full border border-line text-sm text-sub active:bg-mist"
          onClick={() => {
            if (confirm(`${year}年の編集を破棄し、同梱の${builtinConfirmed ? '確定' : '暫定'}データに戻しますか？`)) onReset(year)
          }}
        >
          同梱データに戻す
        </button>
      )}
    </div>
  )
}
