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
import { createSupportTicket, getStudentSupportTicket, listStudentSupportTickets, listSupportTickets, getSupportTicket, replyToSupportTicket, updateSupportTicket } from './supportStore.js'
import {
  addAssignmentFile,
  applyAssignmentScopeChange,
  appendProgressUpdate,
  applyQaOutcome,
  beginAssignmentRevision,
  cancelProvisionedAssignment,
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
  markExpertNotificationsRead,
  notifyAssignmentRevision,
  postAssignmentMessage,
  provisionAssignment,
  provisionAvailableTasks,
  queryAssignments,
  readExpertStore,
  runForExpert,
  removeAssignmentFile,
  resolveQaFeedback,
  resubmitAssignmentForQa,
  setAvailability,
  submitAssignmentForQa,
  toExpertWorkspace,
  updateAssignmentWorkState,
} from './expertStore.js'
import { addActivity, buildTaskSummary, getStudentAnalysis, getStudentFiles, getStudentTask, getStudentTasks, readTaskStore, withTaskStore } from './taskStore.js'
import { publish, subscribe, closeStreams } from './realtime.js'
import { hasObjectStorage, persistUpload, removeStoredObject, signedObjectUrl } from './storage.js'
import { hasEmail, sendEmail } from './email.js'
import { exportStudentAccount } from './accountExport.js'
import { hasSupabase, hasSupabaseAuth, supabaseChangeStaffRole, supabaseConsumeRateLimit, supabaseCreateAppSession, supabaseDeleteAppSession, supabaseExpertProfiles, supabaseFindProfileByEmail, supabaseGetAppSession, supabaseProfile, supabaseRefresh, supabaseRequestPasswordReset, supabaseRevokeUserSessions, supabaseTeam, supabaseUpdatePassword, supabaseSignIn, supabaseSignUp, supabaseUser } from './supabase.js'
import { getAdminCase, getAdminOverview, getAdminQaCase, issueAdminPlan, issueAdminScopeChange, listAdminQaAssignments, recordAdminReview } from './adminStore.js'
import { getSuperadminActivity, getSuperadminOverview } from './superadminStore.js'
import { checkMalwareScanner, inspectUpload } from './uploadSafety.js'

const PORT = Number(process.env.PORT || 4174)
const COOKIE = 'sn_sid'
const EXPERT_COOKIE = 'sn_eid'
const expertSessions = new Map()
const staffSessions = new Map()
const ADMIN_COOKIE = 'sn_admin'
const SUPERADMIN_COOKIE = 'sn_superadmin'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, 'private-uploads')
const requestWindows = new Map()
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
fs.mkdirSync(uploadDir, { recursive: true })
const allowedExtensions = new Set(['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png'])
async function rejectInvalidUpload(res, file) {
  let result
  try { result = await inspectUpload(file) } catch { result = 'unavailable' }
  if (result === 'clean') return false
  if (file?.path) try { fs.unlinkSync(file.path) } catch {}
  if (result === 'infected') safeError(res, 400, 'FILE_MALWARE_DETECTED', 'This file cannot be uploaded.')
  else if (result === 'unavailable') safeError(res, 503, 'FILE_SCAN_UNAVAILABLE', 'The file safety check is temporarily unavailable. Please try again.')
  else safeError(res, 400, 'FILE_CONTENT_INVALID', 'The file content does not match a supported PDF, Office document, or image.')
  return true
}
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
function asyncRoute(...handlers) {
  return handlers.map((handler) => (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next))
}
app.disable('x-powered-by')
function configuredOrigin(value) {
  try { return value ? new URL(value).origin : null } catch { return null }
}
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/payments/stripe/webhook') return next()
  const origin = req.headers.origin
  const allowed = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`
  let trusted = !origin
  try { if (origin) trusted = new URL(origin).origin === new URL(allowed).origin } catch { trusted = false }
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '')) trusted = true
  if (req.headers['sec-fetch-site'] === 'cross-site' || !trusted) return safeError(res, 403, 'ORIGIN_REJECTED', 'This request must come from the SolveNest website.')
  next()
})
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (Number.isSafeInteger(trustedProxyHops) && trustedProxyHops > 0 && trustedProxyHops <= 3) app.set('trust proxy', trustedProxyHops)
app.use((req, res, next) => {
  const requestId = /^[a-zA-Z0-9._-]{8,100}$/.test(String(req.headers['x-request-id'] || '')) ? String(req.headers['x-request-id']) : crypto.randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')
  const assetOrigins = [...new Set([configuredOrigin(process.env.SUPABASE_URL), configuredOrigin(process.env.S3_ENDPOINT)].filter(Boolean))].join(' ')
  res.setHeader('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: ${assetOrigins}; frame-src 'self' ${assetOrigins}; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ${assetOrigins}; worker-src 'self' blob:`)
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  const startedAt = Date.now()
  res.on('finish', () => console.log(JSON.stringify({ level: 'info', type: 'request', requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt })))
  next()
})
function applyApprovedScopeChange(store, change, task, plan, stamp) {
  if (change.status === 'ACCEPTED') return null
  change.status = 'ACCEPTED'
  change.acceptedAt = stamp
  change.canAccept = false
  change.expertSyncPending = Boolean(task.assignedExpertId && task.assignmentId)
  plan.scope = change.requested.scope
  plan.delivery = change.requested.delivery
  plan.amount += change.requested.priceDelta
  plan.price = plan.amount
  task.deadline = plan.delivery
  task.amountDue = Number(task.amountDue || 0)
  task.funding = { ...(task.funding || {}), amountTotal: plan.amount, amountFunded: Number(task.funding?.amountFunded || plan.amount - change.requested.priceDelta - task.amountDue) + change.requested.priceDelta, amountDue: task.amountDue }
  task.latestUpdate = { text: 'Your approved scope and delivery date have been updated.', createdAt: stamp }
  task.updatedAt = stamp
  addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'ScopeChangeAccepted', text: task.latestUpdate.text, createdAt: stamp })
  return { id: task.id, studentId: task.studentId, title: task.title, at: stamp, scopeChangeId: change.id }
}
async function recordPaymentStatus(providerId, status, requireRecord = false, provider = null) {
  return withTaskStore((store) => {
    const payment = store.payments.find((item) => item.providerId === providerId)
    if (!payment) {
      if (requireRecord) throw new Error('PAYMENT_RECORD_PENDING')
      return null
    }
    if (status === 'succeeded') {
      const amount = provider?.amount_total ?? provider?.amount_received
      if (!provider || amount !== Math.round(payment.amount * 100) || String(provider.currency).toLowerCase() !== String(payment.currency).toLowerCase()) throw new Error('PAYMENT_VERIFICATION_MISMATCH')
      if (provider.metadata?.studentId && provider.metadata.studentId !== payment.studentId) throw new Error('PAYMENT_OWNER_MISMATCH')
    }
    if (payment.status === 'succeeded') {
      const change = payment.scopeChangeId ? store.scopeChanges.find((item) => item.id === payment.scopeChangeId) : null
      return change?.expertSyncPending ? { scopeChangeId: change.id, id: change.taskId, studentId: change.studentId } : null
    }
    payment.status = status
    if (status !== 'succeeded') return null
    payment.paymentIntentId = typeof provider?.payment_intent === 'string' ? provider.payment_intent : provider?.payment_intent?.id || (String(providerId).startsWith('pi_') ? providerId : payment.paymentIntentId || null)
    const task = store.tasks.find((item) => item.id === payment.taskId && item.studentId === payment.studentId)
    const plan = store.plans.find((item) => item.id === payment.planId && item.status === 'ACCEPTED')
    if (!task || !plan) {
      throw new Error('PAYMENT_PLAN_MISSING')
    }
    const stamp = now()
    if (payment.scopeChangeId) {
      const change = store.scopeChanges.find((item) => item.id === payment.scopeChangeId && item.taskId === task.id && item.status === 'AWAITING_PAYMENT')
      if (!change) throw new Error('SCOPE_PAYMENT_CHANGE_MISSING')
      return applyApprovedScopeChange(store, change, task, plan, stamp)
    }
    if (payment.milestoneId) {
      const milestone = plan.milestones?.find((item) => item.id === payment.milestoneId)
      if (!milestone || milestone.fundingState === 'funded') return null
      milestone.fundingState = 'funded'
      milestone.paidAt = stamp
      milestone.paymentId = payment.id
      const scopeFunded = store.payments.filter((item) => item.planId === plan.id && item.scopeChangeId && item.status === 'succeeded').reduce((total, item) => total + item.amount, 0)
      const amountFunded = scopeFunded + plan.milestones.filter((item) => item.fundingState === 'funded').reduce((total, item) => total + item.amount, 0)
      const next = plan.milestones.find((item) => item.fundingState !== 'funded')
      if (next) next.fundingState = 'payment_required'
      task.amountDue = Math.max(0, plan.amount - amountFunded)
      task.funding = { model: 'milestone', state: next ? 'payment_required' : 'funded', amountTotal: plan.amount, amountFunded, amountDue: task.amountDue, milestones: plan.milestones }
      if (task.status === 'PAYMENT_PENDING') task.status = 'PAID'
      task.latestUpdate = { text: next ? 'The first milestone is funded. Expert work can begin; the final milestone is due before delivery.' : 'All milestones are funded. The approved delivery can be released.', createdAt: stamp }
      if (next) task.nextAction = { label: 'Fund final milestone', route: `/student/payments?task=${task.id}&section=milestones` }
      else if (task.nextAction?.label === 'Fund final milestone') task.nextAction = null
      task.updatedAt = stamp
      addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'MilestoneFunded', text: task.latestUpdate.text, createdAt: stamp })
      return { id: task.id, studentId: task.studentId, title: task.title, at: stamp, milestoneName: milestone.name, remaining: task.amountDue }
    }
    if (task.status !== 'PAYMENT_PENDING') return null
    task.status = 'PAID'
    task.amountDue = 0
    task.funding = { state: 'funded', amountTotal: plan.amount, amountFunded: plan.amount, amountDue: 0 }
    task.latestUpdate = { text: 'Your task is funded and ready for Expert assignment.', createdAt: stamp }
    task.nextAction = null
    task.updatedAt = stamp
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'TaskFunded', text: task.latestUpdate.text, createdAt: stamp })
    return { id: task.id, studentId: task.studentId, title: task.title, at: stamp }
  })
}

async function recordRefundStatus(paymentIntentId, amountRefundedMinor, refundId = null) {
  return withTaskStore((store) => {
    const payment = store.payments.find((item) => item.paymentIntentId === paymentIntentId || item.providerId === paymentIntentId)
    if (!payment) return null
    const amountRefunded = Math.min(payment.amount, Math.max(0, Number(amountRefundedMinor || 0) / 100))
    payment.refundedAmount = amountRefunded
    payment.refundId = refundId || payment.refundId || null
    payment.refundedAt = now()
    payment.status = amountRefunded >= payment.amount ? 'refunded' : 'partially_refunded'
    const task = store.tasks.find((item) => item.id === payment.taskId && item.studentId === payment.studentId)
    const plan = store.plans.find((item) => item.id === payment.planId)
    if (payment.milestoneId && plan) {
      const milestone = plan.milestones?.find((item) => item.id === payment.milestoneId)
      if (milestone && payment.status === 'refunded') Object.assign(milestone, { fundingState: 'payment_required', paidAt: null, paymentId: null })
    }
    if (task) {
      const succeeded = store.payments.filter((item) => item.taskId === task.id && item.status === 'succeeded').reduce((sum, item) => sum + Number(item.amount || 0), 0)
      task.amountDue = Math.max(0, Number(plan?.amount || task.funding?.amountTotal || 0) - succeeded)
      task.funding = { ...(task.funding || {}), state: task.amountDue ? 'payment_required' : 'funded', amountFunded: succeeded, amountDue: task.amountDue }
      if (!['DELIVERED', 'COMPLETED', 'DECLINED'].includes(task.status)) task.status = 'PAYMENT_PENDING'
      task.latestUpdate = { text: `A ${payment.status === 'refunded' ? 'full' : 'partial'} refund was processed for this task.`, createdAt: payment.refundedAt }
      task.updatedAt = payment.refundedAt
      addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'PaymentRefunded', text: task.latestUpdate.text, createdAt: payment.refundedAt })
    }
    return { payment, task }
  })
}

async function announceFundedTask(task) {
  if (!task) return
  if (task.scopeChangeId) await syncApprovedScopeChange(task.scopeChangeId)
  if (!task.at) return
  try { await addNotification({ id: crypto.randomUUID(), studentId: task.studentId, title: task.scopeChangeId ? 'Scope change approved' : task.milestoneName ? `${task.milestoneName} funded` : 'Task funded', body: task.scopeChangeId ? 'Your updated scope and delivery date are now in effect.' : task.milestoneName ? task.remaining ? 'Expert work can begin. The final milestone is due before delivery.' : 'All milestones are funded and delivery can be released.' : 'Your task is ready for Expert assignment.', task: { title: task.title, ref: task.id }, route: `/student/payments?task=${task.id}&section=${task.milestoneName ? 'milestones' : 'funding'}`, isRead: false, requiresAction: false, createdAt: task.at }) }
  catch (error) { console.error('[payment] notification failed', error) }
  publish(task.studentId, { type: 'TaskFunded', taskId: task.id })
}

async function syncApprovedScopeChange(scopeChangeId) {
  const state = await readTaskStore()
  const change = state.scopeChanges.find((item) => item.id === scopeChangeId && item.status === 'ACCEPTED' && item.expertSyncPending)
  if (!change) return
  const task = state.tasks.find((item) => item.id === change.taskId)
  if (!task?.assignedExpertId || !task.assignmentId) return
  const result = await runForExpert(task.assignedExpertId, () => applyAssignmentScopeChange(task.assignmentId, change))
  if (!result.ok) throw new Error(result.error || 'SCOPE_EXPERT_SYNC_FAILED')
  await withTaskStore((store) => { const current = store.scopeChanges.find((item) => item.id === scopeChangeId); if (current) current.expertSyncPending = false })
  publishExpert(task.assignedExpertId, 'AssignmentChanged', { assignmentId: task.assignmentId, at: now() })
}

app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), asyncRoute(async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'PAYMENTS_NOT_CONFIGURED' })
  let event
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET) } catch { return res.status(400).json({ error: 'INVALID_WEBHOOK' }) }
  const object = event.data.object
  if (event.type === 'charge.refunded') {
    try {
      const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id
      const refunded = paymentIntentId ? await recordRefundStatus(paymentIntentId, object.amount_refunded, null) : null
      if (refunded?.task) publish(refunded.task.studentId, { type: 'PaymentRefunded', taskId: refunded.task.id })
      return res.json({ received: true })
    } catch (error) {
      console.error('[stripe-webhook] refund reconciliation failed', error)
      return res.status(503).json({ error: 'REFUND_RECONCILIATION_PENDING' })
    }
  }
  const sessionEvent = event.type.startsWith('checkout.session.')
  const status = event.type === 'checkout.session.completed' ? (object.payment_status === 'paid' ? 'succeeded' : null)
    : event.type === 'checkout.session.async_payment_succeeded' ? 'succeeded'
      : event.type === 'checkout.session.async_payment_failed' ? 'failed'
        : event.type === 'checkout.session.expired' ? 'canceled'
          : event.type === 'payment_intent.succeeded' ? 'succeeded'
            : event.type === 'payment_intent.payment_failed' ? 'failed' : null
  try {
    const fundedTask = status && (sessionEvent || object.id.startsWith('pi_')) ? await recordPaymentStatus(object.id, status, sessionEvent && Boolean(object.metadata?.taskId), object) : null
    await announceFundedTask(fundedTask)
    res.json({ received: true })
  } catch (error) {
    console.error('[stripe-webhook] reconciliation failed', error)
    res.status(503).json({ error: 'PAYMENT_RECONCILIATION_PENDING' })
  }
}))
app.use(express.json({ limit: '1mb' }))

function now() { return new Date().toISOString() }

function safeError(res, status, code, message, fieldErrors = {}) {
  res.status(status).json({ error: code, code, message, fieldErrors, retryable: status >= 500 })
}

const studentRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)

async function limited(key, max = 10) {
  if (process.env.NODE_ENV === 'production') {
    try { return await supabaseConsumeRateLimit(key, max) }
    catch (error) { console.error('[rate-limit] unavailable', error); return false }
  }
  const stamp = Date.now()
  if (requestWindows.size > 5000) for (const [name, window] of requestWindows) if (stamp - window.startedAt >= 60_000) requestWindows.delete(name)
  const current = requestWindows.get(key) || { count: 0, startedAt: stamp }
  if (stamp - current.startedAt >= 60_000) { current.count = 0; current.startedAt = stamp }
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
  if (!process.env.SOLVY_API_URL) {
    if (process.env.NODE_ENV === 'production') throw new Error('SOLVY_NOT_CONFIGURED')
    return { ...normalizeAnalysis(files), provider: 'local-intake', provisional: true }
  }
  const inputs = await Promise.all(files.map(async (file) => ({ id: file.id, role: file.role, name: file.originalName, mimeType: file.mimeType, size: file.size, url: await signedObjectUrl(file.storageKey, file.originalName) })))
  if (process.env.NODE_ENV === 'production' && inputs.some((file) => !file.url)) throw new Error('ANALYSIS_FILE_ACCESS_UNAVAILABLE')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(process.env.SOLVY_API_URL, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(process.env.SOLVY_API_KEY ? { Authorization: `Bearer ${process.env.SOLVY_API_KEY}` } : {}) }, body: JSON.stringify({ fileIds: files.map((file) => file.id), files: inputs }) })
    if (!response.ok) throw new Error(`SOLVY_${response.status}`)
    const payload = await response.json()
    const result = payload.analysis || payload.result || payload
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('SOLVY_INVALID_RESPONSE')
    return { ...result, provider: 'solvy', provisional: true }
  } finally { clearTimeout(timeout) }
}

async function solvyOperation(operation, payload) {
  if (!process.env.SOLVY_API_URL) throw Object.assign(new Error('SOLVY_NOT_CONFIGURED'), { code: 'SOLVY_NOT_CONFIGURED' })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(process.env.SOLVY_API_URL, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Solvy-Operation': operation, ...(process.env.SOLVY_API_KEY ? { Authorization: `Bearer ${process.env.SOLVY_API_KEY}` } : {}) }, body: JSON.stringify({ operation, ...payload }) })
    if (!response.ok) throw Object.assign(new Error(`SOLVY_${response.status}`), { code: 'SOLVY_PROVIDER_ERROR' })
    return response.json()
  } finally { clearTimeout(timeout) }
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
  const state = await readTaskStore()
  return [...state.files, ...(state.deliveryFiles || [])].find((file) => file.studentId === studentId && file.id === fileId) || null
}

function dossierPayload(task, files) {
  const sourceFiles = files.map((file) => ({ id: file.id, name: file.originalName, role: file.role, type: file.mimeType, size: file.size, origin: 'student', state: file.state, createdAt: file.createdAt, taskId: task.id, canReplace: !task.assignedExpertId, canRemove: !task.assignedExpertId }))
  const deliveryVersions = task.deliveryVersions || []
  return { id: task.id, taskId: task.id, title: task.title, subject: task.subject, status: task.status, deadline: task.deadline, sourceFiles, exchangeFiles: [], deliveryVersions, fileCount: sourceFiles.length + deliveryVersions.reduce((total, item) => total + item.files.length, 0), lastActivityAt: task.updatedAt, hasNewDelivery: Boolean(task.hasNewDelivery) }
}

async function syncStudentDelivery(expertId, assignmentId) {
  const workspace = await readExpertStore()
  const assignment = workspace.assignments.find((item) => item.id === assignmentId && item.taskId)
  if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND')
  const history = assignment.workspace?.deliveryHistory || []
  const latest = history.at(-1) || (assignment.workspace?.delivery?.state === 'delivered' ? { ...assignment.workspace.delivery, files: (assignment.workspace.files?.submission || []).filter((file) => assignment.workspace.delivery.fileIds.includes(file.id)) } : null)
  if (!latest) throw new Error('DELIVERY_NOT_FOUND')
  return withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === assignment.taskId && item.assignedExpertId === expertId && item.assignmentId === assignmentId)
    if (!task) return null
    task.deliveryVersions = Array.isArray(task.deliveryVersions) ? task.deliveryVersions : []
    if (task.deliveryVersions.some((item) => item.version === latest.version)) return null
    const plan = store.plans.find((item) => item.taskId === task.id && item.status === 'ACCEPTED')
    const remaining = Math.max(0, Number(plan?.revisionAllowance || 0) - (task.revisionRequests || []).length)
    const files = latest.files.map((file) => ({ id: file.id, name: file.name, type: file.type, size: file.size, version: latest.version, uploadedAt: file.uploadedAt || latest.deliveredAt, role: 'deliverable' }))
    store.deliveryFiles = Array.isArray(store.deliveryFiles) ? store.deliveryFiles : []
    for (const file of latest.files) {
      if (!file.storageKey) continue
      if (!store.deliveryFiles.some((item) => item.id === file.id && item.studentId === task.studentId)) store.deliveryFiles.push({ id: file.id, studentId: task.studentId, taskId: task.id, role: 'DELIVERY', originalName: file.name, storageKey: file.storageKey, mimeType: file.type, size: file.size, state: 'READY', createdAt: latest.deliveredAt })
    }
    const delivery = { id: `${assignmentId}-v${latest.version}`, version: latest.version, deliveredAt: latest.deliveredAt, status: 'ready_to_review', files, note: latest.note, qa: { state: 'approved' }, revision: { status: remaining ? 'available' : 'limit_reached', remaining }, explainAndDefend: process.env.SOLVY_API_URL ? { eligible: true } : { eligible: false, reason: 'Explain & Defend is not configured yet.' } }
    task.deliveryVersions.push(delivery)
    task.status = 'DELIVERED'
    task.hasNewDelivery = true
    task.latestUpdate = { text: `Delivery version ${latest.version} is ready to review.`, createdAt: latest.deliveredAt }
    task.updatedAt = latest.deliveredAt
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'TaskDelivered', text: task.latestUpdate.text, createdAt: latest.deliveredAt })
    return { task, delivery }
  })
}

app.get('/api/student/me', requireStudent, (req, res) => {
  res.json({ user: { id: req.student.studentId, role: req.student.role, name: req.student.name, email: req.student.email || null } })
})

app.get('/api/student/events', requireStudent, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: now() })}\n\n`)
  const unsubscribe = subscribe(req.student.studentId, res)
  req.on('close', unsubscribe)
})

app.post('/api/student/task-creation/session', requireStudent, asyncRoute(async (req, res) => {
  const session = { id: crypto.randomUUID(), studentId: req.student.studentId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdAt: now(), updatedAt: now() }
  await withTaskStore((store) => store.drafts.push(session))
  res.status(201).json({ session })
}))

app.get('/api/student/task-creation/session/:sessionId', requireStudent, asyncRoute(async (req, res) => {
  const state = await readTaskStore()
  const session = state.drafts.find((draft) => draft.id === req.params.sessionId && draft.studentId === req.student.studentId)
  if (!session) return safeError(res, 404, 'SESSION_NOT_FOUND', 'Task setup session not found.')
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => file.analysisSessionId === session.id || file.taskId === null)
  const analysis = state.analyses.find((item) => item.sessionId === session.id && item.studentId === req.student.studentId) || null
  res.json({ session, files, analysis: analysis?.result || null })
}))

app.post('/api/guest/analysis-transfer', asyncRoute(async (req, res) => {
  if (!await limited(`guest-transfer:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before creating another transfer.')
  const analysis = req.body?.analysis
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return safeError(res, 400, 'ANALYSIS_REQUIRED', 'A structured analysis is required.')
  const token = crypto.randomBytes(32).toString('base64url')
  const preview = { title: String(analysis.title || '').slice(0, 200), subject: String(analysis.subject || '').slice(0, 160), taskType: String(analysis.taskType || '').slice(0, 160), provider: 'guest-preview', provisional: true, verified: false }
  const transfer = { tokenHash: hashTransferToken(token), analysis: preview, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), claimedBy: null, createdAt: now() }
  await withTaskStore((store) => { store.guestTransfers = store.guestTransfers.filter((item) => new Date(item.expiresAt).getTime() > Date.now()); store.guestTransfers.push(transfer) })
  res.status(201).json({ transferToken: token, expiresAt: transfer.expiresAt })
}))

app.post('/api/student/analysis-transfer/claim', requireStudent, asyncRoute(async (req, res) => {
  const token = String(req.body?.transferToken || '')
  const transfer = await withTaskStore((store) => {
    const item = store.guestTransfers.find((candidate) => candidate.tokenHash === hashTransferToken(token) && !candidate.claimedBy && new Date(candidate.expiresAt).getTime() > Date.now())
    if (item) Object.assign(item, { claimedBy: req.student.studentId, claimedAt: now() })
    return item || null
  })
  if (!transfer) return safeError(res, 404, 'TRANSFER_NOT_FOUND', 'This analysis transfer is expired or invalid.')
  res.json({ analysis: transfer.analysis, claimed: true })
}))

app.post('/api/student/task-creation/files', requireStudent, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_REJECTED'
      safeError(res, 400, code, code === 'FILE_TOO_LARGE' ? 'File exceeds the 100 MB limit.' : 'This file type is not supported.')
      return
    }
    next()
  })
}, asyncRoute(async (req, res) => {
  if (!req.file) return safeError(res, 400, 'FILE_REQUIRED', 'Choose a file to upload.')
  if (await rejectInvalidUpload(res, req.file)) return
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
}))

app.delete('/api/student/task-creation/files/:fileId', requireStudent, asyncRoute(async (req, res) => {
  const result = await withTaskStore((store) => {
    const index = store.files.findIndex((file) => file.id === req.params.fileId && file.studentId === req.student.studentId && !file.taskId)
    if (index === -1) return null
    const [file] = store.files.splice(index, 1)
    return file
  })
  if (!result) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  try { await removeStoredObject(result.storageKey); fs.unlinkSync(path.join(uploadDir, result.storageKey)) } catch {}
  res.json({ ok: true })
}))

app.get('/api/student/files/:fileId/access', requireStudent, asyncRoute(async (req, res) => {
  const file = await ownedFile(req.student.studentId, req.params.fileId)
  if (!file) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  const objectUrl = await signedObjectUrl(file.storageKey, file.originalName)
  res.json({ signedUrl: objectUrl || signedFileUrl(file.id), expiresAt: Date.now() + 10 * 60 * 1000 })
}))

app.get('/api/student/files/:fileId/download', requireStudent, asyncRoute(async (req, res) => {
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
}))

app.delete('/api/student/files/:fileId', requireStudent, asyncRoute(async (req, res) => {
  const owned = await ownedFile(req.student.studentId, req.params.fileId)
  if (!owned) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  const task = owned.taskId ? await getStudentTask(req.student.studentId, owned.taskId) : null
  if (owned.role === 'DELIVERY' || task?.assignedExpertId) return safeError(res, 409, 'FILE_IMMUTABLE', 'Files linked to an assigned task cannot be removed.')
  const removed = await withTaskStore((store) => {
    const index = store.files.findIndex((file) => file.id === req.params.fileId && file.studentId === req.student.studentId)
    if (index < 0) return null
    const [file] = store.files.splice(index, 1)
    return file
  })
  if (!removed) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  try { await removeStoredObject(removed.storageKey); fs.unlinkSync(path.join(uploadDir, removed.storageKey)) } catch {}
  res.json({ ok: true })
}))

app.post('/api/student/dossiers/:taskId/files', requireStudent, asyncRoute(async (req, res, next) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (task.assignedExpertId) return safeError(res, 409, 'TASK_FILES_LOCKED', 'Contact support to add materials after Expert assignment.')
  upload.single('file')(req, res, (error) => {
    if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
    next()
  })
}, async (req, res) => {
  if (await rejectInvalidUpload(res, req.file)) return
  const file = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: req.params.taskId, role: 'SUPPORTING', originalName: path.basename(req.file.originalname), storageKey: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, state: 'READY', createdAt: now() }
  try { await persistUpload(req.file, file.storageKey) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.') }
  await withTaskStore((store) => store.files.push(file))
  res.status(201).json({ file: { id: file.id, name: file.originalName, type: file.mimeType, size: file.size, role: file.role, origin: 'student', taskId: file.taskId, createdAt: file.createdAt } })
}))

app.put('/api/student/files/:fileId/replace', requireStudent, asyncRoute(async (req, res, next) => {
  const file = await ownedFile(req.student.studentId, req.params.fileId)
  if (!file) return safeError(res, 404, 'FILE_NOT_FOUND', 'File not found.')
  const task = file.taskId ? await getStudentTask(req.student.studentId, file.taskId) : null
  if (file.role === 'DELIVERY' || task?.assignedExpertId) return safeError(res, 409, 'FILE_IMMUTABLE', 'Files linked to an assigned task cannot be replaced.')
  upload.single('file')(req, res, (error) => {
    if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
    next()
  })
}, async (req, res) => {
  if (await rejectInvalidUpload(res, req.file)) return
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
}))

app.post('/api/student/task-creation/analyze', requireStudent, asyncRoute(async (req, res) => {
  if (!await limited(`analysis:${req.student.studentId}`, 5)) return safeError(res, 429, 'ANALYSIS_RATE_LIMITED', 'Analysis requests are temporarily limited. Please try again shortly.')
  const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(String) : []
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => fileIds.includes(file.id) && !file.taskId)
  if (!files.some((file) => file.role === 'BRIEF')) return safeError(res, 400, 'BRIEF_REQUIRED', 'Upload an assignment brief before analysis.', { files: 'An assignment brief is required.' })
  const sessionId = String(req.body?.sessionId || '')
  const draft = (await readTaskStore()).drafts.find((item) => item.id === sessionId && item.studentId === req.student.studentId && item.status === 'ACTIVE' && new Date(item.expiresAt).getTime() > Date.now())
  if (!draft || files.some((file) => file.analysisSessionId !== draft.id)) return safeError(res, 409, 'SESSION_INVALID', 'Start a new task setup session and upload the files again.')
  let result
  try { result = await analyzeWithSolvy(files) } catch (error) { return safeError(res, 502, 'ANALYSIS_FAILED', 'Solvy could not analyze these files. Your uploads are preserved; please retry.', {}, error) }
  const analysis = { id: crypto.randomUUID(), studentId: req.student.studentId, sessionId, fileIds: files.map((file) => file.id), status: 'COMPLETED', result, createdAt: now(), updatedAt: now() }
  await withTaskStore((store) => { store.analyses.push(analysis); addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, type: 'AnalysisCompleted', text: 'Task analysis completed.', createdAt: analysis.createdAt }) })
  publish(req.student.studentId, { type: 'AnalysisCompleted', analysisId: analysis.id, status: analysis.status })
  res.status(201).json({ analysis: { ...analysis.result, id: analysis.id, status: analysis.status } })
}))

app.post('/api/student/task-creation/tasks', requireStudent, asyncRoute(async (req, res) => {
  const idempotencyKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim()
  if (!idempotencyKey) return safeError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'A task creation key is required.')
  const state = await readTaskStore()
  const existing = state.idempotency[`${req.student.studentId}:${idempotencyKey}`]
  if (existing) return res.status(200).json({ task: await studentTaskPayload(existing, req.student.studentId), replayed: true })
  const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(String) : []
  const files = (await getStudentFiles(req.student.studentId)).filter((file) => fileIds.includes(file.id) && !file.taskId)
  if (!files.some((file) => file.role === 'BRIEF')) return safeError(res, 400, 'BRIEF_REQUIRED', 'An assignment brief is required.', { fileIds: 'Select an assignment brief.' })
  const analysisId = String(req.body?.analysisId || '')
  const record = state.analyses.find((item) => item.id === analysisId && item.studentId === req.student.studentId && item.status === 'COMPLETED')
  if (!record || record.fileIds.length !== files.length || !record.fileIds.every((id) => fileIds.includes(id))) return safeError(res, 409, 'ANALYSIS_REQUIRED', 'Analyze these exact files before creating the task.')
  const analysis = record.result
  const createdAt = now()
  const task = { id: crypto.randomUUID(), studentId: req.student.studentId, title: String(analysis.title || 'New academic task').slice(0, 200), type: analysis.taskType || 'Academic task', subject: analysis.subject || null, deadline: analysis.deadline || null, status: 'FEASIBILITY_REVIEW', createdAt, updatedAt: createdAt, latestUpdate: { text: 'Your task has been submitted for SolveNest review.', createdAt }, analysis: { ...analysis, provisional: true }, review: { status: 'QUEUED', reviewerId: null, reviewedAt: null, decision: null }, nextAction: null }
  const creation = await withTaskStore((store) => {
    const replay = store.idempotency[`${req.student.studentId}:${idempotencyKey}`]
    if (replay) return { task: replay, replayed: true }
    const ownedFiles = store.files.filter((file) => fileIds.includes(file.id) && file.studentId === req.student.studentId && !file.taskId)
    if (ownedFiles.length !== fileIds.length || !ownedFiles.some((file) => file.role === 'BRIEF')) return { error: 'FILES_CHANGED' }
    const currentAnalysis = store.analyses.find((item) => item.id === analysisId && item.studentId === req.student.studentId && item.status === 'COMPLETED')
    if (!currentAnalysis || currentAnalysis.fileIds.length !== fileIds.length || !currentAnalysis.fileIds.every((id) => fileIds.includes(id))) return { error: 'ANALYSIS_CHANGED' }
    store.tasks.push(task)
    store.reviews.push({ id: crypto.randomUUID(), taskId: task.id, studentId: req.student.studentId, status: 'QUEUED', reviewerId: null, reviewedAt: null, decision: null, createdAt })
    store.files = store.files.map((file) => fileIds.includes(file.id) && file.studentId === req.student.studentId ? { ...file, taskId: task.id } : file)
    store.idempotency[`${req.student.studentId}:${idempotencyKey}`] = task
    addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, type: 'TaskSubmittedForReview', text: 'Your task has been submitted for SolveNest review.', createdAt })
    return { task, replayed: false }
  })
  if (creation.error) return safeError(res, 409, creation.error, 'The selected files or analysis changed. Refresh and try again.')
  if (!creation.replayed) try { await addNotification({ id: crypto.randomUUID(), studentId: req.student.studentId, title: 'Task submitted for review', body: task.latestUpdate.text, task: { title: task.title, ref: task.id }, route: `/student/tasks?task=${task.id}`, isRead: false, requiresAction: false, createdAt }) } catch (error) { console.error('[task] notification failed', error) }
  const summary = await studentTaskPayload(creation.task, req.student.studentId)
  publish(req.student.studentId, { type: 'TaskSubmittedForReview', task: summary })
  res.status(creation.replayed ? 200 : 201).json({ task: summary, replayed: creation.replayed, nextAction: null })
}))

app.get('/api/student/tasks', requireStudent, asyncRoute(async (req, res) => {
  const tasks = await Promise.all((await getStudentTasks(req.student.studentId)).map((task) => studentTaskPayload(task, req.student.studentId)))
  res.json({ tasks, meta: { page: Number(req.query.page || 1), perPage: Number(req.query.per_page || 20), total: tasks.length } })
}))

app.get('/api/student/tasks/:taskId/preview', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ task: await studentTaskPayload(task, req.student.studentId) })
}))

app.get('/api/student/dossiers', requireStudent, asyncRoute(async (req, res) => {
  const dossiers = await Promise.all((await getStudentTasks(req.student.studentId)).map(async (task) => dossierPayload(task, await getStudentFiles(req.student.studentId, task.id))))
  res.json({ dossiers, meta: { total: dossiers.length } })
}))

app.get('/api/student/dossiers/:taskId', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const files = await getStudentFiles(req.student.studentId, task.id)
  res.json({ dossier: dossierPayload(task, files) })
}))

app.get('/api/student/dossiers/:taskId/delivery', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const version = req.query.version ? Number(req.query.version) : null
  const delivery = version ? (task.deliveryVersions || []).find((item) => item.version === version) : (task.deliveryVersions || []).at(-1)
  if (!delivery) return safeError(res, 404, 'DELIVERY_NOT_FOUND', 'No delivery is available for this task.')
  res.json({ delivery })
}))

app.patch('/api/student/dossiers/:taskId/delivery/read', requireStudent, asyncRoute(async (req, res) => {
  const changed = await withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === req.params.taskId && item.studentId === req.student.studentId)
    if (!task) return false
    task.hasNewDelivery = false
    return true
  })
  if (!changed) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ ok: true })
}))

app.post('/api/student/dossiers/:taskId/delivery/accept', requireStudent, asyncRoute(async (req, res) => {
  const completed = await withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === req.params.taskId && item.studentId === req.student.studentId)
    if (!task || !task.deliveryVersions?.length) return null
    if (task.status === 'COMPLETED') return task
    if (task.status !== 'DELIVERED') return { error: 'DELIVERY_NOT_READY' }
    const stamp = now()
    task.status = 'COMPLETED'
    task.hasNewDelivery = false
    task.completedAt = stamp
    task.latestUpdate = { text: 'You accepted the delivery and completed this task.', createdAt: stamp }
    task.nextAction = null
    task.updatedAt = stamp
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'TaskCompleted', text: task.latestUpdate.text, createdAt: stamp })
    return task
  })
  if (!completed) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (completed.error) return safeError(res, 409, completed.error, 'The delivery is not ready to accept.')
  publish(req.student.studentId, { type: 'TaskCompleted', taskId: completed.id })
  res.json({ task: await studentTaskPayload(completed, req.student.studentId) })
}))

app.post('/api/student/dossiers/:taskId/revision', requireStudent, asyncRoute(async (req, res) => {
  const note = String(req.body?.note || '').trim()
  if (note.length < 10 || note.length > 2000) return safeError(res, 400, 'REVISION_NOTE_REQUIRED', 'Describe the requested revision in 10 to 2000 characters.')
  const result = await withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === req.params.taskId && item.studentId === req.student.studentId)
    if (!task) return { error: 'TASK_NOT_FOUND' }
    if (task.status !== 'DELIVERED' || !task.assignmentId) return { error: 'REVISION_NOT_AVAILABLE' }
    const plan = store.plans.find((item) => item.taskId === task.id && item.status === 'ACCEPTED')
    const requests = task.revisionRequests || []
    if (requests.length >= Number(plan?.revisionAllowance || 0)) return { error: 'REVISION_LIMIT_REACHED' }
    const stamp = now()
    const revision = { id: crypto.randomUUID(), note, status: 'requested', version: task.deliveryVersions?.at(-1)?.version || 1, requestedAt: stamp }
    task.revisionRequests = [...requests, revision]
    task.status = 'REVISION_REQUESTED'
    task.latestUpdate = { text: 'Your revision request has been sent to the Expert.', createdAt: stamp }
    task.updatedAt = stamp
    if (task.deliveryVersions?.length) task.deliveryVersions.at(-1).revision = { status: 'requested', remaining: Math.max(0, Number(plan?.revisionAllowance || 0) - task.revisionRequests.length) }
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'RevisionRequested', text: task.latestUpdate.text, createdAt: stamp })
    return { revision, expertId: task.assignedExpertId, assignmentId: task.assignmentId }
  })
  if (result.error) return safeError(res, result.error === 'TASK_NOT_FOUND' ? 404 : 409, result.error, 'A revision is not available for this delivery.')
  try { await runForExpert(result.expertId, () => notifyAssignmentRevision(result.assignmentId, result.revision)) }
  catch (error) { console.error('[revision] expert notification failed', error) }
  publishExpert(result.expertId, 'RevisionRequested', { assignmentId: result.assignmentId, note, at: result.revision.requestedAt })
  publish(req.student.studentId, { type: 'RevisionRequested', taskId: req.params.taskId })
  res.status(201).json({ revision: result.revision })
}))

app.get('/api/student/dashboard', requireStudent, asyncRoute(async (req, res) => {
  const tasks = await Promise.all((await getStudentTasks(req.student.studentId)).map((task) => studentTaskPayload(task, req.student.studentId)))
  const notifications = await listNotifications(req.student.studentId)
  const activity = (await readTaskStore()).activity.filter((item) => item.studentId === req.student.studentId).slice(0, 10)
  const unreadMessages = (await readTaskStore()).conversations.filter((item) => item.studentId === req.student.studentId).reduce((total, item) => total + Number(item.unread || 0), 0)
  res.json({ student: { id: req.student.studentId, name: req.student.name, role: req.student.role, email: req.student.email || null }, tasks, notifications, recentActivity: activity, upcomingActions: [], unreadMessages })
}))

app.get('/api/student/conversations', requireStudent, asyncRoute(async (req, res) => {
  const tasks = await getStudentTasks(req.student.studentId)
  const conversations = await withTaskStore((store) => tasks.map((task) => {
    let existing = store.conversations.find((item) => item.studentId === req.student.studentId && item.taskId === task.id)
    if (!existing) { existing = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, taskTitle: task.title, taskRef: task.id, subject: task.subject, status: task.status, state: 'active', needsStudent: false, unread: 0, participant: { name: 'SolveNest', role: 'Support', initials: 'SN' }, lastMessage: null, createdAt: task.createdAt, updatedAt: task.updatedAt }; store.conversations.push(existing) }
    const messages = store.messages.filter((message) => message.conversationId === existing.id)
    return { ...existing, lastMessage: messages.at(-1) || existing.lastMessage }
  }))
  res.json({ conversations })
}))

app.get('/api/student/conversations/:conversationId/messages', requireStudent, asyncRoute(async (req, res) => {
  const state = await readTaskStore()
  const conversation = state.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
  if (!conversation) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  const messages = state.messages.filter((message) => message.conversationId === conversation.id)
  res.json({ messages, meta: { total: messages.length, page: Number(req.query.page || 1), perPage: Number(req.query.per_page || 50) } })
}))

app.post('/api/student/conversations/:conversationId/messages', requireStudent, asyncRoute(async (req, res) => {
  const text = String(req.body?.body || '').trim()
  const fileId = String(req.body?.fileId || '').trim()
  if ((!text && !fileId) || text.length > 4000) return safeError(res, 400, 'MESSAGE_INVALID', 'Add a message or attachment.', { body: 'Enter a message or attach a file.' })
  const message = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
    if (!conversation) return null
    const attachment = fileId ? store.files.find((file) => file.id === fileId && file.studentId === req.student.studentId && file.conversationId === conversation.id && file.role === 'MESSAGE_ATTACHMENT') : null
    if (fileId && !attachment) return { error: 'ATTACHMENT_NOT_FOUND' }
    const attachments = attachment ? [{ id: attachment.id, name: attachment.originalName, type: attachment.mimeType, size: attachment.size }] : []
    const item = { id: crypto.randomUUID(), conversationId: conversation.id, studentId: req.student.studentId, from: 'student', author: req.student.name, role: 'Student', initials: req.student.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), body: text, attachments, createdAt: now(), status: 'sent' }
    store.messages.push(item)
    conversation.lastMessage = item
    conversation.updatedAt = item.createdAt
    conversation.staffUnread = true
    addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: conversation.taskId, type: 'StudentMessageSent', text: 'Message sent to SolveNest.', createdAt: item.createdAt })
    return item
  })
  if (!message) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  if (message.error) return safeError(res, 404, message.error, 'The selected attachment is unavailable.')
  publish(req.student.studentId, { type: 'MessageCreated', message })
  res.status(201).json({ message })
}))

app.patch('/api/student/conversations/:conversationId/read', requireStudent, asyncRoute(async (req, res) => {
  const changed = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
    if (!conversation) return false
    conversation.unread = 0
    return true
  })
  if (!changed) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  res.json({ ok: true })
}))

app.post('/api/student/conversations/:conversationId/files', requireStudent, (req, res, next) => {
  upload.single('file')(req, res, async (error) => {
    try {
      if (error || !req.file) return safeError(res, 400, 'FILE_UPLOAD_REJECTED', 'This file could not be uploaded.')
      if (await rejectInvalidUpload(res, req.file)) return
      const state = await readTaskStore()
      const conversation = state.conversations.find((item) => item.id === req.params.conversationId && item.studentId === req.student.studentId)
      if (!conversation) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
      const file = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: conversation.taskId, conversationId: conversation.id, role: 'MESSAGE_ATTACHMENT', originalName: path.basename(req.file.originalname), storageKey: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, state: 'READY', createdAt: now() }
      try { await persistUpload(req.file, file.storageKey) } catch { return safeError(res, 503, 'STORAGE_UNAVAILABLE', 'The file could not be stored securely.') }
      await withTaskStore((store) => store.files.push(file))
      res.status(201).json({ file: { id: file.id, name: file.originalName, type: file.mimeType, size: file.size, uploadedBy: 'student', uploadedAt: file.createdAt } })
    } catch (cause) { next(cause) }
  })
})

app.get('/api/student/payments/tasks', requireStudent, asyncRoute(async (req, res) => {
  const tasks = await getStudentTasks(req.student.studentId)
  const state = await readTaskStore()
  const rows = tasks.map((task) => { const plan = state.plans.find((item) => item.taskId === task.id && item.studentId === req.student.studentId) || null; return { id: task.id, taskId: task.id, title: task.title, status: task.status, amountDue: task.amountDue ?? null, funding: task.funding || null, plan, milestones: plan?.milestones || [], paymentModel: plan?.paymentModel || 'full', paymentStatus: state.payments.find((payment) => payment.taskId === task.id && payment.studentId === req.student.studentId)?.status || null } })
  res.json({ tasks: rows })
}))

app.get('/api/student/payments/tasks/:taskId/plan', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const plan = (await readTaskStore()).plans.find((item) => item.taskId === req.params.taskId && item.studentId === req.student.studentId && !['SUPERSEDED', 'REVISED'].includes(item.status))
  if (!task || !plan) return safeError(res, 404, 'PLAN_NOT_FOUND', 'No official plan is available yet.')
  res.json({ plan })
}))

app.post('/api/student/payments/plans/:planId/accept', requireStudent, asyncRoute(async (req, res) => {
  const result = await withTaskStore((store) => {
    const plan = store.plans.find((candidate) => candidate.id === req.params.planId && candidate.studentId === req.student.studentId)
    if (!plan) return { error: 'PLAN_NOT_FOUND' }
    if (plan.status === 'ACCEPTED') return { plan, replayed: true }
    if (plan.status !== 'READY') return { error: 'PLAN_NOT_READY' }
    const task = store.tasks.find((item) => item.id === plan.taskId && item.studentId === req.student.studentId)
    if (!task) return { error: 'TASK_NOT_FOUND' }
    const stamp = now()
    plan.status = 'ACCEPTED'
    plan.acceptedAt = stamp
    plan.canAccept = false
    task.status = 'PAYMENT_PENDING'
    task.amountDue = plan.amount
    task.funding = { model: plan.paymentModel || 'full', state: 'payment_required', amountTotal: plan.amount, amountFunded: 0, amountDue: plan.amount, milestones: plan.milestones || [] }
    task.latestUpdate = { text: 'You accepted the official plan. Funding is the next step.', createdAt: stamp }
    task.nextAction = { label: 'Fund your task', route: `/student/payments?task=${task.id}&section=funding` }
    task.updatedAt = stamp
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'PlanAccepted', text: task.latestUpdate.text, createdAt: stamp })
    return { plan, task }
  })
  if (result.error) return safeError(res, result.error === 'PLAN_NOT_FOUND' || result.error === 'TASK_NOT_FOUND' ? 404 : 409, result.error, result.error === 'PLAN_NOT_READY' ? 'This plan is no longer available for acceptance.' : 'Plan not found.')
  if (!result.replayed) {
    publish(req.student.studentId, { type: 'PlanAccepted', task: await studentTaskPayload(result.task, req.student.studentId) })
  }
  res.json({ plan: result.plan })
}))

app.get('/api/student/payments/tasks/:taskId/funding', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const state = await readTaskStore()
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const plan = state.plans.find((item) => item.taskId === task.id && item.studentId === req.student.studentId && item.status === 'ACCEPTED')
  const milestones = plan?.milestones || []
  const next = milestones.find((item) => item.fundingState === 'payment_required')
  const scopeFunded = state.payments.filter((item) => item.planId === plan?.id && item.studentId === req.student.studentId && item.scopeChangeId && item.status === 'succeeded').reduce((total, item) => total + item.amount, 0)
  const amountFunded = milestones.length ? scopeFunded + milestones.filter((item) => item.fundingState === 'funded').reduce((total, item) => total + item.amount, 0) : Number(task.funding?.amountFunded || 0)
  res.json({ taskId: task.id, model: plan?.paymentModel || 'full', currency: plan?.currency || 'LKR', amountTotal: plan?.amount || 0, amountFunded, amountDue: next?.amount ?? task.amountDue ?? 0, planConfirmed: plan?.status === 'ACCEPTED', workLocked: task.status === 'PAYMENT_PENDING', milestones, providerAvailable: Boolean(stripe), afterFunding: next?.sequence === 2 ? 'The approved delivery is released after this milestone is paid.' : null })
}))

app.post('/api/student/payments/checkout', requireStudent, asyncRoute(async (req, res) => {
  if (!stripe) return safeError(res, 503, 'PROVIDER_UNAVAILABLE', 'Payments are not configured yet.')
  const task = await getStudentTask(req.student.studentId, req.body?.taskId)
  const plan = (await readTaskStore()).plans.find((item) => item.id === req.body?.planId && item.studentId === req.student.studentId)
  if (!task || !plan || plan.taskId !== task.id || plan.status !== 'ACCEPTED') return safeError(res, 409, 'PLAN_NOT_ACCEPTED', 'Accept the current official plan before funding this task.')
  if (String(plan.currency).toLowerCase() !== (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase()) return safeError(res, 503, 'CURRENCY_UNAVAILABLE', 'Checkout is not configured for this quote currency. Contact support.')
  const nextMilestone = plan.paymentModel === 'milestone' ? plan.milestones?.find((item) => item.fundingState === 'payment_required') : null
  if (plan.paymentModel === 'milestone' && (!nextMilestone || nextMilestone.id !== req.body?.milestoneId)) return safeError(res, 409, 'MILESTONE_NOT_PAYABLE', 'Choose the next unpaid milestone.')
  if (plan.paymentModel !== 'milestone' && req.body?.milestoneId) return safeError(res, 400, 'MILESTONE_NOT_APPLICABLE', 'This plan requires one full payment.')
  if (plan.paymentModel !== 'milestone' && task.status !== 'PAYMENT_PENDING') return safeError(res, 409, 'TASK_NOT_PAYABLE', 'This task is not awaiting payment.')
  if (plan.paymentModel === 'milestone' && !['PAYMENT_PENDING', 'PAID', 'ASSIGNMENT_PENDING', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS'].includes(task.status)) return safeError(res, 409, 'TASK_NOT_PAYABLE', 'This task cannot receive a milestone payment now.')
  const amount = Number(nextMilestone?.amount ?? plan.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) return safeError(res, 400, 'PAYMENT_AMOUNT_REQUIRED', 'There is no payable official plan for this task.')
  const key = String(req.body?.idempotencyKey || crypto.randomUUID())
  const payments = (await readTaskStore()).payments.filter((payment) => payment.studentId === req.student.studentId && payment.planId === plan.id && (payment.milestoneId || null) === (nextMilestone?.id || null))
  const existing = payments.find((payment) => payment.idempotencyKey === key)
  if (payments.some((payment) => payment.status === 'succeeded')) return safeError(res, 409, 'PLAN_ALREADY_FUNDED', 'This plan has already been funded.')
  if (existing && ['failed', 'canceled'].includes(existing.status)) return safeError(res, 409, 'PAYMENT_RETRY_REQUIRED', 'Start a new payment attempt for this plan.')
  const active = existing || payments.find((payment) => !['failed', 'canceled', 'succeeded'].includes(payment.status))
  if (active?.providerId) {
    if (active.providerId.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(active.providerId)
      if (session.payment_status === 'paid') {
        await announceFundedTask(await recordPaymentStatus(active.providerId, 'succeeded', true, session))
        return safeError(res, 409, 'PLAN_ALREADY_FUNDED', 'This plan has already been funded. Refresh the task to see its new status.')
      }
      if (session.status !== 'expired') return res.json({ paymentId: active.id, checkoutUrl: session.url, status: active.status, provider: 'stripe' })
      await recordPaymentStatus(active.providerId, 'canceled')
      return safeError(res, 409, 'PAYMENT_RETRY_REQUIRED', 'This checkout expired. Start a new payment attempt.')
    } else {
      const intent = await stripe.paymentIntents.retrieve(active.providerId)
      if (['canceled', 'requires_payment_method'].includes(intent.status)) {
        await recordPaymentStatus(active.providerId, 'failed')
        return safeError(res, 409, 'PAYMENT_RETRY_REQUIRED', 'Start a new payment attempt for this plan.')
      }
      return safeError(res, 409, 'PAYMENT_RETRY_REQUIRED', 'A previous payment attempt must be resolved before starting hosted checkout.')
    }
  }
  const attempt = payments.filter((payment) => ['failed', 'canceled'].includes(payment.status)).length
  const origin = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: task.id,
    customer_email: req.student.email || undefined,
    line_items: [{ price_data: { currency: process.env.STRIPE_CURRENCY || 'lkr', unit_amount: Math.round(amount * 100), product_data: { name: nextMilestone ? `SolveNest ${nextMilestone.name} · ${plan.reference}` : `SolveNest plan ${plan.reference || task.id}` } }, quantity: 1 }],
    success_url: `${origin.replace(/\/$/, '')}/student/payments?task=${encodeURIComponent(task.id)}&section=history`,
    cancel_url: `${origin.replace(/\/$/, '')}/student/payments?task=${encodeURIComponent(task.id)}&section=funding`,
    metadata: { taskId: task.id, studentId: req.student.studentId, planId: plan.id, milestoneId: nextMilestone?.id || '' },
    payment_intent_data: { metadata: { taskId: task.id, studentId: req.student.studentId, planId: plan.id, milestoneId: nextMilestone?.id || '' } },
  }, { idempotencyKey: `plan-${plan.id}-${nextMilestone?.id || 'full'}-attempt-${attempt}` })
  const payment = { id: crypto.randomUUID(), providerId: session.id, studentId: req.student.studentId, taskId: task.id, planId: plan.id, milestoneId: nextMilestone?.id || null, milestoneName: nextMilestone?.name || null, amount, currency: process.env.STRIPE_CURRENCY || 'lkr', status: 'pending', idempotencyKey: key, createdAt: now() }
  let stored
  try {
    stored = await withTaskStore((store) => {
      const prior = store.payments.find((item) => item.providerId === session.id)
      if (prior) return prior
      store.payments.push(payment)
      return payment
    })
  } catch (error) {
    if (error.message !== 'APP_STATE_CONFLICT') throw error
    stored = (await readTaskStore()).payments.find((item) => item.providerId === session.id && item.studentId === req.student.studentId)
    if (!stored) throw error
  }
  res.status(stored.id === payment.id ? 201 : 200).json({ paymentId: stored.id, checkoutUrl: session.url, provider: 'stripe', status: stored.status })
}))

app.get('/api/student/payments/payments/:paymentId/status', requireStudent, asyncRoute(async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment) return safeError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  if (stripe && payment.providerId) {
    try {
      const provider = payment.providerId.startsWith('cs_') ? await stripe.checkout.sessions.retrieve(payment.providerId) : await stripe.paymentIntents.retrieve(payment.providerId)
      const status = payment.providerId.startsWith('cs_') ? provider.payment_status === 'paid' ? 'succeeded' : provider.status === 'expired' ? 'canceled' : 'pending' : provider.status
      payment.status = status
      const fundedTask = await recordPaymentStatus(payment.providerId, status, true, provider)
      await announceFundedTask(fundedTask)
    } catch (error) { console.error('[payment-status] reconciliation pending', error); return safeError(res, 503, 'PAYMENT_STATUS_PENDING', 'Payment status could not be finalized yet. Please try again.') }
  }
  res.json(payment)
}))

app.get('/api/student/payments/history', requireStudent, asyncRoute(async (req, res) => {
  const payments = (await readTaskStore()).payments.filter((item) => item.studentId === req.student.studentId && (!req.query.task || item.taskId === req.query.task))
  res.json({ payments })
}))

app.get('/api/student/payments/payments/:paymentId', requireStudent, asyncRoute(async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment) return safeError(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  res.json(payment)
}))

app.get('/api/student/payments/payments/:paymentId/receipt', requireStudent, asyncRoute(async (req, res) => {
  const payment = (await readTaskStore()).payments.find((item) => item.id === req.params.paymentId && item.studentId === req.student.studentId)
  if (!payment || payment.status !== 'succeeded') return safeError(res, 404, 'RECEIPT_NOT_FOUND', 'Receipt is not available yet.')
  if (!stripe || !payment.providerId) return safeError(res, 503, 'RECEIPT_UNAVAILABLE', 'The payment provider is unavailable.')
  const session = payment.providerId.startsWith('cs_') ? await stripe.checkout.sessions.retrieve(payment.providerId) : null
  const intentId = typeof session?.payment_intent === 'string' ? session.payment_intent : session?.payment_intent?.id || payment.providerId
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] })
  const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge
  if (!charge?.receipt_url) return safeError(res, 404, 'RECEIPT_NOT_FOUND', 'The payment provider has not issued a receipt yet.')
  res.json({ url: charge.receipt_url, filename: null })
}))

app.get('/api/student/payments/tasks/:taskId/scope-change', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  const change = (await readTaskStore()).scopeChanges.find((item) => item.taskId === req.params.taskId && item.studentId === req.student.studentId && ['REQUESTED', 'AWAITING_PAYMENT'].includes(item.status))
  if (!task || !change) return safeError(res, 404, 'SCOPE_CHANGE_NOT_FOUND', 'No scope change is waiting for you.')
  res.json({ scopeChange: { ...change, canAccept: true } })
}))

app.post('/api/student/payments/scope-changes/:scopeChangeId/accept', requireStudent, studentRoute(async (req, res) => {
  const state = await readTaskStore()
  const change = state.scopeChanges.find((candidate) => candidate.id === req.params.scopeChangeId && candidate.studentId === req.student.studentId)
  if (!change) return safeError(res, 404, 'SCOPE_CHANGE_NOT_FOUND', 'Scope change not found.')
  if (change.status === 'ACCEPTED') return res.json({ scopeChange: change })
  if (!['REQUESTED', 'AWAITING_PAYMENT'].includes(change.status)) return safeError(res, 409, 'SCOPE_CHANGE_NOT_READY', 'This scope change can no longer be accepted.')
  const task = state.tasks.find((item) => item.id === change.taskId && item.studentId === req.student.studentId)
  const plan = state.plans.find((item) => item.id === change.planId && item.status === 'ACCEPTED')
  if (!task || !plan) return safeError(res, 409, 'SCOPE_CHANGE_NOT_READY', 'The original accepted plan is unavailable.')
  if (!['PAID', 'ASSIGNMENT_PENDING', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS'].includes(task.status)) return safeError(res, 409, 'SCOPE_CHANGE_TOO_LATE', 'This task has moved beyond the point where this scope change can be accepted.')
  if (change.requested.priceDelta > 0 && String(plan.currency).toLowerCase() !== (process.env.STRIPE_CURRENCY || 'lkr').toLowerCase()) return safeError(res, 503, 'CURRENCY_UNAVAILABLE', 'Checkout is not configured for this quote currency. Contact support.')
  if (change.requested.priceDelta === 0) {
    const result = await withTaskStore((store) => {
      const current = store.scopeChanges.find((item) => item.id === change.id)
      if (!current || current.status === 'ACCEPTED') return { change: current, event: null }
      const currentTask = store.tasks.find((item) => item.id === current.taskId)
      const currentPlan = store.plans.find((item) => item.id === current.planId)
      return { change: current, event: applyApprovedScopeChange(store, current, currentTask, currentPlan, now()) }
    })
    try { await announceFundedTask(result.event) }
    catch (error) { console.error('[scope-change] Expert sync pending', error) }
    return res.json({ scopeChange: result.change })
  }
  if (!stripe) return safeError(res, 503, 'PROVIDER_UNAVAILABLE', 'Payment is required for this scope change, but checkout is unavailable.')
  const attempts = state.payments.filter((item) => item.scopeChangeId === change.id)
  const active = attempts.find((item) => !['failed', 'canceled', 'succeeded'].includes(item.status))
  if (active?.providerId) {
    const existing = await stripe.checkout.sessions.retrieve(active.providerId)
    if (existing.payment_status === 'paid') {
      try { await announceFundedTask(await recordPaymentStatus(active.providerId, 'succeeded', true, existing)) }
      catch (error) { console.error('[scope-change] payment reconciliation pending', error); return safeError(res, 503, 'SCOPE_CHANGE_PENDING', 'Payment was received; the scope update is still being finalized.') }
      return res.json({ scopeChange: (await readTaskStore()).scopeChanges.find((item) => item.id === change.id) })
    }
    if (existing.status !== 'expired') return res.json({ scopeChange: { ...change, checkoutUrl: existing.url } })
    await recordPaymentStatus(active.providerId, 'canceled')
  }
  const attempt = attempts.filter((item) => ['failed', 'canceled'].includes(item.status)).length + (active ? 1 : 0)
  const origin = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: task.id,
    customer_email: req.student.email || undefined,
    line_items: [{ price_data: { currency: process.env.STRIPE_CURRENCY || 'lkr', unit_amount: change.requested.priceDelta * 100, product_data: { name: `SolveNest scope change · ${plan.reference}` } }, quantity: 1 }],
    success_url: `${origin.replace(/\/$/, '')}/student/payments?task=${encodeURIComponent(task.id)}&section=history`,
    cancel_url: `${origin.replace(/\/$/, '')}/student/payments?task=${encodeURIComponent(task.id)}&section=scope-change`,
    metadata: { taskId: task.id, studentId: task.studentId, planId: plan.id, scopeChangeId: change.id },
  }, { idempotencyKey: `scope-${change.id}-attempt-${attempt}` })
  const payment = { id: crypto.randomUUID(), providerId: session.id, studentId: task.studentId, taskId: task.id, taskTitle: task.title, planId: plan.id, planReference: plan.reference, scopeChangeId: change.id, type: 'Scope change', amount: change.requested.priceDelta, currency: process.env.STRIPE_CURRENCY || 'lkr', status: 'pending', createdAt: now() }
  const stored = await withTaskStore((store) => {
    const current = store.scopeChanges.find((item) => item.id === change.id)
    if (!current || current.status === 'ACCEPTED') return current
    if (!store.payments.some((item) => item.providerId === session.id)) store.payments.push(payment)
    current.status = 'AWAITING_PAYMENT'
    current.paymentId = store.payments.find((item) => item.providerId === session.id)?.id
    return current
  })
  if (stored?.status === 'ACCEPTED') return res.json({ scopeChange: stored })
  res.json({ scopeChange: { ...stored, checkoutUrl: session.url } })
}))

app.post('/api/student/payments/scope-changes/:scopeChangeId/reject', requireStudent, asyncRoute(async (req, res) => {
  const change = await withTaskStore((store) => {
    const current = store.scopeChanges.find((item) => item.id === req.params.scopeChangeId && item.studentId === req.student.studentId)
    if (!current) return null
    if (!['REQUESTED', 'AWAITING_PAYMENT'].includes(current.status)) return { error: 'SCOPE_CHANGE_NOT_READY' }
    const payment = store.payments.find((item) => item.scopeChangeId === current.id && !['failed', 'canceled'].includes(item.status))
    if (payment?.status === 'succeeded') return { error: 'SCOPE_CHANGE_FUNDED' }
    if (payment) payment.status = 'canceled'
    current.status = 'REJECTED'
    current.canAccept = false
    current.rejectedAt = now()
    return current
  })
  if (!change) return safeError(res, 404, 'SCOPE_CHANGE_NOT_FOUND', 'Scope change not found.')
  if (change.error) return safeError(res, 409, change.error, 'This scope change can no longer be rejected.')
  res.json({ scopeChange: change })
}))

app.post('/api/student/explain/tasks/:taskId/explain', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (!task.deliveryVersions?.length) return safeError(res, 409, 'DELIVERY_REQUIRED', 'Explain & Defend becomes available after delivery.')
  const limit = Math.max(1, Number(process.env.EXPLAIN_DAILY_LIMIT || 30))
  const since = Date.now() - 24 * 60 * 60 * 1000
  const used = ((await readTaskStore()).explainRequests || []).filter((item) => item.studentId === req.student.studentId && new Date(item.createdAt).getTime() > since).length
  if (used >= limit) return safeError(res, 429, 'EXPLAIN_DAILY_LIMIT', 'The daily Explain & Defend limit has been reached.')
  if (!await limited(`explain:${req.student.studentId}`, 30)) return safeError(res, 429, 'EXPLAIN_RATE_LIMITED', 'Explain requests are temporarily limited.')
  if (req.body?.artifactId) {
    const artifact = await ownedFile(req.student.studentId, String(req.body.artifactId))
    if (!artifact || artifact.taskId !== task.id) return safeError(res, 404, 'ARTIFACT_NOT_FOUND', 'Choose a file from this task.')
  }
  const state = await readTaskStore()
  let session = state.explainSessions.find((item) => item.id === req.body?.sessionId && item.studentId === req.student.studentId && item.taskId === task.id)
  if (!session) { session = { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, mode: req.body?.mode || 'explain', title: task.title, artifactId: req.body?.artifactId || null, trail: [], createdAt: now(), updatedAt: now() }; await withTaskStore((store) => store.explainSessions.push(session)) }
  try {
    const result = await solvyOperation('explain', { taskId: task.id, sessionId: session.id, artifactId: req.body?.artifactId || null, mode: req.body?.mode || 'explain', selection: req.body?.selection || null, question: req.body?.question || null, prompt: req.body?.prompt || null, answers: req.body?.answers || null, scope: req.body?.scope || null, round: req.body?.round || null })
    await withTaskStore((store) => { const stamp = now(); const item = store.explainSessions.find((entry) => entry.id === session.id); if (item) Object.assign(item, { updatedAt: stamp, lastResult: result }); store.explainRequests = (store.explainRequests || []).filter((entry) => new Date(entry.createdAt).getTime() > since); store.explainRequests.push({ studentId: req.student.studentId, taskId: task.id, createdAt: stamp }); addActivity(store, { id: crypto.randomUUID(), studentId: req.student.studentId, taskId: task.id, type: 'ExplainRequest', text: 'Explain & Defend request completed.', createdAt: stamp }) })
    res.json({ ...result, sessionId: session.id })
  } catch (error) { safeError(res, 503, 'EXPLAIN_UNAVAILABLE', 'Explain & Defend is not configured or temporarily unavailable.') }
}))

app.get('/api/student/explain/tasks/:taskId/rubric', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  res.json({ criteria: task.analysis?.rubric?.criteria || [], source: task.analysis?.rubric?.sourceFileId || null })
}))

app.get('/api/student/explain/tasks/:taskId/sessions', requireStudent, asyncRoute(async (req, res) => {
  const task = await getStudentTask(req.student.studentId, req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  const sessions = (await readTaskStore()).explainSessions.filter((item) => item.taskId === task.id && item.studentId === req.student.studentId)
  res.json({ sessions })
}))

app.get('/api/student/explain/sessions/:sessionId', requireStudent, asyncRoute(async (req, res) => {
  const session = (await readTaskStore()).explainSessions.find((item) => item.id === req.params.sessionId && item.studentId === req.student.studentId)
  if (!session) return safeError(res, 404, 'EXPLAIN_SESSION_NOT_FOUND', 'Explain session not found.')
  res.json({ session })
}))

app.patch('/api/student/explain/sessions/:sessionId', requireStudent, asyncRoute(async (req, res) => {
  const patch = req.body || {}
  if (patch.artifactId) {
    const artifact = await ownedFile(req.student.studentId, String(patch.artifactId))
    const original = (await readTaskStore()).explainSessions.find((item) => item.id === req.params.sessionId && item.studentId === req.student.studentId)
    if (!artifact || !original || artifact.taskId !== original.taskId) return safeError(res, 400, 'ARTIFACT_INVALID', 'Choose a file from this task.')
  }
  const session = await withTaskStore((store) => {
    const item = store.explainSessions.find((candidate) => candidate.id === req.params.sessionId && candidate.studentId === req.student.studentId)
    if (!item) return null
    if (typeof patch.title === 'string') item.title = patch.title.trim().slice(0, 160)
    if (typeof patch.mode === 'string' && ['explain', 'why', 'quiz', 'lecturer', 'defend'].includes(patch.mode)) item.mode = patch.mode
    if (typeof patch.anchor === 'string') item.anchor = patch.anchor.slice(0, 300)
    if (typeof patch.artifactId === 'string') item.artifactId = patch.artifactId
    if (Array.isArray(patch.trail)) item.trail = patch.trail.slice(0, 50).map((entry) => ({ key: String(entry?.key || '').slice(0, 100), label: String(entry?.label || '').slice(0, 160), status: String(entry?.status || 'complete').slice(0, 30) }))
    item.updatedAt = now()
    return item
  })
  if (!session) return safeError(res, 404, 'EXPLAIN_SESSION_NOT_FOUND', 'Explain session not found.')
  res.json({ session })
}))

app.get('/api/student/explain/usage', requireStudent, asyncRoute(async (req, res) => {
  const state = await readTaskStore()
  const since = Date.now() - 24 * 60 * 60 * 1000
  const used = (state.explainRequests || []).filter((item) => item.studentId === req.student.studentId && new Date(item.createdAt).getTime() > since).length
  const limit = Number(process.env.EXPLAIN_DAILY_LIMIT || 30)
  res.json({ remaining: Math.max(0, limit - used), limit, periodLabel: 'Today' })
}))

app.get('/api/student/explain/artifacts/:artifactId/content', requireStudent, asyncRoute(async (req, res) => {
  const file = await ownedFile(req.student.studentId, req.params.artifactId)
  if (!file) return safeError(res, 404, 'ARTIFACT_NOT_FOUND', 'Artifact not found.')
  const url = await signedObjectUrl(file.storageKey, file.originalName)
  res.json({ kind: 'document', title: file.originalName, sourceUrl: url, text: null })
}))

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) { try { out[key] = decodeURIComponent(value) } catch { /* Ignore a malformed cookie without rejecting the request. */ } }
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

function clearStudentCookies(res) {
  const expired = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  res.setHeader('Set-Cookie', [`sn_access=; ${expired}`, `sn_refresh=; ${expired}`, `${COOKIE}=; ${expired}`])
}

function accountSessions(req) {
  if (hasSupabaseAuth()) return { sessions: [{ id: 'current-browser', device: req.student.device, createdAt: now(), lastActiveAt: now() }], activeSessionId: 'current-browser', sessionRevoke: false }
  return { sessions: studentSessionList(req.student.studentId, req.student.id), activeSessionId: req.student.id, sessionRevoke: true }
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

  if (process.env.NODE_ENV === 'production' || process.env.DEV_DEMO_SESSION !== '1') {
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
  const saved = createSession({ id: session.studentId, role: session.role, name: session.name, email: null }, session.device)
  setSessionCookie(res, saved.id)
  return saved
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

async function ensureExpertSession(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const sid = cookies[EXPERT_COOKIE]
  if (sid && hasSupabase()) {
    const record = await supabaseGetAppSession(sid)
    if (record?.role === 'Expert') return { id: sid, role: 'Expert', expertId: record.user_id, studentId: record.user_id, createdAt: record.created_at, lastActiveAt: record.last_active_at, device: record.device }
  }
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

app.post('/api/expert/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim()
  const password = String(req.body?.password || '')
  if (!email || !password) return safeError(res, 400, 'CREDENTIALS_REQUIRED', 'Enter your email and password.')
  if (!await limited(`expert-login:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth()) return safeError(res, 503, 'EXPERT_LOGIN_UNAVAILABLE', 'Expert sign-in is not configured yet.')
  try {
    const { data, error } = await supabaseSignIn({ email, password })
    if (error || !data?.user) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
    const profile = await supabaseProfile(data.user.id)
    if (profile?.role !== 'Expert') return safeError(res, 403, 'EXPERT_ACCESS_REQUIRED', 'This account does not have Expert access.')
    const sid = crypto.randomUUID()
    await supabaseCreateAppSession(sid, profile.id, 'Expert', userAgentLabel(req.headers['user-agent']))
    res.setHeader('Set-Cookie', `${EXPERT_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
    res.json({ user: { id: profile.id, role: 'Expert', name: profile.name, email: profile.email } })
  } catch (error) {
    console.error('[expert-login]', error)
    safeError(res, 503, 'EXPERT_LOGIN_UNAVAILABLE', 'Expert sign-in could not be completed. Please try again later.')
  }
}))

async function requireExpert(req, res, next) {
  try {
    req.expert = await ensureExpertSession(req, res)
    if (req.expert.expertId !== 'demo-expert') {
      const profile = await supabaseProfile(req.expert.expertId)
      if (profile?.role !== 'Expert') {
        if (hasSupabase()) await supabaseDeleteAppSession(req.expert.id)
        else expertSessions.delete(req.expert.id)
        return safeError(res, 401, 'EXPERT_ACCESS_REQUIRED', 'This account no longer has Expert access.')
      }
      req.expert.name = profile.name
      req.expert.email = profile.email
    }
    if (!req.path.endsWith('/logout') && !req.path.endsWith('/me')) {
      const accountState = await runForExpert({ id: req.expert.expertId, name: req.expert.name }, async () => (await readExpertStore()).accountState)
      if (accountState && accountState !== 'active') return safeError(res, 403, 'EXPERT_ACCOUNT_SUSPENDED', 'This Expert account is not active.')
    }
    next()
  } catch (error) {
    safeError(res, error.status || 503, 'EXPERT_ACCESS_REQUIRED', error.status ? 'Expert sign in is required.' : 'Expert access could not be verified right now.')
  }
}

function expertRoute(handler) {
  return (req, res, next) => {
    Promise.resolve().then(() => runForExpert({ id: req.expert.expertId, name: req.expert.name }, () => handler(req, res, next))).catch((error) => {
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

function publishExpert(expertId, type, payload) { publish('expert:' + expertId, { type, ...payload }) }

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
  QA_FILES_LOCKED: 'Submission files are locked while quality review is in progress or approved.',
  QA_FILES_CHANGED: 'The submission changed after quality approval. Submit it for quality review again.',
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
  if (!await limited(`expert-update:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many updates. Try again shortly.')
  const result = await appendProgressUpdate(req.params.assignmentId, req.body?.body)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  res.status(201).json(result)
}))

app.post('/api/expert/assignments/:assignmentId/work/state', requireExpert, expertRoute(async (req, res) => {
  if (!await limited(`expert-state:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many changes. Try again shortly.')
  const result = await updateAssignmentWorkState(req.params.assignmentId, req.body?.state)
  if (!result.ok) return expertMutationError(res, result.error)
  const studentChange = await withTaskStore((store) => {
    const task = store.tasks.find((item) => item.assignmentId === req.params.assignmentId && item.assignedExpertId === req.expert.expertId)
    if (!task || ['DELIVERED', 'COMPLETED', 'DECLINED'].includes(task.status)) return null
    const statuses = { assigned: 'ASSIGNMENT_PENDING', working: 'IN_PROGRESS', qa_review: 'QUALITY_REVIEW', changes_requested: 'QUALITY_CHANGES', ready_to_deliver: 'READY_TO_DELIVER' }
    const labels = { assigned: 'Your Expert has received the assignment.', working: 'Expert work is in progress.', qa_review: 'Your work is in quality review.', changes_requested: 'Quality review requested changes from the Expert.', ready_to_deliver: 'Quality review is complete and delivery is being prepared.' }
    if (!statuses[result.workState]) return null
    const stamp = now()
    task.status = statuses[result.workState]
    task.latestUpdate = { text: labels[result.workState], createdAt: stamp }
    task.updatedAt = stamp
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'ExpertWorkStateChanged', text: task.latestUpdate.text, createdAt: stamp })
    return { studentId: task.studentId, taskId: task.id, status: task.status }
  })
  if (studentChange) publish(studentChange.studentId, { type: 'TaskProgressUpdated', taskId: studentChange.taskId, status: studentChange.status })
  expertChanged(req, result)
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/messages', requireExpert, expertRoute(async (req, res) => {
  if (!await limited(`expert-message:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Too many messages. Try again shortly.')
  const result = await postAssignmentMessage(req.params.assignmentId, req.body?.body)
  if (!result.ok) return expertMutationError(res, result.error)
  const studentMessage = await withTaskStore((store) => {
    const task = store.tasks.find((item) => item.assignmentId === req.params.assignmentId && item.assignedExpertId === req.expert.expertId)
    if (!task) return null
    let conversation = store.conversations.find((item) => item.studentId === task.studentId && item.taskId === task.id)
    if (!conversation) {
      conversation = { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, taskTitle: task.title, taskRef: task.id, subject: task.subject, status: task.status, state: 'active', needsStudent: false, unread: 0, staffUnread: false, participant: { name: 'SolveNest', role: 'Support', initials: 'SN' }, lastMessage: null, createdAt: task.createdAt, updatedAt: task.updatedAt }
      store.conversations.push(conversation)
    }
    const item = { ...result.message, conversationId: conversation.id, studentId: task.studentId, from: 'expert', role: 'Expert', attachments: result.message.attachments || [], status: 'sent' }
    store.messages.push(item)
    conversation.lastMessage = item
    conversation.updatedAt = item.createdAt
    conversation.unread = Number(conversation.unread || 0) + 1
    conversation.staffUnread = true
    return { studentId: task.studentId, taskId: task.id, message: item }
  })
  if (studentMessage) publish(studentMessage.studentId, { type: 'MessageCreated', taskId: studentMessage.taskId, message: studentMessage.message })
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
  if (!await limited(`expert-upload:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Uploads are temporarily limited. Try again shortly.')
  const uploadError = await new Promise((resolve) => upload.single('file')(req, res, (error) => resolve(error)))
  if (uploadError) {
    const code = uploadError.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'FILE_UPLOAD_REJECTED'
    return expertMutationError(res, code)
  }
  if (!req.file) return expertMutationError(res, 'FILE_UPLOAD_REJECTED')
  if (await rejectInvalidUpload(res, req.file)) return
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
  if (!await limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await submitAssignmentForQa(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/feedback/:feedbackId/resolve', requireExpert, expertRoute(async (req, res) => {
  if (!await limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await resolveQaFeedback(req.params.assignmentId, req.params.feedbackId)
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/resubmit', requireExpert, expertRoute(async (req, res) => {
  if (!await limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
  const result = await resubmitAssignmentForQa(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/delivery', requireExpert, expertRoute(async (req, res) => {
  if (!await limited(`expert-delivery:${req.expert.expertId}`, 12)) return safeError(res, 429, 'RATE_LIMITED', 'Too many delivery attempts. Try again shortly.')
  const fundedTask = (await readTaskStore()).tasks.find((item) => item.assignmentId === req.params.assignmentId && item.assignedExpertId === req.expert.expertId)
  if (fundedTask?.funding?.model === 'milestone' && Number(fundedTask.amountDue || 0) > 0) return safeError(res, 409, 'FINAL_MILESTONE_DUE', 'The final milestone must be paid before delivery is released.')
  const result = await deliverAssignment(req.params.assignmentId, { note: req.body?.note })
  if (!result.ok) return expertMutationError(res, result.error)
  const studentDelivery = await syncStudentDelivery(req.expert.expertId, req.params.assignmentId)
  if (studentDelivery) {
    try { await addNotification({ id: crypto.randomUUID(), studentId: studentDelivery.task.studentId, title: 'Your delivery is ready', body: `Version ${studentDelivery.delivery.version} is ready to review.`, task: { title: studentDelivery.task.title, ref: studentDelivery.task.id }, route: `/student/files?task=${studentDelivery.task.id}&section=delivery`, isRead: false, requiresAction: true, createdAt: studentDelivery.delivery.deliveredAt }) }
    catch (error) { console.error('[delivery] student notification failed', error) }
    publish(studentDelivery.task.studentId, { type: 'TaskDelivered', taskId: studentDelivery.task.id })
  }
  expertChanged(req, result)
  res.json(result)
}))

app.post('/api/expert/assignments/:assignmentId/revision/begin', requireExpert, expertRoute(async (req, res) => {
  const state = await readTaskStore()
  const task = state.tasks.find((item) => item.assignmentId === req.params.assignmentId && item.assignedExpertId === req.expert.expertId)
  if (task && task.status !== 'REVISION_REQUESTED') return safeError(res, 409, 'REVISION_NOT_REQUESTED', 'The Student has not requested a revision.')
  const result = await beginAssignmentRevision(req.params.assignmentId)
  if (!result.ok) return expertMutationError(res, result.error)
  if (task) {
    await withTaskStore((store) => {
      const current = store.tasks.find((item) => item.id === task.id && item.status === 'REVISION_REQUESTED')
      if (!current) return
      current.status = 'REVISION_IN_PROGRESS'
      current.latestUpdate = { text: 'Your revision is in progress.', createdAt: now() }
      current.updatedAt = current.latestUpdate.createdAt
      if (current.deliveryVersions?.length) current.deliveryVersions.at(-1).revision.status = 'in_progress'
    })
    publish(task.studentId, { type: 'RevisionStarted', taskId: task.id })
  }
  expertChanged(req, result)
  publishExpert(req.expert.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/expert/assignments/__provision', requireExpert, expertRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return safeError(res, 404, 'NOT_FOUND', 'Not found.')
  if (!await limited(`expert-provision:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many provisioning requests. Try again shortly.')
  const result = await provisionAssignment(req.body || {})
  if (!result.ok) return expertMutationError(res, result.error)
  publishExpert(req.expert.expertId, 'AssignmentChanged', { assignmentId: result.assignment.id, workState: result.assignment.workState, at: now() })
  res.status(201).json(result)
}))

app.post('/api/expert/assignments/:assignmentId/qa/outcome', requireExpert, expertRoute(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return safeError(res, 404, 'NOT_FOUND', 'Not found.')
  if (!await limited(`expert-qa:${req.expert.expertId}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Too many quality review actions. Try again shortly.')
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
  if (!await limited(`expert-provision:${req.expert.expertId}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many provisioning requests. Try again shortly.')
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
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: now() })}\n\n`)
  subscribe('expert:' + req.expert.expertId, res)
})
app.post('/api/expert/notifications/read-all', requireExpert, expertRoute(async (_req, res) => res.json(await markExpertNotificationsRead())))

app.post('/api/expert/logout', requireExpert, expertRoute(async (req, res) => {
  if (hasSupabase() && req.expert.expertId !== 'demo-expert') await supabaseDeleteAppSession(req.expert.id)
  else expertSessions.delete(req.expert.id)
  res.setHeader('Set-Cookie', `${EXPERT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
}))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'solvenest-server' })
})
app.get('/api/ready', asyncRoute(async (_req, res) => {
  const checks = await Promise.allSettled([
    Promise.race([readTaskStore(), new Promise((_resolve, reject) => setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), 5000))]),
    checkMalwareScanner(),
  ])
  const ready = checks[0].status === 'fulfilled' && checks[1].status === 'fulfilled' && checks[1].value === true
  res.status(ready ? 200 : 503).json({ ok: ready, service: 'solvenest-server' })
}))

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  if (!await limited(`student-register:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before creating another account.')
  const { name, email, password } = req.body || {}
  if (String(name || '').trim().length < 2) return safeError(res, 400, 'NAME_REQUIRED', 'Enter your full name.', { name: 'Enter your full name.' })
  if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) return safeError(res, 400, 'EMAIL_INVALID', 'Enter a valid email address.', { email: 'Enter a valid email address.' })
  if (String(password || '').length < 12) return safeError(res, 400, 'PASSWORD_TOO_SHORT', 'Password must be at least 12 characters.', { password: 'Use at least 12 characters.' })
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
}))

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  if (!await limited(`student-login:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying to sign in again.')
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
}))

app.post('/api/auth/password-reset', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return safeError(res, 400, 'EMAIL_INVALID', 'Enter a valid email address.')
  if (!await limited(`password-reset:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth() || !process.env.PUBLIC_APP_URL) return safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Password recovery is not configured yet.')
  try {
    const { error } = await supabaseRequestPasswordReset(email)
    if (error) throw error
    res.json({ ok: true })
  } catch {
    safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'The reset email could not be requested. Please try again later.')
  }
}))

app.post('/api/auth/password-reset/complete', asyncRoute(async (req, res) => {
  const { accessToken, refreshToken, password } = req.body || {}
  if (!accessToken || !refreshToken || String(password || '').length < 12) return safeError(res, 400, 'RESET_INVALID', 'The reset link or new password is invalid.')
  if (!await limited(`password-reset-complete:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  if (!hasSupabaseAuth()) return safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Password recovery is not configured yet.')
  try {
    const { error } = await supabaseUpdatePassword(accessToken, refreshToken, password)
    if (error) return safeError(res, 400, 'RESET_INVALID', 'The reset link has expired or is invalid.')
    const user = await supabaseUser(accessToken)
    if (user?.id) await supabaseRevokeUserSessions(user.id)
    res.json({ ok: true })
  } catch {
    safeError(res, 503, 'RECOVERY_UNAVAILABLE', 'Your password could not be updated. Please try again later.')
  }
}))

const contactUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, /\.(pdf|png|jpe?g|docx)$/i.test(file.originalname)) })
app.post('/api/contact', (req, res, next) => contactUpload.single('attachment')(req, res, (error) => error ? safeError(res, 400, 'ATTACHMENT_INVALID', 'Choose a PDF, PNG, JPG or DOCX file smaller than 5 MB.') : next()), asyncRoute(async (req, res) => {
  if (req.file && await rejectInvalidUpload(res, req.file)) return
  const { intent, name, email, message, ...details } = req.body || {}
  if (!['general', 'task', 'payment', 'technical', 'business'].includes(intent) || !String(name || '').trim() || !/^\S+@\S+\.\S+$/.test(String(email || '')) || !String(message || '').trim()) return safeError(res, 400, 'CONTACT_INVALID', 'Complete the required contact fields.')
  if (!await limited(`contact:${req.ip}`, 5)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before sending another message.')
  if (!hasEmail() || !process.env.CONTACT_EMAIL) return safeError(res, 503, 'CONTACT_UNAVAILABLE', 'Contact messages are not configured yet.')
  const lines = [`Type: ${intent}`, `Name: ${String(name).trim()}`, `Email: ${String(email).trim()}`, ...Object.entries(details).filter(([, value]) => typeof value === 'string').map(([key, value]) => `${key}: ${value}`), '', String(message)]
  try {
    const result = await sendEmail({ to: process.env.CONTACT_EMAIL, subject: `SolveNest ${intent} enquiry`, text: lines.join('\n'), replyTo: String(email).trim(), attachments: req.file ? [{ filename: req.file.originalname, content: req.file.buffer }] : [] })
    if (!result.delivered) throw new Error('CONTACT_NOT_DELIVERED')
    res.status(202).json({ ok: true })
  } catch {
    safeError(res, 503, 'CONTACT_UNAVAILABLE', 'Your message could not be sent. Please try again later.')
  }
}))

async function logoutStudent(req, res) {
  if (hasSupabaseAuth()) await supabaseRevokeUserSessions(req.student.studentId)
  else deleteSession(req.student.id)
  clearStudentCookies(res)
  res.json({ ok: true })
}
app.post('/api/auth/logout', requireStudent, asyncRoute(logoutStudent))

app.get('/api/student/notifications', requireStudent, asyncRoute(async (req, res) => {
  const notifications = await listNotifications(req.student.studentId)
  res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
    total: notifications.length,
  })
}))

app.get('/api/student/notifications/unread-count', requireStudent, asyncRoute(async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.student.studentId) })
}))

app.patch('/api/student/notifications/:id/read', requireStudent, asyncRoute(async (req, res) => {
  const item = await markRead(req.params.id, req.student.studentId)
  if (!item) {
    res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' })
    return
  }
  res.json({ ok: true, notification: item, unreadCount: await unreadCount(req.student.studentId) })
}))

app.post('/api/student/notifications/read-all', requireStudent, asyncRoute(async (req, res) => {
  const notifications = await markAllRead(req.student.studentId)
  res.json({ ok: true, notifications, unreadCount: 0 })
}))

const accountRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)
app.get('/api/student/account/export', requireStudent, accountRoute(async (req, res) => {
  if (!await limited(`account-export:${req.student.studentId}`, 2)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before downloading another export.')
  res.setHeader('Content-Disposition', 'attachment; filename="solvenest-account.json"')
  res.json(await exportStudentAccount(req.student))
}))
app.post('/api/student/account/closure-request', requireStudent, accountRoute(async (req, res) => {
  if (!await limited(`account-closure:${req.student.studentId}`, 2)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before requesting closure again.')
  const result = await withTaskStore((store) => {
    if (store.tasks.some((task) => task.studentId === req.student.studentId && !['COMPLETED', 'DECLINED'].includes(task.status))) return { blocked: true }
    const existing = store.supportTickets.find((ticket) => ticket.context?.studentId === req.student.studentId && ticket.issue === 'account_closure' && ticket.status !== 'resolved')
    if (existing) return { id: existing.id }
    const stamp = now()
    const ticket = { id: `SN-SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'received', category: 'privacy', categoryLabel: 'Privacy', issue: 'account_closure', issueLabel: 'Account closure request', message: 'Please review my account for closure and contact me about any records that must be retained.', context: { studentId: req.student.studentId, studentName: req.student.name }, createdAt: stamp, updatedAt: stamp, history: [], studentUpdates: [] }
    store.supportTickets.unshift(ticket)
    return { id: ticket.id }
  })
  if (result.blocked) return safeError(res, 409, 'ACTIVE_TASKS', 'Resolve active tasks before requesting account closure.')
  res.json({ ticketId: result.id, message: 'Your closure request is in the support queue. Your account remains active until the request is reviewed.' })
}))
app.get('/api/student/account', requireStudent, accountRoute(async (req, res) => {
  const activeTasks = (await getStudentTasks(req.student.studentId)).filter((task) => !['COMPLETED', 'DECLINED'].includes(task.status)).length
  res.json({
    account: await getAccountView({
      student: req.student,
      ...accountSessions(req),
      activeTasks,
    }),
  })
}))

app.patch('/api/student/account', requireStudent, accountRoute(async (req, res) => {
  const body = req.body || {}
  const section = body.section ? String(body.section) : null
  if (section === 'profile') {
    await updateProfile(req.student.studentId, body.profile || {})
  } else if (section === 'preferences') {
    await updatePreferences(req.student.studentId, body.preferences || {})
  } else {
    res.status(400).json({ error: 'ACCOUNT_SECTION_REQUIRED' })
    return
  }
  const activeTasks = (await getStudentTasks(req.student.studentId)).filter((task) => !['COMPLETED', 'DECLINED'].includes(task.status)).length
  res.json({
    account: await getAccountView({
      student: req.student,
      ...accountSessions(req),
      activeTasks,
    }),
  })
}))

app.post('/api/student/account/logout', requireStudent, asyncRoute(logoutStudent))

app.delete('/api/student/account/sessions/current', requireStudent, asyncRoute(async (req, res) => {
  if (hasSupabaseAuth()) await supabaseRevokeUserSessions(req.student.studentId)
  else deleteSession(req.student.id)
  clearStudentCookies(res)
  res.json({ ok: true, signedOut: true })
}))

app.delete('/api/student/account/sessions/:sessionId', requireStudent, (req, res) => {
  if (hasSupabaseAuth()) return safeError(res, 501, 'SESSION_REVOKE_UNAVAILABLE', 'Remote session management is not available for this account.')
  const sessionId = String(req.params.sessionId || '')
  const target = getSession(sessionId)
  if (!target || target.studentId !== req.student.studentId) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    return
  }
  if (sessionId === req.student.id) {
    deleteSession(sessionId)
    clearStudentCookies(res)
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

app.post('/api/student/help/tickets/:ticketId/replies', requireStudent, supportRoute(async (req, res) => {
  const result = await replyToSupportTicket(req.student.studentId, req.params.ticketId, req.body?.message)
  if (result.error) return safeError(res, result.error === 'TICKET_NOT_FOUND' ? 404 : 409, result.error, result.error === 'TICKET_RESOLVED' ? 'This support request is already resolved.' : 'Enter a reply.')
  res.status(201).json(result)
}))

function localStaffPreview(req, role) {
  const enabled = role === 'Superadmin' ? process.env.SUPERADMIN_DEMO_SESSION === '1' : process.env.ADMIN_DEMO_SESSION === '1'
  return process.env.NODE_ENV !== 'production' && enabled && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.ip || '')
}

function staffCookie(role) { return role === 'Superadmin' ? SUPERADMIN_COOKIE : ADMIN_COOKIE }
function staffLabel(role) { return role === 'Superadmin' ? 'Super Admin' : 'Admin' }
function requireStaffRole(role) { return async (req, res, next) => {
  const sid = parseCookies(req.headers.cookie)[staffCookie(role)]
  if (sid && (hasSupabase() || staffSessions.has(sid))) {
    try {
      const session = hasSupabase() ? await supabaseGetAppSession(sid) : staffSessions.get(sid)
      if (!session || session.role !== role) return safeError(res, 401, `${role.toUpperCase()}_ACCESS_REQUIRED`, `Sign in with a ${staffLabel(role)} account to continue.`)
      const profile = await supabaseProfile(session.user_id || session.id)
      if (profile?.role === role) {
        req.staff = { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
        return next()
      }
      if (hasSupabase()) await supabaseDeleteAppSession(sid)
      else staffSessions.delete(sid)
      return safeError(res, 401, `${role.toUpperCase()}_ACCESS_REQUIRED`, `This account no longer has ${staffLabel(role)} access.`)
    } catch (error) {
      console.error('[staff] profile check failed', error)
      return safeError(res, 503, 'STAFF_ACCESS_UNAVAILABLE', `${staffLabel(role)} access could not be verified right now.`)
    }
  }
  if (localStaffPreview(req, role)) {
    req.staff = { id: role === 'Superadmin' ? 'local-superadmin' : 'local-admin', name: `Local ${staffLabel(role)}`, role, demo: true }
    return next()
  }
  safeError(res, 401, `${role.toUpperCase()}_ACCESS_REQUIRED`, `Sign in with a ${staffLabel(role)} account to continue.`)
} }
const requireAdmin = requireStaffRole('Admin')
const requireSuperadmin = requireStaffRole('Superadmin')

function staffRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error(`[staff] ${req.method} ${req.originalUrl}`, error)
    if (!res.headersSent && /staff_role_events|change_staff_role/.test(String(error.message || ''))) return safeError(res, 503, 'STAFF_GOVERNANCE_SETUP_REQUIRED', 'Apply the staff governance database migration to use this feature.')
    if (!res.headersSent) safeError(res, 500, 'STAFF_LOAD_FAILED', 'The staff workspace could not be loaded.')
  })
}

async function staffLogin(req, res, role) {
  if (!hasSupabaseAuth()) return safeError(res, 503, 'STAFF_LOGIN_UNAVAILABLE', 'Staff sign-in is not configured yet.')
  if (!await limited(`${role.toLowerCase()}-login:${req.ip}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before trying again.')
  const { data, error } = await supabaseSignIn({ email: req.body?.email, password: req.body?.password })
  if (error || !data?.user) return safeError(res, 401, 'INVALID_CREDENTIALS', 'Those details did not match an account.')
  const profile = await supabaseProfile(data.user.id)
  if (profile?.role !== role) return safeError(res, 403, `${role.toUpperCase()}_ACCESS_REQUIRED`, `This account does not have ${staffLabel(role)} access.`)
  const sid = crypto.randomUUID()
  const staff = { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
  await supabaseCreateAppSession(sid, profile.id, profile.role, userAgentLabel(req.headers['user-agent']))
  res.setHeader('Set-Cookie', `${staffCookie(role)}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  res.json({ staff })
}
async function staffLogout(req, res, role) {
  const sid = parseCookies(req.headers.cookie)[staffCookie(role)]
  if (sid) {
    if (hasSupabase()) await supabaseDeleteAppSession(sid)
    else staffSessions.delete(sid)
  }
  res.setHeader('Set-Cookie', `${staffCookie(role)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  res.json({ ok: true })
}

app.post('/api/admin/login', staffRoute((req, res) => staffLogin(req, res, 'Admin')))

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ staff: req.staff }))
app.post('/api/admin/logout', requireAdmin, staffRoute((req, res) => staffLogout(req, res, 'Admin')))
app.get('/api/admin/overview', requireAdmin, staffRoute(async (_req, res) => res.json(await getAdminOverview())))
app.get('/api/admin/conversations', requireAdmin, staffRoute(async (_req, res) => {
  const state = await readTaskStore()
  const conversations = state.conversations.map((conversation) => ({ ...conversation, lastMessage: state.messages.filter((message) => message.conversationId === conversation.id).at(-1) || conversation.lastMessage })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  res.json({ conversations })
}))
app.get('/api/admin/conversations/:conversationId/messages', requireAdmin, staffRoute(async (req, res) => {
  const state = await readTaskStore()
  const conversation = state.conversations.find((item) => item.id === req.params.conversationId)
  if (!conversation) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  res.json({ conversation, messages: state.messages.filter((item) => item.conversationId === conversation.id) })
}))
app.post('/api/admin/conversations/:conversationId/messages', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`staff-message:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before sending another message.')
  const body = String(req.body?.body || '').trim()
  if (!body || body.length > 4000) return safeError(res, 400, 'MESSAGE_INVALID', 'Message must be between 1 and 4000 characters.')
  const result = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId)
    if (!conversation) return null
    const message = { id: crypto.randomUUID(), conversationId: conversation.id, studentId: conversation.studentId, from: 'solvenest', author: req.staff.name || 'SolveNest', role: 'Support', initials: 'SN', body, attachments: [], createdAt: now(), status: 'sent' }
    store.messages.push(message)
    conversation.lastMessage = message
    conversation.updatedAt = message.createdAt
    conversation.staffUnread = false
    conversation.unread = Number(conversation.unread || 0) + 1
    addActivity(store, { id: crypto.randomUUID(), studentId: conversation.studentId, taskId: conversation.taskId, type: 'StaffMessageSent', text: 'SolveNest replied in your task room.', createdAt: message.createdAt })
    return { message, conversation }
  })
  if (!result) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  try { await addNotification({ id: crypto.randomUUID(), studentId: result.conversation.studentId, title: 'New task message', body: 'SolveNest replied in your task room.', task: { title: result.conversation.taskTitle, ref: result.conversation.taskId }, route: `/student/messages?conversation=${result.conversation.id}`, isRead: false, requiresAction: false, createdAt: result.message.createdAt }) }
  catch (error) { console.error('[messages] notification failed', error) }
  publish(result.conversation.studentId, { type: 'MessageCreated', message: result.message })
  res.status(201).json({ message: result.message })
}))
app.post('/api/admin/conversations/:conversationId/read', requireAdmin, staffRoute(async (req, res) => {
  const changed = await withTaskStore((store) => {
    const conversation = store.conversations.find((item) => item.id === req.params.conversationId)
    if (!conversation) return false
    conversation.staffUnread = false
    return true
  })
  if (!changed) return safeError(res, 404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.')
  res.json({ ok: true })
}))
app.get('/api/admin/tasks/:taskId', requireAdmin, staffRoute(async (req, res) => {
  const detail = await getAdminCase(req.params.taskId)
  if (!detail) return safeError(res, 404, 'TASK_NOT_FOUND', 'This task could not be found.')
  res.json(detail)
}))
app.get('/api/admin/tasks/:taskId/files/:fileId/download', requireAdmin, staffRoute(async (req, res) => {
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
app.post('/api/admin/tasks/:taskId/review', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-review:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Too many review actions. Please wait a moment.')
  const result = await recordAdminReview(req.params.taskId, req.staff.id, req.body?.action, req.body?.note)
  if (result.error) return safeError(res, result.error === 'TASK_NOT_FOUND' ? 404 : result.error === 'NOTE_REQUIRED' || result.error === 'INVALID_ACTION' ? 400 : 409, result.error, result.error === 'NOTE_REQUIRED' ? 'Add an internal note of at least 10 characters.' : 'This review cannot be changed from its current state.')
  try {
    const titles = { start: 'Review started', approve: 'Task approved', request_info: 'Information requested', decline: 'Task declined' }
    await addNotification({ id: crypto.randomUUID(), studentId: result.studentId, title: titles[result.action], body: result.action === 'request_info' || result.action === 'decline' ? String(req.body?.note || '') : 'Your task review status has been updated.', task: { title: result.title, ref: req.params.taskId }, route: `/student/tasks?task=${req.params.taskId}`, isRead: false, requiresAction: result.action === 'request_info', createdAt: result.updatedAt })
  } catch (error) { console.error('[review] notification failed', error) }
  publish(result.studentId, { type: 'TaskReviewUpdated', taskId: req.params.taskId, status: result.status })
  res.json(result)
}))

app.post('/api/admin/tasks/:taskId/plan', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-plan:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before issuing another plan.')
  const result = await issueAdminPlan(req.params.taskId, req.staff.id, req.body)
  if (result.error) return safeError(res, result.error === 'TASK_NOT_FOUND' ? 404 : result.error === 'PLAN_INVALID' ? 400 : 409, result.error, result.error === 'PLAN_INVALID' ? 'Enter a scope of at least 20 characters, a positive whole-number price, a future delivery date, and a valid revision allowance.' : 'This task is not ready for a new plan.')
  try { await addNotification({ id: crypto.randomUUID(), studentId: result.studentId, title: 'Official plan ready', body: 'Review the scope, delivery date, and price before accepting.', task: { title: result.title, ref: req.params.taskId }, route: `/student/payments?task=${req.params.taskId}&section=plan`, isRead: false, requiresAction: true, createdAt: result.plan.issuedAt }) }
  catch (error) { console.error('[plan] notification failed', error) }
  publish(result.studentId, { type: 'PlanIssued', taskId: req.params.taskId })
  res.status(201).json({ plan: result.plan })
}))

app.post('/api/admin/payments/:paymentId/refund', requireAdmin, staffRoute(async (req, res) => {
  if (!stripe) return safeError(res, 503, 'PROVIDER_UNAVAILABLE', 'Stripe refunds are not configured.')
  if (!await limited(`admin-refund:${req.staff.id}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before processing another refund.')
  const note = String(req.body?.note || '').trim().slice(0, 2000)
  if (note.length < 10) return safeError(res, 400, 'REFUND_NOTE_REQUIRED', 'Record the refund decision in at least 10 characters.')
  const state = await readTaskStore()
  const payment = state.payments.find((item) => item.id === req.params.paymentId)
  if (!payment || !['succeeded', 'partially_refunded'].includes(payment.status)) return safeError(res, 409, 'PAYMENT_NOT_REFUNDABLE', 'This payment is not available for a refund.')
  const remaining = Math.max(0, Number(payment.amount || 0) - Number(payment.refundedAmount || 0))
  const amount = req.body?.amount == null ? remaining : Number(req.body.amount)
  if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) return safeError(res, 400, 'REFUND_AMOUNT_INVALID', 'Enter a valid whole-number refund amount.')
  const task = state.tasks.find((item) => item.id === payment.taskId)
  if (['DELIVERED', 'COMPLETED'].includes(task?.status) && req.body?.completedWorkReview !== true) return safeError(res, 409, 'REFUND_REVIEW_REQUIRED', 'Completed work requires an explicit staff review before refunding.')
  let paymentIntentId = payment.paymentIntentId
  if (!paymentIntentId && String(payment.providerId || '').startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(payment.providerId)
    paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  }
  if (!paymentIntentId) return safeError(res, 409, 'PAYMENT_INTENT_MISSING', 'The Stripe payment cannot be identified.')
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount: amount * 100, reason: 'requested_by_customer', metadata: { solveNestPaymentId: payment.id, taskId: payment.taskId, actorId: req.staff.id } }, { idempotencyKey: `refund-${payment.id}-${Number(payment.refundedAmount || 0)}-${amount}` })
  const reconciled = await recordRefundStatus(paymentIntentId, (Number(payment.refundedAmount || 0) + amount) * 100, refund.id)
  await withTaskStore((store) => {
    store.adminAudit = store.adminAudit || []
    store.adminAudit.unshift({ id: crypto.randomUUID(), taskId: payment.taskId, actorId: req.staff.id, action: 'payment_refund', note, amount, currency: payment.currency, paymentId: payment.id, refundId: refund.id, at: now() })
  })
  if (reconciled?.task) {
    try { await addNotification({ id: crypto.randomUUID(), studentId: reconciled.task.studentId, title: 'Refund processed', body: `A refund of ${payment.currency.toUpperCase()} ${amount} was processed.`, task: { title: reconciled.task.title, ref: reconciled.task.id }, route: `/student/payments?task=${reconciled.task.id}&section=history`, isRead: false, requiresAction: false, createdAt: now() }) } catch (error) { console.error('[refund] notification failed', error) }
    publish(reconciled.task.studentId, { type: 'PaymentRefunded', taskId: reconciled.task.id })
  }
  res.status(201).json({ refund: { id: refund.id, status: refund.status, amount, currency: payment.currency }, payment: reconciled?.payment })
}))

app.post('/api/admin/tasks/:taskId/scope-change', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-scope:${req.staff.id}`, 10)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before issuing another scope change.')
  const task = (await readTaskStore()).tasks.find((item) => item.id === req.params.taskId)
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (task.assignedExpertId && task.assignmentId) {
    const expert = await runForExpert(task.assignedExpertId, readExpertStore)
    const assignment = expert.assignments.find((item) => item.id === task.assignmentId)
    if (!assignment || ['qa_review', 'ready_to_deliver', 'delivered'].includes(assignment.workState)) return safeError(res, 409, 'SCOPE_CHANGE_TOO_LATE', 'Wait until the current quality review is resolved, or contact support about delivered work.')
  }
  const result = await issueAdminScopeChange(req.params.taskId, req.staff.id, req.body)
  if (result.error) return safeError(res, result.error === 'SCOPE_CHANGE_INVALID' ? 400 : 409, result.error, 'Provide a clear reason, revised scope, future delivery date, and nonnegative additional price for an eligible task.')
  await addNotification({ id: crypto.randomUUID(), studentId: result.studentId, title: 'Scope change proposed', body: 'Review the revised work, price, and delivery date before accepting.', task: { title: result.title, ref: task.id }, route: `/student/payments?task=${task.id}&section=scope-change`, isRead: false, requiresAction: true, createdAt: result.change.issuedAt })
  publish(result.studentId, { type: 'ScopeChangeIssued', taskId: task.id })
  res.status(201).json({ scopeChange: result.change })
}))

app.get('/api/admin/experts', requireAdmin, staffRoute(async (req, res) => {
  const profiles = req.staff.demo ? [{ id: 'demo-expert', name: 'Alex Morgan', email: null, role: 'Expert' }] : await supabaseExpertProfiles()
  const experts = await Promise.all(profiles.map(async (profile) => {
    const store = await runForExpert(profile, readExpertStore)
    return { id: profile.id, name: profile.name, email: profile.email, availability: store.expert.availability, activeAssignments: store.assignments.filter((item) => item.workState !== 'delivered').length }
  }))
  res.json({ experts })
}))

app.post('/api/admin/tasks/:taskId/assign', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-assign:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before assigning another task.')
  const expertId = String(req.body?.expertId || '')
  const profile = req.staff.demo && expertId === 'demo-expert' ? { id: expertId, name: 'Alex Morgan', role: 'Expert' } : req.staff.demo ? null : await supabaseProfile(expertId)
  if (profile?.role !== 'Expert') return safeError(res, 404, 'EXPERT_NOT_FOUND', 'Choose an active Expert account.')
  const state = await readTaskStore()
  const task = state.tasks.find((item) => item.id === req.params.taskId)
  const plan = state.plans.find((item) => item.taskId === task?.id && item.status === 'ACCEPTED')
  const funded = state.payments.some((item) => item.taskId === task?.id && item.planId === plan?.id && item.status === 'succeeded')
  if (!task) return safeError(res, 404, 'TASK_NOT_FOUND', 'Task not found.')
  if (task.assignedExpertId) return safeError(res, 409, 'TASK_ALREADY_ASSIGNED', 'This task is already assigned.')
  if (task.status !== 'PAID' || !plan || !funded) return safeError(res, 409, 'TASK_NOT_FUNDED', 'The Student must accept and fund the official plan before assignment.')
  const workspace = await runForExpert(profile, readExpertStore)
  if (workspace.expert.availability === 'unavailable') return safeError(res, 409, 'EXPERT_UNAVAILABLE', 'Choose an Expert who is available for work.')
  const sourceFiles = state.files.filter((file) => file.taskId === task.id && file.studentId === task.studentId && file.state === 'READY').map((file) => ({ id: file.id, name: file.originalName, type: file.mimeType, size: file.size, storageKey: file.storageKey, origin: 'solvenest', uploadedBy: 'student', uploadedAt: file.createdAt }))
  const requirements = [plan.scope, ...(Array.isArray(task.analysis?.deliverables) ? task.analysis.deliverables.map((item) => typeof item === 'string' ? item : item.title || item.name).filter(Boolean) : [])].slice(0, 12)
  const created = await runForExpert(profile, () => provisionAssignment({ taskId: task.id, title: task.title, reference: plan.reference, domain: task.subject, type: task.type, deliverable: plan.scope, requirements, deadline: plan.delivery, workspace: { files: { source: sourceFiles } } }))
  if (!created.ok) return expertMutationError(res, created.error)
  let updated
  try { updated = await withTaskStore((store) => {
    const current = store.tasks.find((item) => item.id === task.id)
    if (!current || current.assignedExpertId || current.status !== 'PAID') return false
    const stamp = now()
    current.assignedExpertId = profile.id
    current.assignedExpertName = profile.name
    current.assignmentId = created.assignment.id
    current.status = 'ASSIGNMENT_PENDING'
    current.latestUpdate = { text: 'A SolveNest Expert has been assigned to your task.', createdAt: stamp }
    current.updatedAt = stamp
    store.adminAudit = store.adminAudit || []
    store.adminAudit.unshift({ id: crypto.randomUUID(), taskId: task.id, actorId: req.staff.id, action: 'assign_expert', note: `Assigned ${profile.name} (${profile.id}).`, at: stamp })
    addActivity(store, { id: crypto.randomUUID(), studentId: task.studentId, taskId: task.id, type: 'ExpertAssigned', text: current.latestUpdate.text, createdAt: stamp })
    return true
  }) } catch (error) {
    if (!created.replayed) {
      const latest = (await readTaskStore()).tasks.find((item) => item.id === task.id)
      if (latest?.assignmentId !== created.assignment.id) await runForExpert(profile, () => cancelProvisionedAssignment(created.assignment.id, task.id)).catch((rollbackError) => console.error('[assignment] rollback failed', rollbackError))
    }
    throw error
  }
  if (!updated) {
    const latest = (await readTaskStore()).tasks.find((item) => item.id === task.id)
    if (latest?.assignmentId === created.assignment.id) return res.status(200).json({ assignmentId: created.assignment.id, expert: { id: profile.id, name: profile.name }, replayed: true })
    if (!created.replayed) await runForExpert(profile, () => cancelProvisionedAssignment(created.assignment.id, task.id)).catch((error) => console.error('[assignment] rollback failed', error))
    return safeError(res, 409, 'TASK_ASSIGNMENT_CHANGED', 'The task changed while it was being assigned. Reload the case.')
  }
  try { await addNotification({ id: crypto.randomUUID(), studentId: task.studentId, title: 'Expert assigned', body: 'Your task has moved to the Expert workspace.', task: { title: task.title, ref: task.id }, route: `/student/tasks?task=${task.id}`, isRead: false, requiresAction: false, createdAt: now() }) }
  catch (error) { console.error('[assignment] student notification failed', error) }
  publish(task.studentId, { type: 'ExpertAssigned', taskId: task.id })
  publishExpert(profile.id, 'AssignmentChanged', { assignmentId: created.assignment.id, at: now() })
  res.status(201).json({ assignmentId: created.assignment.id, expert: { id: profile.id, name: profile.name } })
}))

app.get('/api/admin/support', requireAdmin, staffRoute(async (_req, res) => res.json({ tickets: await listSupportTickets() })))
app.get('/api/admin/support/:ticketId', requireAdmin, staffRoute(async (req, res) => {
  const ticket = await getSupportTicket(req.params.ticketId)
  if (!ticket) return safeError(res, 404, 'TICKET_NOT_FOUND', 'Support request not found.')
  res.json({ ticket })
}))
app.post('/api/admin/support/:ticketId/status', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-support:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before updating another request.')
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

app.get('/api/admin/qa', requireAdmin, staffRoute(async (_req, res) => res.json({ assignments: await listAdminQaAssignments() })))
app.get('/api/admin/qa/:assignmentId', requireAdmin, staffRoute(async (req, res) => {
  const detail = await getAdminQaCase(req.params.assignmentId)
  if (!detail) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  res.json(detail)
}))
app.get('/api/admin/qa/:assignmentId/files/:fileId/download', requireAdmin, staffRoute(async (req, res) => {
  const detail = await getAdminQaCase(req.params.assignmentId)
  if (!detail?.submissionFiles.some((file) => file.id === req.params.fileId)) return safeError(res, 404, 'FILE_NOT_FOUND', 'Submission file not found.')
  const file = await runForExpert(detail.assignment.expertId, () => findExpertFile(req.params.fileId))
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
app.post('/api/admin/qa/:assignmentId/outcome', requireAdmin, staffRoute(async (req, res) => {
  if (!await limited(`admin-qa:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before recording another quality decision.')
  const outcome = String(req.body?.outcome || '')
  if (!['approved', 'changes_requested'].includes(outcome)) return safeError(res, 400, 'QA_OUTCOME_INVALID', 'Choose a valid quality decision.')
  const note = String(req.body?.note || '').trim().slice(0, 2000)
  if (outcome === 'changes_requested' && note.length < 10) return safeError(res, 400, 'QA_FEEDBACK_REQUIRED', 'Explain the changes needed in at least 10 characters.')
  const feedback = outcome === 'changes_requested' ? [{ title: 'Changes required', body: note, severity: 'major' }] : []
  const detail = await getAdminQaCase(req.params.assignmentId)
  if (!detail) return safeError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.')
  const result = await runForExpert(detail.assignment.expertId, () => applyQaOutcome(req.params.assignmentId, outcome, feedback, req.staff.id, note))
  if (!result.ok) return expertMutationError(res, result.error)
  publishExpert(detail.assignment.expertId, 'QaUpdated', { assignmentId: req.params.assignmentId, qa: result.qa })
  res.json(result)
}))

app.post('/api/superadmin/login', staffRoute((req, res) => staffLogin(req, res, 'Superadmin')))
app.get('/api/superadmin/me', requireSuperadmin, (req, res) => res.json({ staff: req.staff }))
app.post('/api/superadmin/logout', requireSuperadmin, staffRoute((req, res) => staffLogout(req, res, 'Superadmin')))
app.get('/api/superadmin/overview', requireSuperadmin, staffRoute(async (_req, res) => {
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
app.get('/api/superadmin/team', requireSuperadmin, staffRoute(async (req, res) => {
  const page = Number(req.query.page || 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return safeError(res, 400, 'INVALID_PAGE', 'Choose a valid page.')
  res.json({ directory: req.staff.demo ? null : await supabaseTeam({ page, search: req.query.search }) })
}))
app.get('/api/superadmin/team/lookup', requireSuperadmin, staffRoute(async (req, res) => {
  if (req.staff.demo || !hasSupabase()) return safeError(res, 503, 'TEAM_LOOKUP_UNAVAILABLE', 'Team lookup requires a real Super Admin account and Supabase.')
  if (!await limited(`staff-lookup:${req.staff.id}`, 30)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before looking up another account.')
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return safeError(res, 400, 'INVALID_EMAIL', 'Enter a valid account email.')
  res.json({ person: await supabaseFindProfileByEmail(email) })
}))
app.get('/api/superadmin/activity', requireSuperadmin, staffRoute(async (req, res) => {
  res.json({ activity: await getSuperadminActivity(!req.staff.demo && hasSupabase()) })
}))
app.post('/api/superadmin/team/:profileId/role', requireSuperadmin, staffRoute(async (req, res) => {
  if (req.staff.demo || !hasSupabase()) return safeError(res, 503, 'ROLE_MANAGEMENT_UNAVAILABLE', 'Role management requires a real Super Admin account and Supabase.')
  if (!await limited(`staff-role:${req.staff.id}`, 20)) return safeError(res, 429, 'RATE_LIMITED', 'Please wait before changing another role.')
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

const clientDist = path.resolve(__dirname, '..', 'client', 'dist')
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /api/\nDisallow: /student\nDisallow: /expert\nDisallow: /admin\nDisallow: /superadmin\nDisallow: /reset-password\n')
})
app.get('/sitemap.xml', (_req, res) => {
  let origin
  try { origin = new URL(process.env.PUBLIC_APP_URL).origin } catch { return res.status(503).type('text/plain').send('Public URL is not configured.') }
  const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const pages = ['/', '/method', '/domains', '/plans', '/why-solvenest', '/help', '/connect']
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${escapeXml(origin + page)}</loc></url>`).join('')}</urlset>`)
})
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, setHeaders: (res, assetPath) => {
    if (assetPath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    else res.setHeader('Cache-Control', 'no-cache')
  } }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || !String(req.headers.accept || '').includes('text/html')) return next()
    if (/^\/(student|expert|admin|superadmin|login|signin|signup|register|reset-password)(\/|$)/.test(req.path)) res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' })
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error.type === 'entity.parse.failed') return safeError(res, 400, 'INVALID_JSON', 'The request contains invalid JSON.')
  if (error.type === 'entity.too.large') return safeError(res, 413, 'REQUEST_TOO_LARGE', 'The request is too large.')
  if (error instanceof multer.MulterError) return safeError(res, error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code, error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 100 MB or smaller.' : 'The upload could not be accepted.')
  console.error(JSON.stringify({ level: 'error', type: 'api_error', requestId: req.requestId, method: req.method, path: req.path, message: error.message }))
  safeError(res, 500, 'INTERNAL_ERROR', 'The request could not be completed.')
})

if (process.env.NODE_ENV === 'production') {
  const missing = []
  if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) missing.push('valid PORT')
  if (!fs.existsSync(path.join(clientDist, 'index.html'))) missing.push('built client/dist application')
  if (!hasSupabase()) missing.push('Supabase Auth and service role')
  if (!hasObjectStorage()) missing.push('private object storage')
  if (String(process.env.FILE_SIGNING_SECRET || '').length < 32) missing.push('FILE_SIGNING_SECRET (32+ characters)')
  if (!process.env.SOLVY_API_URL || !process.env.SOLVY_API_KEY) missing.push('Solvy endpoint and key')
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) missing.push('Stripe key and webhook secret')
  if (!hasEmail() || !process.env.CONTACT_EMAIL) missing.push('SMTP and contact email')
  if (!process.env.CLAMD_HOST) missing.push('private ClamAV clamd host')
  if (!/^https:\/\//i.test(process.env.PUBLIC_APP_URL || '')) missing.push('HTTPS PUBLIC_APP_URL')
  if (missing.length) throw new Error(`Production configuration incomplete: ${missing.join(', ')}`)
}

const server = app.listen(PORT, () => {
  console.log(`SolveNest API listening on http://127.0.0.1:${server.address().port}`)
})
server.requestTimeout = 5 * 60_000
server.headersTimeout = 65_000
server.keepAliveTimeout = 60_000
let scopeSyncRunning = false
const scopeSyncTimer = setInterval(async () => {
  if (scopeSyncRunning) return
  scopeSyncRunning = true
  try {
    const pending = (await readTaskStore()).scopeChanges.filter((item) => item.status === 'ACCEPTED' && item.expertSyncPending)
    for (const change of pending) {
      try { await syncApprovedScopeChange(change.id) }
      catch (error) { console.error('[scope-change] Expert sync retry failed', { scopeChangeId: change.id, error }) }
    }
  } catch (error) { console.error('[scope-change] Expert sync retry failed', error) }
  finally { scopeSyncRunning = false }
}, 60_000)
scopeSyncTimer.unref()
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(scopeSyncTimer)
  closeStreams()
  console.log(JSON.stringify({ level: 'info', type: 'shutdown', signal }))
  server.close((error) => process.exit(error ? 1 : 0))
  setTimeout(() => { server.closeAllConnections?.(); process.exit(1) }, 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
