/**
 * Firebase の設定（複数端末同期用）。
 *
 * Firebase コンソール → プロジェクトの設定 → マイアプリ（ウェブ）に表示される
 * firebaseConfig の値をここに貼り付ける。null のままなら同期機能は表示されず、
 * これまでどおり端末内（localStorage）だけで動く。
 *
 * ここに書く値（apiKey など）は公開しても問題ない識別子で、
 * データの保護は Firestore のセキュリティルール（README 参照）で行う。
 */
export const firebaseConfig: {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
} | null = null
