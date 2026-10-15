async function request(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || 'The request could not be completed.')
    error.fieldErrors = payload.fieldErrors || {}
    throw error
  }
  return payload
}

export async function registerStudent(payload) { const result = await request('/api/auth/register', payload); if (!result.emailConfirmationRequired) await claimPendingAnalysis(); return result }
async function claimPendingAnalysis() {
  const transferToken = window.localStorage.getItem('solvenest-analysis-transfer')
  if (!transferToken) return null
  const response = await fetch('/api/student/analysis-transfer/claim', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ transferToken }), signal: AbortSignal.timeout(30_000) })
  if (!response.ok) return null
  window.localStorage.removeItem('solvenest-analysis-transfer')
  return response.json()
}
export async function loginStudent(payload) { const result = await request('/api/auth/login', payload); await claimPendingAnalysis(); return result }
export function requestPasswordReset(email) { return request('/api/auth/password-reset', { email }) }
export function completePasswordReset(payload) { return request('/api/auth/password-reset/complete', payload) }
