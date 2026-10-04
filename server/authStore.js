import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const usersPath = path.join(dataDir, 'users.json')
const sessionsPath = path.join(dataDir, 'sessions.json')
const ensure = () => { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }) }
const read = (file, fallback) => { ensure(); try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { fs.writeFileSync(file, JSON.stringify(fallback, null, 2)); return fallback } }
const write = (file, value) => { ensure(); const temporary = `${file}.tmp`; fs.writeFileSync(temporary, JSON.stringify(value, null, 2)); fs.renameSync(temporary, file) }
const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, digest: crypto.scryptSync(password, salt, 64).toString('hex') })
const same = (left, right) => left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))

export function createUser({ name, email, password }) {
  const users = read(usersPath, [])
  const normalizedEmail = String(email).trim().toLowerCase()
  if (users.some((user) => user.email === normalizedEmail)) return null
  const id = crypto.randomUUID()
  const passwordHash = hash(password)
  const user = { id, role: 'Student', name: String(name).trim(), email: normalizedEmail, passwordHash, createdAt: new Date().toISOString() }
  users.push(user)
  write(usersPath, users)
  return publicUser(user)
}

export function authenticateUser(email, password) {
  const users = read(usersPath, [])
  const user = users.find((candidate) => candidate.email === String(email).trim().toLowerCase())
  if (!user) return null
  const passwordHash = hash(password, user.passwordHash.salt)
  return same(passwordHash.digest, user.passwordHash.digest) ? publicUser(user) : null
}

export function publicUser(user) {
  return { id: user.id, role: user.role, name: user.name, email: user.email }
}

export function createSession(user, device) {
  const sessions = read(sessionsPath, [])
  const session = { id: crypto.randomUUID(), userId: user.id, role: user.role, studentId: user.id, name: user.name, email: user.email, device, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }
  sessions.push(session)
  write(sessionsPath, sessions)
  return session
}

export function getSession(id) {
  const sessions = read(sessionsPath, [])
  const session = sessions.find((item) => item.id === id)
  if (!session) return null
  session.lastActiveAt = new Date().toISOString()
  write(sessionsPath, sessions)
  return session
}

export function deleteSession(id) { write(sessionsPath, read(sessionsPath, []).filter((session) => session.id !== id)) }
export function listSessions(userId) { return read(sessionsPath, []).filter((session) => session.userId === userId) }
