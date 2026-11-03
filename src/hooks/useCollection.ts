import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogYear, ComicSeries, OwnershipMap, OwnershipStatus } from '../types'
import { storage } from '../storage'
import { effectiveYear } from '../data/catalog'

export interface Stats {
  total: number
  owned: number
  notOwned: number
  unknown: number
  /** 0〜100 */
  rate: number
}

export function statusOf(ownership: OwnershipMap, id: string): OwnershipStatus {
  return ownership[id]?.status ?? 'unknown'
}

export function computeStats(issues: { id: string }[], ownership: OwnershipMap): Stats {
  let owned = 0
  let notOwned = 0
  for (const i of issues) {
    const s = statusOf(ownership, i.id)
    if (s === 'owned') owned++
    else if (s === 'not_owned') notOwned++
  }
  const total = issues.length
  return { total, owned, notOwned, unknown: total - owned - notOwned, rate: total ? (owned / total) * 100 : 0 }
}

/** 刊行号データ編集時に所持記録を新しい号IDへ引き継ぐための指定 */
export interface Migration {
  from: string[]
  to: string[]
}

export function useCollection() {
  const [ownership, setOwnership] = useState<OwnershipMap>({})
  const [overrides, setOverrides] = useState<Record<number, CatalogYear>>({})
  const [comicsSeries, setComicsSeries] = useState<ComicSeries[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    Promise.all([storage.loadOwnership(), storage.loadCatalogOverrides(), storage.loadComicsSeries()]).then(([o, c, cs]) => {
      setOwnership(o)
      setOverrides(c)
      setComicsSeries(cs)
      setLoaded(true)
    })
  }, [])

  // 変更のたびに自動保存
  useEffect(() => {
    if (!loaded) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    storage
      .saveOwnership(ownership)
      .then(() => setSaveError(null))
      .catch(() => setSaveError('保存に失敗しました。ストレージ容量やプライベートモードを確認してください'))
  }, [ownership, loaded])

  useEffect(() => {
    if (!loaded) return
    storage.saveCatalogOverrides(overrides).catch(() => setSaveError('刊行号データの保存に失敗しました'))
  }, [overrides, loaded])

  useEffect(() => {
    if (!loaded) return
    storage.saveComicsSeries(comicsSeries).catch(() => setSaveError('コミックスのシリーズ保存に失敗しました'))
  }, [comicsSeries, loaded])

  const getYear = useCallback((year: number) => effectiveYear(year, overrides), [overrides])

  /** タップ: 未確認→所持済み、所持済み→未所持、未所持→所持済み */
  const toggle = useCallback((id: string) => {
    setOwnership((prev) => {
      const current = statusOf(prev, id)
      const next = current === 'owned' ? 'not_owned' : 'owned'
      return { ...prev, [id]: { issueId: id, status: next, updatedAt: new Date().toISOString() } }
    })
  }, [])

  const setUnknown = useCallback((id: string) => {
    setOwnership((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const setYearCatalog = useCallback((catalog: CatalogYear, migration?: Migration) => {
    setOverrides((prev) => ({ ...prev, [catalog.year]: catalog }))
    if (!migration) return
    setOwnership((prev) => {
      const statuses = migration.from.map((id) => statusOf(prev, id))
      const merged: OwnershipStatus = statuses.includes('owned')
        ? 'owned'
        : statuses.includes('not_owned')
          ? 'not_owned'
          : 'unknown'
      const next = { ...prev }
      for (const id of migration.from) delete next[id]
      if (merged !== 'unknown') {
        const now = new Date().toISOString()
        for (const id of migration.to) next[id] = { issueId: id, status: merged, updatedAt: now }
      }
      return next
    })
  }, [])

  const resetYearCatalog = useCallback((year: number) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[year]
      return next
    })
  }, [])

  /** シリーズを追加または更新（同じIDがあれば置き換え） */
  const upsertSeries = useCallback((series: ComicSeries) => {
    setComicsSeries((prev) => {
      const i = prev.findIndex((s) => s.id === series.id)
      if (i < 0) return [...prev, series]
      const next = [...prev]
      next[i] = series
      return next
    })
  }, [])

  const addSeriesMany = useCallback((list: ComicSeries[]) => {
    setComicsSeries((prev) => {
      const have = new Set(prev.map((s) => s.id))
      return [...prev, ...list.filter((s) => !have.has(s.id))]
    })
  }, [])

  /** シリーズ削除。その巻の所持記録も削除する */
  const removeSeries = useCallback((id: string) => {
    setComicsSeries((prev) => prev.filter((s) => s.id !== id))
    setOwnership((prev) => {
      const prefix = `jc:${id}:`
      const next: OwnershipMap = {}
      for (const [k, v] of Object.entries(prev)) if (!k.startsWith(prefix)) next[k] = v
      return next
    })
  }, [])

  const replaceAll = useCallback(
    (o: OwnershipMap, c?: Record<number, CatalogYear>, cs?: ComicSeries[]) => {
      setOwnership(o)
      if (c) setOverrides(c)
      if (cs) setComicsSeries(cs)
    },
    [],
  )

  return {
    loaded,
    saveError,
    ownership,
    overrides,
    comicsSeries,
    upsertSeries,
    addSeriesMany,
    removeSeries,
    getYear,
    toggle,
    setUnknown,
    setYearCatalog,
    resetYearCatalog,
    replaceAll,
  }
}
