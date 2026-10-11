<template>
  <section class="turn-work">
    <div class="turn-work-heading">
      <span v-if="statusText" role="status">{{ statusText }}</span>
      <button type="button" :aria-expanded="state.expanded" @click="toggle">
        {{ state.expanded ? 'Hide work' : 'View work' }}
      </button>
    </div>
    <div v-if="state.expanded" class="turn-work-panel">
      <p v-if="state.loading" role="status">Loading work…</p>
      <p v-if="state.error" role="alert">
        {{ state.error }} <button type="button" :disabled="state.loading" @click="retry">Retry</button>
      </p>
      <button v-if="state.nextCursor" type="button" :disabled="state.loading" @click="loadOlder">Load earlier steps</button>
      <p v-if="state.loaded && !state.loading && workItems.length === 0">No tool activity in this part of the response.</p>
      <ol class="turn-work-items">
        <li v-for="item in workItems" :key="item.id">
          <details>
            <summary>{{ itemTitle(item) }}</summary>
            <pre>{{ itemBody(item) }}</pre>
          </details>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ThreadItem } from '../../api/appServerDtos'
import { useTurnWorkDetails } from '../../composables/useTurnWorkDetails'

const props = defineProps<{ threadId: string; turnId: string; statusText: string }>()
const { state, toggle, retry, loadOlder } = useTurnWorkDetails(() => props.threadId, () => props.turnId)
const workItems = computed(() => state.value.items.filter((item) => item.type !== 'userMessage'
  && !(item.type === 'agentMessage' && item.phase !== 'commentary')))

function itemTitle(item: ThreadItem): string {
  if (item.type === 'commandExecution') return item.command || 'Command'
  const labels: Record<string, string> = {
    fileChange: 'File changes', mcpToolCall: 'Tool call', dynamicToolCall: 'Tool call',
    webSearch: 'Web search', reasoning: 'Reasoning', agentMessage: 'Progress update', plan: 'Plan',
  }
  return labels[item.type] ?? item.type.replace(/([a-z])([A-Z])/gu, '$1 $2')
}

function itemBody(item: ThreadItem): string {
  if (item.type === 'commandExecution') {
    return `${item.aggregatedOutput || '(No output)'}\n\nStatus: ${item.status}${item.exitCode === null ? '' : ` · Exit code: ${item.exitCode}`}`
  }
  if (item.type === 'agentMessage' || item.type === 'plan') return item.text
  if (item.type === 'fileChange') return item.changes.map((change) => `${change.path}\n${change.diff}`).join('\n\n')
  return JSON.stringify(item, null, 2)
}
</script>

<style scoped>
@reference "tailwindcss";
.turn-work { @apply w-full min-w-0 max-w-180 mx-auto text-sm text-slate-500; }
.turn-work-heading { @apply flex items-center gap-3 py-1; }
button { @apply cursor-pointer rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-50; }
.turn-work-panel { @apply mt-2 rounded-lg border border-slate-200 p-3; }
.turn-work-items { @apply list-none m-0 p-0 space-y-2; }
summary { @apply cursor-pointer break-words font-mono text-xs py-2; overflow-wrap: anywhere; }
pre { @apply max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs; overflow-wrap: anywhere; }
</style>
