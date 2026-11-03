import type { StorageAdapter } from './adapter'
import { LocalStorageAdapter } from './localStorageAdapter'

/** 保存先の切り替えはここだけで行う */
export const storage: StorageAdapter = new LocalStorageAdapter()

export type { StorageAdapter }
