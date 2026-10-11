import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getTurnWorkPage } from '../api/codexGateway'
import type { ThreadItem } from '../api/appServerDtos'

type WorkState = {
  threadId: string
  turnId: string
  items: ThreadItem[]
  nextCursor: string | null
  loaded: boolean
  expanded: boolean
  loading: boolean
  dirty: boolean
  error: string
  timer: ReturnType<typeof setTimeout> | null
}

const cacheGeneration = ref(0)
const entries = new Map<string, WorkState>()
const keyFor = (threadId: string, turnId: string) => JSON.stringify([threadId, turnId])

function entryFor(threadId: string, turnId: string): WorkState {
  const key = keyFor(threadId, turnId)
  let entry = entries.get(key)
  if (!entry) {
    entry = reactive({ threadId, turnId, items: [], nextCursor: null, loaded: false,
      expanded: false, loading: false, dirty: false, error: '', timer: null })
    entries.set(key, entry)
  }
  return entry
}

async function load(entry: WorkState, older = false): Promise<void> {
  if (entry.loading || !entry.expanded || (older && !entry.nextCursor)) return
  entry.loading = true
  entry.error = ''
  if (!older) entry.dirty = false
  let succeeded = false
  try {
    const cursor = older ? entry.nextCursor : null
    const page = await getTurnWorkPage(entry.threadId, entry.turnId, cursor)
    if (entries.get(keyFor(entry.threadId, entry.turnId)) !== entry) return
    if (cursor && page.nextCursor === cursor) throw new Error('The work history cursor did not advance')
    const existingIds = new Set(entry.items.map((item) => item.id))
    const incomingIds = new Set(page.items.map((item) => item.id))
    const overlap = entry.items.findIndex((item) => incomingIds.has(item.id))
    if (older) {
      entry.items = [...page.items.filter((item) => !existingIds.has(item.id)), ...entry.items]
      entry.nextCursor = page.nextCursor
    } else if (overlap >= 0 && page.nextCursor) {
      entry.items = [...entry.items.slice(0, overlap), ...page.items]
    } else {
      entry.items = page.items
      entry.nextCursor = page.nextCursor
    }
    entry.loaded = true
    succeeded = true
  } catch (error) {
    entry.error = error instanceof Error ? error.message : 'Unable to load work details'
    entry.dirty = true
  } finally {
    entry.loading = false
    if (succeeded && entry.dirty && entry.expanded) scheduleRefresh(entry)
  }
}

function scheduleRefresh(entry: WorkState): void {
  if (!entry.expanded || entry.timer || entry.loading) return
  entry.timer = setTimeout(() => {
    entry.timer = null
    if (entry.expanded && entry.dirty) void load(entry)
  }, 1000)
}

export function invalidateTurnWork(threadId: string, turnId: string): void {
  const entry = entries.get(keyFor(threadId, turnId))
  if (!entry) return
  entry.dirty = true
  scheduleRefresh(entry)
}

export function refreshOpenTurnWork(): void {
  for (const entry of entries.values()) {
    entry.dirty = true
    scheduleRefresh(entry)
  }
}

export function clearTurnWorkCache(): void {
  for (const entry of entries.values()) if (entry.timer) clearTimeout(entry.timer)
  entries.clear()
  cacheGeneration.value += 1
}

function close(entry: WorkState): void {
  entry.expanded = false
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = null
}

export function useTurnWorkDetails(threadId: () => string, turnId: () => string) {
  const state = computed(() => {
    cacheGeneration.value
    return entryFor(threadId(), turnId())
  })
  watch(state, (_next, previous) => close(previous))
  onBeforeUnmount(() => close(state.value))
  return {
    state,
    toggle: () => {
      const entry = state.value
      if (entry.expanded) close(entry)
      else {
        entry.expanded = true
        if (!entry.loaded || entry.dirty || entry.error) void load(entry)
      }
    },
    retry: () => load(state.value),
    loadOlder: () => load(state.value, true),
  }
}
