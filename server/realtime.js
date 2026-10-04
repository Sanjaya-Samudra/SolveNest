const subscribers = new Map()

export function subscribe(studentId, response) {
  const set = subscribers.get(studentId) || new Set()
  set.add(response)
  subscribers.set(studentId, set)
  return () => { set.delete(response); if (!set.size) subscribers.delete(studentId) }
}

export function publish(studentId, event) {
  for (const response of subscribers.get(studentId) || []) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
}
