import { memo, useRef } from 'react'
import type { CollectionItem, OwnershipStatus } from '../types'

interface TileProps {
  item: CollectionItem
  status: OwnershipStatus
  onTap: (id: string) => void
  onLongPress: (id: string) => void
}

const LONG_PRESS_MS = 550

const IssueTile = memo(function IssueTile({ item, status, onTap, onLongPress }: TileProps) {
  const timer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }

  const provisional = item.provisional
  const label = item.label
  const small = item.main.length > 3

  const base =
    'no-select relative flex aspect-square w-full flex-col items-center justify-center rounded-xl border transition-colors duration-150 active:scale-[0.97]'
  const look =
    status === 'owned'
      ? 'border-owned bg-owned text-white'
      : status === 'not_owned'
        ? `${provisional ? 'border-dashed' : ''} border-ink/70 bg-paper text-ink`
        : `${provisional ? 'border-dashed' : ''} border-[#cfcfca] bg-paper text-ink/55`

  const stateJa = status === 'owned' ? '所持済み' : status === 'not_owned' ? '未所持' : '未確認'

  return (
    <button
      className={`${base} ${look}`}
      aria-label={`${label}（${stateJa}${provisional ? '・暫定データ' : ''}）`}
      aria-pressed={status === 'owned'}
      onPointerDown={(e) => {
        longPressed.current = false
        start.current = { x: e.clientX, y: e.clientY }
        clear()
        timer.current = window.setTimeout(() => {
          longPressed.current = true
          navigator.vibrate?.(20)
          onLongPress(item.id)
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        navigator.vibrate?.(8)
        onTap(item.id)
      }}
    >
      {status === 'owned' && (
        <span aria-hidden className="absolute right-1.5 top-1 text-[13px] font-bold leading-none">
          ○
        </span>
      )}
      {item.subOnTop && (
        <span className={`mb-1 text-[10px] leading-none ${status === 'owned' ? 'text-white/85' : 'text-sub'}`}>{item.sub}</span>
      )}
      <span className={`tabular px-1 text-center font-serif leading-none ${small ? 'text-[15px]' : item.main.length > 2 ? 'text-[19px]' : 'text-[26px]'}`}>
        {item.main}
      </span>
      {!item.subOnTop && (
        <span className={`mt-1 text-[10px] leading-none ${status === 'owned' ? 'text-white/85' : 'text-sub'}`}>{item.sub}</span>
      )}
      {status === 'not_owned' && (
        <span className="absolute bottom-1 text-[9px] leading-none tracking-wider text-sub">未所持</span>
      )}
    </button>
  )
})

interface GridProps {
  items: CollectionItem[]
  statusOf: (id: string) => OwnershipStatus
  onTap: (id: string) => void
  onLongPress: (id: string) => void
  emptyText: string
}

export function IssueGrid({ items, statusOf, onTap, onLongPress, emptyText }: GridProps) {
  if (items.length === 0) {
    return <p className="py-16 text-center text-sm text-sub">{emptyText}</p>
  }
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
      {items.map((item) => (
        <IssueTile key={item.id} item={item} status={statusOf(item.id)} onTap={onTap} onLongPress={onLongPress} />
      ))}
    </div>
  )
}
