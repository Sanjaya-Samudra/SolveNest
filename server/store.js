import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasSupabase, supabaseReadState, supabaseWriteState } from './supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'notifications.json')

function emptyStore() {
  return { studentId: 'demo-student', notifications: [] }
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2))
  }
}

export function readStore() {
  ensureStore()
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.notifications)) throw new Error('invalid')
    return parsed
  } catch {
    const fresh = emptyStore()
    fs.writeFileSync(storePath, JSON.stringify(fresh, null, 2))
    return fresh
  }
}

export function writeStore(store) {
  ensureStore()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
}

export async function listNotifications(studentId = null) {
  if (hasSupabase()) { const state = await supabaseReadState(); return (state.notifications || []).filter((notification) => !studentId || notification.studentId === studentId) }
  const store = readStore()
  return store.notifications.filter((notification) => !studentId || !notification.studentId || notification.studentId === studentId)
}

export async function addNotification(notification) {
  if (hasSupabase()) { const state = await supabaseReadState(); state.notifications = state.notifications || []; state.notifications.unshift(notification); await supabaseWriteState(state); return notification }
  const store = readStore()
  store.notifications.unshift(notification)
  writeStore(store)
  return notification
}

export async function markRead(id, studentId = null) {
  if (hasSupabase()) { const state = await supabaseReadState(); const item = (state.notifications || []).find((n) => String(n.id) === String(id) && n.studentId === studentId); if (!item) return null; item.isRead = true; await supabaseWriteState(state); return item }
  const store = readStore()
  const item = store.notifications.find((n) => String(n.id) === String(id) && (!studentId || n.studentId === studentId || !n.studentId))
  if (!item) return null
  item.isRead = true
  writeStore(store)
  return item
}

export async function markAllRead(studentId = null) {
  if (hasSupabase()) { const state = await supabaseReadState(); state.notifications = (state.notifications || []).map((n) => n.studentId === studentId ? { ...n, isRead: true } : n); await supabaseWriteState(state); return state.notifications }
  const store = readStore()
  store.notifications = store.notifications.map((n) => (!studentId || n.studentId === studentId || !n.studentId) ? { ...n, isRead: true } : n)
  writeStore(store)
  return store.notifications
}

export async function unreadCount(studentId = null) {
  return (await listNotifications(studentId)).filter((n) => !n.isRead).length
}
