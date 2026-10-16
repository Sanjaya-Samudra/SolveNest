import { staffRequest } from '../shared/staffRequest.js'
const request = (path, options) => staffRequest('/api/superadmin', path, options)

export const getSuperOverview = () => request('/overview')
export const getSuperStaff = () => request('/me')
export const loginSuperadmin = (email, password, otp, factorId) => request('/login', { method: 'POST', body: { email, password, otp, factorId } })
export const logoutSuperadmin = () => request('/logout', { method: 'POST' })
export const getTeam = ({ page = 1, search = '' } = {}) => request(`/team?page=${page}&search=${encodeURIComponent(search)}`)
export const lookupTeamEmail = (email) => request(`/team/lookup?email=${encodeURIComponent(email)}`)
export const getActivity = () => request('/activity')
export const changeRole = (id, expectedRole, role, note) => request(`/team/${encodeURIComponent(id)}/role`, { method: 'POST', body: { expectedRole, role, note } })
