import crypto from 'node:crypto'
import { readTaskStore, withTaskStore } from './taskStore.js'

const terminal = new Set(['rejected', 'succeeded', 'failed', 'cancelled'])
const highValueThreshold = () => Math.max(1, Number(process.env.HIGH_VALUE_REFUND_THRESHOLD || 100000))

function publicRequest(item) {
  if (!item) return null
  const { studentId: _studentId, ...safe } = item
  return safe
}

export async function listStudentRefunds(studentId) {
  const state = await readTaskStore()
  return (state.refundRequests || []).filter((item) => item.studentId === studentId).map(publicRequest)
}

export async function createRefundRequest(studentId, paymentId, input = {}) {
  const reason = String(input.reason || '').trim().slice(0, 2000)
  const expectedScope = String(input.expectedScope || '').trim().slice(0, 2000)
  const deliveredDifference = String(input.deliveredDifference || '').trim().slice(0, 2000)
  if (reason.length < 20) return { error: 'REFUND_REASON_REQUIRED' }
  return withTaskStore((store) => {
    store.refundRequests ||= []
    const payment = store.payments.find((item) => item.id === paymentId && item.studentId === studentId)
    if (!payment || !['succeeded', 'partially_refunded'].includes(payment.status)) return { error: 'PAYMENT_NOT_REFUNDABLE' }
    const existing = store.refundRequests.find((item) => item.paymentId === paymentId && !terminal.has(item.status))
    if (existing) return { error: 'REFUND_ALREADY_OPEN', request: publicRequest(existing) }
    const remaining = Math.max(0, Number(payment.amount || 0) - Number(payment.refundedAmount || 0))
    const amount = input.amount == null ? remaining : Number(input.amount)
    if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) return { error: 'REFUND_AMOUNT_INVALID' }
    const task = store.tasks.find((item) => item.id === payment.taskId)
    const deliveredWork = ['DELIVERED', 'COMPLETED'].includes(task?.status)
    const stamp = new Date().toISOString()
    const request = {
      id: `SN-REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      paymentId,
      taskId: payment.taskId,
      taskTitle: task?.title || payment.taskTitle || 'SolveNest task',
      studentId,
      amount,
      currency: payment.currency || 'lkr',
      reason,
      expectedScope,
      deliveredDifference,
      evidenceReferences: Array.isArray(input.evidenceReferences) ? input.evidenceReferences.map((value) => String(value).trim().slice(0, 500)).filter(Boolean).slice(0, 10) : [],
      workCompletedClaim: Boolean(input.workCompletedClaim),
      deliveredWork,
      highValue: amount >= highValueThreshold(),
      status: 'pending_admin',
      requestedAt: stamp,
      updatedAt: stamp,
      history: [{ id: crypto.randomUUID(), action: 'requested', actorRole: 'Student', at: stamp }],
    }
    store.refundRequests.unshift(request)
    return { request: publicRequest(request) }
  })
}

export async function appealRefundRequest(studentId, id, input = {}) {
  const reason = String(input.reason || '').trim().slice(0, 2000)
  if (reason.length < 20) return { error: 'APPEAL_REASON_REQUIRED' }
  return withTaskStore((store) => {
    const item = (store.refundRequests || []).find((entry) => entry.id === id && entry.studentId === studentId)
    if (!item) return { error: 'REFUND_REQUEST_NOT_FOUND' }
    if (item.status !== 'rejected' || item.appeal?.status === 'pending') return { error: 'REFUND_APPEAL_UNAVAILABLE' }
    const stamp = new Date().toISOString()
    item.appeal = { status: 'pending', reason, requestedAt: stamp }
    item.status = 'pending_superadmin'
    item.updatedAt = stamp
    item.history.unshift({ id: crypto.randomUUID(), action: 'appealed', actorRole: 'Student', note: reason, at: stamp })
    return { request: publicRequest(item) }
  })
}

export async function listRefundQueue() {
  const state = await readTaskStore()
  return (state.refundRequests || []).map((item) => ({ ...item, studentId: item.studentId })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function decideRefundRequest(id, actor, role, input = {}) {
  const decision = String(input.decision || '')
  const note = String(input.note || '').trim().slice(0, 2000)
  if (!['approved', 'rejected'].includes(decision)) return { error: 'REFUND_DECISION_INVALID' }
  if (note.length < 10) return { error: 'REFUND_NOTE_REQUIRED' }
  return withTaskStore((store) => {
    const item = (store.refundRequests || []).find((entry) => entry.id === id)
    if (!item) return { error: 'REFUND_REQUEST_NOT_FOUND' }
    const expected = role === 'Superadmin' ? 'pending_superadmin' : 'pending_admin'
    if (item.status !== expected) return { error: 'REFUND_REQUEST_CHANGED' }
    if (role === 'Superadmin' && item.adminReview?.actorId === actor.id) return { error: 'SECOND_APPROVER_REQUIRED' }
    if (role === 'Admin' && item.deliveredWork && input.completedWorkReview !== true) return { error: 'REFUND_REVIEW_REQUIRED' }
    const stamp = new Date().toISOString()
    const review = { actorId: actor.id, actorName: actor.name, role, decision, note, at: stamp }
    item.history.unshift({ id: crypto.randomUUID(), action: decision, actorRole: role, actorId: actor.id, note, at: stamp })
    item.updatedAt = stamp
    if (role === 'Admin') item.adminReview = review
    else item.superadminReview = review
    if (decision === 'rejected') {
      item.status = 'rejected'
      item.decisionMessage = note
      item.decidedAt = stamp
      return { request: structuredClone(item), execute: false }
    }
    const needsSecondApproval = role === 'Admin' && (item.highValue || item.deliveredWork || item.workCompletedClaim)
    item.status = needsSecondApproval ? 'pending_superadmin' : 'processing'
    return { request: structuredClone(item), execute: !needsSecondApproval }
  })
}

export async function markRefundResult(id, result) {
  return withTaskStore((store) => {
    const item = (store.refundRequests || []).find((entry) => entry.id === id)
    if (!item) return null
    const stamp = new Date().toISOString()
    item.status = result.ok ? 'succeeded' : 'failed'
    item.providerRefundId = result.refundId || null
    item.failureCode = result.errorCode || null
    item.decisionMessage = result.message || item.decisionMessage || null
    item.decidedAt = stamp
    item.updatedAt = stamp
    item.history.unshift({ id: crypto.randomUUID(), action: item.status, actorRole: 'System', at: stamp, note: result.message || null })
    return structuredClone(item)
  })
}
