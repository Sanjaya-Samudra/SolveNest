import 'dotenv/config'
import fs from 'node:fs'
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
export async function supabaseReadState() { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { data, error } = await adminClient.from('app_state').select('state').eq('id', 'default').maybeSingle(); if (error) throw error; return data?.state || { tasks: [], files: [], analyses: [], reviews: [], drafts: [], guestTransfers: [], conversations: [], messages: [], payments: [], plans: [], scopeChanges: [], explainSessions: [], explainArtifacts: [], idempotency: {}, activity: [], notifications: [] } }
export async function supabaseWriteState(state) { if (!adminClient) throw new Error('SUPABASE_NOT_CONFIGURED'); const { error } = await adminClient.from('app_state').upsert({ id: 'default', state, updated_at: new Date().toISOString() }); if (error) throw error; return state }
export async function supabaseSignUp({ email, password, name }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.signUp({ email, password, options: { data: { name, role: 'Student' } } }) }
export async function supabaseSignIn({ email, password }) { if (!authClient) throw new Error('SUPABASE_NOT_CONFIGURED'); return authClient.auth.signInWithPassword({ email, password }) }
export async function supabaseUser(accessToken) { if (!authClient || !accessToken) return null; const { data, error } = await authClient.auth.getUser(accessToken); if (error) return null; return data.user }
export async function supabaseRefresh(refreshToken) { if (!authClient || !refreshToken) return null; const { data } = await authClient.auth.refreshSession({ refresh_token: refreshToken }); return data.session || null }
export async function supabaseUpload(file, key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).upload(key, fs.readFileSync(file.path), { contentType: file.mimetype, upsert: false }); if (error) throw error; try { fs.unlinkSync(file.path) } catch {} return true }
export async function supabaseRemove(key) { if (!adminClient) return false; const { error } = await adminClient.storage.from(bucket).remove([key]); if (error) throw error; return true }
export async function supabaseSignedUrl(key, expiresIn = 600) { if (!adminClient) return null; const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(key, expiresIn); if (error) throw error; return data.signedUrl }
