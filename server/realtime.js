const subscribers = new Map()

export function subscribe(studentId, response) {
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
  for (const response of subscribers.get(studentId) || []) {
    if (response.destroyed || response.writableEnded) continue
    if (!response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)) response.end()
  }
}

export function closeStreams() {
  for (const connections of subscribers.values()) for (const response of connections) response.end()
}
