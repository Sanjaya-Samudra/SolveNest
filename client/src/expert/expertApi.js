export async function apiFetch(url, { signal, method = 'GET', body } = {}) {
  let response
  try {
    const timeoutSignal = AbortSignal.timeout(30_000)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: requestSignal,
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    const error = new Error('API_UNAVAILABLE')
    error.code = 'API_UNAVAILABLE'
    throw error
  }
  let payload = null
  try {
    payload = await response.json()
  } catch {}
  if (response.status >= 500 && !payload) {
    const error = new Error('API_UNAVAILABLE')
    error.code = 'API_UNAVAILABLE'
    throw error
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error('EXPERT_ACCESS_REQUIRED')
    error.code = response.status
    error.serverMessage = payload?.message || null
    throw error
  }
  if (!response.ok) {
    const error = new Error(payload?.code || `EXPERT_${response.status}`)
    error.code = payload?.code || response.status
    error.status = response.status
    error.serverMessage = payload?.message || null
    throw error
  }
  return payload
}

function assignmentQuery({ search = '', filter = '', sort = '' } = {}) {
  const query = new URLSearchParams()
  if (search) query.set('search', search)
  if (filter && filter !== 'all') query.set('filter', filter)
  if (sort) query.set('sort', sort)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return suffix
}

export function fetchExpertAccountState({ signal } = {}) {
  return apiFetch('/api/expert/me', { signal }).then((payload) => ({
    accountState: payload.accountState,
    availability: payload.availability,
    expert: payload.expert,
    user: payload.user,
  }))
}

export function loginExpert({ email, password }) {
  return apiFetch('/api/expert/auth/login', { method: 'POST', body: { email, password } })
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

export function fetchExpertAssignments({ search = '', filter = 'all', sort = 'deadline', signal } = {}) {
  const suffix = assignmentQuery({ search, filter, sort })
  return apiFetch(`/api/expert/assignments${suffix}`, { signal }).then((payload) => ({
    assignments: payload.assignments || [],
    meta: payload.meta || { total: 0, filtered: 0 },
  }))
}

export function fetchAssignmentOverview(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}`, { signal })
    .then((payload) => payload.assignment)
}

export function fetchAssignmentRequirements(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/requirements`, { signal })
    .then((payload) => payload.requirements)
}

export function fetchAssignmentWork(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/work`, { signal })
    .then((payload) => payload.work)
}

export function fetchAssignmentMessages(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/messages`, { signal })
    .then((payload) => ({ messages: payload.messages || [], unread: payload.unread || 0 }))
}

export function fetchAssignmentFiles(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/files`, { signal })
    .then((payload) => payload.sections || { source: [], shared: [], working: [], submission: [] })
}

export function fetchQaDeliveryState(assignmentId, { signal } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/qa`, { signal })
}

export function addProgressUpdate(assignmentId, body) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/work/updates`, {
    method: 'POST',
    body: { body },
  })
}

export function updateAssignmentWorkState(assignmentId, state) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/work/state`, {
    method: 'POST',
    body: { state },
  })
}

export function sendAssignmentMessage(assignmentId, body) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/messages`, {
    method: 'POST',
    body: { body },
  })
}

export function markAssignmentMessagesRead(assignmentId) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/messages/read`, { method: 'PATCH' })
}

export function uploadAssignmentFile(assignmentId, file, section = 'working', { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/expert/assignments/${encodeURIComponent(assignmentId)}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let payload = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload)
        return
      }
      const error = new Error(payload?.code || `EXPERT_${xhr.status}`)
      error.code = payload?.code || xhr.status
      error.status = xhr.status
      error.serverMessage = payload?.message || null
      reject(error)
    }
    xhr.onerror = () => {
      const error = new Error('NETWORK_ERROR')
      error.code = 'NETWORK_ERROR'
      reject(error)
    }
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.onabort = () => {
        const error = new Error('AbortError')
        error.name = 'AbortError'
        reject(error)
      }
    }
    const form = new FormData()
    form.append('file', file)
    form.append('section', section)
    xhr.send(form)
  })
}

export function removeAssignmentFile(assignmentId, fileId) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  })
}

export function submitForQa(assignmentId, { note } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/qa/submit`, {
    method: 'POST',
    body: { note },
  })
}

export function resolveQaFeedbackItem(assignmentId, feedbackId) {
  return apiFetch(
    `/api/expert/assignments/${encodeURIComponent(assignmentId)}/qa/feedback/${encodeURIComponent(feedbackId)}/resolve`,
    { method: 'POST' },
  )
}

export function resubmitForQa(assignmentId, { note } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/qa/resubmit`, {
    method: 'POST',
    body: { note },
  })
}

export function submitDeliveryPackage(assignmentId, { note } = {}) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/delivery`, {
    method: 'POST',
    body: { note },
  })
}

export function beginRevision(assignmentId) {
  return apiFetch(`/api/expert/assignments/${encodeURIComponent(assignmentId)}/revision/begin`, { method: 'POST' })
}

export function fetchExpertFileAccess(fileId) {
  return apiFetch(`/api/expert/files/${encodeURIComponent(fileId)}/access`)
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
