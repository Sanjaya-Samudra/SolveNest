import crypto from 'node:crypto'
import { hasSupabase, supabasePruneRealtimeEvents, supabasePublishRealtimeEvent, supabaseReadRealtimeEvents } from './supabase.js'

const subscribers = new Map()
const origin = crypto.randomUUID()
const startedAt = new Date().toISOString()
let lastEventId = 0
let polling = false
let pollTimer = null
let pruneTimer = null

function deliver(studentId, event) {
  const eventName = /^[A-Za-z][\w-]{0,63}$/.test(String(event?.type || '')) ? event.type : 'Update'
  for (const response of subscribers.get(studentId) || []) {
    if (response.destroyed || response.writableEnded) continue
    if (!response.write(`event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`)) response.end()
  }
}

async function pollSharedEvents() {
  if (polling || !hasSupabase()) return
  polling = true
  try {
    const rows = await supabaseReadRealtimeEvents(lastEventId, startedAt)
    for (const row of rows) {
      lastEventId = Math.max(lastEventId, Number(row.id) || 0)
      if (row.origin !== origin) deliver(row.audience, row.event)
    }
  } catch (error) { console.error('[realtime] shared event poll failed', error.message) }
  finally { polling = false }
}

function ensureSharedPolling() {
  if (!hasSupabase() || pollTimer) return
  pollTimer = setInterval(pollSharedEvents, 1_500)
  pollTimer.unref()
  pollSharedEvents()
}

export function subscribe(studentId, response) {
  ensureSharedPolling()
  const set = subscribers.get(studentId) || new Set()
  // Bound per-account connections and force periodic authentication on reconnect.
  if (set.size >= 8) set.values().next().value.end()
  set.add(response)
  subscribers.set(studentId, set)
  const heartbeat = setInterval(() => {
    if (response.destroyed || response.writableEnded) return
    if (!response.write(': heartbeat\n\n')) response.end()
  }, 20_000)
  const lifetime = setTimeout(() => response.end(), 5 * 60_000)
  heartbeat.unref(); lifetime.unref()
  const close = () => { clearInterval(heartbeat); clearTimeout(lifetime); set.delete(response); if (!set.size) subscribers.delete(studentId) }
  response.once('close', close)
  return close
}

export function publish(studentId, event) {
  deliver(studentId, event)
  if (hasSupabase()) supabasePublishRealtimeEvent(studentId, event, origin).catch((error) => console.error('[realtime] shared event publish failed', error.message))
}

export function closeStreams() {
  if (pollTimer) clearInterval(pollTimer)
  if (pruneTimer) clearInterval(pruneTimer)
  pollTimer = null
  pruneTimer = null
  for (const connections of subscribers.values()) for (const response of connections) response.end()
}

async function pruneSharedEvents() {
  try { await supabasePruneRealtimeEvents(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) }
  catch (error) { console.error('[realtime] event cleanup failed', error.message) }
}
if (hasSupabase()) {
  pruneSharedEvents()
  pruneTimer = setInterval(pruneSharedEvents, 60 * 60_000)
  pruneTimer.unref()
}
