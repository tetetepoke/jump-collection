import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap, OwnershipRecord, OwnershipStatus } from '../types'
import { storage } from '../storage'
import { effectiveYear } from '../data/catalog'
import { firebaseConfig } from '../firebaseConfig'
import type { CloudData, CloudSession, CloudUser } from '../sync/cloud'
import seed from '../data/seed.json'

/** 初期データを読み込んだ印。記録が空の端末で一度だけ使う */
const SEED_KEY = 'jump-collection:seed-applied:v1'

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

export type SyncState =
  | { kind: 'unavailable' } // firebaseConfig 未設定
  | { kind: 'signed_out' }
  | { kind: 'connecting'; user: CloudUser }
  | { kind: 'synced'; user: CloudUser }
  | { kind: 'error'; user: CloudUser | null; message: string }

const loadCloud = () => import('../sync/cloud')
/** この端末の記録をクラウドへ統合済みかどうか（uid ごと）。ログアウト時に消す */
const mergedKey = (uid: string) => `jump-collection:sync:merged:${uid}`

export function useCollection() {
  const [ownership, setOwnership] = useState<OwnershipMap>({})
  const [overrides, setOverrides] = useState<Record<number, CatalogYear>>({})
  const [comicsSeries, setComicsSeries] = useState<ComicSeries[]>([])
  const [inserts, setInserts] = useState<Record<string, InsertCollection>>({})
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncState>(firebaseConfig ? { kind: 'signed_out' } : { kind: 'unavailable' })

  // 最新値を副作用（クラウド書き込み）から参照するための ref
  const ownershipRef = useRef(ownership)
  const overridesRef = useRef(overrides)
  const seriesRef = useRef(comicsSeries)
  const insertsRef = useRef(inserts)
  ownershipRef.current = ownership
  overridesRef.current = overrides
  seriesRef.current = comicsSeries
  insertsRef.current = inserts

  const session = useRef<CloudSession | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    Promise.all([
      storage.loadOwnership(),
      storage.loadCatalogOverrides(),
      storage.loadComicsSeries(),
      storage.loadInserts(),
    ]).then(([o, c, cs, ins]) => {
      // 記録がまったく無い端末では、同梱の初期データ（src/data/seed.json）を読み込む
      let seeded = false
      try {
        seeded = localStorage.getItem(SEED_KEY) === '1'
      } catch {
        /* noop */
      }
      const empty = !Object.keys(o).length && !Object.keys(c).length && !cs.length && !Object.keys(ins).length
      if (empty && !seeded) {
        o = seed.ownership as OwnershipMap
        c = seed.catalogOverrides as unknown as Record<number, CatalogYear>
        cs = seed.comicsSeries as ComicSeries[]
        skipSave.current = false // 初期データはすぐ保存する
      }
      try {
        localStorage.setItem(SEED_KEY, '1')
      } catch {
        /* noop */
      }
      setOwnership(o)
      setOverrides(c)
      setComicsSeries(cs)
      setInserts(ins)
      setLoaded(true)
    })
  }, [])

  // ローカル保存（同期中もオフライン用キャッシュとして保存し続ける）
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

  useEffect(() => {
    if (!loaded) return
    storage.saveInserts(inserts).catch(() => setSaveError('折込冊子のリスト保存に失敗しました'))
  }, [inserts, loaded])

  // ───────── クラウド同期 ─────────

  const cloudError = useCallback((e: unknown) => {
    console.error(e)
    setSync((s) => ({
      kind: 'error',
      user: 'user' in s ? s.user : null,
      message: 'クラウドとの同期に失敗しました。通信状況を確認してください（変更はこの端末に保存されています）',
    }))
  }, [])

  const push = useCallback(
    (fn: (s: CloudSession) => Promise<unknown>) => {
      const s = session.current
      if (s) fn(s).catch(cloudError)
    },
    [cloudError],
  )

  useEffect(() => {
    if (!loaded || !firebaseConfig) return
    let unsubAuth: (() => void) | null = null
    let cancelled = false
    loadCloud().then((cloud) => {
      if (cancelled) return
      unsubAuth = cloud.watchAuth(async (user) => {
        session.current?.stop()
        session.current = null
        if (!user) {
          setSync({ kind: 'signed_out' })
          return
        }
        setSync({ kind: 'connecting', user })
        const s = new cloud.CloudSession(user.uid)
        const local: CloudData = {
          ownership: ownershipRef.current,
          catalogOverrides: overridesRef.current,
          comicsSeries: seriesRef.current,
          inserts: insertsRef.current,
        }
        let needMerge = true
        try {
          needMerge = localStorage.getItem(mergedKey(user.uid)) !== '1'
        } catch {
          /* noop */
        }
        try {
          await s.start(
            local,
            needMerge,
            (d) => {
              setOwnership(d.ownership)
              setOverrides(d.catalogOverrides)
              setComicsSeries(d.comicsSeries)
              setInserts(d.inserts)
              setSync({ kind: 'synced', user })
            },
            cloudError,
          )
          session.current = s
          try {
            localStorage.setItem(mergedKey(user.uid), '1')
          } catch {
            /* noop */
          }
        } catch (e) {
          cloudError(e)
        }
      })
    })
    return () => {
      cancelled = true
      unsubAuth?.()
      session.current?.stop()
      session.current = null
    }
  }, [loaded, cloudError])

  const signIn = useCallback(async () => {
    const cloud = await loadCloud()
    try {
      await cloud.signIn()
    } catch (e) {
      cloudError(e)
    }
  }, [cloudError])

  const signOut = useCallback(async () => {
    const uid = session.current?.uid
    const cloud = await loadCloud()
    await cloud.logOut()
    if (uid) {
      try {
        localStorage.removeItem(mergedKey(uid))
      } catch {
        /* noop */
      }
    }
  }, [])

  // ───────── 操作 ─────────

  const getYear = useCallback((year: number) => effectiveYear(year, overrides), [overrides])

  /** 所持記録の変更をローカルとクラウドの両方に反映（null は未確認＝記録削除） */
  const applyOwnership = useCallback(
    (changes: Record<string, OwnershipRecord | null>) => {
      const next = { ...ownershipRef.current }
      for (const [id, rec] of Object.entries(changes)) {
        if (rec) next[id] = rec
        else delete next[id]
      }
      ownershipRef.current = next
      setOwnership(next)
      push((s) => s.setOwnership(changes))
    },
    [push],
  )

  /** タップ: 未確認→所持済み、所持済み→未所持、未所持→所持済み */
  const toggle = useCallback(
    (id: string) => {
      const next = statusOf(ownershipRef.current, id) === 'owned' ? 'not_owned' : 'owned'
      applyOwnership({ [id]: { issueId: id, status: next, updatedAt: new Date().toISOString() } })
    },
    [applyOwnership],
  )

  const setUnknown = useCallback(
    (id: string) => {
      if (ownershipRef.current[id]) applyOwnership({ [id]: null })
    },
    [applyOwnership],
  )

  const setYearCatalog = useCallback(
    (catalog: CatalogYear, migration?: Migration) => {
      setOverrides((prev) => ({ ...prev, [catalog.year]: catalog }))
      push((s) => s.setCatalogYear(catalog.year, catalog))
      if (!migration) return
      const prev = ownershipRef.current
      const statuses = migration.from.map((id) => statusOf(prev, id))
      const merged: OwnershipStatus = statuses.includes('owned')
        ? 'owned'
        : statuses.includes('not_owned')
          ? 'not_owned'
          : 'unknown'
      const changes: Record<string, OwnershipRecord | null> = {}
      for (const id of migration.from) if (prev[id]) changes[id] = null
      if (merged !== 'unknown') {
        const now = new Date().toISOString()
        for (const id of migration.to) changes[id] = { issueId: id, status: merged, updatedAt: now }
      }
      applyOwnership(changes)
    },
    [applyOwnership, push],
  )

  const resetYearCatalog = useCallback(
    (year: number) => {
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[year]
        return next
      })
      push((s) => s.setCatalogYear(year, null))
    },
    [push],
  )

  /** シリーズを追加または更新（同じIDがあれば置き換え） */
  const upsertSeries = useCallback(
    (series: ComicSeries) => {
      setComicsSeries((prev) => {
        const i = prev.findIndex((s) => s.id === series.id)
        if (i < 0) return [...prev, series]
        const next = [...prev]
        next[i] = series
        return next
      })
      push((s) => s.setSeries(series.id, series))
    },
    [push],
  )

  const addSeriesMany = useCallback(
    (list: ComicSeries[]) => {
      const have = new Set(seriesRef.current.map((s) => s.id))
      const fresh = list.filter((s) => !have.has(s.id))
      setComicsSeries((prev) => [...prev, ...fresh])
      for (const series of fresh) push((s) => s.setSeries(series.id, series))
    },
    [push],
  )

  /** シリーズ削除。その巻の所持記録も削除する */
  const removeSeries = useCallback(
    (id: string) => {
      setComicsSeries((prev) => prev.filter((s) => s.id !== id))
      push((s) => s.setSeries(id, null))
      const prefix = `jc:${id}:`
      const changes: Record<string, null> = {}
      for (const k of Object.keys(ownershipRef.current)) if (k.startsWith(prefix)) changes[k] = null
      applyOwnership(changes)
    },
    [applyOwnership, push],
  )

  /** 折込冊子の最新号を保存 */
  const upsertInsert = useCallback(
    (collection: InsertCollection) => {
      const next = { ...collection, updatedAt: new Date().toISOString() }
      setInserts((prev) => ({ ...prev, [next.id]: next }))
      push((s) => s.setInsert(next.id, next))
    },
    [push],
  )

  const replaceAll = useCallback(
    (o: OwnershipMap, c?: Record<number, CatalogYear>, cs?: ComicSeries[], ins?: Record<string, InsertCollection>) => {
      setOwnership(o)
      if (c) setOverrides(c)
      if (cs) setComicsSeries(cs)
      if (ins) setInserts(ins)
      push((s) =>
        s.replaceAll({
          ownership: o,
          catalogOverrides: c ?? overridesRef.current,
          comicsSeries: cs ?? seriesRef.current,
          inserts: ins ?? insertsRef.current,
        }),
      )
    },
    [push],
  )

  return {
    loaded,
    saveError,
    sync,
    signIn,
    signOut,
    ownership,
    overrides,
    comicsSeries,
    inserts,
    upsertInsert,
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
