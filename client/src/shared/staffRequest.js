export async function staffRequest(base, path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload) {
      const error = new Error(response.status === 401 ? 'Your session has expired. Sign in again.' : response.status === 403 ? 'Your account does not have access to this workspace.' : payload?.message || 'This service is temporarily unavailable. Please try again.')
      error.status = response.status
      error.code = payload?.code || payload?.error || 'INVALID_RESPONSE'
      error.requestId = response.headers.get('X-Request-Id')
      throw error
    }
    return payload
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request took too long. Check the current status before trying again.')
    if (error instanceof TypeError) throw new Error('Could not connect to SolveNest. Check your connection and try again.')
    throw error
  } finally { clearTimeout(timeout) }
}
