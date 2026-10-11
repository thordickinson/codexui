type Notification = { method: string; params: unknown }
type BrowserNotification = Notification & { atIso: string }

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

// Both browser transports use this projection. Tool payloads stay on the
// server; an expanded panel can fetch its own bounded item page after a hint.
export function createConversationNotifications(emit: (value: BrowserNotification) => void) {
  const visibleAgentItems = new Map<string, { turnId: string; params: Record<string, unknown>; text: string }>()
  const pendingWork = new Map<string, { threadId: string; turnId: string }>()
  let timer: ReturnType<typeof setTimeout> | null = null
  const send = (notification: Notification) => emit({ ...notification, atIso: new Date().toISOString() })

  function hint(params: Record<string, unknown>) {
    const threadId = typeof params.threadId === 'string' ? params.threadId : ''
    const turnId = typeof params.turnId === 'string' ? params.turnId : ''
    if (!threadId || !turnId) return
    pendingWork.set(JSON.stringify([threadId, turnId]), { threadId, turnId })
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      for (const value of pendingWork.values()) send({ method: 'turn/work/updated', params: value })
      pendingWork.clear()
    }, 500)
  }

  return {
    accept(notification: Notification) {
      const { method } = notification
      const params = record(notification.params)
      // Legacy copies of v2 events can contain the same full tool output.
      if (method.startsWith('codex/event/')) return
      if (method === 'item/started' || method === 'item/completed') {
        const item = record(params.item)
        const key = JSON.stringify([params.threadId, item.id])
        hint(params)
        if (item.type === 'agentMessage' && item.phase !== 'commentary') {
          if (method === 'item/started') visibleAgentItems.set(key, {
            turnId: String(params.turnId ?? ''), params, text: typeof item.text === 'string' ? item.text : '',
          })
          else visibleAgentItems.delete(key)
          send(notification)
        }
        return
      }
      if (method === 'item/agentMessage/delta') {
        const key = JSON.stringify([params.threadId, params.itemId])
        const active = visibleAgentItems.get(key)
        if (active && typeof params.delta === 'string') {
          const startOffset = active.text.length
          active.text += params.delta
          send({ method, params: { ...params, startOffset } })
        } else hint(params)
        return
      }
      if (method.startsWith('item/') || method === 'turn/plan/updated' || method === 'turn/diff/updated') {
        hint(params)
        return
      }
      if (method === 'turn/started' || method === 'turn/completed') {
        const turn = record(params.turn)
        hint({ ...params, turnId: turn.id })
        if (method === 'turn/completed') {
          for (const [key, active] of visibleAgentItems) if (active.turnId === turn.id) visibleAgentItems.delete(key)
        }
        send({ method, params: { ...params, turn: { ...turn, items: [] } } })
        return
      }
      if (method === 'thread/started') {
        send({ method, params: { ...params, thread: { ...record(params.thread), turns: [] } } })
        return
      }
      // Approval/input requests and account/status notifications remain intact.
      send(notification)
    },
    replay(listener: (value: BrowserNotification) => void) {
      for (const active of visibleAgentItems.values()) {
        listener({ method: 'item/started', atIso: new Date().toISOString(), params: {
          ...active.params, item: { ...record(active.params.item), text: active.text },
        } })
      }
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      pendingWork.clear()
      visibleAgentItems.clear()
    },
  }
}
