import type { SyncState } from '../hooks/useCollection'

interface Props {
  sync: SyncState
  onSignIn: () => void
  onSignOut: () => void
}

/** バックアップ画面の先頭に出す、複数端末同期の操作欄 */
export function SyncPanel({ sync, onSignIn, onSignOut }: Props) {
  if (sync.kind === 'unavailable') {
    return (
      <section className="rounded-xl bg-mist p-4 text-xs leading-relaxed text-sub">
        <p className="font-semibold text-ink">複数端末の同期</p>
        <p className="mt-1">未設定です。Firebase を設定すると、Googleアカウントでログインしてスマホ・PCの記録を自動で同じにできます（READMEの「複数端末の同期」参照）。</p>
      </section>
    )
  }

  const user = 'user' in sync ? sync.user : null

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            sync.kind === 'synced' ? 'bg-owned' : sync.kind === 'error' ? 'bg-red-600' : sync.kind === 'connecting' ? 'bg-amber-500' : 'bg-line'
          }`}
        />
        <p className="text-sm font-semibold">
          {sync.kind === 'synced' && 'クラウドと同期中'}
          {sync.kind === 'connecting' && '接続中…'}
          {sync.kind === 'signed_out' && '同期オフ（この端末のみに保存）'}
          {sync.kind === 'error' && '同期エラー'}
        </p>
      </div>

      {user && <p className="mt-1 text-xs text-sub">{user.email ?? user.name}</p>}

      {sync.kind === 'error' && <p className="mt-2 text-xs leading-relaxed text-red-700">{sync.message}</p>}

      {sync.kind === 'signed_out' ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-sub">
            Googleアカウントでログインすると、同じアカウントでログインした全端末で記録が自動的に同じになります。
            初回ログイン時は、この端末の記録とクラウドの記録をまとめます（同じ号は新しく記録した方を採用）。
          </p>
          <button onClick={onSignIn} className="mt-3 h-12 w-full rounded-full bg-ink text-sm font-semibold text-white active:opacity-80">
            Googleでログインして同期
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            if (confirm('ログアウトしますか？\nこの端末の記録はそのまま残ります（以後はこの端末だけに保存されます）。')) onSignOut()
          }}
          className="mt-3 h-11 w-full rounded-full border border-line text-sm text-sub active:bg-mist"
        >
          ログアウト
        </button>
      )}
    </section>
  )
}
