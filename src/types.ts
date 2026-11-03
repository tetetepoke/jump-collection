// ─────────────────────────────────────────────
// 刊行号データ（カタログ）: 「どの号が実在するか」
// 所持記録とは完全に別管理する。
// ─────────────────────────────────────────────

/** 刊行号データの確度 */
export type Verification =
  | 'confirmed' // 資料で裏付けた確定データ
  | 'provisional' // 暫定（雛形）。実在が裏付けられていない

/** 1冊分の刊行号（合併号は numbers が複数） */
export interface Issue {
  /** 例: "1985-3-4"（年-号数をハイフン連結）。所持記録のキーになる */
  id: string
  year: number
  /** 例: [3, 4] → 「3・4号」 */
  numbers: number[]
  verification: Verification
}

export interface CatalogYear {
  year: number
  verification: Verification
  /** 確定データの出典メモ（確定時のみ） */
  source?: string
  issues: Issue[]
}

// ─────────────────────────────────────────────
// 所持記録: 「どの号を持っているか」
// ─────────────────────────────────────────────

/** unknown は「未確認」。未所持とは区別する */
export type OwnershipStatus = 'unknown' | 'not_owned' | 'owned'

export interface OwnershipRecord {
  issueId: string
  status: Exclude<OwnershipStatus, 'unknown'>
  /** ISO 8601。将来の複数端末同期で新しい方を採用するために保持 */
  updatedAt: string
}

/** 記録が無い号は unknown とみなす */
export type OwnershipMap = Record<string, OwnershipRecord>

export type Filter = 'all' | 'owned' | 'not_owned' | 'unknown'

// ─────────────────────────────────────────────
// ジャンプコミックス: 「シリーズ → 巻」で管理
// シリーズ（刊行データ）と所持記録は別管理。所持記録は共通の OwnershipMap に
// "jc:<seriesId>:<巻>" のIDで保存する。
// ─────────────────────────────────────────────

export interface ComicSeries {
  /** プリセット由来は "p-dragonball" のような固定ID、手動追加は "s-xxxx" */
  id: string
  title: string
  /** 完結 / 連載中 */
  status: 'completed' | 'ongoing'
  /** 通常巻の冊数（1〜N巻） */
  volumeCount: number
  /** 通常巻以外（例: "0巻", "外伝"）。任意 */
  extras: string[]
  verification: Verification
  source?: string
  createdAt: string
}

/** 画面表示用の1冊（雑誌の号・コミックスの巻を共通で扱う） */
export interface CollectionItem {
  id: string
  /** タイル中央の大きな表示（例: "3・4", "12"） */
  main: string
  /** タイル下の小さな表示（例: "号", "合併号", "巻"） */
  sub: string
  /** 読み上げ・確認ダイアログ用（例: "3・4号", "DRAGON BALL 12巻"） */
  label: string
  provisional: boolean
  /** sub を数字の上に表示する（例: "Vol."） */
  subOnTop?: boolean
}

// ─────────────────────────────────────────────
// 折込冊子（コミックスニュース・ジャンパラ・ジャンコミスクープ）
// Vol.1〜最新号を並べてチェックするだけ。最新号は追加で増やせる。
// 所持記録は "ins:<コレクションID>:<Vol番号>" のIDで共通の OwnershipMap に保存する。
// ─────────────────────────────────────────────

export interface InsertCollection {
  id: string
  /** 最新号（Vol.1〜count を表示） */
  count: number
  updatedAt: string
}

/** 'magazine' | 'comics' | 'ins:<コレクションID>' */
export type CollectionKind = 'magazine' | 'comics' | `ins:${string}`
