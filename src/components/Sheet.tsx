import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** 画面下からせり上がるシート */
export function Sheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/30" aria-label="閉じる" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif text-lg tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-sub active:bg-mist"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="safe-bottom overflow-y-auto px-5 pt-4">{children}</div>
      </div>
    </div>
  )
}
