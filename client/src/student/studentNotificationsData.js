const listeners = new Set()

let state = {
  items: [],
  loading: false,
  error: null,
  loaded: false,
}

function emit() {
  const snapshot = getSnapshot()
  listeners.forEach((fn) => fn(snapshot))
}

export function getSnapshot() {
  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    unreadCount: state.items.filter((n) => !n.isRead).length,
  }
}

export function subscribeNotifications(fn) {
  listeners.add(fn)
  fn(getSnapshot())
  return () => listeners.delete(fn)
}

function authError(status) {
  const error = new Error('STUDENT_ACCESS_REQUIRED')
  error.code = status
  return error
}

async function apiFetch(url, { signal, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (response.status === 401 || response.status === 403) throw authError(response.status)
  return response
}

function normalizeList(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.notifications || payload?.data || []
  return rows.map((n) => ({
    ...n,
    task: n.task || { title: n.taskTitle || 'Task', subject: null, ref: n.taskRef || n.reference || '' },
    body: n.body || n.description || '',
    route: n.route || n.primaryAction?.route || null,
    isRead: Boolean(n.isRead),
    requiresAction: Boolean(n.requiresAction),
  }))
}

export async function loadNotifications({ force = false, signal } = {}) {
  if (state.loaded && !force) {
    emit()
    return getSnapshot()
  }
  state = { ...state, loading: true, error: null }
  emit()
  try {
    const response = await apiFetch('/api/student/notifications', { signal })
    if (!response.ok) throw new Error(`NOTIFICATIONS_${response.status}`)
    const payload = await response.json()
    state = {
      items: normalizeList(payload),
      loading: false,
      error: null,
      loaded: true,
    }
    emit()
    return getSnapshot()
  } catch (error) {
    if (error.name === 'AbortError') return getSnapshot()
    state = { ...state, loading: false, error, loaded: true }
    emit()
    throw error
  }
}

export async function markNotificationRead(id) {
  const response = await apiFetch(`/api/student/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })
  if (!response.ok) throw new Error(`NOTIFICATION_READ_${response.status}`)
  const payload = await response.json().catch(() => ({}))
  state = {
    ...state,
    items: state.items.map((n) => (String(n.id) === String(id) ? { ...n, isRead: true } : n)),
  }
  if (Array.isArray(payload.notifications)) {
    state = { ...state, items: normalizeList(payload.notifications) }
  }
  emit()
  return getSnapshot()
}

export async function markAllNotificationsRead() {
  const response = await apiFetch('/api/student/notifications/read-all', { method: 'POST' })
  if (!response.ok) throw new Error(`NOTIFICATIONS_READ_ALL_${response.status}`)
  const payload = await response.json().catch(() => ({}))
  if (Array.isArray(payload.notifications)) {
    state = { ...state, items: normalizeList(payload.notifications) }
  } else {
    state = { ...state, items: state.items.map((n) => ({ ...n, isRead: true })) }
  }
  emit()
  return getSnapshot()
}

export function resolveNotificationTone(n) {
  if (n.requiresAction) return 'action'
  if (['Payment confirmed', 'Task completed'].includes(n.title)) return 'success'
  if (!n.isRead) return 'active'
  return 'neutral'
}
