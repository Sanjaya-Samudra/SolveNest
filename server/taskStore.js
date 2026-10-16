import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasSupabase, supabaseReadState, supabaseWriteState } from './supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'tasks.json')
const emptyStore = () => ({ tasks: [], files: [], deliveryFiles: [], analyses: [], reviews: [], drafts: [], guestTransfers: [], conversations: [], messages: [], payments: [], plans: [], scopeChanges: [], explainSessions: [], explainArtifacts: [], explainRequests: [], supportTickets: [], idempotency: {}, activity: [], adminAudit: [] })

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2))
}

export async function readTaskStore() {
  if (hasSupabase()) return supabaseReadState()
  ensureStore()
  try {
    const value = JSON.parse(fs.readFileSync(storePath, 'utf8'))
    return { ...emptyStore(), ...value }
  } catch (cause) {
    throw new Error('LOCAL_TASK_STORE_UNREADABLE', { cause })
  }
}

export async function writeTaskStore(store) {
  if (hasSupabase()) return supabaseWriteState(store)
  ensureStore()
  const temporaryPath = `${storePath}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2))
  fs.renameSync(temporaryPath, storePath)
}

let localWriteQueue = Promise.resolve()
export function withTaskStore(mutator) {
  if (hasSupabase()) return mutateTaskStore(mutator)
  const operation = localWriteQueue.then(() => mutateTaskStore(mutator))
  localWriteQueue = operation.catch(() => {})
  return operation
}

async function mutateTaskStore(mutator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const store = await readTaskStore()
    const result = await mutator(store)
    try { await writeTaskStore(store); return result }
    catch (error) { if (error.message !== 'APP_STATE_CONFLICT' || attempt === 2) throw error }
  }
}

export async function getStudentTasks(studentId) {
  return (await readTaskStore()).tasks.filter((task) => task.studentId === studentId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function getStudentTask(studentId, taskId) {
  return (await readTaskStore()).tasks.find((task) => task.studentId === studentId && task.id === taskId) || null
}

export async function getStudentFiles(studentId, taskId = null) {
  return (await readTaskStore()).files.filter((file) => file.studentId === studentId && (!taskId || file.taskId === taskId))
}

export async function getStudentAnalysis(studentId, analysisId) {
  return (await readTaskStore()).analyses.find((analysis) => analysis.studentId === studentId && analysis.id === analysisId) || null
}

export function addActivity(store, activity) {
  store.activity.unshift(activity)
  const perStudent = new Map()
  store.activity = store.activity.filter((item) => {
    const key = item.studentId || 'system'
    const count = perStudent.get(key) || 0
    perStudent.set(key, count + 1)
    return count < 100
  })
}

export async function claimProviderEvent(provider, eventId, type, leaseMs = 5 * 60_000) {
  const key = `provider:${provider}:${eventId}`
  return withTaskStore((store) => {
    store.idempotency ||= {}
    const current = store.idempotency[key]
    const leaseExpired = current?.status === 'processing' && Date.parse(current.leaseExpiresAt || 0) <= Date.now()
    if (current?.status === 'completed' || (current?.status === 'processing' && !leaseExpired)) return false
    const stamp = new Date().toISOString()
    store.idempotency[key] = { provider, eventId, type, status: 'processing', claimedAt: stamp, leaseExpiresAt: new Date(Date.now() + leaseMs).toISOString(), attempts: Number(current?.attempts || 0) + 1 }
    return true
  })
}

export async function completeProviderEvent(provider, eventId) {
  const key = `provider:${provider}:${eventId}`
  return withTaskStore((store) => {
    const current = store.idempotency?.[key]
    if (!current) return false
    store.idempotency[key] = { ...current, status: 'completed', completedAt: new Date().toISOString(), leaseExpiresAt: null }
    return true
  })
}

export async function releaseProviderEvent(provider, eventId, errorCode = 'PROCESSING_FAILED') {
  const key = `provider:${provider}:${eventId}`
  return withTaskStore((store) => {
    const current = store.idempotency?.[key]
    if (!current || current.status === 'completed') return false
    store.idempotency[key] = { ...current, status: 'failed', failedAt: new Date().toISOString(), errorCode, leaseExpiresAt: null }
    return true
  })
}

export function buildTaskSummary(task, files = []) {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    subject: task.subject,
    deadline: task.deadline,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    latestUpdate: task.latestUpdate,
    fileCount: files.length,
    sourceMaterials: files.map(({ id, originalName, role, mimeType, size, createdAt }) => ({ id, name: originalName, role, mimeType, size, createdAt })),
    nextAction: task.nextAction || null,
    estimate: task.analysis?.estimate || null,
  }
}
