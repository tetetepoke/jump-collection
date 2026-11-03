import { useState } from 'react'
import type { ComicSeries } from '../types'
import { COMICS_PRESETS, newSeriesId, presetToSeries } from '../data/comics'

const input = 'h-12 w-full rounded-xl border border-line bg-paper px-4 text-base'
const label = 'mb-1.5 block text-xs font-semibold'

function parseExtras(text: string): string[] {
  return [...new Set(text.split(/[,、，\s]+/).map((s) => s.trim()).filter(Boolean))]
}

// ───────── 追加 ─────────

interface AddProps {
  existing: ComicSeries[]
  onAdd: (list: ComicSeries[]) => void
}

export function SeriesAdd({ existing, onAdd }: AddProps) {
  const [tab, setTab] = useState<'manual' | 'preset'>('manual')
  return (
    <div className="space-y-5 pb-6">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-mist p-1">
        {(
          [
            ['manual', '手動で追加'],
            ['preset', '完結作品から選ぶ'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-10 rounded-full text-sm ${tab === k ? 'bg-paper font-semibold shadow-sm' : 'text-sub'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'manual' ? <ManualAdd onAdd={(s) => onAdd([s])} /> : <PresetAdd existing={existing} onAdd={onAdd} />}
    </div>
  )
}

function ManualAdd({ onAdd }: { onAdd: (s: ComicSeries) => void }) {
  const [title, setTitle] = useState('')
  const [count, setCount] = useState('')
  const [status, setStatus] = useState<ComicSeries['status']>('ongoing')
  const [extras, setExtras] = useState('')

  const submit = () => {
    const n = Number(count)
    if (!title.trim()) return alert('作品名を入力してください')
    if (!Number.isInteger(n) || n < 0 || n > 300) return alert('巻数は0〜300で入力してください')
    onAdd({
      id: newSeriesId(),
      title: title.trim(),
      status,
      volumeCount: n,
      extras: parseExtras(extras),
      verification: 'provisional',
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>作品名</label>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: ONE PIECE" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{status === 'ongoing' ? '既刊巻数' : '全巻数'}</label>
          <input className={`${input} tabular`} type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="例: 30" />
        </div>
        <div>
          <label className={label}>状態</label>
          <StatusToggle value={status} onChange={setStatus} />
        </div>
      </div>
      <div>
        <label className={label}>
          特別巻 <span className="font-normal text-sub">（任意・読点区切り）</span>
        </label>
        <input className={input} value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="例: 0巻、外伝" />
      </div>
      <p className="text-[11px] leading-relaxed text-sub">追加した作品は「暫定」になります。資料で巻数を確認できたら、作品画面の編集から確定してください。</p>
      <button onClick={submit} className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white active:opacity-80">
        追加する
      </button>
    </div>
  )
}

function PresetAdd({ existing, onAdd }: AddProps) {
  const have = new Set(existing.map((s) => s.id))
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setPicked((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-sub">
        よく知られた完結作品の一覧です。巻数は一般に知られているジャンプコミックス通常版の最終巻数で、資料との照合はしていません。追加すると<strong className="text-ink">暫定</strong>として登録されます。
      </p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {COMICS_PRESETS.map((p) => {
          const added = have.has(`p-${p.key}`)
          const on = picked.has(p.key)
          return (
            <li key={p.key}>
              <button
                disabled={added}
                onClick={() => toggle(p.key)}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-40"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    on || added ? 'border-owned bg-owned text-white' : 'border-line'
                  }`}
                >
                  {(on || added) && '✓'}
                </span>
                <span className="flex-1 text-sm">{p.title}</span>
                <span className="tabular text-xs text-sub">{added ? '登録済み' : `全${p.volumeCount}巻`}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-0 bg-paper pb-1 pt-2">
        <button
          disabled={picked.size === 0}
          onClick={() => onAdd(COMICS_PRESETS.filter((p) => picked.has(p.key)).map(presetToSeries))}
          className="h-12 w-full rounded-full bg-ink text-sm font-semibold text-white active:opacity-80 disabled:opacity-30"
        >
          {picked.size ? `${picked.size}作品を追加（暫定）` : '作品を選んでください'}
        </button>
      </div>
    </div>
  )
}

function StatusToggle({ value, onChange }: { value: ComicSeries['status']; onChange: (v: ComicSeries['status']) => void }) {
  return (
    <div className="grid h-12 grid-cols-2 gap-1 rounded-xl bg-mist p-1">
      {(
        [
          ['ongoing', '連載中'],
          ['completed', '完結'],
        ] as const
      ).map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-lg text-sm ${value === k ? 'bg-paper font-semibold shadow-sm' : 'text-sub'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ───────── 編集 ─────────

interface EditProps {
  series: ComicSeries
  onSave: (s: ComicSeries) => void
  onDelete: () => void
}

export function SeriesEdit({ series, onSave, onDelete }: EditProps) {
  const [title, setTitle] = useState(series.title)
  const [count, setCount] = useState(String(series.volumeCount))
  const [status, setStatus] = useState(series.status)
  const [extras, setExtras] = useState(series.extras.join('、'))
  const [source, setSource] = useState(series.source ?? '')

  const build = (): ComicSeries | null => {
    const n = Number(count)
    if (!title.trim()) {
      alert('作品名を入力してください')
      return null
    }
    if (!Number.isInteger(n) || n < 0 || n > 300) {
      alert('巻数は0〜300で入力してください')
      return null
    }
    const ex = parseExtras(extras)
    const volumesChanged = n !== series.volumeCount || ex.join('|') !== series.extras.join('|')
    return {
      ...series,
      title: title.trim(),
      status,
      volumeCount: n,
      extras: ex,
      // 巻構成が変わったら確定は外れる
      verification: volumesChanged ? 'provisional' : series.verification,
      source: volumesChanged ? undefined : series.source,
    }
  }

  const save = () => {
    const s = build()
    if (s) onSave(s)
  }

  const confirmSeries = () => {
    const s = build()
    if (!s) return
    if (!source.trim()) return alert('確定するには出典（どの資料で確認したか）を入力してください')
    if (!confirm(`「${s.title}」の巻構成（${s.volumeCount}巻${s.extras.length ? `＋特別巻${s.extras.length}冊` : ''}）を確定にします。資料で確認済みですか？`)) return
    onSave({ ...s, verification: 'confirmed', source: source.trim() })
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="space-y-4">
        <div>
          <label className={label}>作品名</label>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{status === 'ongoing' ? '既刊巻数' : '全巻数'}</label>
            <input className={`${input} tabular`} type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <label className={label}>状態</label>
            <StatusToggle value={status} onChange={setStatus} />
          </div>
        </div>
        <div>
          <label className={label}>
            特別巻 <span className="font-normal text-sub">（任意・読点区切り）</span>
          </label>
          <input className={input} value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="例: 0巻、外伝" />
        </div>
        <p className="text-[11px] leading-relaxed text-sub">
          巻数を減らしても、消えた巻の所持記録は残ります（巻数を戻すと復活）。巻構成を変えると確定は外れ、暫定に戻ります。
        </p>
        <button onClick={save} className="h-12 w-full rounded-full border border-ink text-sm active:bg-mist">
          保存
        </button>
      </div>

      <section className="rounded-xl bg-mist p-4">
        <h3 className="text-sm font-semibold">確定</h3>
        {series.verification === 'confirmed' ? (
          <>
            <p className="mt-1 text-xs text-sub">確定済み。出典: {series.source || '—'}</p>
            <button
              className="mt-3 h-11 w-full rounded-full border border-line bg-paper text-sm"
              onClick={() => onSave({ ...series, verification: 'provisional', source: undefined })}
            >
              暫定に戻す
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs leading-relaxed text-sub">現物・奥付・出版社の公式情報などで巻構成を確認できた場合のみ確定してください。</p>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="出典（例: 集英社公式サイトで確認）" className={`${input} mt-3 rounded-full`} />
            <button onClick={confirmSeries} className="mt-2 h-11 w-full rounded-full bg-owned text-sm font-semibold text-white active:opacity-80">
              この作品を確定データにする
            </button>
          </>
        )}
      </section>

      <button
        onClick={() => {
          if (confirm(`「${series.title}」を削除しますか？\nこの作品の所持記録もすべて消えます。`)) onDelete()
        }}
        className="h-11 w-full rounded-full border border-line text-sm text-red-700 active:bg-mist"
      >
        この作品を削除
      </button>
    </div>
  )
}
