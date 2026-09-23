import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

export function listNotifications() {
  return readStore().notifications
}

export function markRead(id) {
  const store = readStore()
  const item = store.notifications.find((n) => String(n.id) === String(id))
  if (!item) return null
  item.isRead = true
  writeStore(store)
  return item
}

export function markAllRead() {
  const store = readStore()
  store.notifications = store.notifications.map((n) => ({ ...n, isRead: true }))
  writeStore(store)
  return store.notifications
}

export function unreadCount() {
  return listNotifications().filter((n) => !n.isRead).length
}
