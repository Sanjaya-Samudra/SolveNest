import crypto from 'node:crypto'
import { readTaskStore, withTaskStore } from './taskStore.js'
import { listExpertStores } from './expertStore.js'
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
    assignedExpertId: task.assignedExpertId || null,
    assignedExpertName: task.assignedExpertName || null,
    assignmentId: task.assignmentId || null,
    decision: review.decision || null,
    fileCount: store.files.filter((file) => file.taskId === task.id).length,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export async function getAdminOverview() {
  const store = await readTaskStore()
  const tasks = store.tasks.map((task) => summary(store, task)).sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))
  const experts = await listExpertStores()
  const tickets = await listSupportTickets()
  return {
    tasks,
    metrics: {
      queued: tasks.filter((task) => task.reviewStatus === 'QUEUED').length,
      inReview: tasks.filter((task) => task.reviewStatus === 'IN_REVIEW').length,
      decided: tasks.filter((task) => ['APPROVED', 'NEEDS_INFO', 'DECLINED'].includes(task.reviewStatus)).length,
      readyToAssign: tasks.filter((task) => task.status === 'PAID' && !task.assignedExpertId).length,
      qaWaiting: experts.reduce((total, { store }) => total + store.assignments.filter((item) => item.workspace?.qa?.state === 'in_review').length, 0),
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
    plan: store.plans.find((item) => item.taskId === taskId && !['superseded', 'revised'].includes(String(item.status).toLowerCase())) || null,
    scopeChange: store.scopeChanges.find((item) => item.taskId === taskId && ['REQUESTED', 'AWAITING_PAYMENT'].includes(item.status)) || null,
  }
}

export async function issueAdminScopeChange(taskId, actorId, input) {
  const scope = String(input?.scope || '').trim().slice(0, 4000)
  const reason = String(input?.reason || '').trim().slice(0, 2000)
  const priceDelta = Number(input?.priceDelta)
  const delivery = new Date(String(input?.delivery || ''))
  if (scope.length < 20 || reason.length < 10 || !Number.isSafeInteger(priceDelta) || priceDelta < 0 || priceDelta > 100000000 || Number.isNaN(delivery.getTime()) || delivery.getTime() <= Date.now()) return { error: 'SCOPE_CHANGE_INVALID' }
  return withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === taskId)
    const plan = store.plans.find((item) => item.taskId === taskId && item.status === 'ACCEPTED')
    if (!task || !plan) return { error: 'TASK_OR_PLAN_NOT_FOUND' }
    if (!['PAID', 'ASSIGNMENT_PENDING', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS'].includes(task.status)) return { error: 'TASK_NOT_ELIGIBLE' }
    if (store.scopeChanges.some((item) => item.taskId === taskId && ['REQUESTED', 'AWAITING_PAYMENT'].includes(item.status))) return { error: 'SCOPE_CHANGE_PENDING' }
    const issuedAt = new Date().toISOString()
    const change = { id: crypto.randomUUID(), taskId, studentId: task.studentId, planId: plan.id, status: 'REQUESTED', reason, original: { scope: plan.scope, price: plan.amount, delivery: plan.delivery }, requested: { scope, priceDelta, delivery: delivery.toISOString() }, newTotal: plan.amount + priceDelta, currency: plan.currency, issuedAt, issuedBy: actorId, canAccept: true }
    store.scopeChanges.unshift(change)
    store.adminAudit = store.adminAudit || []
    store.adminAudit.unshift({ id: crypto.randomUUID(), taskId, actorId, action: 'issue_scope_change', note: reason, at: issuedAt })
    return { ok: true, change, studentId: task.studentId, title: task.title }
  })
}

export async function issueAdminPlan(taskId, actorId, input) {
  const scope = String(input?.scope || '').trim().slice(0, 4000)
  const excluded = String(input?.excluded || '').trim().slice(0, 2000)
  const price = Number(input?.price)
  const delivery = String(input?.delivery || '').trim()
  const revisionAllowance = Number(input?.revisionAllowance)
  const paymentModel = input?.paymentModel === 'milestone' ? 'milestone' : 'full'
  const firstMilestonePercent = Number(input?.firstMilestonePercent)
  const firstMilestoneAmount = Math.round(price * firstMilestonePercent / 100)
  const parsedDelivery = new Date(delivery)
  if (scope.length < 20 || !Number.isSafeInteger(price) || price <= 0 || price > 100000000 || !delivery || Number.isNaN(parsedDelivery.getTime()) || parsedDelivery.getTime() <= Date.now() || !Number.isSafeInteger(revisionAllowance) || revisionAllowance < 0 || revisionAllowance > 20 || (paymentModel === 'milestone' && (!Number.isSafeInteger(firstMilestonePercent) || firstMilestonePercent < 10 || firstMilestonePercent > 90 || firstMilestoneAmount < 1 || firstMilestoneAmount >= price))) return { error: 'PLAN_INVALID' }
  return withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task) return { error: 'TASK_NOT_FOUND' }
    if (reviewOf(store, task).status !== 'APPROVED') return { error: 'REVIEW_NOT_APPROVED' }
    if (store.plans.some((item) => item.taskId === taskId && item.status === 'ACCEPTED')) return { error: 'PLAN_ALREADY_ACCEPTED' }
    const stamp = new Date().toISOString()
    for (const old of store.plans.filter((item) => item.taskId === taskId && item.status === 'READY')) old.status = 'SUPERSEDED'
    const firstAmount = paymentModel === 'milestone' ? firstMilestoneAmount : 0
    const milestones = paymentModel === 'milestone' ? [
      { id: crypto.randomUUID(), sequence: 1, name: 'Start work', scope: 'Funds Expert assignment and project work.', amount: firstAmount, currency: 'LKR', fundingState: 'payment_required' },
      { id: crypto.randomUUID(), sequence: 2, name: 'Release delivery', scope: 'Due before the approved delivery is released.', amount: price - firstAmount, currency: 'LKR', fundingState: 'locked' },
    ] : []
    const plan = { id: crypto.randomUUID(), taskId, studentId: task.studentId, taskTitle: task.title, reference: `SN-${task.id.slice(0, 8).toUpperCase()}`, scope, excluded, delivery: parsedDelivery.toISOString(), revisionAllowance, price, amount: price, currency: 'LKR', paymentModel, status: 'READY', issuedAt: stamp, issuedBy: actorId, canAccept: true, milestones }
    store.plans.unshift(plan)
    task.status = 'QUOTE_READY'
    task.amountDue = price
    task.latestUpdate = { text: 'Your official plan is ready to review.', createdAt: stamp }
    task.nextAction = { label: 'Review official plan', route: `/student/payments?task=${task.id}&section=plan` }
    task.updatedAt = stamp
    store.adminAudit = store.adminAudit || []
    store.adminAudit.unshift({ id: crypto.randomUUID(), taskId, actorId, action: 'issue_plan', note: `Official plan issued for LKR ${price}.`, at: stamp })
    store.activity.unshift({ id: crypto.randomUUID(), studentId: task.studentId, taskId, type: 'PlanIssued', text: 'Your official plan is ready to review.', createdAt: stamp })
    return { ok: true, plan, studentId: task.studentId, title: task.title }
  })
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
  const experts = await listExpertStores()
  return experts.flatMap(({ id: expertId, store }) => store.assignments.filter((item) => item.workspace?.qa?.state === 'in_review').map((item) => ({
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
    expertId,
  }))).sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
}

export async function getAdminQaCase(assignmentId) {
  const experts = await listExpertStores()
  const owner = experts.find(({ store }) => store.assignments.some((item) => item.id === assignmentId))
  if (!owner) return null
  const { id: expertId, store } = owner
  const assignment = store.assignments.find((item) => item.id === assignmentId)
  return {
    assignment: { id: assignment.id, title: assignment.title, reference: assignment.reference || null, domain: assignment.domain || null, deadline: assignment.deadline || null, workState: assignment.workState, expertName: store.expert.name, expertId },
    qa: assignment.workspace?.qa || null,
    submissionFiles: (assignment.workspace?.files?.submission || []).map((file) => ({ id: file.id, name: file.name || file.originalName || 'Submission file', size: file.size || 0, mimeType: file.mimeType || null })),
    history: (store.staffQaAudit || []).filter((item) => item.assignmentId === assignmentId).slice(0, 20),
  }
}
