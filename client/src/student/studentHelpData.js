const listeners = new Set()

let state = {
  catalog: null,
  loading: false,
  error: null,
  loaded: false,
  tickets: [],
}

function emit() {
  listeners.forEach((fn) => fn(getSnapshot()))
}

export function getSnapshot() {
  return {
    catalog: state.catalog,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    tickets: state.tickets,
    categories: state.catalog?.categories || [],
    issues: state.catalog?.issues || {},
    quickHelp: state.catalog?.quickHelp || [],
    articles: state.catalog?.articles || [],
    policies: state.catalog?.policies || [],
    workspace: state.catalog?.workspace || [],
    tasks: state.catalog?.tasks || [],
  }
}

export function subscribeHelp(fn) {
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

export async function loadHelpCatalog({ force = false, signal } = {}) {
  if (state.loaded && state.catalog && !force) {
    emit()
    return getSnapshot()
  }
  state = { ...state, loading: true, error: null }
  emit()
  try {
    const response = await apiFetch('/api/student/help', { signal })
    if (!response.ok) throw new Error(`HELP_${response.status}`)
    const payload = await response.json()
    state = {
      ...state,
      catalog: payload,
      tickets: Array.isArray(payload.tickets) ? payload.tickets : [],
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

export async function searchHelpQuery(query, { signal } = {}) {
  const q = String(query || '').trim()
  if (!q) return []
  const response = await apiFetch(`/api/student/help/search?q=${encodeURIComponent(q)}`, { signal })
  if (!response.ok) throw new Error(`HELP_SEARCH_${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload.results) ? payload.results : []
}

export async function fetchGuidance({ category, issue, taskId }, { signal } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (issue) params.set('issue', issue)
  if (taskId) params.set('taskId', taskId)
  const response = await apiFetch(`/api/student/help/guidance?${params.toString()}`, { signal })
  if (!response.ok) throw new Error(`HELP_GUIDANCE_${response.status}`)
  return response.json()
}

export async function submitHelpTicket({ category, issue, taskId, message }) {
  const response = await apiFetch('/api/student/help/tickets', {
    method: 'POST',
    body: { category, issue, taskId, message },
  })
  if (!response.ok) throw new Error(`HELP_TICKET_${response.status}`)
  const ticket = await response.json()
  state = { ...state, tickets: [ticket, ...state.tickets] }
  if (state.catalog) state = { ...state, catalog: { ...state.catalog, tickets: state.tickets } }
  emit()
  return ticket
}

export function findTaskById(tasks, taskId) {
  if (!taskId) return null
  return (tasks || []).find((t) => String(t.id) === String(taskId)) || null
}

export function topicToCategory(topic) {
  const map = {
    payments: 'payment',
    payment: 'payment',
    plan: 'payment',
    files: 'files',
    delivery: 'files',
    deliveries: 'files',
    tasks: 'task',
    task: 'task',
    messages: 'messages',
    message: 'messages',
    explain: 'explain',
    account: 'account',
    technical: 'technical',
  }
  return map[String(topic || '').toLowerCase()] || null
}
