import type { ThreadHistoryPage } from '../api/codexGateway'
import type { UiMessage } from '../types/codex'

export function orderedTurnIds(lookup: Record<string, number>): string[] {
  return Object.keys(lookup).sort((a, b) => lookup[a]! - lookup[b]!)
}

// Indices describe the loaded, contiguous window. Forking uses the distance
// from its latest turn, which is unchanged when older turns are prepended.
export function mergeThreadHistory(
  messages: UiMessage[],
  turnIds: string[],
  page: ThreadHistoryPage,
  older: boolean,
): { messages: UiMessage[]; turnIndexByTurnId: Record<string, number> } {
  const pageIds = orderedTurnIds(page.turnIndexByTurnId)
  const pageIdSet = new Set(pageIds)
  const firstOverlap = turnIds.findIndex((id) => pageIdSet.has(id))
  // A recent page owns the order from the overlap onward, including turns
  // we missed while disconnected. It also removes any rolled-back tail.
  const ids = [...new Set(older
    ? [...pageIds.filter((id) => !turnIds.includes(id)), ...turnIds]
    : [...(firstOverlap >= 0 ? turnIds.slice(0, firstOverlap) : []), ...pageIds])]
  const lookup = Object.fromEntries(ids.map((id, index) => [id, index]))
  const replacedTurns = new Set(pageIds)
  const currentById = new Map(messages.map((message) => [message.id, message]))
  const incomingIds = new Set(page.messages.map((message) => message.id))
  const firstMessageOverlap = messages.findIndex((message) => incomingIds.has(message.id))
  const combined = older
    ? [...page.messages.filter((message) => !currentById.has(message.id)), ...messages]
    : [...messages.filter((message, index) => !message.turnId || (lookup[message.turnId] !== undefined
      && (!replacedTurns.has(message.turnId)
        || (message.turnId === page.partialTurnId && firstMessageOverlap >= 0 && index < firstMessageOverlap)))), ...page.messages]
  const seen = new Set<string>()
  const merged = combined.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  }).map((message) => {
    const turnIndex = message.turnId ? lookup[message.turnId] : message.turnIndex
    return turnIndex === message.turnIndex ? message : { ...message, turnIndex }
  }).sort((a, b) => (a.turnIndex ?? Infinity) - (b.turnIndex ?? Infinity))
  return { messages: merged, turnIndexByTurnId: lookup }
}
