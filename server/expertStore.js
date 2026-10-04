import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasSupabase, supabaseReadState, supabaseWriteState } from './supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'expert.json')

const emptyStore = () => ({
  expert: {
    id: 'demo-expert',
    name: 'Alex Morgan',
    title: 'Data & Analytics',
    verified: true,
    accountState: 'approved',
    availability: 'available',
    avatarUrl: null,
  },
  assignments: [],
  availableTasks: [],
  movement: [],
  interests: {},
  notifications: [],
  unreadMessages: 0,
})

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2))
}

function normalizeStore(value) {
  const base = emptyStore()
  if (!value || typeof value !== 'object') return base
  return {
    ...base,
    ...value,
    expert: { ...base.expert, ...(value.expert || {}) },
    assignments: Array.isArray(value.assignments) ? value.assignments : [],
    availableTasks: Array.isArray(value.availableTasks) ? value.availableTasks : [],
    movement: Array.isArray(value.movement) ? value.movement : [],
    interests: value.interests && typeof value.interests === 'object' ? value.interests : {},
    notifications: Array.isArray(value.notifications) ? value.notifications : [],
    unreadMessages: Number(value.unreadMessages || 0),
  }
}

export async function readExpertStore() {
  if (hasSupabase()) {
    const state = await supabaseReadState()
    return normalizeStore(state.expert)
  }
  ensureStore()
  try {
    const value = JSON.parse(fs.readFileSync(storePath, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('invalid')
    return normalizeStore(value)
  } catch {
    const fresh = emptyStore()
    fs.writeFileSync(storePath, JSON.stringify(fresh, null, 2))
    return fresh
  }
}

export async function writeExpertStore(store) {
  if (hasSupabase()) {
    const state = await supabaseReadState()
    state.expert = store
    await supabaseWriteState(state)
    return store
  }
  ensureStore()
  const temporaryPath = `${storePath}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2))
  fs.renameSync(temporaryPath, storePath)
  return store
}

export async function withExpertStore(mutator) {
  const store = await readExpertStore()
  const result = await mutator(store)
  await writeExpertStore(store)
  return result
}

function safeAssignment(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!raw.id || !raw.title) return null
  return {
    id: String(raw.id),
    taskId: raw.taskId ? String(raw.taskId) : String(raw.id),
    reference: raw.reference ? String(raw.reference) : null,
    title: String(raw.title),
    domain: raw.domain ? String(raw.domain) : null,
    type: raw.type ? String(raw.type) : null,
    deliverable: raw.deliverable ? String(raw.deliverable) : null,
    requirements: Array.isArray(raw.requirements) ? raw.requirements.map(String).slice(0, 12) : [],
    deadline: raw.deadline || null,
    workState: raw.workState || 'assigned',
    latest: raw.latest && typeof raw.latest === 'object'
      ? { kind: String(raw.latest.kind || 'update'), text: String(raw.latest.text || ''), at: raw.latest.at || null }
      : null,
    nextAction: raw.nextAction && typeof raw.nextAction === 'object'
      ? { key: String(raw.nextAction.key || 'open'), label: String(raw.nextAction.label || 'Open Assignment'), route: raw.nextAction.route || null }
      : null,
    updatedAt: raw.updatedAt || raw.createdAt || null,
  }
}

function safeAvailable(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!raw.id || !raw.title) return null
  return {
    id: String(raw.id),
    title: String(raw.title),
    domain: raw.domain ? String(raw.domain) : null,
    type: raw.type ? String(raw.type) : null,
    requirements: Array.isArray(raw.requirements) ? raw.requirements.map(String).slice(0, 10) : [],
    skills: Array.isArray(raw.skills) ? raw.skills.map(String).slice(0, 10) : [],
    deadline: raw.deadline || null,
    complexity: raw.complexity ? String(raw.complexity) : null,
    interestState: ['none', 'sent', 'declined'].includes(raw.interestState) ? raw.interestState : 'none',
    matchHints: Array.isArray(raw.matchHints) ? raw.matchHints.map(String).slice(0, 6) : [],
    publishedAt: raw.publishedAt || null,
  }
}

function safeMovement(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!raw.id || !raw.kind) return null
  return {
    id: String(raw.id),
    kind: String(raw.kind),
    label: String(raw.label || raw.kind),
    title: raw.title ? String(raw.title) : null,
    at: raw.at || null,
    route: raw.route || null,
    assignmentId: raw.assignmentId ? String(raw.assignmentId) : null,
  }
}

export function toExpertWorkspace(store) {
  const normalized = normalizeStore(store)
  const assignments = normalized.assignments.map(safeAssignment).filter(Boolean)
  const availableTasks = normalized.availableTasks.map(safeAvailable).filter(Boolean)
  const movement = normalized.movement.map(safeMovement).filter(Boolean)
  const interests = normalized.interests
  const expert = normalized.expert
  return {
    expert: {
      id: expert.id,
      name: expert.name,
      title: expert.title || null,
      verified: Boolean(expert.verified),
      avatarUrl: expert.avatarUrl || null,
    },
    accountState: ['approved', 'pending', 'suspended'].includes(expert.accountState) ? expert.accountState : 'approved',
    availability: ['available', 'limited', 'unavailable'].includes(expert.availability) ? expert.availability : 'available',
    assignments,
    availableTaskPreview: availableTasks.slice(0, 3).map((task) => ({
      ...task,
      interestState: interests[task.id] || task.interestState,
    })),
    recentMovement: movement.slice(0, 8),
    notifications: normalized.notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body || null,
      at: item.at || null,
      isRead: Boolean(item.isRead),
      route: item.route || null,
    })),
    unreadNotifications: normalized.notifications.filter((item) => !item.isRead).length,
    unreadMessages: normalized.unreadMessages,
    capabilities: {
      availabilityEdit: true,
      expressInterest: true,
      messages: normalized.unreadMessages > 0,
    },
  }
}

export async function setAvailability(status) {
  return withExpertStore((store) => {
    if (['available', 'limited', 'unavailable'].includes(status)) {
      store.expert.availability = status
    }
    return store.expert.availability
  })
}

export async function listAssignments() {
  return (await readExpertStore()).assignments.map(safeAssignment).filter(Boolean)
}

export async function getAssignment(id) {
  const wanted = String(id)
  return (await listAssignments()).find((item) => item.id === wanted || item.taskId === wanted) || null
}

export async function listAvailableTasks(limit = 3) {
  const store = await readExpertStore()
  const capped = Math.max(1, Math.min(Number(limit) || 3, 12))
  return store.availableTasks
    .map(safeAvailable)
    .filter(Boolean)
    .slice(0, capped)
    .map((task) => ({ ...task, interestState: store.interests[task.id] || task.interestState }))
}

export async function listMovement() {
  return (await readExpertStore()).movement.map(safeMovement).filter(Boolean)
}

export async function expressInterest(taskId) {
  const wanted = String(taskId)
  const store = await readExpertStore()
  const task = store.availableTasks.map(safeAvailable).find((item) => item && item.id === wanted)
  if (!task) return { ok: false, error: 'TASK_NOT_FOUND' }
  if (store.interests[task.id] === 'sent') return { ok: false, error: 'INTEREST_ALREADY_SENT' }
  store.interests[task.id] = 'sent'
  store.movement.unshift({
    id: `mov-${Date.now()}`,
    kind: 'interest',
    label: 'INTEREST SENT',
    title: task.title,
    at: new Date().toISOString(),
    route: '/expert/available-tasks',
    assignmentId: null,
  })
  store.movement = store.movement.slice(0, 40)
  await writeExpertStore(store)
  return { ok: true, taskId: task.id, interestState: 'sent' }
}
