import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AsyncLocalStorage } from 'node:async_hooks'
import { hasSupabase, supabaseListExpertWorkspaces, supabaseReadExpertWorkspace, supabaseReadState, supabaseWriteExpertWorkspace, supabaseWriteState } from './supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'expert.json')
const expertContext = new AsyncLocalStorage()
const currentExpert = () => expertContext.getStore() || { id: 'demo-expert', name: 'Alex Morgan' }
function fileFor(id) {
  if (id !== 'demo-expert') return path.join(dataDir, `expert-${id}.json`)
  try {
    if (fs.existsSync(storePath) && JSON.parse(fs.readFileSync(storePath, 'utf8'))?.expert?.id !== 'demo-expert') return path.join(dataDir, 'expert-demo.json')
  } catch {}
  return storePath
}

export function runForExpert(expert, callback) {
  const identity = typeof expert === 'string' ? { id: expert } : expert
  if (!/^(demo-expert|[0-9a-f-]{36})$/i.test(String(identity?.id || ''))) throw new Error('EXPERT_ID_INVALID')
  return expertContext.run(identity, callback)
}

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
  const identity = currentExpert()
  if (hasSupabase()) {
    if (identity.id !== 'demo-expert') {
      const saved = await supabaseReadExpertWorkspace(identity.id)
      const store = normalizeStore(saved)
      if (saved) Object.defineProperty(store, '__revision', { value: saved.__revision, configurable: true })
      store.expert = { ...store.expert, id: identity.id, name: identity.name || store.expert.name, title: saved?.expert?.title || 'Expert' }
      return store
    }
    const state = await supabaseReadState()
    const saved = identity.id === 'demo-expert' ? state.expertDemo || (state.expert?.expert?.id === 'demo-expert' ? state.expert : null) : state.expertWorkspaces?.[identity.id] || (state.expert?.expert?.id === identity.id ? state.expert : null)
    const store = normalizeStore(saved)
    store.expert = { ...store.expert, id: identity.id, name: identity.name || (identity.id === 'demo-expert' ? store.expert.name : 'Expert'), title: saved?.expert?.title || (identity.id === 'demo-expert' ? store.expert.title : 'Expert') }
    return store
  }
  ensureStore()
  try {
    const destination = fileFor(identity.id)
    const legacy = identity.id !== 'demo-expert' && !fs.existsSync(destination) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : null
    const value = legacy?.expert?.id === identity.id ? legacy : JSON.parse(fs.readFileSync(destination, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('invalid')
    if (identity.id === 'demo-expert' && value.expert?.id && value.expert.id !== 'demo-expert') return emptyStore()
    const store = normalizeStore(value)
    store.expert = { ...store.expert, id: identity.id, name: identity.name || (identity.id === 'demo-expert' ? store.expert.name : 'Expert'), title: value.expert?.title || (identity.id === 'demo-expert' ? store.expert.title : 'Expert') }
    return store
  } catch {
    const fresh = emptyStore()
    fresh.expert = { ...fresh.expert, id: identity.id, name: identity.name || (identity.id === 'demo-expert' ? fresh.expert.name : 'Expert'), title: identity.id === 'demo-expert' ? fresh.expert.title : 'Expert' }
    return fresh
  }
}

export async function writeExpertStore(store) {
  const identity = currentExpert()
  store.expert = { ...store.expert, id: identity.id, name: identity.name || store.expert.name }
  if (hasSupabase()) {
    if (identity.id !== 'demo-expert') return supabaseWriteExpertWorkspace(identity.id, store)
    const state = await supabaseReadState()
    if (identity.id === 'demo-expert') {
      if (state.expert?.expert?.id && state.expert.expert.id !== 'demo-expert') state.expertDemo = store
      else state.expert = store
    }
    else {
      state.expertWorkspaces = state.expertWorkspaces || {}
      state.expertWorkspaces[identity.id] = store
    }
    await supabaseWriteState(state)
    return store
  }
  ensureStore()
  const destination = fileFor(identity.id)
  const temporaryPath = `${destination}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2))
  fs.renameSync(temporaryPath, destination)
  return store
}

export async function listExpertStores() {
  if (hasSupabase()) {
    return (await supabaseListExpertWorkspaces()).map((row) => ({ id: row.expert_id, store: normalizeStore(row.workspace) }))
  }
  ensureStore()
  const files = fs.readdirSync(dataDir).filter((name) => /^expert-[0-9a-f-]{36}\.json$/i.test(name))
  const stores = await Promise.all(files.map(async (name) => {
    const id = name.slice(7, -5)
    return { id, store: await runForExpert(id, readExpertStore) }
  }))
  const legacy = normalizeStore(JSON.parse(fs.readFileSync(storePath, 'utf8')))
  if (!stores.some((item) => item.id === legacy.expert.id)) stores.unshift({ id: legacy.expert.id, store: legacy })
  if (legacy.expert.id !== 'demo-expert' && fs.existsSync(path.join(dataDir, 'expert-demo.json'))) stores.unshift({ id: 'demo-expert', store: await runForExpert('demo-expert', readExpertStore) })
  return stores
}

export async function withExpertStore(mutator) {
  const store = await readExpertStore()
  const result = await mutator(store)
  await writeExpertStore(store)
  return result
}

const CLOSED_WORK_STATES = new Set(['delivered'])

export function resolveAssignmentDeadlineState(deadline, workState) {
  if (CLOSED_WORK_STATES.has(String(workState || 'assigned'))) {
    return { key: 'completed', label: 'Completed', detail: 'Completed', tone: 'green' }
  }
  const time = deadline ? new Date(deadline).getTime() : NaN
  if (!deadline || Number.isNaN(time)) return { key: 'no_deadline', label: 'No deadline', detail: 'No deadline', tone: 'neutral' }
  const diff = time - Date.now()
  if (diff < 0) {
    const days = Math.max(1, Math.ceil(-diff / (24 * 60 * 60 * 1000)))
    return { key: 'overdue', label: 'Overdue', detail: `Overdue by ${days} day${days === 1 ? '' : 's'}`, tone: 'red' }
  }
  const hours = Math.ceil(diff / (60 * 60 * 1000))
  if (diff <= 48 * 60 * 60 * 1000) {
    const detail = hours <= 24 ? `Due in ${Math.max(1, hours)}h` : `Due in ${Math.ceil(hours / 24)}d`
    return { key: 'due_soon', label: 'Due soon', detail, tone: 'amber' }
  }
  return {
    key: 'on_track',
    label: 'On track',
    detail: `Due ${new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    tone: 'neutral',
  }
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
    deadlineState: resolveAssignmentDeadlineState(raw.deadline, raw.workState || 'assigned'),
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
  const unreadMessages = normalized.assignments.reduce((total, raw) => {
    if (!raw || typeof raw !== 'object') return total
    const workspace = normalizeWorkspace(raw.workspace, raw.workState)
    return total + workspace.messages.filter((message) => message.from !== 'expert' && !message.readAt).length
  }, Number(normalized.unreadMessages || 0))
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
    unreadMessages,
    capabilities: {
      availabilityEdit: true,
      expressInterest: true,
      messages: unreadMessages > 0,
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
  const currentInterest = store.interests[task.id] || task.interestState
  if (currentInterest === 'sent') return { ok: false, error: 'INTEREST_ALREADY_SENT' }
  store.interests[task.id] = 'sent'
  store.movement.unshift({
    id: `mov-${Date.now()}`,
    kind: 'interest',
    label: 'INTEREST SENT',
    title: task.title,
    at: new Date().toISOString(),
    route: '/expert/available',
    assignmentId: null,
  })
  store.movement = store.movement.slice(0, 40)
  await writeExpertStore(store)
  return { ok: true, taskId: task.id, interestState: 'sent' }
}

export async function provisionAvailableTasks(seeds = []) {
  const list = (Array.isArray(seeds) ? seeds : []).filter((item) => item && typeof item === 'object')
  if (!list.length) return { ok: false, error: 'TITLE_REQUIRED' }
  const store = await readExpertStore()
  const created = []
  for (const seed of list) {
    const title = String(seed.title || '').trim()
    if (!title) continue
    const normalized = {
      id: `otp-${crypto.randomUUID()}`,
      title,
      domain: seed.domain ? String(seed.domain) : null,
      type: seed.type ? String(seed.type) : null,
      requirements: Array.isArray(seed.requirements) ? seed.requirements.map(String).slice(0, 10) : [],
      skills: Array.isArray(seed.skills) ? seed.skills.map(String).slice(0, 10) : [],
      deadline: seed.deadline || null,
      complexity: seed.complexity ? String(seed.complexity) : null,
      interestState: 'none',
      matchHints: Array.isArray(seed.matchHints) ? seed.matchHints.map(String).slice(0, 6) : [],
      publishedAt: seed.publishedAt || nowIso(),
    }
    const existingIndex = store.availableTasks.findIndex((item) => item && item.title === title)
    if (existingIndex >= 0) {
      const previous = store.availableTasks[existingIndex]
      const merged = { ...previous, ...normalized, id: previous.id, interestState: store.interests[previous.id] || previous.interestState || 'none' }
      store.availableTasks[existingIndex] = merged
      created.push(safeAvailable(merged))
    } else {
      store.availableTasks.push(normalized)
      created.push(safeAvailable(normalized))
    }
  }
  if (!created.length) return { ok: false, error: 'TITLE_REQUIRED' }
  store.availableTasks = store.availableTasks.slice(0, 60)
  await writeExpertStore(store)
  return { ok: true, count: created.length, tasks: created }
}

const WORK_STATE_VALUES = new Set([
  'assigned',
  'needs_review',
  'working',
  'waiting_clarification',
  'ready_for_qa',
  'qa_review',
  'changes_requested',
  'ready_to_deliver',
  'delivered',
])

const QA_STATE_VALUES = new Set(['not_submitted', 'in_review', 'changes_requested', 'approved'])
const FILE_SECTION_VALUES = new Set(['source', 'shared', 'working', 'submission'])
const EXPERT_FILE_SECTIONS = new Set(['working', 'submission'])

const NEXT_ACTIONS = {
  assigned: { key: 'review', label: 'Review Assignment' },
  needs_review: { key: 'review', label: 'Review Assignment' },
  working: { key: 'continue', label: 'Continue' },
  waiting_clarification: { key: 'respond', label: 'Respond' },
  ready_for_qa: { key: 'submit', label: 'Submit for QA' },
  qa_review: { key: 'wait', label: 'Waiting' },
  changes_requested: { key: 'review-qa', label: 'Review QA Feedback' },
  ready_to_deliver: { key: 'prepare', label: 'Prepare Delivery' },
  delivered: { key: 'open', label: 'Open Assignment' },
}

const WORK_STATE_TRANSITIONS = {
  working: new Set(['assigned', 'needs_review', 'waiting_clarification', 'changes_requested']),
  waiting_clarification: new Set(['assigned', 'working', 'changes_requested']),
}

function nowIso() {
  return new Date().toISOString()
}

function stamp(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
}

function clipText(value, max = 140) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function emptyWorkspace(workState = 'assigned') {
  return {
    workState: WORK_STATE_VALUES.has(workState) ? workState : 'assigned',
    requirements: { open: [] },
    updates: [],
    messages: [],
    files: { source: [], shared: [], working: [], submission: [] },
    qa: { state: 'not_submitted', cycle: 0, submittedAt: null, reviewedAt: null, feedback: [] },
    qaLog: [],
    delivery: { state: 'not_delivered', version: 0, deliveredAt: null, note: null, fileIds: [] },
    deliveryHistory: [],
    revision: { active: false, requestedAt: null },
    revisionRequest: null,
    updatedAt: null,
  }
}

function normalizeUpdate(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.body) return null
  return { id: String(raw.id), body: String(raw.body), createdAt: raw.createdAt || null }
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.body) return null
  return {
    id: String(raw.id),
    from: raw.from === 'expert' ? 'expert' : 'solvenest',
    author: String(raw.author || 'SolveNest'),
    role: String(raw.role || 'Support'),
    initials: String(raw.initials || 'SN'),
    body: String(raw.body),
    attachments: Array.isArray(raw.attachments) ? raw.attachments.slice(0, 8) : [],
    createdAt: raw.createdAt || null,
    readAt: raw.readAt || null,
  }
}

function normalizeFeedback(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  return {
    id: String(raw.id),
    title: String(raw.title || 'QA feedback'),
    body: String(raw.body || ''),
    severity: ['minor', 'major'].includes(raw.severity) ? raw.severity : 'minor',
    state: raw.state === 'resolved' ? 'resolved' : 'open',
    cycle: Number(raw.cycle || 1),
    createdAt: raw.createdAt || null,
    resolvedAt: raw.resolvedAt || null,
  }
}

function normalizeOpenRequirement(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.text) return null
  return { id: String(raw.id), text: String(raw.text), note: raw.note ? String(raw.note) : null, createdAt: raw.createdAt || null }
}

function normalizeFileRecord(raw, section) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) return null
  const origin = raw.origin === 'expert' ? 'expert' : 'solvenest'
  return {
    id: String(raw.id),
    name: String(raw.name),
    type: raw.type ? String(raw.type) : null,
    size: Number(raw.size || 0),
    section: FILE_SECTION_VALUES.has(section) ? section : 'working',
    origin,
    uploadedBy: raw.uploadedBy ? String(raw.uploadedBy) : origin,
    storageKey: raw.storageKey ? String(raw.storageKey) : null,
    state: raw.state ? String(raw.state) : 'READY',
    uploadedAt: raw.uploadedAt || raw.createdAt || null,
  }
}

function publicFile(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    size: raw.size,
    section: raw.section,
    origin: raw.origin,
    uploadedBy: raw.uploadedBy,
    state: raw.state,
    uploadedAt: raw.uploadedAt,
  }
}

function safeFileList(value, section) {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeFileRecord(item, section)).filter(Boolean)
}

function normalizeWorkspace(raw, workState) {
  const base = emptyWorkspace(workState)
  if (!raw || typeof raw !== 'object') return base
  const qaRaw = raw.qa && typeof raw.qa === 'object' ? raw.qa : {}
  const deliveryRaw = raw.delivery && typeof raw.delivery === 'object' ? raw.delivery : {}
  const revisionRaw = raw.revision && typeof raw.revision === 'object' ? raw.revision : {}
  const filesRaw = raw.files && typeof raw.files === 'object' ? raw.files : {}
  const requirementsRaw = raw.requirements && typeof raw.requirements === 'object' ? raw.requirements : {}
  return {
    workState: WORK_STATE_VALUES.has(raw.workState) ? raw.workState : base.workState,
    requirements: {
      open: Array.isArray(requirementsRaw.open) ? requirementsRaw.open.map(normalizeOpenRequirement).filter(Boolean) : [],
    },
    updates: Array.isArray(raw.updates) ? raw.updates.map(normalizeUpdate).filter(Boolean) : [],
    messages: Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage).filter(Boolean) : [],
    files: {
      source: safeFileList(filesRaw.source, 'source'),
      shared: safeFileList(filesRaw.shared, 'shared'),
      working: safeFileList(filesRaw.working, 'working'),
      submission: safeFileList(filesRaw.submission, 'submission'),
    },
    qa: {
      state: QA_STATE_VALUES.has(qaRaw.state) ? qaRaw.state : 'not_submitted',
      cycle: Number(qaRaw.cycle || 0),
      submittedAt: qaRaw.submittedAt || null,
      reviewedAt: qaRaw.reviewedAt || null,
      feedback: Array.isArray(qaRaw.feedback) ? qaRaw.feedback.map(normalizeFeedback).filter(Boolean) : [],
    },
    qaLog: Array.isArray(raw.qaLog) ? raw.qaLog.slice(0, 10) : [],
    delivery: {
      state: deliveryRaw.state === 'delivered' ? 'delivered' : 'not_delivered',
      version: Number(deliveryRaw.version || 0),
      deliveredAt: deliveryRaw.deliveredAt || null,
      note: deliveryRaw.note ? String(deliveryRaw.note) : null,
      fileIds: Array.isArray(deliveryRaw.fileIds) ? deliveryRaw.fileIds.map(String) : [],
    },
    deliveryHistory: Array.isArray(raw.deliveryHistory) ? raw.deliveryHistory.filter((item) => item && Number.isSafeInteger(Number(item.version)) && Array.isArray(item.files)).slice(-20) : [],
    revision: { active: Boolean(revisionRaw.active), requestedAt: revisionRaw.requestedAt || null },
    revisionRequest: raw.revisionRequest?.id ? { id: String(raw.revisionRequest.id), note: String(raw.revisionRequest.note || ''), requestedAt: raw.revisionRequest.requestedAt || null } : null,
    updatedAt: raw.updatedAt || null,
  }
}

function ensureWorkspace(assignment) {
  assignment.workspace = normalizeWorkspace(assignment.workspace, assignment.workState)
  assignment.workState = assignment.workspace.workState
  return assignment.workspace
}

function findRawAssignment(store, id) {
  const wanted = String(id)
  const assignment = store.assignments.find((item) => item && (String(item.id) === wanted || String(item.taskId) === wanted))
  if (!assignment) return null
  ensureWorkspace(assignment)
  return assignment
}

function touchAssignment(assignment, change = {}) {
  const stampValue = nowIso()
  if (change.workState && WORK_STATE_VALUES.has(change.workState)) {
    assignment.workState = change.workState
    assignment.workspace.workState = change.workState
  }
  if (change.latestText) {
    assignment.latest = { kind: change.latestKind || 'update', text: clipText(change.latestText, 160), at: stampValue }
  }
  const next = NEXT_ACTIONS[assignment.workState] || NEXT_ACTIONS.assigned
  assignment.nextAction = { key: next.key, label: next.label, route: 'assignments' }
  assignment.updatedAt = stampValue
  assignment.workspace.updatedAt = stampValue
  return stampValue
}

function pushMovement(store, { kind, label, title, assignmentId }) {
  store.movement.unshift({
    id: stamp('mov'),
    kind,
    label,
    title: title ? clipText(title, 120) : null,
    at: nowIso(),
    route: assignmentId ? `/expert/assignments/${encodeURIComponent(assignmentId)}` : '/expert/assignments',
    assignmentId: assignmentId ? String(assignmentId) : null,
  })
  store.movement = store.movement.slice(0, 40)
}

function pushExpertNotification(store, { title, body, route }) {
  store.notifications.unshift({
    id: stamp('ntf'),
    title: clipText(title, 120),
    body: body ? clipText(body, 220) : null,
    at: nowIso(),
    isRead: false,
    route: route || null,
  })
  store.notifications = store.notifications.slice(0, 40)
}

function safeAssignmentDetail(assignment) {
  const base = safeAssignment(assignment)
  if (!base) return null
  const workspace = normalizeWorkspace(assignment.workspace, base.workState)
  const unread = workspace.messages.filter((message) => message.from !== 'expert' && !message.readAt).length
  return {
    ...base,
    workState: workspace.workState,
    deadlineState: resolveAssignmentDeadlineState(base.deadline, workspace.workState),
    workspace: {
      workState: workspace.workState,
      updates: workspace.updates.slice(0, 10),
      counts: {
        updates: workspace.updates.length,
        messages: workspace.messages.length,
        unreadMessages: unread,
        files: workspace.files.source.length + workspace.files.shared.length + workspace.files.working.length + workspace.files.submission.length,
        submissionFiles: workspace.files.submission.length,
        openFeedback: workspace.qa.feedback.filter((item) => item.state !== 'resolved').length,
      },
      requirementsOpen: workspace.requirements.open.length,
      qa: workspace.qa,
      delivery: workspace.delivery,
      revision: workspace.revision,
      updatedAt: workspace.updatedAt,
    },
  }
}

export async function queryAssignments({ search = '', filter = 'all', sort = 'deadline' } = {}) {
  const store = await readExpertStore()
  let rows = store.assignments.map(safeAssignment).filter(Boolean)
  const total = rows.length
  const needle = String(search || '').trim().toLowerCase()
  if (needle) {
    rows = rows.filter((row) => [row.reference, row.title, row.domain, row.type, row.deliverable]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)))
  }
  const attentionStates = new Set(['needs_review', 'waiting_clarification', 'ready_for_qa', 'changes_requested', 'ready_to_deliver'])
  const openStates = new Set(['assigned', 'needs_review', 'working', 'waiting_clarification', 'ready_for_qa', 'qa_review', 'changes_requested', 'ready_to_deliver'])
  const overdue = (row) => resolveAssignmentDeadlineState(row.deadline, row.workState).key === 'overdue'
  if (filter === 'attention') rows = rows.filter((row) => attentionStates.has(row.workState) || (openStates.has(row.workState) && overdue(row)))
  else if (filter === 'active') rows = rows.filter((row) => ['assigned', 'needs_review', 'working', 'waiting_clarification'].includes(row.workState))
  else if (filter === 'qa') rows = rows.filter((row) => ['ready_for_qa', 'qa_review', 'changes_requested'].includes(row.workState))
  else if (filter === 'delivered') rows = rows.filter((row) => row.workState === 'delivered')
  const timeOf = (value) => (value ? new Date(value).getTime() : Number.POSITIVE_INFINITY)
  const comparators = {
    deadline: (a, b) => timeOf(a.deadline) - timeOf(b.deadline),
    updated: (a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt),
    reference: (a, b) => String(a.reference || '').localeCompare(String(b.reference || '')),
    title: (a, b) => String(a.title).localeCompare(String(b.title)),
  }
  rows = rows.sort(comparators[sort] || comparators.deadline)
  return { assignments: rows, total }
}

export async function getAssignmentDetail(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  return assignment ? safeAssignmentDetail(assignment) : null
}

export async function getAssignmentRequirements(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return null
  const workspace = assignment.workspace
  return {
    requirements: {
      confirmed: (Array.isArray(assignment.requirements) ? assignment.requirements : []).map((text, index) => ({
        id: `req-${index + 1}`,
        text: String(text),
        state: 'confirmed',
      })),
      open: workspace.requirements.open,
      deliverable: assignment.deliverable || null,
      deadline: assignment.deadline || null,
    },
  }
}

export async function getAssignmentWork(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return null
  const workspace = assignment.workspace
  return {
    work: {
      workState: workspace.workState,
      updates: workspace.updates,
      qaState: workspace.qa.state,
      qaCycle: workspace.qa.cycle,
      revisionActive: workspace.revision.active,
      updatedAt: workspace.updatedAt,
    },
  }
}

export async function getAssignmentMessages(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return null
  const workspace = assignment.workspace
  return {
    messages: workspace.messages,
    unread: workspace.messages.filter((message) => message.from !== 'expert' && !message.readAt).length,
  }
}

export async function getAssignmentFiles(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return null
  const workspace = assignment.workspace
  return {
    sections: {
      source: workspace.files.source.map(publicFile),
      shared: workspace.files.shared.map(publicFile),
      working: workspace.files.working.map(publicFile),
      submission: workspace.files.submission.map(publicFile),
    },
  }
}

export async function getAssignmentQa(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return null
  const workspace = assignment.workspace
  return {
    qa: workspace.qa,
    delivery: workspace.delivery,
    revision: workspace.revision,
    workState: assignment.workState,
    submissionFiles: workspace.files.submission.map(publicFile),
  }
}

export async function appendProgressUpdate(id, body) {
  const text = String(body || '').trim()
  if (!text || text.length > 4000) return { ok: false, error: 'UPDATE_INVALID' }
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const update = { id: stamp('upd'), body: text, createdAt: nowIso() }
  assignment.workspace.updates.unshift(update)
  assignment.workspace.updates = assignment.workspace.updates.slice(0, 100)
  touchAssignment(assignment, { latestKind: 'progress', latestText: text })
  await writeExpertStore(store)
  return { ok: true, update, updatedAt: assignment.updatedAt }
}

export async function updateAssignmentWorkState(id, state) {
  const target = String(state || '')
  if (!WORK_STATE_TRANSITIONS[target]) return { ok: false, error: 'WORK_STATE_INVALID' }
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (assignment.workState === 'delivered' && !workspace.revision.active) return { ok: false, error: 'ASSIGNMENT_CLOSED' }
  if (workspace.qa.state === 'in_review') return { ok: false, error: 'QA_IN_REVIEW' }
  const source = assignment.workState
  if (!WORK_STATE_TRANSITIONS[target].has(source)) return { ok: false, error: 'WORK_STATE_LOCKED' }
  const latestText = target === 'waiting_clarification'
    ? 'Waiting for clarification before continuing.'
    : source === 'changes_requested' || source === 'waiting_clarification'
      ? 'Work resumed on this assignment.'
      : 'Work started on this assignment.'
  touchAssignment(assignment, { workState: target, latestKind: 'work', latestText })
  pushMovement(store, {
    kind: 'work',
    label: target === 'waiting_clarification' ? 'CLARIFICATION NEEDED' : 'WORK STARTED',
    title: assignment.title,
    assignmentId: assignment.id,
  })
  await writeExpertStore(store)
  return { ok: true, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function postAssignmentMessage(id, body) {
  const text = String(body || '').trim()
  if (!text || text.length > 4000) return { ok: false, error: 'MESSAGE_INVALID' }
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const expertName = store.expert.name || 'Expert'
  const message = {
    id: stamp('msg'),
    from: 'expert',
    author: expertName,
    role: 'Expert',
    initials: expertName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    body: text,
    attachments: [],
    createdAt: nowIso(),
    readAt: null,
  }
  assignment.workspace.messages.push(message)
  assignment.workspace.messages = assignment.workspace.messages.slice(-200)
  touchAssignment(assignment, { latestKind: 'message', latestText: `Message sent: ${text}` })
  await writeExpertStore(store)
  return { ok: true, message, unread: assignment.workspace.messages.filter((item) => item.from !== 'expert' && !item.readAt).length }
}

export async function markAssignmentMessagesRead(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const stampValue = nowIso()
  for (const message of assignment.workspace.messages) {
    if (message.from !== 'expert' && !message.readAt) message.readAt = stampValue
  }
  await writeExpertStore(store)
  return { ok: true, unread: 0 }
}

export async function addAssignmentFile(id, section, meta) {
  const target = String(section || 'working')
  if (!EXPERT_FILE_SECTIONS.has(target)) return { ok: false, error: 'FILE_SECTION_INVALID' }
  if (!meta || !meta.name || !meta.storageKey) return { ok: false, error: 'FILE_REQUIRED' }
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  if (assignment.workState === 'delivered' && !assignment.workspace.revision.active) return { ok: false, error: 'ASSIGNMENT_CLOSED' }
  const file = normalizeFileRecord({
    id: crypto.randomUUID(),
    name: meta.name,
    type: meta.type || null,
    size: Number(meta.size || 0),
    section: target,
    origin: 'expert',
    uploadedBy: 'expert',
    storageKey: meta.storageKey,
    state: 'READY',
    uploadedAt: nowIso(),
  }, target)
  assignment.workspace.files[target].push(file)
  touchAssignment(assignment, { latestKind: 'file', latestText: `File uploaded: ${file.name}` })
  await writeExpertStore(store)
  return { ok: true, file: publicFile(file), updatedAt: assignment.updatedAt }
}

export async function removeAssignmentFile(id, fileId) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const wanted = String(fileId)
  for (const section of FILE_SECTION_VALUES) {
    const index = assignment.workspace.files[section].findIndex((file) => file.id === wanted)
    if (index >= 0) {
      if ((assignment.workspace.deliveryHistory || []).some((delivery) => delivery.fileIds?.includes(wanted)) || assignment.workspace.delivery.fileIds.includes(wanted)) return { ok: false, error: 'FILE_IMMUTABLE' }
      const [file] = assignment.workspace.files[section].splice(index, 1)
      if (file.origin !== 'expert') {
        assignment.workspace.files[section].splice(index, 0, file)
        return { ok: false, error: 'FILE_IMMUTABLE' }
      }
      touchAssignment(assignment, { latestKind: 'file', latestText: `File removed: ${file.name}` })
      await writeExpertStore(store)
      return { ok: true, storageKey: file.storageKey || null, fileName: file.name, updatedAt: assignment.updatedAt }
    }
  }
  return { ok: false, error: 'FILE_NOT_FOUND' }
}

export async function findExpertFile(fileId) {
  const store = await readExpertStore()
  const wanted = String(fileId)
  for (const raw of store.assignments) {
    if (!raw || typeof raw !== 'object') continue
    const workspace = normalizeWorkspace(raw.workspace, raw.workState)
    for (const section of FILE_SECTION_VALUES) {
      const file = workspace.files[section].find((item) => item.id === wanted)
      if (file) return file
    }
  }
  return null
}

export async function submitAssignmentForQa(id, { note } = {}) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (assignment.workState === 'delivered' && !workspace.revision.active) return { ok: false, error: 'ASSIGNMENT_CLOSED' }
  if (workspace.qa.state === 'in_review') return { ok: false, error: 'QA_ALREADY_PENDING' }
  if (workspace.qa.state === 'changes_requested') return { ok: false, error: 'QA_FEEDBACK_OPEN' }
  if (workspace.qa.state === 'approved') return { ok: false, error: 'QA_ALREADY_APPROVED' }
  if (!workspace.files.submission.length) return { ok: false, error: 'QA_FILES_REQUIRED' }
  const stampValue = touchAssignment(assignment, { workState: 'qa_review', latestKind: 'qa', latestText: note ? `Submitted for QA: ${clipText(note, 100)}` : 'Submitted for quality review.' })
  workspace.qa = {
    state: 'in_review',
    cycle: workspace.qa.cycle + 1,
    submittedAt: stampValue,
    reviewedAt: null,
    feedback: workspace.qa.feedback,
  }
  pushMovement(store, { kind: 'qa', label: 'SUBMITTED FOR QA', title: assignment.title, assignmentId: assignment.id })
  await writeExpertStore(store)
  return { ok: true, qa: workspace.qa, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function resolveQaFeedback(id, feedbackId) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (workspace.qa.state !== 'changes_requested') return { ok: false, error: 'QA_NOT_PENDING' }
  const feedback = workspace.qa.feedback.find((item) => item.id === String(feedbackId))
  if (!feedback) return { ok: false, error: 'FEEDBACK_NOT_FOUND' }
  if (feedback.state === 'resolved') return { ok: false, error: 'FEEDBACK_ALREADY_RESOLVED' }
  feedback.state = 'resolved'
  feedback.resolvedAt = nowIso()
  const allResolved = workspace.qa.feedback.every((item) => item.state === 'resolved')
  touchAssignment(assignment, { latestKind: 'qa', latestText: `QA feedback resolved: ${feedback.title}` })
  await writeExpertStore(store)
  return { ok: true, qa: workspace.qa, allResolved, updatedAt: assignment.updatedAt }
}

export async function resubmitAssignmentForQa(id, { note } = {}) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (workspace.qa.state !== 'changes_requested') return { ok: false, error: 'QA_NOT_PENDING' }
  if (!workspace.qa.feedback.every((item) => item.state === 'resolved')) return { ok: false, error: 'QA_FEEDBACK_OPEN' }
  if (!workspace.files.submission.length) return { ok: false, error: 'QA_FILES_REQUIRED' }
  const stampValue = touchAssignment(assignment, { workState: 'qa_review', latestKind: 'qa', latestText: note ? `Resubmitted for QA: ${clipText(note, 100)}` : 'Work resubmitted for quality review.' })
  workspace.qa = {
    state: 'in_review',
    cycle: workspace.qa.cycle + 1,
    submittedAt: stampValue,
    reviewedAt: null,
    feedback: workspace.qa.feedback,
  }
  pushMovement(store, { kind: 'qa', label: 'RESUBMITTED FOR QA', title: assignment.title, assignmentId: assignment.id })
  await writeExpertStore(store)
  return { ok: true, qa: workspace.qa, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function applyQaOutcome(id, outcome, feedbackItems = [], actorId = null, reviewNote = '') {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (workspace.qa.state !== 'in_review') return { ok: false, error: 'QA_NOT_PENDING' }
  if (!workspace.files.submission.length) return { ok: false, error: 'QA_FILES_REQUIRED' }
  const stampValue = nowIso()
  if (outcome === 'approved') {
    workspace.qa.reviewedAt = stampValue
    workspace.qa.state = 'approved'
    workspace.qa.reviewerId = actorId
    workspace.qa.reviewNote = String(reviewNote || '').trim().slice(0, 2000) || null
    if (actorId) {
      store.staffQaAudit = Array.isArray(store.staffQaAudit) ? store.staffQaAudit : []
      store.staffQaAudit.unshift({ id: crypto.randomUUID(), assignmentId: id, actorId, outcome, note: workspace.qa.reviewNote, feedback: [], at: stampValue })
    }
    touchAssignment(assignment, { workState: 'ready_to_deliver', latestKind: 'qa', latestText: 'Quality review approved — ready to deliver.' })
    pushMovement(store, { kind: 'qa', label: 'QA APPROVED', title: assignment.title, assignmentId: assignment.id })
    pushExpertNotification(store, { title: 'Quality review approved', body: assignment.title, route: `/expert/assignments/${assignment.id}` })
    await writeExpertStore(store)
    return { ok: true, qa: workspace.qa, workState: assignment.workState, updatedAt: assignment.updatedAt }
  }
  if (outcome !== 'changes_requested') return { ok: false, error: 'QA_OUTCOME_INVALID' }
  const items = Array.isArray(feedbackItems) ? feedbackItems : []
  if (!items.length) return { ok: false, error: 'QA_FEEDBACK_REQUIRED' }
  workspace.qa.reviewedAt = stampValue
  workspace.qa.state = 'changes_requested'
  workspace.qa.reviewerId = actorId
  workspace.qa.reviewNote = String(reviewNote || '').trim().slice(0, 2000) || null
  workspace.qa.feedback = items.slice(0, 20).map((item) => normalizeFeedback({
    id: stamp('fb'),
    title: item?.title || 'QA feedback',
    body: item?.body || '',
    severity: item?.severity,
    state: 'open',
    cycle: workspace.qa.cycle,
    createdAt: stampValue,
  })).filter(Boolean)
  if (actorId) {
    store.staffQaAudit = Array.isArray(store.staffQaAudit) ? store.staffQaAudit : []
    store.staffQaAudit.unshift({ id: crypto.randomUUID(), assignmentId: id, actorId, outcome, note: workspace.qa.reviewNote, feedback: workspace.qa.feedback.map(({ title, body, severity }) => ({ title, body, severity })), at: stampValue })
  }
  touchAssignment(assignment, { workState: 'changes_requested', latestKind: 'qa', latestText: 'Quality review returned feedback.' })
  pushMovement(store, { kind: 'qa', label: 'CHANGES REQUESTED', title: assignment.title, assignmentId: assignment.id })
  pushExpertNotification(store, { title: 'QA feedback received', body: assignment.title, route: `/expert/assignments/${assignment.id}` })
  await writeExpertStore(store)
  return { ok: true, qa: workspace.qa, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function deliverAssignment(id, { note } = {}) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (assignment.workState === 'delivered' && workspace.delivery.state === 'delivered') return { ok: true, delivery: workspace.delivery, revision: workspace.revision, workState: assignment.workState, updatedAt: assignment.updatedAt, replayed: true }
  if (workspace.qa.state !== 'approved') return { ok: false, error: 'QA_APPROVAL_REQUIRED' }
  const submission = workspace.files.submission
  if (!submission.length) return { ok: false, error: 'DELIVERY_FILES_REQUIRED' }
  const stampValue = touchAssignment(assignment, { workState: 'delivered', latestKind: 'delivery', latestText: note ? `Delivery submitted: ${clipText(note, 100)}` : 'Delivery submitted.' })
  workspace.delivery = {
    state: 'delivered',
    version: workspace.delivery.version + 1,
    deliveredAt: stampValue,
    note: note ? clipText(note, 2000) : null,
    fileIds: submission.map((file) => file.id),
  }
  workspace.deliveryHistory = Array.isArray(workspace.deliveryHistory) ? workspace.deliveryHistory : []
  workspace.deliveryHistory.push({ ...workspace.delivery, files: submission.map((file) => ({ ...file })) })
  workspace.revision = { active: false, requestedAt: null }
  pushMovement(store, { kind: 'delivery', label: 'DELIVERED', title: assignment.title, assignmentId: assignment.id })
  pushExpertNotification(store, { title: 'Delivery submitted', body: assignment.title, route: `/expert/assignments/${assignment.id}` })
  await writeExpertStore(store)
  return { ok: true, delivery: workspace.delivery, revision: workspace.revision, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function beginAssignmentRevision(id) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  const workspace = assignment.workspace
  if (assignment.workState !== 'delivered') return { ok: false, error: 'ASSIGNMENT_NOT_DELIVERED' }
  workspace.qaLog.unshift({ ...workspace.qa, loggedAt: nowIso() })
  workspace.qaLog = workspace.qaLog.slice(0, 10)
  workspace.qa = { state: 'not_submitted', cycle: workspace.qa.cycle, submittedAt: null, reviewedAt: null, feedback: [] }
  workspace.revision = { active: true, requestedAt: nowIso() }
  touchAssignment(assignment, { workState: 'working', latestKind: 'revision', latestText: 'Revision in progress.' })
  pushMovement(store, { kind: 'revision', label: 'REVISION STARTED', title: assignment.title, assignmentId: assignment.id })
  await writeExpertStore(store)
  return { ok: true, revision: workspace.revision, qa: workspace.qa, workState: assignment.workState, updatedAt: assignment.updatedAt }
}

export async function notifyAssignmentRevision(id, request) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  if (assignment.workspace.revisionRequest?.id === request.id) return { ok: true, replayed: true }
  assignment.workspace.revisionRequest = { id: request.id, note: request.note, requestedAt: request.requestedAt }
  pushMovement(store, { kind: 'revision', label: 'REVISION REQUESTED', title: assignment.title, assignmentId: assignment.id })
  pushExpertNotification(store, { title: 'Student revision requested', body: assignment.title, route: `/expert/assignments/${assignment.id}` })
  await writeExpertStore(store)
  return { ok: true }
}

export async function applyAssignmentScopeChange(id, change) {
  const store = await readExpertStore()
  const assignment = findRawAssignment(store, id)
  if (!assignment) return { ok: false, error: 'ASSIGNMENT_NOT_FOUND' }
  assignment.scopeChangeIds = Array.isArray(assignment.scopeChangeIds) ? assignment.scopeChangeIds : []
  if (assignment.scopeChangeIds.includes(change.id)) return { ok: true, replayed: true }
  if (assignment.workState === 'delivered') return { ok: false, error: 'ASSIGNMENT_CLOSED' }
  assignment.deliverable = change.requested.scope
  assignment.requirements = [change.requested.scope, ...(assignment.requirements || []).filter((item) => item !== change.original.scope)].slice(0, 12)
  assignment.deadline = change.requested.delivery
  assignment.scopeChangeIds.push(change.id)
  touchAssignment(assignment, { latestKind: 'scope', latestText: 'The approved scope and delivery date were updated.' })
  pushMovement(store, { kind: 'scope', label: 'SCOPE UPDATED', title: assignment.title, assignmentId: assignment.id })
  pushExpertNotification(store, { title: 'Scope change approved', body: assignment.title, route: `/expert/assignments/${assignment.id}` })
  await writeExpertStore(store)
  return { ok: true }
}

export async function provisionAssignment(seed = {}) {
  const title = String(seed.title || '').trim()
  if (!title) return { ok: false, error: 'TITLE_REQUIRED' }
  const store = await readExpertStore()
  if (seed.taskId) {
    const existing = store.assignments.find((item) => item.taskId === String(seed.taskId))
    if (existing) return { ok: true, assignment: safeAssignmentDetail(existing), replayed: true }
  }
  const stampValue = nowIso()
  const workState = WORK_STATE_VALUES.has(seed.workState) ? seed.workState : 'assigned'
  const id = `asg-${crypto.randomUUID()}`
  const assignment = {
    id,
    taskId: seed.taskId ? String(seed.taskId) : id,
    reference: seed.reference ? String(seed.reference) : `SN-${String(store.assignments.length + 1).padStart(4, '0')}`,
    title,
    domain: seed.domain ? String(seed.domain) : null,
    type: seed.type ? String(seed.type) : null,
    deliverable: seed.deliverable ? String(seed.deliverable) : null,
    requirements: Array.isArray(seed.requirements) ? seed.requirements.map(String).slice(0, 12) : [],
    deadline: seed.deadline || null,
    workState,
    latest: { kind: 'assignment', text: 'Assignment confirmed by SolveNest.', at: stampValue },
    nextAction: { ...NEXT_ACTIONS[workState], route: 'assignments' },
    createdAt: stampValue,
    updatedAt: stampValue,
    workspace: emptyWorkspace(workState),
  }
  if (seed.workspace && typeof seed.workspace === 'object') {
    assignment.workspace = normalizeWorkspace({ ...seed.workspace, workState }, workState)
  }
  store.assignments.unshift(assignment)
  pushMovement(store, { kind: 'assignment', label: 'ASSIGNED', title, assignmentId: id })
  pushExpertNotification(store, { title: 'New assignment confirmed', body: title, route: `/expert/assignments/${id}` })
  await writeExpertStore(store)
  return { ok: true, assignment: safeAssignmentDetail(assignment) }
}

export async function cancelProvisionedAssignment(id, taskId) {
  const store = await readExpertStore()
  const index = store.assignments.findIndex((item) => item.id === id && item.taskId === taskId)
  if (index < 0) return false
  const assignment = store.assignments[index]
  if (assignment.workState !== 'assigned' || assignment.workspace?.updates?.length || assignment.workspace?.messages?.length) return false
  store.assignments.splice(index, 1)
  store.movement = store.movement.filter((item) => item.assignmentId !== id)
  store.notifications = store.notifications.filter((item) => item.route !== `/expert/assignments/${id}`)
  await writeExpertStore(store)
  return true
}
