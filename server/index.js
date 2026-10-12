import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import Stripe from 'stripe'
import { authenticateUser, createSession, createUser, deleteSession, getSession, listSessions } from './authStore.js'
import { getAccountView, updatePreferences, updateProfile } from './accountStore.js'
import { addNotification, listNotifications, markAllRead, markRead, unreadCount } from './store.js'
import { getCatalog, resolveGuidance, searchHelp } from './helpStore.js'
import { createSupportTicket, getStudentSupportTicket, listStudentSupportTickets, listSupportTickets, getSupportTicket, updateSupportTicket } from './supportStore.js'
import {
  addAssignmentFile,
  appendProgressUpdate,
  applyQaOutcome,
  beginAssignmentRevision,
  deliverAssignment,
  expressInterest,
  findExpertFile,
  getAssignmentDetail,
  getAssignmentFiles,
  getAssignmentMessages,
  getAssignmentQa,
  getAssignmentRequirements,
  getAssignmentWork,
  listAvailableTasks,
  listMovement,
  markAssignmentMessagesRead,
  postAssignmentMessage,
  provisionAssignment,
  provisionAvailableTasks,
  queryAssignments,
  readExpertStore,
  removeAssignmentFile,
  resolveQaFeedback,
  resubmitAssignmentForQa,
  setAvailability,
  submitAssignmentForQa,
  toExpertWorkspace,
  updateAssignmentWorkState,
} from './expertStore.js'
import { addActivity, buildTaskSummary, getStudentAnalysis, getStudentFiles, getStudentTask, getStudentTasks, readTaskStore, withTaskStore } from './taskStore.js'
import { publish, subscribe } from './realtime.js'
import { hasObjectStorage, persistUpload, removeStoredObject, signedObjectUrl } from './storage.js'
import { hasEmail, sendEmail } from './email.js'
import { hasSupabase, hasSupabaseAuth, supabaseChangeStaffRole, supabaseFindProfileByEmail, supabaseProfile, supabaseRefresh, supabaseRequestPasswordReset, supabaseTeam, supabaseUpdatePassword, supabaseSignIn, supabaseSignUp, supabaseUser } from './supabase.js'
import { getAdminCase, getAdminOverview, getAdminQaCase, listAdminQaAssignments, recordAdminReview } from './adminStore.js'
import { getSuperadminActivity, getSuperadminOverview } from './superadminStore.js'

const PORT = Number(process.env.PORT || 4174)
const COOKIE = 'sn_sid'
const EXPERT_COOKIE = 'sn_eid'
const expertSessions = new Map()
const staffSessions = new Map()
const STAFF_COOKIE = 'sn_staff'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, 'private-uploads')
const requestWindows = new Map()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
fs.mkdirSync(uploadDir, { recursive: true })
const allowedExtensions = new Set(['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png'])
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).slice(1).toLowerCase()
    callback(null, allowedExtensions.has(extension))
  },
})

const app = express()
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'PAYMENTS_NOT_CONFIGURED' })
  let event
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET) } catch { return res.status(400).json({ error: 'INVALID_WEBHOOK' }) }
  const intent = event.data.object
  const status = event.type === 'payment_intent.succeeded' ? 'succeeded' : event.type === 'payment_intent.payment_failed' ? 'failed' : null
  if (status) await withTaskStore((store) => { const payment = store.payments.find((item) => item.providerId === intent.id); if (payment) payment.status = status })
  res.json({ received: true })
})
app.use(express.json())

function now() { return new Date().toISOString() }

function safeError(res, status, code, message, fieldErrors = {}) {
  res.status(status).json({ error: code, code, message, fieldErrors, retryable: status >= 500 })
}

function limited(key, max = 10) {
  const current = requestWindows.get(key) || { count: 0, startedAt: Date.now() }
  if (Date.now() - current.startedAt >= 60_000) { current.count = 0; current.startedAt = Date.now() }
  current.count += 1
  requestWindows.set(key, current)
  return current.count <= max
}

function normalizeAnalysis(files) {
  const brief = files.find((file) => file.role === 'BRIEF')
  const rubric = files.find((file) => file.role === 'SUPPORTING' && /rubric|marking|criteria/i.test(file.originalName))
  const title = path.basename(brief?.originalName || 'New task', path.extname(brief?.originalName || ''))
  return {
    provider: 'local-intake',
    provisional: true,
    taskType: 'Academic task',
    title,
    subject: null,
    deadline: null,
    citationStyle: null,
    requiredSections: [],
    rubric: rubric ? { sourceFileId: rubric.id, criteria: [] } : null,
    deliverables: [],
    missingInformation: ['deadline', 'subject'],
    estimate: null,
  }
}

async function analyzeWithSolvy(files) {
  if (!process.env.SOLVY_API_URL) return { ...normalizeAnalysis(files), provider: 'local-intake', provisional: true }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(process.env.SOLVY_API_URL, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(process.env.SOLVY_API_KEY ? { Authorization: `Bearer ${process.env.SOLVY_API_KEY}` } : {}) }, body: JSON.stringify({ fileIds: files.map((file) => file.id), files: files.map((file) => ({ id: file.id, role: file.role, name: file.originalName, mimeType: file.mimeType, size: file.size })) }) })
    if (!response.ok) throw new Error(`SOLVY_${response.status}`)
    const payload = await response.json()
    const result = payload.analysis || payload.result || payload
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('SOLVY_INVALID_RESPONSE')
    return { ...result, provider: 'solvy', provisional: true }
  } finally { clearTimeout(timeout) }
}

async function solvyOperation(operation, payload) {
  if (!process.env.SOLVY_API_URL) throw Object.assign(new Error('SOLVY_NOT_CONFIGURED'), { code: 'SOLVY_NOT_CONFIGURED' })
  const response = await fetch(process.env.SOLVY_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Solvy-Operation': operation, ...(process.env.SOLVY_API_KEY ? { Authorization: `Bearer ${process.env.SOLVY_API_KEY}` } : {}) }, body: JSON.stringify({ operation, ...payload }) })
  if (!response.ok) throw Object.assign(new Error(`SOLVY_${response.status}`), { code: 'SOLVY_PROVIDER_ERROR' })
  return response.json()
}

async function studentTaskPayload(task, studentId) {
  return buildTaskSummary(task, await getStudentFiles(studentId, task.id))
}

function hashTransferToken(token) { return crypto.createHash('sha256').update(token).digest('hex') }

function fileSignature(fileId, expiresAt) {
  return crypto.createHmac('sha256', process.env.FILE_SIGNING_SECRET || 'development-file-secret').update(`${fileId}:${expiresAt}`).digest('hex')
}

function signedFileUrl(fileId) {
  const expiresAt = Date.now() + 10 * 60 * 1000
  return `/api/student/files/${encodeURIComponent(fileId)}/download?expires=${expiresAt}&token=${fileSignature(fileId, expiresAt)}`
}

function signedExpertFileUrl(fileId) {
  const expiresAt = Date.now() + 10 * 60 * 1000
  return `/api/expert/files/${encodeURIComponent(fileId)}/download?expires=${expiresAt}&token=${fileSignature(fileId, expiresAt)}`
}

async function ownedFile(studentId, fileId) {
  return (await getStudentFiles(studentId)).find((file) => file.id === fileId) || null
}

app.get('/api/student/me', requireStudent, (req, res) => {
  res.json({ user: { id: req.student.studentId, role: req.student.role, name: req.student.name, email: req.student.email || null } })
})

app.get('/api/student/events', requireStudent, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: now() })}\n\n`)
  const unsubscribe = subscribe(req.student.studentId, res)
  req.on('close', unsubscribe)
})

app.post('/api/student/task-creation/session', requireStudent, async (req, res) => {
  const session = { id: crypto.randomUUID(), studentId: req.student.studentId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdAt: now(), updatedAt: now() }
  await withTaskStore((store) => store.drafts.push(session))
  res.status(201).json({ session })
})

app.get('/api/student/task-creation/session/:sessionId', requireStudent, async (req, res) => {
  const state = await readTaskStore()
  const session = state.drafts.find((draft) => draft.id === req.params.sessionId && draft.studentId === req.student.studentId)
  if (!session) return safeError(res, 404, 'SESSION_NOT_FOUND', 'Task setup session not found.')
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => file.analysisSessionId === session.id || file.taskId === null)
  const analysis = state.analyses.find((item) => item.sessionId === session.id && item.studentId === req.student.studentId) || null
  res.json({ session, files, analysis: analysis?.result || null })
})

app.post('/api/guest/analysis-transfer', async (req, res) => {
  const analysis = req.body?.analysis
  if (!analysis || typeof analysis !== 'object') return safeError(res, 400, 'ANALYSIS_REQUIRED', 'A structured analysis is required.')
  const token = crypto.randomBytes(32).toString('base64url')
  const transfer = { tokenHash: hashTransferToken(token), analysis, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), claimedBy: null, createdAt: now() }
  await withTaskStore((store) => store.guestTransfers.push(transfer))
  res.status(201).json({ transferToken: token, expiresAt: transfer.expiresAt })
})

app.post('/api/student/analysis-transfer/claim', requireStudent, async (req, res) => {
  const token = String(req.body?.transferToken || '')
  const transfer = await withTaskStore((store) => {
    const item = store.guestTransfers.find((candidate) => candidate.tokenHash === hashTransferToken(token) && !candidate.claimedBy && new Date(candidate.expiresAt).getTime() > Date.now())
    if (item) Object.assign(item, { claimedBy: req.student.studentId, claimedAt: now() })
    return item || null
  })
  if (!transfer) return safeError(res, 404, 'TRANSFER_NOT_FOUND', 'This analysis transfer is expired or invalid.')
  res.json({ analysis: transfer.analysis, claimed: true })
})

app.post('/api/student/task-creation/files', requireStudent, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_REJECTED'
      safeError(res, 400, code, code === 'FILE_TOO_LARGE' ? 'File exceeds the 100 MB limit.' : 'This file type is not supported.')
      return
    }
    next()
  })
}, async (req, res) => {
  if (!req.file) return safeError(res, 400, 'FILE_REQUIRED', 'Choose a file to upload.')
  const role = String(req.body.kind || '').toLowerCase() === 'brief' ? 'BRIEF' : 'SUPPORTING'
  const file = {
    id: crypto.randomUUID(),
    studentId: req.student.studentId,
    taskId: null,
    analysisSessionId: req.body.sessionId || null,
    role,
    originalName: path.basename(req.file.originalname),
    storageKey: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    state: 'READY',
    createdAt: now(),
  }
  try { await persistUpload(req.file, file.storageKey) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.') }
  await withTaskStore((store) => store.files.push(file))
  res.status(201).json({ file: { id: file.id, name: file.originalName, kind: file.role === 'BRIEF' ? 'brief' : 'supporting', size: file.size, status: 'ready', createdAt: file.createdAt } })
})

app.delete('/api/student/task-creation/files/:fileId', requireStudent, async (req, res) => {
  const result = await withTaskStore((store) => {
    const index = store.files.findIndex((file) => file.id === req.params.fileId && file.studentId === req.student.studentId && !file.taskId)
    if (index === -1) return null
    const [file] = store.files.splice(index, 1)
    return file
  })
  if (!result) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  try { await removeStoredObject(result.storageKey); fs.unlinkSync(path.join(uploadDir, result.storageKey)) } catch {}
  res.json({ ok: true })
})

app.get('/api/student/files/:fileId/access', requireStudent, async (req, res) => {
  const file = await ownedFile(req.student.studentId, req.params.fileId)
  if (!file) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  const objectUrl = await signedObjectUrl(file.storageKey, file.originalName)
  res.json({ signedUrl: objectUrl || signedFileUrl(file.id), expiresAt: Date.now() + 10 * 60 * 1000 })
})

app.get('/api/student/files/:fileId/download', requireStudent, async (req, res) => {
  const file = await ownedFile(req.student.studentId, req.params.fileId)
  const expiresAt = Number(req.query.expires)
  const providedToken = Buffer.from(String(req.query.token || ''))
  const expectedToken = Buffer.from(file ? fileSignature(file.id, expiresAt) : '')
  const valid = file && providedToken.length === expectedToken.length && Number.isFinite(expiresAt) && expiresAt > Date.now() && crypto.timingSafeEqual(providedToken, expectedToken)
  if (!valid) return safeError(res, 403, 'FILE_ACCESS_DENIED', 'This file access link has expired or is invalid.')
  const storagePath = path.join(uploadDir, file.storageKey)
  if (hasObjectStorage()) return safeError(res, 409, 'OBJECT_STORAGE_REDIRECT_REQUIRED', 'Use the signed object-storage URL.')
  if (!fs.existsSync(storagePath)) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
  res.download(storagePath, file.originalName)
})

app.delete('/api/student/files/:fileId', requireStudent, async (req, res) => {
  const removed = await withTaskStore((store) => {
    const index = store.files.findIndex((file) => file.id === req.params.fileId && file.studentId === req.student.studentId)
    if (index < 0) return null
    const [file] = store.files.splice(index, 1)
    try { fs.unlinkSync(path.join(uploadDir, file.storageKey)) } catch {}
    return file
  })
  if (!removed) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  try { await removeStoredObject(removed.storageKey); fs.unlinkSync(path.join(uploadDir, removed.storageKey)) } catch {}
  res.json({ ok: true })
})

app.post('/api/student/dossiers/:taskId/files', requireStudent, async (req, res, next) => {
  if (!(await getStudentTask(req.student.studentId, req.params.taskId))) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  upload.single('file')(req, res, (error) => {
    if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
    next()
  })
}, async (req, res) => {
  const file = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: req.params.taskId, role: 'SUPPORTING', originalName: path.basename(req.file.originalname), storageKey: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, state: 'READY', createdAt: now() }
  try { await persistUpload(req.file, file.storageKey) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.') }
  await withTaskStore((store) => store.files.push(file))
  res.status(201).json({ file: { id: file.id, name: file.originalName, type: file.mimeType, size: file.size, role: file.role, origin: 'student', taskId: file.taskId, createdAt: file.createdAt } })
})

app.put('/api/student/files/:fileId/replace', requireStudent, async (req, res, next) => {
  if (!(await ownedFile(req.student.studentId, req.params.fileId))) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  upload.single('file')(req, res, (error) => {
    if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
    next()
  })
}, async (req, res) => {
  try { await persistUpload(req.file, req.file.filename) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The replacement file could not be stored securely.') }
  const replacement = await withTaskStore((store) => {
    const file = store.files.find((item) => item.id === req.params.fileId && item.studentId === req.student.studentId)
    if (!file) return null
    const previousKey = file.storageKey
    Object.assign(file, { originalName: path.basename(req.file.originalname), storageKey: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, state: 'READY', updatedAt: now() })
    return { file, previousKey }
  })
  if (!replacement) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  try { await removeStoredObject(replacement.previousKey); fs.unlinkSync(path.join(uploadDir, replacement.previousKey)) } catch {}
  res.json({ file: { id: replacement.file.id, name: replacement.file.originalName, type: replacement.file.mimeType, size: replacement.file.size, role: replacement.file.role, origin: 'student', taskId: replacement.file.taskId, createdAt: replacement.file.createdAt } })
})

app.post('/api/student/task-creation/analyze', requireStudent, async (req, res) => {
  if (!limited(`analysis:${req.student.studentId}`, 5)) return safeError(res, 429, 'ANALYSIS_RATE_LIMITED', 'Analysis requests are temporarily limited. Please try again shortly.')
  const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(String) : []
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => fileIds.includes(file.id) && !file.taskId)
  if (!files.some((file) => file.role === 'BRIEF')) return safeError(res, 400, 'BRIEF_REQUIRED', 'Upload an assignment brief before analysis.', { files: 'An assignment brief is required.' })
  let result
  try { result = await analyzeWithSolvy(files) } catch (error) { return safeError(res, 502, 'ANALYSIS_FAILED', 'Solvy could not analyze these files. Your uploads are preserved; please retry.', {}, error) }
  const analysis = { id: crypto.randomUUID(), studentId: req.student.studentId, fileIds: files.map((file) => file.id), status: 'COMPLETED', result, createdAt: now(), updatedAt: now() }
  await withTaskStore((store) => { store.analyses.push(analysis); addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, type: 'AnalysisCompleted', text: 'Task analysis completed.', createdAt: analysis.createdAt }) })
  publish(req.student.studentId, { type: 'AnalysisCompleted', analysisId: analysis.id, status: analysis.status })
  res.status(201).json({ analysis: { ...analysis.result, id: analysis.id, status: analysis.status } })
})

app.post('/api/student/task-creation/tasks', requireStudent, async (req, res) => {
  const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim()
  if (!idempotencyKey) return safeError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'A task creation key is required.')
  const state = await readTaskStore()
  const existing = state.idempotency[`${req.student.studentId}:${idempotencyKey}`]
  if (existing) return res.status(200).json({ task: await studentTaskPayload(existing, req.student.studentId), replayed: true })
  const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(String) : []
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => fileIds.includes(file.id) && !file.taskId)
  if (!files.some((file) => file.role === 'BRIEF')) return safeError(res, 400, 'BRIEF_REQUIRED', 'An assignment brief is required.', { fileIds: 'Select an assignment brief.' })
  const analysis = req.body?.analysis || {}
  const createdAt = now()
  const task = { id: crypto.randomUUID(), studentId: req.student.studentId, title: String(analysis.title || 'New academic task').slice(0, 200), type: analysis.taskType || 'Academic task', subject: analysis.subject || null, deadline: analysis.deadline || null, status: 'FEASIBILITY_REVIEW', createdAt, updatedAt: createdAt, latestUpdate: { text: 'Your task has been submitted for SolveNest review.', createdAt }, analysis: { ...analysis, provisional: true }, review: { status: 'QUEUED', reviewerId: null, reviewedAt: null, decision: null }, nextAction: null }
  await withTaskStore((store) => {
    store.tasks.push(task)
    store.reviews.push({ id: crypto.randomUUID(), taskId: task.id, studentId: req.student.studentId, status: 'QUEUED', reviewerId: null, reviewedAt: null, decision: null, createdAt })
    store.files = store.files.map((file) => fileIds.includes(file.id) && file.studentId === req.student.studentId ? { ...file, taskId: task.id } : file)
    store.idempotency[`${req.student.studentId}:${idempotencyKey}`] = task
    addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, type: 'TaskSubmittedForReview', text: 'Your task has been submitted for SolveNest review.', createdAt })
  })
  await addNotification({ id: crypto.randomUUID(), studentId: req.student.studentId, title: 'Task submitted for review', body: task.latestUpdate.text, task: { title: task.title, ref: task.id }, route: `/student/tasks?task=${task.id}`, isRead: false, requiresAction: false, createdAt })
  const summary = await studentTaskPayload(task, req.student.studentId)
  publish(req.student.studentId, { type: 'TaskSubmittedForReview', task: summary })
  res.status(201).json({ task: summary, nextAction: null })
})

app.get('/api/student/tasks', requireStudent, async (req, res) => {
  const tasks = await Promise.all((await getStudentTasks(req.student.studentId)).map((task) => studentTaskPayload(task, req.student.studentId)))
  res.json({ tasks, meta: { page: Number(req.query.page || 1), perPage: Number(req.query.per_page || 20), total: tasks.length } })
})

app.get('/api/student/tasks/:taskId/preview', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ task: await studentTaskPayload(task, req.student.studentId) })
})

app.get('/api/student/dossiers', requireStudent, async (req, res) => {
  const dossiers = await Promise.all((await getStudentTasks(req.student.studentId)).map(async (task) => { const files = await getStudentFiles(req.student.studentId, task.id); return { id: task.id, taskId: task.id, title: task.title, subject: task.subject, status: task.status, deadline: task.deadline, sourceFiles: files.map((file) => ({ id: file.id, name: file.originalName, role: file.role, type: file.mimeType, size: file.size, origin: 'student', state: file.state, createdAt: file.createdAt, taskId: task.id })), exchangeFiles: [], deliveryVersions: [], fileCount: files.length, lastActivityAt: task.updatedAt, hasNewDelivery: false } }))
  res.json({ dossiers, meta: { total: dossiers.length } })
})

app.get('/api/student/dossiers/:taskId', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const files = await getStudentFiles(req.student.studentId, task.id)
  res.json({ dossier: { id: task.id, taskId: task.id, title: task.title, subject: task.subject, status: task.status, deadline: task.deadline, sourceFiles: files.map((file) => ({ id: file.id, name: file.originalName, role: file.role, type: file.mimeType, size: file.size, origin: 'student', state: file.state, createdAt: file.createdAt, taskId: task.id })), exchangeFiles: [], deliveryVersions: [], fileCount: files.length, lastActivityAt: task.updatedAt, hasNewDelivery: false } })
})

app.get('/api/student/dashboard', requireStudent, async (req, res) => {
  const tasks = await Promise.all((await getStudentTasks(req.student.studentId)).map((task) => studentTaskPayload(task, req.student.studentId)))
  const notifications = await listNotifications(req.student.studentId)
  const activity = (await readTaskStore()).activity.filter((item) => item.studentId === req.student.studentId).slice(0, 10)
  res.json({ student: { id: req.student.studentId, name: req.student.name, role: req.student.role, email: req.student.email || null }, tasks, notifications, recentActivity: activity, upcomingActions: [], unreadMessages: 0 })
})

app.get('/api/student/conversations', requireStudent, async (req, res) => {
  const tasks = await getStudentTasks(req.student.studentId)
  const conversations = await withTaskStore((store) => tasks.map((task) => {
    let existing = store.conversations.find((item) => item.studentId === req.student.studentId && item.taskId === task.id)
    if (!existing) { existing = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, taskTitle: task.title, taskRef: task.id, subject: task.subject, status: task.status, state: 'active', needsStudent: false, unread: 0, participant: { name: 'SolveNest', role: 'Support', initials: 'SN' }, lastMessage: null, createdAt: task.createdAt, updatedAt: task.updatedAt }; store.conversations.push(existing) }
    const messages = store.messages.filter((message) => message.conversationId === existing.id)
    return { ...existing, lastMessage: messages.at(-1) || existing.lastMessage }
  }))
  res.json({ conversations })
})

app.get('/api/student/conversations/:conversationId/messages', requireStudent, async (req, res) => {
  const state = await readTaskStore()
  const conversation = state.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
  if (!conversation) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  const messages = state.messages.filter((message) => message.conversationId === conversation.id)
  res.json({ messages, meta: { total: messages.length, page: Number(req.query.page || 1), perPage: Number(req.query.per_page || 50) } })
})

app.post('/api/student/conversations/:conversationId/messages', requireStudent, async (req, res) => {
  const text = String(req.body?.body || '').trim()
  if (!text || text.length > 4000) return safeError(res, 400, 'MESSAGE_INVALID', 'Message must be between 1 and 4000 characters.', { body: 'Enter a message.' })
  const message = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
    if (!conversation) return null
    const item = { id: crypto.randomUUID(), conversationId: conversation.id, studentId: req.student.studentId, from: 'student', author: req.student.name, role: 'Student', initials: req.student.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), body: text, attachments: [], createdAt: now(), status: 'sent' }
    store.messages.push(item)
    conversation.lastMessage = item
    conversation.updatedAt = item.createdAt
    addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: conversation.taskId, type: 'StudentMessageSent', text: 'Message sent to SolveNest.', createdAt: item.createdAt })
    return item
  })
  if (!message) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  publish(req.student.studentId, { type: 'MessageCreated', message })
  res.status(201).json({ message })
})

app.patch('/api/student/conversations/:conversationId/read', requireStudent, async (req, res) => {
  const changed = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
    if (!conversation) return false
    conversation.unread = 0
    return true
  })
  if (!changed) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  res.json({ ok: true })
})

app.post('/api/student/conversations/:conversationId/files', requireStudent, (req, res, next) => {
  upload.single('file')(req, res, async (error) => {
    if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
    const state = await readTaskStore()
    const conversation = state.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
    if (!conversation) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
    const file = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: conversation.taskId, conversationId: conversation.id, role: 'MESSAGE_ATTACHMENT', originalName: path.basename(req.file.originalname), storageKey: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, state: 'READY', createdAt: now() }
    try { await persistUpload(req.file, file.storageKey) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.') }
    await withTaskStore((store) => store.files.push(file))
    res.status(201).json({ file: { id: file.id, name: file.originalName, type: file.mimeType, size: file.size, uploadedBy: 'student', uploadedAt: file.createdAt } })
  })
})

app.get('/api/student/payments/tasks', requireStudent, async (req, res) => {
  const tasks = await getStudentTasks(req.student.studentId)
  const state = await readTaskStore()
  const rows = tasks.map((task) => ({ id: task.id, taskId: task.id, title: task.title, status: task.status, amountDue: task.amountDue || null, funding: task.funding || null, plan: state.plans.find((plan) => plan.taskId === task.id && plan.studentId === req.student.studentId) || null, paymentStatus: state.payments.find((payment) => payment.taskId === task.id && payment.studentId === req.student.studentId)?.status || null }))
  res.json({ tasks: rows })
})

app.get('/api/student/payments/tasks/:taskId/plan', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const plan = (await readTaskStore()).plans.find((item) => item.taskId === req.params.taskId && item.studentId === req.student.studentId)
  if (!task || !plan) return safeError(res, 404, 'PLAN_NOT_FOUND', 'No official plan is available yet.')
  res.json({ plan })
})

app.post('/api/student/payments/plans/:planId/accept', requireStudent, async (req, res) => {
  const plan = await withTaskStore((store) => { const item = store.plans.find((candidate) => candidate.id === req.params.planId && candidate.studentId === req.student.studentId); if (item) item.status = 'ACCEPTED'; return item || null })
  if (!plan) return safeError(res, 404, 'PLAN_NOT_FOUND', 'Plan not found.')
  res.json({ plan })
})

app.get('/api/student/payments/tasks/:taskId/funding', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const state = await readTaskStore()
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ taskId: task.id, milestones: state.plans.find((plan) => plan.taskId === task.id)?.milestones || [], providerAvailable: Boolean(stripe) })
})

app.post('/api/student/payments/checkout', requireStudent, async (req, res) => {
  if (!stripe) return safeError(res, 503, 'PROVIDER_UNAVAILABLE', 'Payments are not configured yet.')
  const task = await getStudentTask(req.student.studentId, req.body?.taskId)
  const plan = (await readTaskStore()).plans.find((item) => item.id === req.body?.planId && item.studentId === req.student.studentId)
  const amount = Number(plan?.amount || task?.amountDue || 0)
  if (!task || !amount) return safeError(res, 400, 'PAYMENT_AMOUNT_REQUIRED', 'There is no payable official plan for this task.')
  const key = String(req.body?.idempotencyKey || crypto.randomUUID())
  const existing = (await readTaskStore()).payments.find((payment) => payment.studentId === req.student.studentId && payment.idempotencyKey === key)
  if (existing) return res.json({ paymentId: existing.id, status: existing.status, provider: 'stripe' })
  const intent = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency: process.env.STRIPE_CURRENCY || 'lkr', metadata: { taskId: task.id, studentId: req.student.studentId } }, { idempotencyKey: key })
  const payment = { id: crypto.randomUUID(), providerId: intent.id, studentId: req.student.studentId, taskId: task.id, planId: plan?.id || null, amount, currency: process.env.STRIPE_CURRENCY || 'lkr', status: intent.status, idempotencyKey: key, createdAt: now() }
  await withTaskStore((store) => store.payments.push(payment))
  res.status(201).json({ paymentId: payment.id, clientSecret: intent.client_secret, provider: 'stripe', status: payment.status })
})

app.get('/api/student/payments/payments/:paymentId/status', requireStudent, async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment) return safeError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  if (stripe && payment.providerId) { const intent = await stripe.paymentIntents.retrieve(payment.providerId); payment.status = intent.status; await withTaskStore((store) => { const item = store.payments.find((entry) => entry.id === payment.id); if (item) item.status = intent.status }) }
  res.json(payment)
})

app.get('/api/student/payments/history', requireStudent, async (req, res) => {
  const payments = (await readTaskStore()).payments.filter((item) => item.studentId === req.student.studentId && (!req.query.task || item.taskId === req.query.task))
  res.json({ payments })
})

app.get('/api/student/payments/payments/:paymentId', requireStudent, async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment) return safeError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  res.json(payment)
})

app.get('/api/student/payments/payments/:paymentId/receipt', requireStudent, async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment || payment.status !== 'succeeded') return safeError(res, 404, 'RECEIPT_NOT_FOUND', 'Receipt is not available yet.')
  res.json({ url: null, filename: `solvenest-receipt-${payment.id}.pdf` })
})

app.get('/api/student/payments/tasks/:taskId/scope-change', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const change = (await readTaskStore()).scopeChanges.find((item) => item.taskId === req.params.taskId && item.studentId === req.student.studentId && item.status !== 'ACCEPTED')
  if (!task || !change) return safeError(res, 404, 'SCOPE_CHANGE_NOT_FOUND', 'No scope change is waiting for you.')
  res.json({ scopeChange: change })
})

app.post('/api/student/payments/scope-changes/:scopeChangeId/accept', requireStudent, async (req, res) => {
  const change = await withTaskStore((store) => { const item = store.scopeChanges.find((candidate) => candidate.id === req.params.scopeChangeId && candidate.studentId === req.student.studentId); if (item) item.status = 'ACCEPTED'; return item || null })
  if (!change) return safeError(res, 404, 'SCOPE_CHANGE_NOT_FOUND', 'Scope change not found.')
  res.json({ scopeChange: change })
})

app.post('/api/student/explain/tasks/:taskId/explain', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (!limited(`explain:${req.student.studentId}`, 30)) return safeError(res, 429, 'EXPLAIN_RATE_LIMITED', 'Explain requests are temporarily limited.')
  const state = await readTaskStore()
  let session = state.explainSessions.find((item) => item.id === req.body?.sessionId && item.studentId === req.student.studentId)
  if (!session) { session = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, mode: req.body?.mode || 'explain', title: task.title, artifactId: req.body?.artifactId || null, trail: [], createdAt: now(), updatedAt: now() }; await withTaskStore((store) => store.explainSessions.push(session)) }
  try {
    const result = await solvyOperation('explain', { taskId: task.id, sessionId: session.id, artifactId: req.body?.artifactId || null, mode: req.body?.mode || 'explain', selection: req.body?.selection || null, question: req.body?.question || null, prompt: req.body?.prompt || null, answers: req.body?.answers || null, scope: req.body?.scope || null, round: req.body?.round || null })
    await withTaskStore((store) => { const item = store.explainSessions.find((entry) => entry.id === session.id); if (item) Object.assign(item, { updatedAt: now(), lastResult: result }) })
    res.json({ ...result, sessionId: session.id })
  } catch (error) { safeError(res, 503, 'EXPLAIN_UNAVAILABLE', 'Explain & Defend is not configured or temporarily unavailable.') }
})

app.get('/api/student/explain/tasks/:taskId/rubric', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ criteria: task.analysis?.rubric?.criteria || [], source: task.analysis?.rubric?.sourceFileId || null })
})

app.get('/api/student/explain/tasks/:taskId/sessions', requireStudent, async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const sessions = (await readTaskStore()).explainSessions.filter((item) => item.taskId === task.id && item.studentId === req.student.studentId)
  res.json({ sessions })
})

app.get('/api/student/explain/sessions/:sessionId', requireStudent, async (req, res) => {
  const session = (await readTaskStore()).explainSessions.find((item) => item.id === req.params.sessionId && item.studentId === req.student.studentId)
  if (!session) return safeError(res, 404, 'EXPLAIN_SESSION_NOT_FOUND', 'Explain session not found.')
  res.json({ session })
})

app.patch('/api/student/explain/sessions/:sessionId', requireStudent, async (req, res) => {
  const session = await withTaskStore((store) => { const item = store.explainSessions.find((candidate) => candidate.id === req.params.sessionId && candidate.studentId === req.student.studentId); if (item) Object.assign(item, { ...req.body, id: item.id, studentId: item.studentId, taskId: item.taskId, updatedAt: now() }); return item || null })
  if (!session) return safeError(res, 404, 'EXPLAIN_SESSION_NOT_FOUND', 'Explain session not found.')
  res.json({ session })
})

app.get('/api/student/explain/usage', requireStudent, async (req, res) => {
  const state = await readTaskStore()
  const since = Date.now() - 24 * 60 * 60 * 1000
  const used = state.activity.filter((item) => item.studentId === req.student.studentId && item.type === 'ExplainRequest' && new Date(item.createdAt).getTime() > since).length
  const limit = Number(process.env.EXPLAIN_DAILY_LIMIT || 30)
  res.json({ remaining: Math.max(0, limit - used), limit, periodLabel: 'Today' })
})

app.get('/api/student/explain/artifacts/:artifactId/content', requireStudent, async (req, res) => {
  const file = await ownedFile(req.student.studentId, req.params.artifactId)
  if (!file) return safeError(res, 404, 'ARTIFACT_NOT_FOUND', 'Artifact not found.')
  const url = await signedObjectUrl(file.storageKey, file.originalName)
  res.json({ kind: 'document', title: file.originalName, sourceUrl: url, text: null })
})

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
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
}

function setSupabaseCookies(res, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', [`sn_access=${encodeURIComponent(session.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expires_in || 3600}${secure}`, `sn_refresh=${encodeURIComponent(session.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`])
}

function clearSupabaseCookies(res) {
  res.append('Set-Cookie', 'sn_access=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  res.append('Set-Cookie', 'sn_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
}

async function ensureStudentSession(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  if (hasSupabaseAuth()) {
    let user = await supabaseUser(cookies.sn_access)
    if (!user && cookies.sn_refresh) {
      const session = await supabaseRefresh(cookies.sn_refresh)
      if (session) { setSupabaseCookies(res, session); user = await supabaseUser(session.access_token) }
    }
    if (user) {
      const profile = await supabaseProfile(user.id)
      if (profile?.role === 'Student') return { id: user.id, role: 'Student', studentId: user.id, name: profile.name || user.user_metadata?.name || 'Student', email: user.email || null, device: userAgentLabel(req.headers['user-agent']) }
    }
    const err = new Error('STUDENT_ACCESS_REQUIRED')
    err.status = 401
    throw err
  }
  let sid = cookies[COOKIE]
  if (sid) {
    const session = getSession(sid)
    if (session) {
    session.device = userAgentLabel(req.headers['user-agent'])
    return session
    }
  }

  if (process.env.DEV_DEMO_SESSION !== '1') {
    const err = new Error('STUDENT_ACCESS_REQUIRED')
    err.status = 401
    throw err
  }

  sid = crypto.randomUUID()
  const now = new Date().toISOString()
  const session = {
    id: sid,
    role: 'Student',
    studentId: 'demo-student',
    name: 'Demo Student',
    createdAt: now,
    lastActiveAt: now,
    device: userAgentLabel(req.headers['user-agent']),
  }
  createSession({ id: session.studentId, role: session.role, name: session.name, email: null }, session.device)
  setSessionCookie(res, sid)
  return session
}

function userAgentLabel(agent = '') {
  const text = String(agent || '')
  if (!text) return 'This device'
  if (/iPhone|iPad/i.test(text)) return 'iOS device'
  if (/Android/i.test(text)) return 'Android device'
  if (/Windows/i.test(text)) return 'Windows device'
  if (/Macintosh|Mac OS/i.test(text)) return 'Mac device'
  if (/Linux/i.test(text)) return 'Linux device'
  return 'This device'
}

function studentSessionList(studentId, activeSessionId) {
  return listSessions(studentId)
    .map((session) => ({
      id: session.id,
      device: session.device || 'This device',
      lastActiveAt: session.lastActiveAt || session.createdAt || null,
      current: session.id === activeSessionId,
    }))
    .sort((a, b) => String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || '')))
}

function requireStudent(req, res, next) {
  ensureStudentSession(req, res).then((student) => {
    req.student = student
    if (req.student.role !== 'Student') throw Object.assign(new Error('STUDENT_ACCESS_REQUIRED'), { status: 403 })
    next()
  }).catch((error) => {
    res.status(error.status || 401).json({ error: 'STUDENT_ACCESS_REQUIRED' })
  })
}

function ensureExpertSession(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const sid = cookies[EXPERT_COOKIE]
  if (sid && expertSessions.has(sid)) {
    const session = expertSessions.get(sid)
    session.lastActiveAt = now()
    session.device = userAgentLabel(req.headers['user-agent'])
    return session
  }
  if (process.env.NODE_ENV === 'production' || process.env.STRICT_SESSION === '1') {
    throw Object.assign(new Error('EXPERT_ACCESS_REQUIRED'), { status: 401 })
  }
  const newSid = crypto.randomUUID()
  const stamp = now()
  const session = {
    id: newSid,
    role: 'Expert',
    expertId: 'demo-expert',
    studentId: 'demo-expert',
    name: 'Alex Morgan',
    email: null,
    createdAt: stamp,
    lastActiveAt: stamp,
    device: userAgentLabel(req.headers['user-agent']),
  }
  expertSessions.set(newSid, session)
  res.setHeader('Set-Cookie', `${EXPERT_COOKIE}=${newSid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  return session
}

app.post('/api/expert/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim()
  const password = String(req.body?.password || '')
  if (!email || !password) return safeError(res, 400, 'CREDENTIALS_REQUIRED', 'Enter your email and password.')
  if (!limited(`expert-login:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth()) return safeError(res, 503, 'EXPERT_LOGIN_UNAVAILABLE', 'Expert sign-in is not configured yet.')
  try {
    const { data, error } = await supabaseSignIn({ email, password })
    if (error || !data?.user) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
    const profile = await supabaseProfile(data.user.id)
    if (profile?.role !== 'Expert') return safeError(res, 403, 'EXPERT_ACCESS_REQUIRED', 'This account does not have Expert access.')
    const workspace = await expertWorkspaceView()
    if (workspace.expert.id !== profile.id) return safeError(res, 403, 'EXPERT_WORKSPACE_UNAVAILABLE', 'No Expert workspace is assigned to this account yet.')
    const sid = crypto.randomUUID()
    const stamp = now()
    expertSessions.set(sid, { id: sid, role: 'Expert', expertId: profile.id, studentId: profile.id, name: profile.name, email: profile.email, createdAt: stamp, lastActiveAt: stamp, device: userAgentLabel(req.headers['user-agent']) })
    res.setHeader('Set-Cookie', `${EXPERT_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
    res.json({ user: { id: profile.id, role: 'Expert', name: profile.name, email: profile.email } })
  } catch (error) {
    console.error('[expert-login]', error)
    safeError(res, 503, 'EXPERT_LOGIN_UNAVAILABLE', 'Expert sign-in could not be completed. Please try again later.')
  }
})

function requireExpert(req, res, next) {
  try {
    req.expert = ensureExpertSession(req, res)
    next()
  } catch (error) {
    res.status(error.status || 401).json({ error: 'EXPERT_ACCESS_REQUIRED' })
  }
}

function expertRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      console.error(`[expert] ${req.method} ${req.originalUrl}`, error)
      if (res.headersSent) return
      safeError(res, 500, 'EXPERT_LOAD_FAILED', 'The expert workspace could not be loaded.')
    })
  }
}

async function expertWorkspaceView() {
  return toExpertWorkspace(await readExpertStore())
}

app.get('/api/expert/me', requireExpert, expertRoute(async (req, res) => {
  const workspace = await expertWorkspaceView()
  res.json({
    user: { id: req.expert.expertId, role: 'Expert', name: workspace.expert.name, email: req.expert.email || null },
    accountState: workspace.accountState,
    availability: workspace.availability,
    expert: workspace.expert,
  })
}))

app.get('/api/expert/dashboard', requireExpert, expertRoute(async (_req, res) => {
  res.json(await expertWorkspaceView())
}))

app.get('/api/expert/availability', requireExpert, expertRoute(async (_req, res) => {
  res.json({ availability: (await expertWorkspaceView()).availability })
}))

app.patch('/api/expert/availability', requireExpert, expertRoute(async (req, res) => {
  const status = String(req.body?.status || '')
  if (!['available', 'limited', 'unavailable'].includes(status)) {
    return safeError(res, 400, 'AVAILABILITY_INVALID', 'Choose Available, Limited, or Unavailable.')
  }
  const availability = await setAvailability(status)
  res.json({ ok: true, availability })
}))

function publishExpert(expertId, type, payload) {
  const listeners = expertSessions.get('__sse__')?.get(expertId)
  if (!listeners || !listeners.size) return
  const data = JSON.stringify({ type, ...payload })
  for (const response of listeners) {
    if (!response.writableEnded) response.write(`event: ${type}\ndata: ${data}\n\n`)
  }
}

const EXPERT_ERROR_STATUS = {
  ASSIGNMENT_NOT_FOUND: 404,
  ASSIGNMENT_CLOSED: 409,
  ASSIGNMENT_NOT_DELIVERED: 409,
  UPDATE_INVALID: 400,
  MESSAGE_INVALID: 400,
  WORK_STATE_INVALID: 400,
  WORK_STATE_LOCKED: 409,
  QA_IN_REVIEW: 409,
  QA_ALREADY_PENDING: 409,
  QA_ALREADY_APPROVED: 409,
  QA_FEEDBACK_OPEN: 409,
  QA_NOT_PENDING: 409,
  QA_APPROVAL_REQUIRED: 409,
  QA_FILES_REQUIRED: 409,
  QA_OUTCOME_INVALID: 400,
  QA_FEEDBACK_REQUIRED: 400,
  FEEDBACK_NOT_FOUND: 404,
  FEEDBACK_ALREADY_RESOLVED: 409,
  DELIVERY_FILES_REQUIRED: 409,
  FILE_SECTION_INVALID: 400,
  FILE_REQUIRED: 400,
  FILE_NOT_FOUND: 404,
  FILE_IMMUTABLE: 403,
  FILE_TOO_LARGE: 400,
  FILE_UPLOAD_REJECTED: 400,
  TITLE_REQUIRED: 400,
}

const EXPERT_ERROR_MESSAGE = {
  ASSIGNMENT_NOT_FOUND: 'Assignment not found.',
  ASSIGNMENT_CLOSED: 'This assignment is closed. Start a revision to reopen it.',
  ASSIGNMENT_NOT_DELIVERED: 'This assignment has not been delivered yet.',
  UPDATE_INVALID: 'Progress updates must be between 1 and 4000 characters.',
  MESSAGE_INVALID: 'Messages must be between 1 and 4000 characters.',
  WORK_STATE_INVALID: 'That work state is not available for this assignment.',
  WORK_STATE_LOCKED: 'The work state cannot change while the assignment is in its current stage.',
  QA_IN_REVIEW: 'Quality review is in progress. Wait for the review outcome.',
  QA_ALREADY_PENDING: 'This assignment is already in quality review.',
  QA_ALREADY_APPROVED: 'Quality review is already approved. Prepare the delivery.',
  QA_FEEDBACK_OPEN: 'Resolve every QA feedback item before resubmitting.',
  QA_NOT_PENDING: 'No quality review is currently pending for this assignment.',
  QA_APPROVAL_REQUIRED: 'Quality review must approve this work before delivery.',
  QA_FILES_REQUIRED: 'Add at least one submission file before submitting for QA.',
  QA_OUTCOME_INVALID: 'That quality review outcome is not valid.',
  QA_FEEDBACK_REQUIRED: 'QA feedback items are required for this outcome.',
  FEEDBACK_NOT_FOUND: 'That feedback item was not found.',
  FEEDBACK_ALREADY_RESOLVED: 'That feedback item is already resolved.',
  DELIVERY_FILES_REQUIRED: 'Add at least one submission file before delivering.',
  FILE_SECTION_INVALID: 'Files can only be uploaded to the working or submission section.',
  FILE_REQUIRED: 'Choose a file to upload.',
  FILE_NOT_FOUND: 'File not found.',
  FILE_IMMUTABLE: 'Files provided with the assignment cannot be removed.',
  FILE_TOO_LARGE: 'File exceeds the 100 MB limit.',
  FILE_UPLOAD_REJECTED: 'This file type is not supported.',
  TITLE_REQUIRED: 'An assignment title is required.',
}

function expertMutationError(res, code) {
  return safeError(res, EXPERT_ERROR_STATUS[code] || 400, code, EXPERT_ERROR_MESSAGE[code] || 'The request could not be completed.')
}

function expertChanged(req, result, extra = {}) {
  publishExpert(req.expert.expertId, 'AssignmentChanged', {
    assignmentId: req.params.assignmentId,
    workState: result.workState || null,
    at: result.updatedAt || now(),
    ...extra,
  })
}

app.get('/api/expert/assignments', requireExpert, expertRoute(async (req, res) => {
  const result = await queryAssignments({ search: req.query.search, filter: req.query.filter, sort: req.query.sort })
  res.json({ assignments: result.assignments, meta: { total: result.total, filtered: result.assignments.length } })
}))

app.get('/api/expert/assignments/:assignmentId', requireExpert, expertRoute(async (req, res) => {
  const assignment = await getAssignmentDetail(req.params.assignmentId)
  if (!assignment) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json({ assignment })
}))

app.get('/api/expert/assignments/:assignmentId/requirements', requireExpert, expertRoute(async (req, res) => {
  const payload = await getAssignmentRequirements(req.params.assignmentId)
  if (!payload) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(payload)
}))

app.get('/api/expert/assignments/:assignmentId/work', requireExpert, expertRoute(async (req, res) => {
  const payload = await getAssignmentWork(req.params.assignmentId)
  if (!payload) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(payload)
}))

app.get('/api/expert/assignments/:assignmentId/messages', requireExpert, expertRoute(async (req, res) => {
  const payload = await getAssignmentMessages(req.params.assignmentId)
  if (!payload) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(payload)
}))

app.get('/api/expert/assignments/:assignmentId/files', requireExpert, expertRoute(async (req, res) => {
  const payload = await getAssignmentFiles(req.params.assignmentId)
  if (!payload) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(payload)
}))

app.get('/api/expert/assignments/:assignmentId/qa', requireExpert, expertRoute(async (req, res) => {
  const payload = await getAssignmentQa(req.params.assignmentId)
  if (!payload) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(payload)
}))

app.post('/api/expert/assignments/:assignmentId/work/updates', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-update:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many updates. Try again shortly.')
  const result = await appendProgressUpdate(req.params.assignmentId, req.body?.body)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  res.status(201).json(result)
}))

app.post('/api/expert/assignments/:assignmentId/work/state', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-state:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many changes. Try again shortly.')
  const result = await updateAssignmentWorkState(req.params.assignmentId, req.body?.state)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/messages', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-message:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Too many messages. Try again shortly.')
  const result = await postAssignmentMessage(req.params.assignmentId, req.body?.body)
  if (!result.ok) return expertMutationError(res, result.error)
  publishExpert(req.expert.expertId, 'MessageCreated', { assignmentId: req.params.assignmentId, message: result.message })
  expertChanged(req, { updatedAt: result.message.createdAt })
  res.status(201).json(result)
}))

app.patch('/api/expert/assignments/:assignmentId/messages/read', requireExpert, expertRoute(async (req, res) => {
  const result = await markAssignmentMessagesRead(req.params.assignmentId)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, { updatedAt: now() })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/files', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-upload:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Uploads are temporarily limited. Try again shortly.')
  const uploadError = await new Promise((resolve) => upload.single('file')(req, res, (error) => resolve(error)))
  if (uploadError) {
    const code = uploadError.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_REJECTED'
    return expertMutationError(res, code)
  }
  if (!req.file) return expertMutationError(res, 'FILE_UPLOAD_REJECTED')
  try {
    await persistUpload(req.file, req.file.filename)
  } catch {
    return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.')
  }
  const result = await addAssignmentFile(req.params.assignmentId, req.body?.section, {
    name: path.basename(req.file.originalname),
    type: req.file.mimetype,
    size: req.file.size,
    storageKey: req.file.filename,
  })
  if (!result.ok) {
    try { await removeStoredObject(req.file.filename) } catch {}
    try { fs.unlinkSync(path.join(uploadDir, req.file.filename)) } catch {}
    return expertMutationError(res, result.error)
  }
  expertChanged(req, result)
  res.status(201).json(result)
}))

app.delete('/api/expert/assignments/:assignmentId/files/:fileId', requireExpert, expertRoute(async (req, res) => {
  const result = await removeAssignmentFile(req.params.assignmentId, req.params.fileId)
  if (!result.ok) return expertMutationError(res, result.error)
  if (result.storageKey) {
    try { await removeStoredObject(result.storageKey) } catch {}
    try { fs.unlinkSync(path.join(uploadDir, result.storageKey)) } catch {}
  }
  expertChanged(req, result)
  res.json({ ok: true })
}))

app.get('/api/expert/files/:fileId/access', requireExpert, expertRoute(async (req, res) => {
  const file = await findExpertFile(req.params.fileId)
  if (!file) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  const objectUrl = await signedObjectUrl(file.storageKey, file.name)
  res.json({ signedUrl: objectUrl || signedExpertFileUrl(file.id), expiresAt: Date.now() + 10 * 60 * 1000 })
}))

app.get('/api/expert/files/:fileId/download', requireExpert, expertRoute(async (req, res) => {
  const file = await findExpertFile(req.params.fileId)
  const expiresAt = Number(req.query.expires)
  const providedToken = Buffer.from(String(req.query.token || ''))
  const expectedToken = Buffer.from(file ? fileSignature(file.id, expiresAt) : '')
  const valid = file && providedToken.length === expectedToken.length && Number.isFinite(expiresAt) && expiresAt > Date.now() && crypto.timingSafeEqual(providedToken, expectedToken)
  if (!valid) return safeError(res, 403, 'FILE_ACCESS_DENIED', 'This file access link has expired or is invalid.')
  if (hasObjectStorage()) return safeError(res, 409, 'OBJECT_STORAGE_REDIRECT_REQUIRED', 'Use the signed object-storage URL.')
  const storagePath = path.join(uploadDir, file.storageKey || '')
  if (!file.storageKey || !fs.existsSync(storagePath)) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
  res.download(storagePath, file.name)
}))

app.post('/api/expert/assignments/:assignmentId/qa/submit', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await submitAssignmentForQa(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/feedback/:feedbackId/resolve', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await resolveQaFeedback(req.params.assignmentId, req.params.feedbackId)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/resubmit', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await resubmitAssignmentForQa(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/delivery', requireExpert, expertRoute(async (req, res) => {
  if (!limited(`expert-delivery:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Too many delivery attempts. Try again shortly.')
  const result = await deliverAssignment(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/revision/begin', requireExpert, expertRoute(async (req, res) => {
  const result = await beginAssignmentRevision(req.params.assignmentId)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/__provision', requireExpert, expertRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return safeError(res, 404, 'NOT_FOUND', 'Not found.')
  if (!limited(`expert-provision:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many provisioning requests. Try again shortly.')
  const result = await provisionAssignment(req.body || {})
  if (!result.ok) return expertMutationError(res, result.error)
  publishExpert(req.expert.expertId, 'AssignmentChanged', { assignmentId: result.assignment.id, workState: result.assignment.workState, at: now() })
  res.status(201).json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/outcome', requireExpert, expertRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return safeError(res, 404, 'NOT_FOUND', 'Not found.')
  if (!limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await applyQaOutcome(req.params.assignmentId, String(req.body?.outcome || ''), Array.isArray(req.body?.feedback) ? req.body.feedback : [])
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.get('/api/expert/available-tasks', requireExpert, expertRoute(async (req, res) => {
  const limit = Number(req.query.limit) || 3
  res.json({ tasks: await listAvailableTasks(limit) })
}))

app.post('/api/expert/available-tasks/__provision', requireExpert, expertRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return safeError(res, 404, 'NOT_FOUND', 'Not found.')
  if (!limited(`expert-provision:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many provisioning requests. Try again shortly.')
  const seeds = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body || {}]
  const result = await provisionAvailableTasks(seeds)
  if (!result.ok) return expertMutationError(res, result.error)
  res.status(201).json(result)
}))

app.post('/api/expert/available-tasks/:taskId/interest', requireExpert, expertRoute(async (req, res) => {
  const result = await expressInterest(req.params.taskId)
  if (!result.ok) {
    if (result.error === 'INTEREST_ALREADY_SENT') return safeError(res, 409, 'INTEREST_ALREADY_SENT', 'Interest was already recorded for this task.')
    return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  }
  publishExpert(req.expert.expertId, 'InterestChanged', { taskId: result.taskId, interestState: result.interestState, at: now() })
  res.status(201).json(result)
}))

app.get('/api/expert/movement', requireExpert, expertRoute(async (_req, res) => {
  res.json({ movement: await listMovement() })
}))

app.get('/api/expert/events', requireExpert, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: now() })}\n\n`)
  const key = req.expert.expertId
  const set = expertSessions.get('__sse__') || new Map()
  if (!set.has(key)) set.set(key, new Set())
  expertSessions.set('__sse__', set)
  const listeners = set.get(key)
  listeners.add(res)
  req.on('close', () => {
    listeners.delete(res)
    if (!listeners.size) set.delete(key)
  })
})

app.post('/api/expert/logout', requireExpert, (req, res) => {
  expertSessions.delete(req.expert.id)
  res.setHeader('Set-Cookie', `${EXPERT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'solvenest-server' })
})

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {}
  if (String(name || '').trim().length < 2) return safeError(res, 400, 'NAME_REQUIRED', 'Enter your full name.', { name: 'Enter your full name.' })
  if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) return safeError(res, 400, 'EMAIL_INVALID', 'Enter a valid email address.', { email: 'Enter a valid email address.' })
  if (String(password || '').length < 8) return safeError(res, 400, 'PASSWORD_TOO_SHORT', 'Password must be at least 8 characters.', { password: 'Use at least 8 characters.' })
  if (hasSupabaseAuth()) {
    const { data, error } = await supabaseSignUp({ name: String(name).trim(), email: String(email).trim(), password })
    if (error) return safeError(res, 400, 'AUTH_SIGNUP_FAILED', error.message)
    if (data.session) setSupabaseCookies(res, data.session)
    return res.status(data.session ? 201 : 202).json({ user: data.user ? { id: data.user.id, role: 'Student', name: data.user.user_metadata?.name || name, email: data.user.email } : null, emailConfirmationRequired: !data.session })
  }
  const user = createUser({ name, email, password })
  if (!user) return safeError(res, 409, 'EMAIL_IN_USE', 'An account already exists for that email.', { email: 'This email is already registered.' })
  const session = createSession(user, userAgentLabel(req.headers['user-agent']))
  setSessionCookie(res, session.id)
  sendEmail({ to: user.email, subject: 'Welcome to SolveNest', text: `Your SolveNest Student account is ready, ${user.name}.` }).catch((error) => console.error('[email]', error.message))
  res.status(201).json({ user })
})

app.post('/api/auth/login', async (req, res) => {
  if (hasSupabaseAuth()) {
    const { data, error } = await supabaseSignIn({ email: req.body?.email, password: req.body?.password })
    if (error || !data.session) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
    const profile = await supabaseProfile(data.user.id)
    if (profile?.role !== 'Student') return safeError(res, 403, 'STUDENT_ACCESS_REQUIRED', 'This account does not have Student access.')
    setSupabaseCookies(res, data.session)
    return res.json({ user: { id: data.user.id, role: 'Student', name: data.user.user_metadata?.name || data.user.email?.split('@')[0], email: data.user.email } })
  }
  const user = authenticateUser(req.body?.email, req.body?.password)
  if (!user) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
  const session = createSession(user, userAgentLabel(req.headers['user-agent']))
  setSessionCookie(res, session.id)
  res.json({ user })
})

app.post('/api/auth/password-reset', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return safeError(res, 400, 'EMAIL_INVALID', 'Enter a valid email address.')
  if (!limited(`password-reset:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth() || !process.env.PUBLIC_APP_URL) return safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Password recovery is not configured yet.')
  try {
    const { error } = await supabaseRequestPasswordReset(email)
    if (error) throw error
    res.json({ ok: true })
  } catch {
    safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'The reset email could not be requested. Please try again later.')
  }
})

app.post('/api/auth/password-reset/complete', async (req, res) => {
  const { accessToken, refreshToken, password } = req.body || {}
  if (!accessToken || !refreshToken || String(password || '').length < 8) return safeError(res, 400, 'RESET_INVALID', 'The reset link or new password is invalid.')
  if (!limited(`password-reset-complete:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth()) return safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Password recovery is not configured yet.')
  try {
    const { error } = await supabaseUpdatePassword(accessToken, refreshToken, password)
    if (error) return safeError(res, 400, 'RESET_INVALID', 'The reset link has expired or is invalid.')
    res.json({ ok: true })
  } catch {
    safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Your password could not be updated. Please try again later.')
  }
})

const contactUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, /\.(pdf|png|jpe?g|docx)$/i.test(file.originalname)) })
app.post('/api/contact', (req, res, next) => contactUpload.single('attachment')(req, res, (error) => error ? safeError(res, 400, 'ATTACHMENT_INVALID', 'Choose a PDF, PNG, JPG or DOCX file smaller than 5 MB.') : next()), async (req, res) => {
  const { intent, name, email, message, ...details } = req.body || {}
  if (!['general', 'task', 'payment', 'technical', 'business'].includes(intent) || !String(name || '').trim() || !/^\S+@\S+\.\S+$/.test(String(email || '')) || !String(message || '').trim()) return safeError(res, 400, 'CONTACT_INVALID', 'Complete the required contact fields.')
  if (!limited(`contact:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before sending another message.')
  if (!hasEmail() || !process.env.CONTACT_EMAIL) return safeError(res, 503, 'CONTACT_UNAVAILABLE', 'Contact messages are not configured yet.')
  const lines = [`Type: ${intent}`, `Name: ${String(name).trim()}`, `Email: ${String(email).trim()}`, ...Object.entries(details).filter(([, value]) => typeof value === 'string').map(([key, value]) => `${key}: ${value}`), '', String(message)]
  try {
    const result = await sendEmail({ to: process.env.CONTACT_EMAIL, subject: `SolveNest ${intent} enquiry`, text: lines.join('\n'), replyTo: String(email).trim(), attachments: req.file ? [{ filename: req.file.originalname, content: req.file.buffer }] : [] })
    if (!result.delivered) throw new Error('CONTACT_NOT_DELIVERED')
    res.status(202).json({ ok: true })
  } catch {
    safeError(res, 503, 'CONTACT_UNAVAILABLE', 'Your message could not be sent. Please try again later.')
  }
})

app.post('/api/auth/logout', requireStudent, (req, res) => {
  deleteSession(req.student.id)
  clearSupabaseCookies(res)
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})

app.get('/api/student/notifications', requireStudent, async (req, res) => {
  const notifications = await listNotifications(req.student.studentId)
  res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
    total: notifications.length,
  })
})

app.get('/api/student/notifications/unread-count', requireStudent, async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.student.studentId) })
})

app.patch('/api/student/notifications/:id/read', requireStudent, async (req, res) => {
  const item = await markRead(req.params.id, req.student.studentId)
  if (!item) {
    res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' })
    return
  }
  res.json({ ok: true, notification: item, unreadCount: await unreadCount(req.student.studentId) })
})

app.post('/api/student/notifications/read-all', requireStudent, async (req, res) => {
  const notifications = await markAllRead(req.student.studentId)
  res.json({ ok: true, notifications, unreadCount: 0 })
})

app.get('/api/student/account', requireStudent, (req, res) => {
  const catalog = getCatalog()
  res.json({
    account: getAccountView({
      student: req.student,
      sessions: studentSessionList(req.student.studentId, req.student.id),
      activeSessionId: req.student.id,
      activeTasks: Array.isArray(catalog.tasks) ? catalog.tasks.length : 0,
    }),
  })
})

app.patch('/api/student/account', requireStudent, (req, res) => {
  const body = req.body || {}
  const section = body.section ? String(body.section) : null
  if (section === 'profile') {
    updateProfile(req.student.studentId, body.profile || {})
  } else if (section === 'preferences') {
    updatePreferences(req.student.studentId, body.preferences || {})
  } else {
    res.status(400).json({ error: 'ACCOUNT_SECTION_REQUIRED' })
    return
  }
  const catalog = getCatalog()
  res.json({
    account: getAccountView({
      student: req.student,
      sessions: studentSessionList(req.student.studentId, req.student.id),
      activeSessionId: req.student.id,
      activeTasks: Array.isArray(catalog.tasks) ? catalog.tasks.length : 0,
    }),
  })
})

app.post('/api/student/account/logout', requireStudent, (req, res) => {
  deleteSession(req.student.id)
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})

app.delete('/api/student/account/sessions/current', requireStudent, (req, res) => {
  deleteSession(req.student.id)
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true, signedOut: true })
})

app.delete('/api/student/account/sessions/:sessionId', requireStudent, (req, res) => {
  const sessionId = String(req.params.sessionId || '')
  const target = getSession(sessionId)
  if (!target || target.studentId !== req.student.studentId) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    return
  }
  if (sessionId === req.student.id) {
    deleteSession(sessionId)
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
    res.json({ ok: true, signedOut: true })
    return
  }
  deleteSession(sessionId)
  res.json({ ok: true })
})

app.get('/api/student/help', requireStudent, supportRoute(async (req, res) => {
  res.json({ ...getCatalog(), tickets: await listStudentSupportTickets(req.student.studentId) })
}))

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

function supportRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error(`[support] ${req.method} ${req.originalUrl}`, error)
    if (!res.headersSent) safeError(res, 500, 'SUPPORT_UNAVAILABLE', 'Support requests could not be loaded.')
  })
}

app.get('/api/student/help/tickets', requireStudent, supportRoute(async (req, res) => {
  res.json({ tickets: await listStudentSupportTickets(req.student.studentId) })
}))

app.get('/api/student/help/tickets/:ticketId', requireStudent, supportRoute(async (req, res) => {
  const ticket = await getStudentSupportTicket(req.student.studentId, req.params.ticketId)
  if (!ticket) return safeError(res, 404, 'TICKET_NOT_FOUND', 'Support request not found.')
  res.json(ticket)
}))

app.post('/api/student/help/tickets', requireStudent, supportRoute(async (req, res) => {
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
  const ticket = await createSupportTicket({
    student: req.student,
    category: body.category ? String(body.category) : null,
    issue: body.issue ? String(body.issue) : null,
    taskId: body.taskId ? String(body.taskId) : null,
    message,
  })
  res.status(201).json(ticket)
}))

function localStaffPreview(req) {
  return process.env.NODE_ENV !== 'production' && (process.env.ADMIN_DEMO_SESSION === '1' || process.env.SUPERADMIN_DEMO_SESSION === '1') && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.ip || '')
}

async function requireStaff(req, res, next) {
  const sid = parseCookies(req.headers.cookie)[STAFF_COOKIE]
  if (sid && staffSessions.has(sid)) {
    try {
      const session = staffSessions.get(sid)
      const profile = await supabaseProfile(session.id)
      if (['Admin', 'Superadmin'].includes(profile?.role)) {
        req.staff = { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
        return next()
      }
      staffSessions.delete(sid)
      return safeError(res, 401, 'STAFF_ACCESS_REQUIRED', 'This account no longer has staff access.')
    } catch (error) {
      console.error('[staff] profile check failed', error)
      return safeError(res, 503, 'STAFF_ACCESS_UNAVAILABLE', 'Staff access could not be verified right now.')
    }
  }
  if (localStaffPreview(req)) {
    const superadmin = process.env.SUPERADMIN_DEMO_SESSION === '1'
    req.staff = { id: superadmin ? 'local-superadmin' : 'local-admin', name: superadmin ? 'Local Super Admin' : 'Local Admin', role: superadmin ? 'Superadmin' : 'Admin', demo: true }
    return next()
  }
  safeError(res, 401, 'STAFF_ACCESS_REQUIRED', 'Sign in with an Admin account to continue.')
}

function requireSuperadmin(req, res, next) {
  if (req.staff?.role !== 'Superadmin') return safeError(res, 403, 'SUPERADMIN_REQUIRED', 'Super Admin access is required.')
  next()
}

function staffRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error(`[staff] ${req.method} ${req.originalUrl}`, error)
    if (!res.headersSent && /staff_role_events|change_staff_role/.test(String(error.message || ''))) return safeError(res, 503, 'STAFF_GOVERNANCE_SETUP_REQUIRED', 'Apply the staff governance database migration to use this feature.')
    if (!res.headersSent) safeError(res, 500, 'STAFF_LOAD_FAILED', 'The staff workspace could not be loaded.')
  })
}

app.post('/api/admin/login', staffRoute(async (req, res) => {
  if (!hasSupabaseAuth()) return safeError(res, 503, 'STAFF_LOGIN_UNAVAILABLE', 'Staff sign-in is not configured yet.')
  if (!limited(`staff-login:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  const { data, error } = await supabaseSignIn({ email: req.body?.email, password: req.body?.password })
  if (error || !data?.user) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
  const profile = await supabaseProfile(data.user.id)
  if (!['Admin', 'Superadmin'].includes(profile?.role)) return safeError(res, 403, 'STAFF_ACCESS_REQUIRED', 'This account does not have staff access.')
  const sid = crypto.randomUUID()
  const staff = { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
  staffSessions.set(sid, staff)
  res.setHeader('Set-Cookie', `${STAFF_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  res.json({ staff })
}))

app.get('/api/admin/me', requireStaff, (req, res) => res.json({ staff: req.staff }))
app.post('/api/admin/logout', requireStaff, (req, res) => {
  const sid = parseCookies(req.headers.cookie)[STAFF_COOKIE]
  if (sid) staffSessions.delete(sid)
  res.setHeader('Set-Cookie', `${STAFF_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})
app.get('/api/admin/overview', requireStaff, staffRoute(async (_req, res) => res.json(await getAdminOverview())))
app.get('/api/admin/tasks/:taskId', requireStaff, staffRoute(async (req, res) => {
  const detail = await getAdminCase(req.params.taskId)
  if (!detail) return safeError(res, 404, 'TASK_NOT_FOUND', 'This task could not be found.')
  res.json(detail)
}))
app.get('/api/admin/tasks/:taskId/files/:fileId/download', requireStaff, staffRoute(async (req, res) => {
  const store = await readTaskStore()
  const file = store.files.find((item) => item.id === req.params.fileId && item.taskId === req.params.taskId)
  if (!file?.storageKey) return safeError(res, 404, 'FILE_NOT_FOUND', 'Task file not found.')
  if (hasObjectStorage()) {
    const url = await signedObjectUrl(file.storageKey, file.originalName)
    if (!url) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
    return res.redirect(302, url)
  }
  const storagePath = path.resolve(uploadDir, file.storageKey)
  if (!storagePath.startsWith(`${path.resolve(uploadDir)}${path.sep}`) || !fs.existsSync(storagePath)) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
  res.download(storagePath, file.originalName)
}))
app.post('/api/admin/tasks/:taskId/review', requireStaff, staffRoute(async (req, res) => {
  if (!limited(`admin-review:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many review actions. Please wait a moment.')
  const result = await recordAdminReview(req.params.taskId, req.staff.id, req.body?.action, req.body?.note)
  if (result.error) return safeError(res, result.error === 'TASK_NOT_FOUND' ? 404 : result.error === 'NOTE_REQUIRED' || result.error === 'INVALID_ACTION' ? 400 : 409, result.error, result.error === 'NOTE_REQUIRED' ? 'Add an internal note of at least 10 characters.' : 'This review cannot be changed from its current state.')
  res.json(result)
}))

app.get('/api/admin/support', requireStaff, staffRoute(async (_req, res) => res.json({ tickets: await listSupportTickets() })))
app.get('/api/admin/support/:ticketId', requireStaff, staffRoute(async (req, res) => {
  const ticket = await getSupportTicket(req.params.ticketId)
  if (!ticket) return safeError(res, 404, 'TICKET_NOT_FOUND', 'Support request not found.')
  res.json({ ticket })
}))
app.post('/api/admin/support/:ticketId/status', requireStaff, staffRoute(async (req, res) => {
  if (!limited(`admin-support:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before updating another request.')
  const result = await updateSupportTicket(req.params.ticketId, req.staff.id, req.body?.status, req.body?.note, req.body?.studentMessage)
  if (result.error) return safeError(res, result.error === 'TICKET_NOT_FOUND' ? 404 : result.error === 'STATUS_UNCHANGED' ? 409 : 400, result.error, result.error === 'NOTE_REQUIRED' ? 'Add an internal note of at least 10 characters.' : result.error === 'STUDENT_MESSAGE_REQUIRED' ? 'Explain what the Student needs to provide.' : 'This support request could not be updated.')
  const studentId = result.ticket.context?.studentId
  if (studentId) {
    const labels = { in_progress: 'Your support request is being reviewed.', waiting_on_student: 'Your support request needs your attention.', resolved: 'Your support request was resolved.' }
    const body = result.ticket.studentUpdates?.[0]?.at === result.ticket.updatedAt ? result.ticket.studentUpdates[0].message : labels[result.ticket.status]
    if (body) {
      try {
        await addNotification({ id: crypto.randomUUID(), studentId, title: 'Support request updated', body, route: '/student/help', isRead: false, requiresAction: result.ticket.status === 'waiting_on_student', createdAt: now() })
        publish(studentId, { type: 'SupportTicketUpdated', ticketId: result.ticket.id, status: result.ticket.status })
      } catch (error) { console.error('[support] notification failed', error) }
    }
  }
  res.json(result)
}))

app.get('/api/admin/qa', requireStaff, staffRoute(async (_req, res) => res.json({ assignments: await listAdminQaAssignments() })))
app.get('/api/admin/qa/:assignmentId', requireStaff, staffRoute(async (req, res) => {
  const detail = await getAdminQaCase(req.params.assignmentId)
  if (!detail) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(detail)
}))
app.get('/api/admin/qa/:assignmentId/files/:fileId/download', requireStaff, staffRoute(async (req, res) => {
  const detail = await getAdminQaCase(req.params.assignmentId)
  if (!detail?.submissionFiles.some((file) => file.id === req.params.fileId)) return safeError(res, 404, 'FILE_NOT_FOUND', 'Submission file not found.')
  const file = await findExpertFile(req.params.fileId)
  if (!file?.storageKey) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
  if (hasObjectStorage()) {
    const url = await signedObjectUrl(file.storageKey, file.name)
    if (!url) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
    return res.redirect(302, url)
  }
  const storagePath = path.resolve(uploadDir, file.storageKey)
  if (!storagePath.startsWith(`${path.resolve(uploadDir)}${path.sep}`) || !fs.existsSync(storagePath)) return safeError(res, 404, 'FILE_CONTENT_MISSING', 'The file is no longer available.')
  res.download(storagePath, file.name)
}))
app.post('/api/admin/qa/:assignmentId/outcome', requireStaff, staffRoute(async (req, res) => {
  if (!limited(`admin-qa:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before recording another quality decision.')
  const outcome = String(req.body?.outcome || '')
  if (!['approved', 'changes_requested'].includes(outcome)) return safeError(res, 400, 'QA_OUTCOME_INVALID', 'Choose a valid quality decision.')
  const note = String(req.body?.note || '').trim().slice(0, 2000)
  if (outcome === 'changes_requested' && note.length < 10) return safeError(res, 400, 'QA_FEEDBACK_REQUIRED', 'Explain the changes needed in at least 10 characters.')
  const feedback = outcome === 'changes_requested' ? [{ title: 'Changes required', body: note, severity: 'major' }] : []
  const result = await applyQaOutcome(req.params.assignmentId, outcome, feedback, req.staff.id, note)
  if (!result.ok) return expertMutationError(res, result.error)
  const expert = await readExpertStore()
  publishExpert(expert.expert.id, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.get('/api/superadmin/overview', requireStaff, requireSuperadmin, staffRoute(async (_req, res) => {
  const services = [
    { id: 'auth', label: 'Account sign in', configured: hasSupabaseAuth() },
    { id: 'data', label: 'Persistent data', configured: hasSupabase() },
    { id: 'storage', label: 'Private file storage', configured: hasObjectStorage() },
    { id: 'analysis', label: 'Solvy analysis', configured: Boolean(process.env.SOLVY_API_URL && process.env.SOLVY_API_KEY) },
    { id: 'payments', label: 'Payments', configured: Boolean(stripe && process.env.STRIPE_WEBHOOK_SECRET) },
    { id: 'email', label: 'Email delivery', configured: hasEmail() },
  ]
  res.json(await getSuperadminOverview(services))
}))
app.get('/api/superadmin/team', requireStaff, requireSuperadmin, staffRoute(async (req, res) => {
  res.json({ directory: req.staff.demo ? null : await supabaseTeam() })
}))
app.get('/api/superadmin/team/lookup', requireStaff, requireSuperadmin, staffRoute(async (req, res) => {
  if (req.staff.demo || !hasSupabase()) return safeError(res, 503, 'TEAM_LOOKUP_UNAVAILABLE', 'Team lookup requires a real Super Admin account and Supabase.')
  if (!limited(`staff-lookup:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before looking up another account.')
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return safeError(res, 400, 'INVALID_EMAIL', 'Enter a valid account email.')
  res.json({ person: await supabaseFindProfileByEmail(email) })
}))
app.get('/api/superadmin/activity', requireStaff, requireSuperadmin, staffRoute(async (req, res) => {
  res.json({ activity: await getSuperadminActivity(!req.staff.demo && hasSupabase()) })
}))
app.post('/api/superadmin/team/:profileId/role', requireStaff, requireSuperadmin, staffRoute(async (req, res) => {
  if (req.staff.demo || !hasSupabase()) return safeError(res, 503, 'ROLE_MANAGEMENT_UNAVAILABLE', 'Role management requires a real Super Admin account and Supabase.')
  if (!limited(`staff-role:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before changing another role.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.profileId)) return safeError(res, 400, 'INVALID_PROFILE', 'Choose a valid account.')
  const { role, expectedRole, note } = req.body || {}
  if (!['Student', 'Expert', 'Admin', 'Superadmin'].includes(role) || !['Student', 'Expert', 'Admin', 'Superadmin'].includes(expectedRole)) return safeError(res, 400, 'INVALID_ROLE', 'Choose a valid account role.')
  if (String(note || '').trim().length < 10) return safeError(res, 400, 'NOTE_REQUIRED', 'Add a reason of at least 10 characters.')
  if (req.params.profileId === req.staff.id) return safeError(res, 400, 'SELF_ROLE_CHANGE_BLOCKED', 'You cannot change your own role.')
  try {
    const result = await supabaseChangeStaffRole(req.staff.id, req.params.profileId, expectedRole, role, String(note).trim().slice(0, 2000))
    res.json({ result })
  } catch (error) {
    const code = ['ROLE_CHANGED', 'ROLE_UNCHANGED', 'PROFILE_NOT_FOUND', 'SUPERADMIN_REQUIRED', 'SELF_ROLE_CHANGE_BLOCKED'].find((item) => String(error.message).includes(item))
    if (code) return safeError(res, code === 'PROFILE_NOT_FOUND' ? 404 : 409, code, 'The role could not be changed. Refresh the team directory and try again.')
    throw error
  }
}))

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' })
})

app.use((error, _req, res, _next) => {
  console.error('[api]', error.message)
  safeError(res, 500, 'INTERNAL_ERROR', 'The request could not be completed.')
})

const server = app.listen(PORT, () => {
  console.log(`SolveNest API listening on http://127.0.0.1:${server.address().port}`)
})
