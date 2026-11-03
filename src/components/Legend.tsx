export function Legend({ unit, hideProvisional }: { unit: '号' | '巻'; hideProvisional?: boolean }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-mist px-4 py-3 text-[11px] leading-relaxed text-sub">
      <p>
        <span className="mr-1 inline-block h-3 w-3 translate-y-0.5 rounded bg-owned" />
        タップで<strong className="text-ink">所持済み</strong>（○）、もう一度タップで<strong className="text-ink">未所持</strong>
      </p>
      <p>長押しで「未確認」に戻せます。未確認は未所持とはみなしません。</p>
      {!hideProvisional && <p>点線の枠は暫定データ（実在未確認）の{unit}です。</p>}
    </div>
  )
}
