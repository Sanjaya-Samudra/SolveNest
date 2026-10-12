async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api/admin${path}`, { credentials: 'include', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...options, body: options.body ? JSON.stringify(options.body) : undefined })
  } catch {
    throw new Error('The SolveNest API is offline. Start the project with npm run dev.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const outdatedServer = response.status === 404 && payload.error === 'NOT_FOUND'
    const error = new Error(outdatedServer ? 'The Admin API is not running yet. Restart the SolveNest server to load this workspace.' : payload.message || 'The request could not be completed.')
    error.status = response.status
    error.code = payload.code || payload.error
    throw error
  }
  return payload
}

export const getStaff = () => request('/me')
export const loginStaff = (email, password) => request('/login', { method: 'POST', body: { email, password } })
export const logoutStaff = () => request('/logout', { method: 'POST' })
export const getOverview = () => request('/overview')
export const getCase = (id) => request(`/tasks/${encodeURIComponent(id)}`)
export const recordReview = (id, action, note) => request(`/tasks/${encodeURIComponent(id)}/review`, { method: 'POST', body: { action, note } })
export const getSupportQueue = () => request('/support')
export const getSupportCase = (id) => request(`/support/${encodeURIComponent(id)}`)
export const updateSupportStatus = (id, status, note, studentMessage) => request(`/support/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, note, studentMessage } })
export const getQaQueue = () => request('/qa')
export const getQaCase = (id) => request(`/qa/${encodeURIComponent(id)}`)
export const recordQaOutcome = (id, outcome, note) => request(`/qa/${encodeURIComponent(id)}/outcome`, { method: 'POST', body: { outcome, note } })
