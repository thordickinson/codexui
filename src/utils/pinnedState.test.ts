import { describe, expect, it } from 'vitest'

import { loadPinnedIds, normalizePinnedIds, persistPinnedIds, prunePinnedIds } from './pinnedState'

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))
  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      values.set(key, value)
    },
  }
}

describe('pinnedState', () => {
  it('restores valid pins in their stored order and normalizes duplicates', () => {
    const storage = createStorage({ pins: '[" newest ", "older", "newest", 4, ""]' })

    expect(loadPinnedIds('pins', storage)).toEqual(['newest', 'older'])
    persistPinnedIds('pins', ['latest', 'older', 'latest'], storage)
    expect(loadPinnedIds('pins', storage)).toEqual(['latest', 'older'])
  })

  it('ignores malformed stored values', () => {
    const storage = createStorage({ badJson: '{', notAnArray: '{"id":"thread"}' })

    expect(loadPinnedIds('badJson', storage)).toEqual([])
    expect(loadPinnedIds('notAnArray', storage)).toEqual([])
    expect(normalizePinnedIds([' one ', 'one', null, 'two'])).toEqual(['one', 'two'])
  })

  it('removes pins that no longer belong to loaded projects or conversations', () => {
    expect(prunePinnedIds(['thread-2', 'thread-1', 'thread-2'], new Set(['thread-1']))).toEqual(['thread-1'])
  })
})
