import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasSupabase, supabaseReadState, supabaseWriteState } from './supabase.js'
import { getNotificationPreferences } from './accountStore.js'
import { supabaseProfile } from './supabase.js'
import { sendEmail } from './email.js'

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
  } catch (cause) {
    throw new Error('LOCAL_NOTIFICATION_STORE_UNREADABLE', { cause })
  }
}

export function writeStore(store) {
  ensureStore()
  const temporary = `${storePath}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2))
  fs.renameSync(temporary, storePath)
}

async function updateNotifications(mutator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await supabaseReadState()
    state.notifications = state.notifications || []
    const result = mutator(state.notifications)
    try { await supabaseWriteState(state); return result }
    catch (error) { if (error.message !== 'APP_STATE_CONFLICT' || attempt === 2) throw error }
  }
}

export async function listNotifications(studentId = null) {
  if (hasSupabase()) { const state = await supabaseReadState(); return (state.notifications || []).filter((notification) => !studentId || notification.studentId === studentId) }
  const store = readStore()
  return store.notifications.filter((notification) => !studentId || notification.studentId === studentId)
}

export async function addNotification(notification) {
  const preferences = await getNotificationPreferences(notification.studentId)
  const category = notification.category || (String(notification.route || '').includes('/payments') ? 'payments' : String(notification.route || '').includes('/messages') || /message/i.test(notification.title || '') ? 'messages' : 'tasks')
  const categoryEnabled = preferences[category] !== false
  if (preferences.inApp && categoryEnabled) {
    if (hasSupabase()) await updateNotifications((notifications) => { if (!notifications.some((item) => item.id === notification.id)) notifications.unshift(notification); return notification })
    else {
      const store = readStore()
      store.notifications.unshift(notification)
      writeStore(store)
    }
  }
  if (preferences.email && categoryEnabled && hasSupabase()) {
    try {
      const profile = await supabaseProfile(notification.studentId)
      if (profile?.email) await sendEmail({ to: profile.email, subject: notification.title, text: `${notification.body || notification.title}\n\nOpen SolveNest to view the update.` })
    } catch (error) { console.error('[notification-email]', error.message) }
  }
  return { ...notification, delivery: { inApp: Boolean(preferences.inApp && categoryEnabled), email: Boolean(preferences.email && categoryEnabled) } }
}

export async function markRead(id, studentId = null) {
  if (hasSupabase()) return updateNotifications((notifications) => { const item = notifications.find((n) => String(n.id) === String(id) && n.studentId === studentId); if (item) item.isRead = true; return item || null })
  const store = readStore()
  const item = store.notifications.find((n) => String(n.id) === String(id) && (!studentId || n.studentId === studentId))
  if (!item) return null
  item.isRead = true
  writeStore(store)
  return item
}

export async function markAllRead(studentId = null) {
  if (hasSupabase()) return updateNotifications((notifications) => { for (const item of notifications) if (item.studentId === studentId) item.isRead = true; return notifications.filter((item) => item.studentId === studentId) })
  const store = readStore()
  store.notifications = store.notifications.map((n) => (!studentId || n.studentId === studentId) ? { ...n, isRead: true } : n)
  writeStore(store)
  return store.notifications.filter((item) => !studentId || item.studentId === studentId)
}

export async function unreadCount(studentId = null) {
  return (await listNotifications(studentId)).filter((n) => !n.isRead).length
}
