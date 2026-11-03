import type { Stats } from '../hooks/useCollection'
import type { Verification } from '../types'

interface Props {
  /** 省略すると暫定/確定の表示欄を出さない */
  verification?: Verification
  source?: string
  provisionalNote?: string
  stats: Stats
}

export function StatsPanel({ verification, source, provisionalNote, stats }: Props) {
  const provisional = verification === 'provisional'
  return (
    <section className="rounded-2xl border border-line px-5 py-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-sub">所持数</p>
          <p className="tabular mt-1 font-serif text-4xl leading-none">
            {stats.owned}
            <span className="ml-1 text-lg text-sub">/ {stats.total}冊</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-[0.2em] text-sub">コンプリート率</p>
          <p className="tabular mt-1 font-serif text-4xl leading-none text-owned">
            {stats.rate.toFixed(1)}
            <span className="ml-0.5 text-lg">%</span>
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={stats.rate} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-owned transition-[width] duration-300" style={{ width: `${stats.rate}%` }} />
      </div>

      <dl className="tabular mt-4 grid grid-cols-3 text-center text-sm">
        <div>
          <dt className="text-[11px] text-sub">所持済み</dt>
          <dd className="mt-0.5 font-medium text-owned">{stats.owned}</dd>
        </div>
        <div className="border-x border-line">
          <dt className="text-[11px] text-sub">未所持</dt>
          <dd className="mt-0.5 font-medium">{stats.notOwned}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-sub">未確認</dt>
          <dd className="mt-0.5 font-medium text-sub">{stats.unknown}</dd>
        </div>
      </dl>

      {verification && (
      <div className="mt-4 border-t border-line pt-3 text-xs leading-relaxed">
        {provisional ? (
          <p className="text-sub">
            <span className="mr-1.5 inline-block rounded border border-dashed border-sub px-1.5 py-px text-[10px] tracking-widest text-ink">
              暫定
            </span>
            {provisionalNote}
          </p>
        ) : (
          <p className="text-sub">
            <span className="mr-1.5 inline-block rounded border border-owned px-1.5 py-px text-[10px] tracking-widest text-owned">
              確定
            </span>
            出典: {source || '—'}
          </p>
        )}
      </div>
      )}
    </section>
  )
}
