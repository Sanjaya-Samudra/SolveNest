import crypto from 'node:crypto'
import express from 'express'
import { listNotifications, markAllRead, markRead, unreadCount } from './store.js'
import { createTicket, getCatalog, getTicket, listTickets, resolveGuidance, searchHelp } from './helpStore.js'

const PORT = Number(process.env.PORT || 4174)
const COOKIE = 'sn_sid'
const sessions = new Map()

const app = express()
app.use(express.json())

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`)
}

function ensureStudentSession(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  let sid = cookies[COOKIE]
  if (sid && sessions.has(sid)) return sessions.get(sid)

  if (process.env.STRICT_SESSION === '1') {
    const err = new Error('STUDENT_ACCESS_REQUIRED')
    err.status = 401
    throw err
  }

  sid = crypto.randomUUID()
  const session = { id: sid, role: 'Student', studentId: 'demo-student', name: 'Demo Student' }
  sessions.set(sid, session)
  setSessionCookie(res, sid)
  return session
}

function requireStudent(req, res, next) {
  try {
    req.student = ensureStudentSession(req, res)
    next()
  } catch (error) {
    res.status(error.status || 401).json({ error: 'STUDENT_ACCESS_REQUIRED' })
  }
}

app.get('/api/student/notifications', requireStudent, (req, res) => {
  const notifications = listNotifications()
  res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
    total: notifications.length,
  })
})

app.get('/api/student/notifications/unread-count', requireStudent, (req, res) => {
  res.json({ unreadCount: unreadCount() })
})

app.patch('/api/student/notifications/:id/read', requireStudent, (req, res) => {
  const item = markRead(req.params.id)
  if (!item) {
    res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' })
    return
  }
  res.json({ ok: true, notification: item, unreadCount: unreadCount() })
})

app.post('/api/student/notifications/read-all', requireStudent, (req, res) => {
  const notifications = markAllRead()
  res.json({ ok: true, notifications, unreadCount: 0 })
})

app.get('/api/student/help', requireStudent, (req, res) => {
  res.json(getCatalog())
})

app.get('/api/student/help/search', requireStudent, (req, res) => {
  const query = String(req.query.q || '')
  res.json({ query, results: searchHelp(query) })
})

app.get('/api/student/help/guidance', requireStudent, (req, res) => {
  const { category, issue, taskId } = req.query
  if (!category && !issue) {
    res.status(400).json({ error: 'HELP_QUERY_REQUIRED' })
    return
  }
  res.json(resolveGuidance({
    category: String(category || ''),
    issue: String(issue || ''),
    taskId: taskId ? String(taskId) : null,
  }))
})

app.get('/api/student/help/tickets', requireStudent, (req, res) => {
  res.json({ tickets: listTickets() })
})

app.get('/api/student/help/tickets/:ticketId', requireStudent, (req, res) => {
  const ticket = getTicket(req.params.ticketId)
  if (!ticket) {
    res.status(404).json({ error: 'TICKET_NOT_FOUND' })
    return
  }
  res.json(ticket)
})

app.post('/api/student/help/tickets', requireStudent, (req, res) => {
  const body = req.body || {}
  const message = String(body.message || '').trim()
  if (!message) {
    res.status(400).json({ error: 'MESSAGE_REQUIRED' })
    return
  }
  if (message.length > 4000) {
    res.status(400).json({ error: 'MESSAGE_TOO_LONG' })
    return
  }
  const ticket = createTicket({
    student: req.student,
    category: body.category ? String(body.category) : null,
    issue: body.issue ? String(body.issue) : null,
    taskId: body.taskId ? String(body.taskId) : null,
    message,
  })
  res.status(201).json(ticket)
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'solvenest-server' })
})

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' })
})

app.listen(PORT, () => {
  console.log(`SolveNest API listening on http://127.0.0.1:${PORT}`)
})
