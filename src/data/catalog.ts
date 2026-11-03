import type { CatalogYear } from '../types'
import { confirmedCatalog } from './confirmed'
import { makeIssue } from './issue'

export { issueId, issueLabel, makeIssue, sortIssues } from './issue'

export const FIRST_YEAR = 1981
export const LAST_YEAR = 2026
export const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

/**
 * 暫定雛形の号数。
 * 実在の刊行号一覧を裏付ける資料が未入手のため、1〜52号を単号で仮置きしている。
 * 合併号・実際の発行冊数は反映されていない。画面では必ず「暫定」と表示する。
 */
const PROVISIONAL_MAX_NUMBER = 52

function provisionalYear(year: number): CatalogYear {
  return {
    year,
    verification: 'provisional',
    issues: Array.from({ length: PROVISIONAL_MAX_NUMBER }, (_, i) => makeIssue(year, [i + 1], 'provisional')),
  }
}

/** 同梱データのみから得る年のカタログ（確定データがあればそれ、なければ暫定雛形） */
export function builtinYear(year: number): CatalogYear {
  return confirmedCatalog[year] ?? provisionalYear(year)
}

/** ユーザー編集（上書き）を考慮した有効カタログ */
export function effectiveYear(year: number, overrides: Record<number, CatalogYear>): CatalogYear {
  return overrides[year] ?? builtinYear(year)
}
