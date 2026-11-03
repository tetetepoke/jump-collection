import type { CatalogYear } from '../../types'
import { makeIssue } from '../issue'

/**
 * 確定刊行号データの読み込み口。
 *
 * このフォルダに `1985.json` のような年別JSONを置くと、ビルド時に自動で取り込まれ
 * その年は「確定」として表示される。資料で裏付けが取れた年だけを置くこと。
 *
 * フォーマット:
 * {
 *   "year": 1985,
 *   "source": "出典（例: 国立国会図書館 所蔵目録 / 手元の現物で確認 など）",
 *   "issues": [[1], [2], [3, 4], [5], ...]   // 合併号は配列に複数の号数
 * }
 *
 * 現時点では確定データは同梱していない（全年が暫定）。
 */
interface ConfirmedYearFile {
  year: number
  source: string
  issues: number[][]
}

const files = import.meta.glob<ConfirmedYearFile>('./*.json', { eager: true, import: 'default' })

export const confirmedCatalog: Record<number, CatalogYear> = {}

for (const file of Object.values(files)) {
  confirmedCatalog[file.year] = {
    year: file.year,
    verification: 'confirmed',
    source: file.source,
    issues: file.issues.map((nums) => makeIssue(file.year, nums, 'confirmed')),
  }
}
