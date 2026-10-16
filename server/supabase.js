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
export async function supabaseDeleteUserAppSessions(userId) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { error } = await adminClient.from('app_sessions').delete().eq('user_id', userId)
  if (error) throw error
}
export async function supabaseRevokeUserSessions(userId) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  await supabaseDeleteUserAppSessions(userId)
  const { error } = await adminClient.auth.admin.signOut(userId, 'global')
  if (error) throw error
}
export async function supabaseSignOutCurrent(accessToken, refreshToken) {
  if (!url || !anonKey || !accessToken || !refreshToken) throw new Error('SUPABASE_SESSION_REQUIRED')
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (sessionError) throw sessionError
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw error
}
export async function supabaseVerifyStaffMfa(session, { code = '', factorId = '' } = {}) {
  if (!url || !anonKey || !session?.access_token || !session?.refresh_token) throw new Error('SUPABASE_SESSION_REQUIRED')
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: sessionError } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  if (sessionError) throw sessionError
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors()
  if (factorError) throw factorError
  const verified = factors?.totp?.filter((factor) => factor.status === 'verified') || []
  if (!code) {
    if (verified.length) return { required: true, enrolled: true }
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SolveNest staff access' })
    if (error) throw error
    return { required: true, enrolled: false, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
  }
  const factor = verified.find((item) => item.id === factorId) || verified[0] || factors?.totp?.find((item) => item.id === factorId)
  if (!factor) return { required: true, enrolled: false }
  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: String(code).replace(/\s/g, '') })
  if (error) return { required: true, enrolled: factor.status === 'verified', invalid: true }
  const level = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  return { required: level.data?.currentLevel !== 'aal2', verified: level.data?.currentLevel === 'aal2', session: data }
}
export async function supabaseConsumeRateLimit(key, max) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')
  const { data, error } = await adminClient.rpc('consume_rate_limit', { p_key_hash: keyHash, p_max: max })
  if (error) throw error
  return data === true
}
export async function supabaseClaimScheduledJob(jobKey, leaseSeconds) {
  if (!adminClient) return true
  const { data, error } = await adminClient.rpc('claim_scheduled_job', { p_job_key: String(jobKey), p_lease_seconds: Math.max(10, Math.trunc(leaseSeconds)) })
  if (error) throw error
  return data === true
}
export async function supabaseQueueEmail(message) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('notification_outbox').insert({ to_email: message.to, subject: message.subject, body_text: message.text, reply_to: message.replyTo || null }).select('id').single()
  if (error) throw error
  return data.id
}
export async function supabaseClaimEmailOutbox(limit = 10) {
  if (!adminClient) return []
  const { data, error } = await adminClient.rpc('claim_notification_outbox', { p_limit: Math.min(50, Math.max(1, Math.trunc(limit))) })
  if (error) throw error
  return data || []
}
export async function supabaseCompleteEmailOutbox(id, delivered, errorMessage = null) {
  if (!adminClient) return
  const { error } = await adminClient.rpc('complete_notification_outbox', { p_id: id, p_delivered: Boolean(delivered), p_error: errorMessage ? String(errorMessage).slice(0, 1000) : null })
  if (error) throw error
}
export async function supabaseReadExpertWorkspace(expertId) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('expert_workspaces').select('workspace, revision').eq('expert_id', expertId).maybeSingle()
  if (error) throw error
  if (!data) return null
  Object.defineProperty(data.workspace, '__revision', { value: Number(data.revision), configurable: true })
  return data.workspace
}
export async function supabaseWriteExpertWorkspace(expertId, workspace) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const revision = workspace.__revision ?? null
  const updated_at = new Date().toISOString()
  if (revision === null) {
    const { error } = await adminClient.from('expert_workspaces').insert({ expert_id: expertId, workspace, revision: 1, updated_at })
    if (error) throw error.code === '23505' ? new Error('EXPERT_WORKSPACE_CONFLICT') : error
    Object.defineProperty(workspace, '__revision', { value: 1, configurable: true })
    return workspace
  }
  if (!Number.isSafeInteger(revision)) throw new Error('EXPERT_WORKSPACE_REVISION_REQUIRED')
  const { data, error } = await adminClient.from('expert_workspaces').update({ workspace, revision: revision + 1, updated_at }).eq('expert_id', expertId).eq('revision', revision).select('revision').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('EXPERT_WORKSPACE_CONFLICT')
  Object.defineProperty(workspace, '__revision', { value: Number(data.revision), configurable: true })
  return workspace
}
export async function supabaseListExpertWorkspaces() {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await adminClient.from('expert_workspaces').select('expert_id, workspace').order('expert_id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 500) break
  }
  return rows
}
export async function supabaseProfile(userId) { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('profiles').select('id, role, name, email').eq('id', userId).maybeSingle(); if (error) throw error; return data }
export async function supabaseExpertProfiles() { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('profiles').select('id, name, email, role').eq('role', 'Expert').order('name', { ascending: true }); if (error) throw error; return data || [] }
export async function supabaseTeam({ page = 1, search = '' } = {}) {
  if (!adminClient) return null
  const roles = ['Student', 'Expert', 'Admin', 'Superadmin']
  const counts = await Promise.all(roles.map(async (role) => {
    const { count, error } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role)
    if (error) throw error
    return [role, count || 0]
  }))
  const pageSize = 25
  const cleanSearch = String(search).trim().slice(0, 80).replace(/[^\p{L}\p{N} @._-]/gu, '')
  let query = adminClient.from('profiles').select('id, name, email, role, created_at, updated_at', { count: 'exact' }).in('role', ['Expert', 'Admin', 'Superadmin'])
  if (cleanSearch) {
    const role = ['Expert', 'Admin', 'Superadmin'].find((item) => item.toLowerCase() === cleanSearch.toLowerCase())
    query = role ? query.eq('role', role) : query.or(`name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`)
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  return { counts: Object.fromEntries(counts), people: data || [], page, pageSize, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / pageSize)) }
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
export async function supabaseRequestSuperadminRole(actorId, targetId, expectedRole, note) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.rpc('request_superadmin_role', { p_actor: actorId, p_target: targetId, p_expected_role: expectedRole, p_note: note })
  if (error) throw error
  return data
}
export async function supabasePrivilegedRoleRequests() {
  if (!adminClient) return []
  const { data, error } = await adminClient.from('privileged_role_requests').select('id, target_id, requested_by, expected_role, requested_role, note, status, created_at, expires_at, target:profiles!privileged_role_requests_target_id_fkey(name,email), requester:profiles!privileged_role_requests_requested_by_fkey(name,email)').eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data || []
}
export async function supabaseDecideSuperadminRole(actorId, requestId, decision) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.rpc('decide_superadmin_role_request', { p_actor: actorId, p_request: requestId, p_decision: decision })
  if (error) throw error
  return data
}
const domainCollections = ['tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts', 'guestTransfers', 'conversations', 'messages', 'payments', 'plans', 'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests', 'supportTickets', 'activity', 'notifications', 'adminAudit']
function emptyDomainState() { return Object.fromEntries([...domainCollections.map((name) => [name, []]), ['idempotency', {}]]) }
function recordKey(item, index) { return String(item?.id || item?.token || `${index}`) }
function flattenDomainState(state) {
  const records = new Map()
  for (const collection of domainCollections) {
    const items = Array.isArray(state[collection]) ? state[collection] : []
    items.forEach((payload, position) => records.set(`${collection}\0${recordKey(payload, position)}`, { collection, key: recordKey(payload, position), payload: structuredClone(payload), position }))
  }
  for (const [key, payload] of Object.entries(state.idempotency || {})) records.set(`idempotency\0${key}`, { collection: 'idempotency', key, payload: structuredClone(payload), position: 0 })
  return records
}
export async function supabaseReadState() {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: before, error: beforeError } = await adminClient.from('domain_state_meta').select('revision').eq('id', 'default').single()
    if (beforeError) throw beforeError
    const records = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await adminClient.from('domain_records').select('collection, record_key, payload, position').order('collection').order('position').order('record_key').range(offset, offset + 999)
      if (error) throw error
      records.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    const { data: after, error: afterError } = await adminClient.from('domain_state_meta').select('revision').eq('id', 'default').single()
    if (afterError) throw afterError
    // A writer can move records between pages; retry instead of returning a torn snapshot.
    if (String(before.revision) !== String(after.revision)) continue
    const state = emptyDomainState()
    for (const row of records) {
      if (row.collection === 'idempotency') state.idempotency[row.record_key] = row.payload
      else if (Array.isArray(state[row.collection])) state[row.collection].push(row.payload)
    }
    Object.defineProperty(state, '__revision', { value: Number(after.revision), configurable: true })
    Object.defineProperty(state, '__baseline', { value: flattenDomainState(state), configurable: true })
    return state
  }
  throw new Error('APP_STATE_CONFLICT')
}

export async function supabaseReadDomainCollection(collection, filters = {}) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  if (!domainCollections.includes(collection)) throw new Error('DOMAIN_COLLECTION_INVALID')
  let query = adminClient.from('domain_records').select('payload, position').eq('collection', collection)
  if (filters.recordKey) query = query.eq('record_key', String(filters.recordKey))
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'recordKey' || value === undefined || value === null || value === '') continue
    if (!['studentId', 'taskId', 'conversationId', 'status', 'planId', 'paymentIntentId'].includes(key)) throw new Error('DOMAIN_FILTER_INVALID')
    query = query.eq(`payload->>${key}`, String(value))
  }
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.order('position').order('record_key').range(offset, offset + 499)
    if (error) throw error
    rows.push(...(data || []).map((row) => row.payload))
    if (!data || data.length < 500) break
  }
  return rows
}
export async function supabaseWriteState(state) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const revision = state.__revision
  if (!Number.isSafeInteger(revision)) throw new Error('APP_STATE_REVISION_REQUIRED')
  const baseline = state.__baseline
  if (!(baseline instanceof Map)) throw new Error('APP_STATE_BASELINE_REQUIRED')
  const current = flattenDomainState(state)
  const changes = []
  for (const [identity, record] of current) {
    const previous = baseline.get(identity)
    if (!previous || JSON.stringify(previous.payload) !== JSON.stringify(record.payload)) changes.push({ ...record, position: previous?.position ?? -Date.parse(record.payload?.createdAt || record.payload?.updatedAt || new Date().toISOString()), expectedExists: Boolean(previous), expectedPayload: previous?.payload ?? null })
  }
  for (const [identity, previous] of baseline) if (!current.has(identity)) changes.push({ collection: previous.collection, key: previous.key, payload: null, position: previous.position, expectedExists: true, expectedPayload: previous.payload })
  if (!changes.length) return state
  const { data, error } = await adminClient.rpc('apply_domain_changes_v2', { p_changes: changes })
  if (error) {
    if (String(error.message).includes('APP_STATE_CONFLICT') || error.code === '40001') throw new Error('APP_STATE_CONFLICT')
    throw error
  }
  Object.defineProperty(state, '__revision', { value: Number(data), configurable: true })
  Object.defineProperty(state, '__baseline', { value: current, configurable: true })
  return state
}
export async function supabaseReadStudentAccount(studentId) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await adminClient.from('student_accounts').select('account, revision').eq('student_id', studentId).maybeSingle()
  if (error) throw error
  if (!data) return null
  Object.defineProperty(data.account, '__revision', { value: Number(data.revision), configurable: true })
  return data.account
}
export async function supabaseWriteStudentAccount(studentId, account) {
  if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED')
  const revision = account.__revision ?? null
  const updated_at = new Date().toISOString()
  if (revision === null) {
    const { error } = await adminClient.from('student_accounts').insert({ student_id: studentId, account, revision: 1, updated_at })
    if (error) throw error.code === '23505' ? new Error('STUDENT_ACCOUNT_CONFLICT') : error
    Object.defineProperty(account, '__revision', { value: 1, configurable: true })
    return account
  }
  if (!Number.isSafeInteger(revision)) throw new Error('STUDENT_ACCOUNT_REVISION_REQUIRED')
  const { data, error } = await adminClient.from('student_accounts').update({ account, revision: revision + 1, updated_at }).eq('student_id', studentId).eq('revision', revision).select('revision').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('STUDENT_ACCOUNT_CONFLICT')
  Object.defineProperty(account, '__revision', { value: Number(data.revision), configurable: true })
  return account
}
export async function supabaseSignUp({ email, password, name }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signUp({ email, password, options: { data: { name, role: 'Student' } } }) }
export async function supabaseSignIn({ email, password }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithPassword({ email, password }) }
export async function supabaseRequestPasswordReset(email) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.resetPasswordForEmail(email, process.env.PUBLIC_APP_URL ? { redirectTo: `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/reset-password` } : undefined) }
export async function supabaseUpdatePassword(accessToken, refreshToken, password) { if (!url || !anonKey) throw new Error('SUPABASE_NOT_CONFIGURED'); const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }); if (sessionError) return { error: sessionError }; return client.auth.updateUser({ password }) }
export async function supabaseUser(accessToken) { if (!authClient || !accessToken) return null; const { data, error } = await authClient.auth.getUser(accessToken); if (error) return null; return data.user }
export async function supabaseRefresh(refreshToken) { if (!authClient || !refreshToken) return null; const { data } = await createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.refreshSession({ refresh_token: refreshToken }); return data.session || null }
export async function supabaseUpload(file, key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).upload(key, fs.readFileSync(file.path), { contentType: file.mimetype, upsert: false }); if (error) throw error; try { fs.unlinkSync(file.path) } catch {} return true }
export async function supabaseRemove(key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).remove([key]); if (error) throw error; return true }
export async function supabaseSignedUrl(key, expiresIn = 600) { if (!adminClient) return null; const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(key, expiresIn); if (error) throw error; return data.signedUrl }
export async function supabaseListObjects(prefix = '') {
  if (!adminClient) return []
  const objects = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    for (const item of data || []) if (item.id) objects.push({ key: prefix ? `${prefix}/${item.name}` : item.name, lastModified: item.updated_at || item.created_at || null })
    if (!data || data.length < 1000) break
  }
  return objects
}
export async function supabasePublishRealtimeEvent(audience, event, origin) {
  if (!adminClient) return null
  const { data, error } = await adminClient.from('realtime_events').insert({ audience, event, origin }).select('id').single()
  if (error) throw error
  return Number(data.id)
}
export async function supabaseReadRealtimeEvents(afterId, since) {
  if (!adminClient) return []
  const { data, error } = await adminClient.from('realtime_events').select('id, audience, event, origin').gt('id', afterId).gte('created_at', since).order('id').limit(250)
  if (error) throw error
  return data || []
}
export async function supabasePruneRealtimeEvents(before) {
  if (!adminClient) return
  const { error } = await adminClient.from('realtime_events').delete().lt('created_at', before)
  if (error) throw error
}
