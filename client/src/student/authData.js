async function request(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || 'The request could not be completed.')
    error.fieldErrors = payload.fieldErrors || {}
    throw error
  }
  return payload
}

export function registerStudent(payload) { return request('/api/auth/register', payload) }
export function loginStudent(payload) { return request('/api/auth/login', payload) }
