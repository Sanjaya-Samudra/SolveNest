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
  if (response.status === 401 || response.status === 403) {
    const error = new Error('EXPERT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`EXPERT_${response.status}`)
  return response.json()
}

export function fetchExpertAccountState({ signal } = {}) {
  return apiFetch('/api/expert/me', { signal }).then((payload) => ({
    accountState: payload.accountState,
    availability: payload.availability,
    expert: payload.expert,
    user: payload.user,
  }))
}

export function fetchExpertAvailability({ signal } = {}) {
  return apiFetch('/api/expert/availability', { signal })
}

export function updateExpertAvailability(status) {
  return apiFetch('/api/expert/availability', { method: 'PATCH', body: { status } })
}

export function fetchExpertDashboard({ signal } = {}) {
  return apiFetch('/api/expert/dashboard', { signal })
}

export function fetchExpertAssignments({ signal } = {}) {
  return apiFetch('/api/expert/assignments', { signal }).then((payload) => payload.assignments || [])
}

export function fetchAssignmentDetail(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}`, { signal })
    .then((payload) => payload.assignment)
}

export function fetchAvailableTaskPreview({ limit = 3, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) })
  return apiFetch(`/api/expert/available-tasks?${query}`, { signal }).then((payload) => payload.tasks || [])
}

export function expressInterest(taskId) {
  return apiFetch(`/api/expert/available-tasks/${encodeURIComponent(taskId)}/interest`, { method: 'POST' })
}

export function fetchExpertRecentMovement({ signal } = {}) {
  return apiFetch('/api/expert/movement', { signal }).then((payload) => payload.movement || [])
}

export function signOutExpert() {
  return apiFetch('/api/expert/logout', { method: 'POST' })
}
