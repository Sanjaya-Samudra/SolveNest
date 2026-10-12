import crypto from 'node:crypto'
import { readTaskStore, withTaskStore } from './taskStore.js'
import { readExpertStore } from './expertStore.js'
import { listSupportTickets } from './supportStore.js'

const reviewOf = (store, task) => store.reviews.find((item) => item.taskId === task.id) || task.review || { status: 'QUEUED' }
const dateValue = (value) => value ? new Date(value).getTime() || 0 : 0

function summary(store, task) {
  const review = reviewOf(store, task)
  return {
    id: task.id,
    title: task.title,
    studentId: task.studentId,
    type: task.type || 'Academic task',
    subject: task.subject || null,
    deadline: task.deadline || null,
    status: task.status,
    reviewStatus: review.status || 'QUEUED',
    decision: review.decision || null,
    fileCount: store.files.filter((file) => file.taskId === task.id).length,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export async function getAdminOverview() {
  const store = await readTaskStore()
  const tasks = store.tasks.map((task) => summary(store, task)).sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))
  const expert = await readExpertStore()
  const tickets = await listSupportTickets()
  return {
    tasks,
    metrics: {
      queued: tasks.filter((task) => task.reviewStatus === 'QUEUED').length,
      inReview: tasks.filter((task) => task.reviewStatus === 'IN_REVIEW').length,
      decided: tasks.filter((task) => ['APPROVED', 'NEEDS_INFO', 'DECLINED'].includes(task.reviewStatus)).length,
      qaWaiting: expert.assignments.filter((item) => item.workspace?.qa?.state === 'in_review').length,
      supportOpen: tickets.filter((item) => !['closed', 'resolved'].includes(String(item.status || '').toLowerCase())).length,
    },
  }
}

export async function getAdminCase(taskId) {
  const store = await readTaskStore()
  const task = store.tasks.find((item) => item.id === taskId)
  if (!task) return null
  return {
    task: summary(store, task),
    analysis: task.analysis || null,
    review: reviewOf(store, task),
    files: store.files.filter((file) => file.taskId === taskId).map(({ id, originalName, role, mimeType, size, createdAt, state }) => ({ id, name: originalName, role, mimeType, size, createdAt, state })),
    activity: store.activity.filter((item) => item.taskId === taskId).slice(0, 20),
    audit: (store.adminAudit || []).filter((item) => item.taskId === taskId).slice(0, 20),
  }
}

export async function recordAdminReview(taskId, actorId, action, note) {
  const allowed = { start: 'IN_REVIEW', approve: 'APPROVED', request_info: 'NEEDS_INFO', decline: 'DECLINED' }
  if (!allowed[action]) return { error: 'INVALID_ACTION' }
  const cleanNote = String(note || '').trim().slice(0, 2000)
  if (['request_info', 'decline'].includes(action) && cleanNote.length < 10) return { error: 'NOTE_REQUIRED' }
  return withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task) return { error: 'TASK_NOT_FOUND' }
    const review = reviewOf(store, task)
    const current = review.status || 'QUEUED'
    if (action === 'start' && current !== 'QUEUED') return { error: 'REVIEW_ALREADY_STARTED' }
    if (action !== 'start' && !['QUEUED', 'IN_REVIEW'].includes(current)) return { error: 'REVIEW_ALREADY_DECIDED' }
    const stamp = new Date().toISOString()
    const next = { ...review, taskId, studentId: task.studentId, status: allowed[action], reviewerId: actorId, decision: action === 'start' ? null : action, internalNotes: cleanNote || null, reviewedAt: action === 'start' ? null : stamp, updatedAt: stamp }
    const index = store.reviews.findIndex((item) => item.taskId === taskId)
    if (index >= 0) store.reviews[index] = next
    else store.reviews.push({ id: crypto.randomUUID(), createdAt: stamp, ...next })
    task.review = next
    task.updatedAt = stamp
    store.adminAudit = store.adminAudit || []
    store.adminAudit.unshift({ id: crypto.randomUUID(), taskId, actorId, action, note: cleanNote || null, at: stamp })
    return { ok: true, status: next.status }
  })
}

export async function listAdminQaAssignments() {
  const store = await readExpertStore()
  return store.assignments.filter((item) => item.workspace?.qa?.state === 'in_review').map((item) => ({
    id: item.id,
    title: item.title,
    reference: item.reference || null,
    domain: item.domain || null,
    deadline: item.deadline || null,
    workState: item.workState,
    submittedAt: item.workspace.qa.submittedAt || null,
    cycle: item.workspace.qa.cycle || 1,
    fileCount: item.workspace.files?.submission?.length || 0,
    expertName: store.expert.name,
  })).sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
}

export async function getAdminQaCase(assignmentId) {
  const store = await readExpertStore()
  const assignment = store.assignments.find((item) => item.id === assignmentId)
  if (!assignment) return null
  return {
    assignment: { id: assignment.id, title: assignment.title, reference: assignment.reference || null, domain: assignment.domain || null, deadline: assignment.deadline || null, workState: assignment.workState, expertName: store.expert.name },
    qa: assignment.workspace?.qa || null,
    submissionFiles: (assignment.workspace?.files?.submission || []).map((file) => ({ id: file.id, name: file.name || file.originalName || 'Submission file', size: file.size || 0, mimeType: file.mimeType || null })),
    history: (store.staffQaAudit || []).filter((item) => item.assignmentId === assignmentId).slice(0, 20),
  }
}
