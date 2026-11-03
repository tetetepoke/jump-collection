/**
 * Firebase（Authentication + Firestore）による複数端末同期。
 * このファイルは同期を使うときだけ動的 import されるので、未設定なら読み込まれない。
 *
 * Firestore 構造: users/{uid} の1ドキュメントに全データを持つ
 *   { ownership: { [号ID]: OwnershipRecord }, catalogOverrides: { [年]: CatalogYear },
 *     comicsSeries: { [作品ID]: ComicSeries }, updatedAt }
 * 変更は項目単位（フィールドパス）で書き込むので、別端末の変更と混ざっても消し合わない。
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  FieldPath,
  deleteField,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from '../firebaseConfig'
import type { CatalogYear, ComicSeries, InsertCollection, OwnershipMap, OwnershipRecord } from '../types'

export interface CloudData {
  ownership: OwnershipMap
  catalogOverrides: Record<number, CatalogYear>
  comicsSeries: ComicSeries[]
  inserts: Record<string, InsertCollection>
}

export interface CloudUser {
  uid: string
  name: string | null
  email: string | null
}

interface RemoteDoc {
  ownership?: OwnershipMap
  catalogOverrides?: Record<string, CatalogYear>
  comicsSeries?: Record<string, ComicSeries>
  inserts?: Record<string, InsertCollection>
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function init() {
  if (!firebaseConfig) throw new Error('Firebase が設定されていません')
  if (!app) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    try {
      db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    } catch {
      // オフラインキャッシュが使えない環境（プライベートモード等）
      db = initializeFirestore(app, { ignoreUndefinedProperties: true })
    }
    getRedirectResult(auth).catch(() => {})
  }
  return { auth: auth!, db: db! }
}

const toUser = (u: User): CloudUser => ({ uid: u.uid, name: u.displayName, email: u.email })

export function watchAuth(cb: (user: CloudUser | null) => void): () => void {
  const { auth } = init()
  return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null))
}

export async function signIn(): Promise<void> {
  const { auth } = init()
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      return
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    throw e
  }
}

export async function logOut(): Promise<void> {
  const { auth } = init()
  await signOut(auth)
}

function fromRemote(d: RemoteDoc | undefined): CloudData {
  const series = Object.values(d?.comicsSeries ?? {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    ownership: d?.ownership ?? {},
    catalogOverrides: (d?.catalogOverrides ?? {}) as Record<number, CatalogYear>,
    comicsSeries: series,
    inserts: d?.inserts ?? {},
  }
}

function toRemote(data: CloudData): RemoteDoc {
  return {
    ownership: data.ownership,
    catalogOverrides: data.catalogOverrides as Record<string, CatalogYear>,
    comicsSeries: Object.fromEntries(data.comicsSeries.map((s) => [s.id, s])),
    inserts: data.inserts,
  }
}

/** 端末の記録とクラウドの記録をまとめる。所持記録は更新日時が新しい方、その他はクラウド優先 */
function merge(local: CloudData, remote: CloudData): CloudData {
  const ownership: OwnershipMap = { ...local.ownership }
  for (const [id, r] of Object.entries(remote.ownership)) {
    const l = ownership[id]
    if (!l || r.updatedAt >= l.updatedAt) ownership[id] = r
  }
  const seriesMap = new Map(local.comicsSeries.map((s) => [s.id, s]))
  for (const s of remote.comicsSeries) seriesMap.set(s.id, s)
  return {
    ownership,
    catalogOverrides: { ...local.catalogOverrides, ...remote.catalogOverrides },
    comicsSeries: [...seriesMap.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    inserts: mergeInserts(local.inserts, remote.inserts),
  }
}

/** 折込冊子: 更新日時が新しい方を採用 */
function mergeInserts(
  local: Record<string, InsertCollection>,
  remote: Record<string, InsertCollection>,
): Record<string, InsertCollection> {
  const out = { ...local }
  for (const [id, r] of Object.entries(remote)) {
    const l = out[id]
    if (!l || r.updatedAt >= l.updatedAt) out[id] = r
  }
  return out
}

export class CloudSession {
  private ref: DocumentReference
  private unsub: (() => void) | null = null

  constructor(readonly uid: string) {
    const { db } = init()
    this.ref = doc(db, 'users', uid)
  }

  /**
   * 初回接続: 端末の記録をクラウドへ統合（mergeLocal=true のとき）してから購読を開始する。
   * 以後クラウド側の変更（他端末の操作を含む）は onData で届く。
   */
  async start(local: CloudData, mergeLocal: boolean, onData: (d: CloudData) => void, onError: (e: unknown) => void) {
    const { db } = init()
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(this.ref)
      if (!snap.exists()) {
        tx.set(this.ref, { ...toRemote(local), updatedAt: serverTimestamp() })
      } else if (mergeLocal) {
        const merged = merge(local, fromRemote(snap.data() as RemoteDoc))
        tx.set(this.ref, { ...toRemote(merged), updatedAt: serverTimestamp() })
      }
    })
    this.unsub = onSnapshot(
      this.ref,
      (snap) => onData(fromRemote(snap.data() as RemoteDoc | undefined)),
      onError,
    )
  }

  stop() {
    this.unsub?.()
    this.unsub = null
  }

  private write(path: FieldPath, value: unknown) {
    return updateDoc(this.ref, path, value ?? deleteField(), 'updatedAt', serverTimestamp())
  }

  setOwnership(changes: Record<string, OwnershipRecord | null>) {
    const entries = Object.entries(changes)
    if (entries.length === 0) return Promise.resolve()
    if (entries.length === 1) {
      const [id, rec] = entries[0]
      return this.write(new FieldPath('ownership', id), rec)
    }
    // 複数件はまとめて1回で書く
    const args: unknown[] = []
    for (const [id, rec] of entries) args.push(new FieldPath('ownership', id), rec ?? deleteField())
    args.push('updatedAt', serverTimestamp())
    const [first, firstVal, ...rest] = args
    return updateDoc(this.ref, first as FieldPath, firstVal, ...rest)
  }

  setCatalogYear(year: number, catalog: CatalogYear | null) {
    return this.write(new FieldPath('catalogOverrides', String(year)), catalog)
  }

  setSeries(id: string, series: ComicSeries | null) {
    return this.write(new FieldPath('comicsSeries', id), series)
  }

  setInsert(id: string, collection: InsertCollection | null) {
    return this.write(new FieldPath('inserts', id), collection)
  }

  /** バックアップからの復元など、全体を置き換える */
  replaceAll(data: CloudData) {
    return setDoc(this.ref, { ...toRemote(data), updatedAt: serverTimestamp() })
  }
}
