import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'notifications.json')

const seed = [
  {
    id: 'n9',
    category: 'delivery',
    title: 'Delivery ready',
    task: { title: 'Research Report', subject: 'Information Systems', ref: 'SN-2042' },
    description: 'Your latest delivery has completed the SolveNest review process and is ready.',
    previousState: 'Quality review',
    currentState: 'Delivery ready',
    meaning: 'You can review and download your delivered files now.',
    next: 'Review delivery',
    primaryAction: { label: 'Review delivery', route: '/student/files?task=SN-2042' },
    secondaryAction: { label: 'Explain & Defend', route: '/student/explain?task=SN-2042' },
    requiresAction: true,
    isRead: false,
    createdAt: '2026-09-19T14:42:00',
    entity: { type: 'delivery', version: 'Version 2', state: 'Current' },
    route: '/student/files?task=SN-2042',
    body: 'Your latest delivery is ready to review.',
  },
  {
    id: 'n8',
    category: 'task',
    title: 'Quality review started',
    task: { title: 'Database Project', subject: 'Computer Science', ref: 'SN-1988' },
    description: 'Your task has moved into quality review ahead of delivery.',
    previousState: 'In progress',
    currentState: 'Quality review',
    meaning: 'No action is required from you while quality review is underway.',
    next: 'Wait for quality review to complete',
    primaryAction: null,
    secondaryAction: { label: 'Open task', route: '/student/tasks?id=SN-1988' },
    requiresAction: false,
    isRead: false,
    createdAt: '2026-09-19T12:18:00',
    entity: { type: 'task', stage: 'Quality review' },
    route: '/student/tasks?id=SN-1988',
    body: 'Quality review is underway for Database Project.',
  },
  {
    id: 'n7',
    category: 'message',
    title: 'New message',
    task: { title: 'Software Project', subject: 'Software Engineering', ref: 'SN-2110' },
    description: 'Your assigned Expert sent a message about task requirements.',
    meaning: 'Reply so your Expert can continue without waiting on you.',
    next: 'Reply in the task conversation',
    primaryAction: { label: 'Open conversation', route: '/student/messages?task=SN-2110' },
    secondaryAction: null,
    requiresAction: true,
    isRead: false,
    sender: { name: 'Amara P.', role: 'Verified Expert' },
    preview: 'Could you confirm whether the dataset should include Q4 figures or...',
    createdAt: '2026-09-19T10:06:00',
    entity: { type: 'message' },
    route: '/student/messages?task=SN-2110',
    body: 'Amara P. sent you a message about task requirements.',
  },
  {
    id: 'n6',
    category: 'payment',
    title: 'Official plan ready',
    task: { title: 'Research Report', subject: 'Information Systems', ref: 'SN-2042' },
    description: 'Human review is complete and your official plan is ready for payment.',
    meaning: 'Review the plan and pay to keep this task moving.',
    next: 'Review the official plan',
    primaryAction: { label: 'Review official plan', route: '/student/payments?task=SN-2042&view=plan' },
    secondaryAction: { label: 'Open task', route: '/student/tasks?id=SN-2042' },
    requiresAction: true,
    isRead: true,
    createdAt: '2026-09-18T09:15:00',
    entity: { type: 'payment', amount: 'LKR 18,500', status: 'Awaiting payment' },
    route: '/student/payments?task=SN-2042&view=plan',
    body: 'Your official plan is ready for payment.',
  },
  {
    id: 'n5',
    category: 'payment',
    title: 'Payment confirmed',
    task: { title: 'Research Report', subject: 'Information Systems', ref: 'SN-2042' },
    description: 'Your payment for this task was received and confirmed.',
    meaning: 'No action is required. Your Expert has been notified to begin.',
    next: null,
    primaryAction: { label: 'View payment record', route: '/student/payments?task=SN-2042' },
    secondaryAction: null,
    requiresAction: false,
    isRead: true,
    createdAt: '2026-09-14T14:42:00',
    entity: { type: 'payment', amount: 'LKR 18,500', status: 'Paid' },
    route: '/student/payments?task=SN-2042',
    body: 'Payment of LKR 18,500 was confirmed.',
  },
  {
    id: 'n4',
    category: 'task',
    title: 'Expert assigned',
    task: { title: 'Research Report', subject: 'Information Systems', ref: 'SN-2042' },
    description: 'An Expert was assigned to your task and can now begin work.',
    meaning: 'No action is required. Work has started.',
    next: null,
    primaryAction: { label: 'Open task', route: '/student/tasks?id=SN-2042' },
    secondaryAction: null,
    requiresAction: false,
    isRead: true,
    createdAt: '2026-09-14T09:03:00',
    entity: { type: 'task', stage: 'Assigned' },
    route: '/student/tasks?id=SN-2042',
    body: 'An Expert was assigned and work has started.',
  },
  {
    id: 'n3',
    category: 'task',
    title: 'Scope change proposed',
    task: { title: 'Database Project', subject: 'Computer Science', ref: 'SN-1988' },
    description: 'Your Expert proposed additional scope with an updated price and timeline.',
    meaning: 'Review the change before your Expert can continue.',
    next: 'Decide on the scope change',
    primaryAction: { label: 'Review scope change', route: '/student/tasks?id=SN-1988&view=scope' },
    secondaryAction: null,
    requiresAction: true,
    isRead: true,
    createdAt: '2026-09-08T16:30:00',
    entity: { type: 'task', priceDelta: '+ LKR 3,200', timeDelta: '+ 1 day' },
    route: '/student/tasks?id=SN-1988&view=scope',
    body: 'A scope change is waiting for your decision.',
  },
  {
    id: 'n2',
    category: 'delivery',
    title: 'Revision delivered',
    task: { title: 'Marketing Plan', subject: 'Business', ref: 'SN-1820' },
    description: 'A requested revision has been delivered for your review.',
    meaning: 'Review the revised files and confirm they meet your request.',
    next: 'Review the revision',
    primaryAction: { label: 'Review delivery', route: '/student/files?task=SN-1820' },
    secondaryAction: null,
    requiresAction: false,
    isRead: true,
    createdAt: '2026-08-30T11:00:00',
    entity: { type: 'delivery', version: 'Version 3', state: 'Superseded' },
    route: '/student/files?task=SN-1820',
    body: 'A revision is ready for your review.',
  },
  {
    id: 'n1',
    category: 'task',
    title: 'Task completed',
    task: { title: 'Marketing Plan', subject: 'Business', ref: 'SN-1820' },
    description: 'This task has been marked complete and archived.',
    meaning: 'No further action is required.',
    next: null,
    primaryAction: null,
    secondaryAction: { label: 'Open task', route: '/student/tasks?id=SN-1820' },
    requiresAction: false,
    isRead: true,
    createdAt: '2026-08-30T11:02:00',
    entity: { type: 'task', stage: 'Completed' },
    route: '/student/tasks?id=SN-1820',
    body: 'Marketing Plan has been completed.',
  },
]

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ studentId: 'demo-student', notifications: seed }, null, 2))
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
    fs.writeFileSync(storePath, JSON.stringify({ studentId: 'demo-student', notifications: seed }, null, 2))
    return { studentId: 'demo-student', notifications: [...seed] }
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
