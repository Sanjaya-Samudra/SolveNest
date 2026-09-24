const listeners = new Set()

let state = {
  account: null,
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
    account: state.account,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    identity: state.account?.identity || null,
    profile: state.account?.profile || null,
    security: state.account?.security || null,
    preferences: state.account?.preferences || null,
    privacyControls: state.account?.privacyControls || null,
    policyConsents: state.account?.policyConsents || [],
    activeSessions: state.account?.activeSessions || [],
    capabilities: state.account?.capabilities || null,
  }
}

export function subscribeAccount(fn) {
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

function applyAccount(payload) {
  const account = payload?.account || payload || null
  state = {
    account,
    loading: false,
    error: null,
    loaded: true,
  }
  emit()
  return getSnapshot()
}

export async function loadAccount({ force = false, signal } = {}) {
  if (state.loaded && state.account && !force) {
    emit()
    return getSnapshot()
  }
  state = { ...state, loading: true, error: null }
  emit()
  try {
    const response = await apiFetch('/api/student/account', { signal })
    if (!response.ok) throw new Error(`ACCOUNT_${response.status}`)
    return applyAccount(await response.json())
  } catch (error) {
    if (error.name === 'AbortError') return getSnapshot()
    state = { ...state, loading: false, error, loaded: true }
    emit()
    throw error
  }
}

export async function saveAccountProfile(patch) {
  const response = await apiFetch('/api/student/account', {
    method: 'PATCH',
    body: { section: 'profile', profile: patch },
  })
  if (!response.ok) throw new Error(`ACCOUNT_PROFILE_${response.status}`)
  return applyAccount(await response.json())
}

export async function saveAccountPreferences(patch) {
  const response = await apiFetch('/api/student/account', {
    method: 'PATCH',
    body: { section: 'preferences', preferences: patch },
  })
  if (!response.ok) throw new Error(`ACCOUNT_PREFERENCES_${response.status}`)
  return applyAccount(await response.json())
}

export async function signOutSession(sessionId) {
  const id = sessionId ? `/${encodeURIComponent(sessionId)}` : '/current'
  const response = await apiFetch(`/api/student/account/sessions${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`ACCOUNT_SESSION_${response.status}`)
  return response.json().catch(() => ({ ok: true }))
}

export async function signOut() {
  const response = await apiFetch('/api/student/account/logout', { method: 'POST' })
  if (!response.ok && response.status !== 401) throw new Error(`ACCOUNT_LOGOUT_${response.status}`)
  state = { account: null, loading: false, error: null, loaded: false }
  emit()
  return getSnapshot()
}
