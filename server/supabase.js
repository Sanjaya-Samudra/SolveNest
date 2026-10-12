import 'dotenv/config'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'student-files'
const authClient = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null
const adminClient = url && serviceRoleKey ? createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null

export function hasSupabase() { return Boolean(authClient && adminClient) }
export function hasSupabaseAuth() { return Boolean(authClient) }
export function hasSupabaseStorage() { return Boolean(adminClient) }
function appSessionId(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}
export async function supabaseCreateAppSession(token, userId, role, device) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await adminClient.from('app_sessions').insert({ id: appSessionId(token), user_id: userId, role, device, expires_at })
  if (error) throw error
}
export async function supabaseGetAppSession(token) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('app_sessions').select('user_id, role, device, created_at, last_active_at, expires_at').eq('id', appSessionId(token)).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw error
  return data
}
export async function supabaseDeleteAppSession(token) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { error } = await adminClient.from('app_sessions').delete().eq('id', appSessionId(token))
  if (error) throw error
}
export async function supabaseProfile(userId) { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('profiles').select('id, role, name, email').eq('id', userId).maybeSingle(); if (error) throw error; return data }
export async function supabaseExpertProfiles() { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('profiles').select('id, name, email, role').eq('role', 'Expert').order('name', { ascending: true }); if (error) throw error; return data || [] }
export async function supabaseTeam() {
  if (!adminClient) return null
  const roles = ['Student', 'Expert', 'Admin', 'Superadmin']
  const counts = await Promise.all(roles.map(async (role) => {
    const { count, error } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role)
    if (error) throw error
    return [role, count || 0]
  }))
  const { data, error } = await adminClient.from('profiles').select('id, name, email, role, created_at, updated_at').in('role', ['Expert', 'Admin', 'Superadmin']).order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return { counts: Object.fromEntries(counts), people: data || [], capped: (counts.find(([role]) => role === 'Expert')?.[1] || 0) + (counts.find(([role]) => role === 'Admin')?.[1] || 0) + (counts.find(([role]) => role === 'Superadmin')?.[1] || 0) > (data || []).length }
}
export async function supabaseFindProfileByEmail(email) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('profiles').select('id, name, email, role, created_at, updated_at').eq('email', email).maybeSingle()
  if (error) throw error
  return data
}
export async function supabaseRoleEvents() {
  if (!adminClient) return []
  const { data, error } = await adminClient.from('staff_role_events').select('id, actor_email, target_email, previous_role, new_role, note, created_at').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data || []
}
export async function supabaseChangeStaffRole(actorId, targetId, expectedRole, newRole, note) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.rpc('change_staff_role', { p_actor: actorId, p_target: targetId, p_expected_role: expectedRole, p_new_role: newRole, p_note: note })
  if (error) throw error
  return data
}
export async function supabaseReadState() {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('app_state').select('state, revision').eq('id', 'default').maybeSingle()
  if (error) throw error
  const state = data?.state || { tasks: [], files: [], deliveryFiles: [], analyses: [], reviews: [], drafts: [], guestTransfers: [], conversations: [], messages: [], payments: [], plans: [], scopeChanges: [], explainSessions: [], explainArtifacts: [], explainRequests: [], supportTickets: [], idempotency: {}, activity: [], notifications: [] }
  Object.defineProperty(state, '__revision', { value: data ? Number(data.revision) : null, configurable: true })
  return state
}
export async function supabaseWriteState(state) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const revision = state.__revision
  const updated_at = new Date().toISOString()
  if (revision === null) {
    const { error } = await adminClient.from('app_state').insert({ id: 'default', state, revision: 1, updated_at })
    if (error) throw error.code === '23505' ? new Error('APP_STATE_CONFLICT') : error
    return state
  }
  if (!Number.isSafeInteger(revision)) throw new Error('APP_STATE_REVISION_REQUIRED')
  const { data, error } = await adminClient.from('app_state').update({ state, revision: revision + 1, updated_at }).eq('id', 'default').eq('revision', revision).select('revision').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('APP_STATE_CONFLICT')
  Object.defineProperty(state, '__revision', { value: data.revision, configurable: true })
  return state
}
export async function supabaseReadStudentAccount(studentId) { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('student_accounts').select('account').eq('student_id', studentId).maybeSingle(); if (error) throw error; return data?.account || null }
export async function supabaseWriteStudentAccount(studentId, account) { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { error } = await adminClient.from('student_accounts').upsert({ student_id: studentId, account, updated_at: new Date().toISOString() }); if (error) throw error; return account }
export async function supabaseSignUp({ email, password, name }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.signUp({ email, password, options: { data: { name, role: 'Student' } } }) }
export async function supabaseSignIn({ email, password }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.signInWithPassword({ email, password }) }
export async function supabaseRequestPasswordReset(email) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.resetPasswordForEmail(email, process.env.PUBLIC_APP_URL ? { redirectTo: `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/reset-password` } : undefined) }
export async function supabaseUpdatePassword(accessToken, refreshToken, password) { if (!url || !anonKey) throw new Error('SUPABASE_NOT_CONFIGURED'); const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }); if (sessionError) return { error: sessionError }; return client.auth.updateUser({ password }) }
export async function supabaseUser(accessToken) { if (!authClient || !accessToken) return null; const { data, error } = await authClient.auth.getUser(accessToken); if (error) return null; return data.user }
export async function supabaseRefresh(refreshToken) { if (!authClient || !refreshToken) return null; const { data } = await authClient.auth.refreshSession({ refresh_token: refreshToken }); return data.session || null }
export async function supabaseUpload(file, key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).upload(key, fs.readFileSync(file.path), { contentType: file.mimetype, upsert: false }); if (error) throw error; try { fs.unlinkSync(file.path) } catch {} return true }
export async function supabaseRemove(key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).remove([key]); if (error) throw error; return true }
export async function supabaseSignedUrl(key, expiresIn = 600) { if (!adminClient) return null; const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(key, expiresIn); if (error) throw error; return data.signedUrl }
