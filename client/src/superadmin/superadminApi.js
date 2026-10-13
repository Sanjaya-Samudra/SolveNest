async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api/superadmin${path}`, { credentials: 'include', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...options, body: options.body ? JSON.stringify(options.body) : undefined })
  } catch {
    throw new Error('The SolveNest API is offline. Start the project with npm run dev.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 404 && payload.error === 'NOT_FOUND' ? 'Restart the SolveNest server to load the Super Admin API.' : payload.message || 'The request could not be completed.')
    error.status = response.status
    error.code = payload.code || payload.error
    throw error
  }
  return payload
}

export const getSuperOverview = () => request('/overview')
export const getSuperStaff = () => request('/me')
export const loginSuperadmin = (email, password) => request('/login', { method: 'POST', body: { email, password } })
export const logoutSuperadmin = () => request('/logout', { method: 'POST' })
export const getTeam = ({ page = 1, search = '' } = {}) => request(`/team?page=${page}&search=${encodeURIComponent(search)}`)
export const lookupTeamEmail = (email) => request(`/team/lookup?email=${encodeURIComponent(email)}`)
export const getActivity = () => request('/activity')
export const changeRole = (id, expectedRole, role, note) => request(`/team/${encodeURIComponent(id)}/role`, { method: 'POST', body: { expectedRole, role, note } })
