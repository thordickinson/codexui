export const PINNED_THREAD_IDS_STORAGE_KEY = 'codex-web-local.pinned-thread-ids.v1'
export const PINNED_PROJECT_IDS_STORAGE_KEY = 'codex-web-local.pinned-project-ids.v1'

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>

function getLocalStorage(): LocalStorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function normalizePinnedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export function loadPinnedIds(storageKey: string, storage = getLocalStorage()): string[] {
  if (!storage) return []

  try {
    const raw = storage.getItem(storageKey)
    return raw ? normalizePinnedIds(JSON.parse(raw) as unknown) : []
  } catch {
    return []
  }
}

export function persistPinnedIds(storageKey: string, ids: string[], storage = getLocalStorage()): void {
  if (!storage) return

  try {
    storage.setItem(storageKey, JSON.stringify(normalizePinnedIds(ids)))
  } catch {
    // Pinning remains available for the current session when storage is unavailable.
  }
}

export function prunePinnedIds(ids: string[], validIds: Set<string>): string[] {
  return normalizePinnedIds(ids).filter((id) => validIds.has(id))
}
