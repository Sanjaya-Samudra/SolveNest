import crypto from 'node:crypto'
import { readTaskStore, withTaskStore } from './taskStore.js'

export async function listPrivacyRequests() {
  const state = await readTaskStore()
  return (state.supportTickets || []).filter((item) => item.issue === 'account_closure').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function prepareAccountClosure(studentId) {
  const state = await readTaskStore()
  const activeTasks = state.tasks.filter((task) => task.studentId === studentId && !['COMPLETED', 'DECLINED'].includes(task.status))
  const openRefunds = (state.refundRequests || []).filter((item) => item.studentId === studentId && !['rejected', 'succeeded', 'cancelled'].includes(item.status))
  const disputedPayments = state.payments.filter((item) => item.studentId === studentId && item.dispute && !['won', 'lost', 'closed'].includes(item.dispute.status))
  return { eligible: !activeTasks.length && !openRefunds.length && !disputedPayments.length, blockers: { activeTasks: activeTasks.length, openRefunds: openRefunds.length, paymentDisputes: disputedPayments.length }, storageKeys: state.files.filter((item) => item.studentId === studentId).map((item) => item.storageKey).filter(Boolean) }
}

export async function anonymizeStudentRecords(studentId, actor, note) {
  const cleanNote = String(note || '').trim().slice(0, 2000)
  if (cleanNote.length < 10) return { error: 'NOTE_REQUIRED' }
  return withTaskStore((store) => {
    const request = (store.supportTickets || []).find((item) => item.issue === 'account_closure' && item.context?.studentId === studentId && item.status !== 'resolved')
    if (!request) return { error: 'CLOSURE_REQUEST_NOT_FOUND' }
    const stamp = new Date().toISOString()
    store.files = store.files.filter((item) => item.studentId !== studentId)
    store.deliveryFiles = store.deliveryFiles.filter((item) => item.studentId !== studentId)
    store.drafts = store.drafts.filter((item) => item.studentId !== studentId)
    store.analyses = store.analyses.filter((item) => item.studentId !== studentId)
    store.explainSessions = store.explainSessions.filter((item) => item.studentId !== studentId)
    store.explainArtifacts = store.explainArtifacts.filter((item) => item.studentId !== studentId)
    store.explainRequests = store.explainRequests.filter((item) => item.studentId !== studentId)
    store.notifications = store.notifications.filter((item) => item.studentId !== studentId)
    store.messages.forEach((item) => { if (item.studentId === studentId || store.conversations.some((conversation) => conversation.id === item.conversationId && conversation.studentId === studentId)) { item.body = '[Removed after account closure]'; item.author = item.from === 'student' ? 'Former student' : item.author } })
    store.tasks.forEach((item) => { if (item.studentId === studentId) { item.studentName = 'Former student'; delete item.studentEmail; delete item.analysis } })
    store.supportTickets.forEach((item) => { if (item.context?.studentId === studentId) item.context = { ...item.context, studentName: 'Former student', email: undefined } })
    request.status = 'resolved'; request.updatedAt = stamp; request.closedAt = stamp; request.history ||= []; request.history.unshift({ id: crypto.randomUUID(), status: 'resolved', actorId: actor.id, note: cleanNote, action: 'account_anonymized', at: stamp })
    store.adminAudit.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: 'student_account_anonymized', subjectId: studentId, note: cleanNote, at: stamp })
    return { ok: true, closedAt: stamp }
  })
}
