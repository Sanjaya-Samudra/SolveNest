import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveStudentTaskState, formatDate, formatRelativeTime } from './studentDashboardData.js'

export const FUNDING_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs-payment', label: 'Needs Payment' },
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
]

export const HISTORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'processing', label: 'Processing' },
  { key: 'refunded', label: 'Refunds' },
]

export const PLAN_STATUS_LABELS = {
  draft: 'Draft',
  ready: 'Awaiting Acceptance',
  awaiting_acceptance: 'Awaiting Acceptance',
  pending_acceptance: 'Awaiting Acceptance',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  revised: 'Revised',
  superseded: 'Revised',
}

export const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  requires_action: 'Requires Action',
  succeeded: 'Paid',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
}

export const MILESTONE_STATE_LABELS = {
  funded: 'Funded',
  payment_required: 'Funding Required',
  available: 'Funding Required',
  locked: 'Locked',
  released: 'Released',
}

const currencyFormatters = new Map()

export function formatCurrency(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  const code = String(currency || 'LKR').toUpperCase()
  const value = Number(amount)
  let formatter = currencyFormatters.get(code)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch {
      formatter = new Intl.NumberFormat('en-LK', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    currencyFormatters.set(code, formatter)
  }
  const formatted = formatter.format(value)
  if (code === 'LKR' && formatted.includes('LKR')) return formatted.replace(/\s+/g, ' ')
  if (!formatter.resolvedOptions().currency) return `${code} ${formatted}`
  return formatted
}

export function formatCurrencyShort(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  const code = String(currency || 'LKR').toUpperCase()
  const value = Number(amount)
  const whole = Number.isInteger(value)
    ? new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(value)
    : new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return `${code} ${whole}`
}

function authError(status) {
  const error = new Error('STUDENT_ACCESS_REQUIRED')
  error.code = status
  return error
}

async function apiFetch(url, { signal, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (response.status === 401 || response.status === 403) throw authError(response.status)
  return response
}

async function readJson(response) {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function unwrapList(payload, keys) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
    if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  }
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function unwrapOne(payload, keys) {
  if (!payload || typeof payload !== 'object') return null
  for (const key of keys) {
    if (payload[key] && typeof payload[key] === 'object') return payload[key]
    if (payload.data?.[key] && typeof payload.data[key] === 'object') return payload.data[key]
  }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data
  return payload
}

export function mapTaskFundingSummary(raw) {
  const task = raw?.task || raw
  const id = task?.id || task?.taskId || task?.task_id || raw?.taskId || null
  const plan = raw?.plan || raw?.officialPlan || task?.plan || null
  const funding = raw?.funding || raw?.paymentSummary || task?.funding || null
  const milestones = Array.isArray(raw?.milestones)
    ? raw.milestones
    : Array.isArray(funding?.milestones)
      ? funding.milestones
      : []
  const amountDue = raw?.amountDue ?? funding?.amountDue ?? funding?.amount_due ?? null
  const amountPaid = raw?.amountPaid ?? funding?.amountPaid ?? funding?.amount_paid ?? null
  const currency = raw?.currency || funding?.currency || plan?.currency || task?.currency || 'LKR'
  const status = String(task?.status || raw?.status || '').toUpperCase()
  const display = resolveStudentTaskState(task)
  return {
    id,
    task: {
      id,
      title: task?.title || 'Untitled task',
      reference: task?.reference || raw?.reference || null,
      subject: task?.subject || task?.domain || task?.type || null,
      status,
      display,
      deadline: task?.deadline || null,
    },
    plan,
    funding,
    milestones: milestones.map(mapMilestone),
    currency,
    amountDue: amountDue == null ? null : Number(amountDue),
    amountPaid: amountPaid == null ? null : Number(amountPaid),
    model: raw?.paymentModel || funding?.model || funding?.paymentModel || (milestones.length > 1 ? 'milestone' : 'full'),
    fundingState: raw?.fundingState || funding?.state || null,
    lastPaymentAt: raw?.lastPaymentAt || funding?.lastPaymentAt || null,
    raw,
  }
}

export function mapMilestone(raw, index = 0) {
  return {
    id: raw?.id || raw?.milestoneId || `ms-${index + 1}`,
    sequence: raw?.sequence ?? raw?.index ?? index + 1,
    name: raw?.name || raw?.title || `Milestone ${index + 1}`,
    scope: raw?.scope || raw?.description || null,
    amount: raw?.amount != null ? Number(raw.amount) : raw?.price != null ? Number(raw.price) : null,
    currency: raw?.currency || null,
    fundingState: raw?.fundingState || raw?.funding_state || raw?.status || raw?.state || 'locked',
    workState: raw?.workState || raw?.work_state || null,
    evidence: raw?.evidence || raw?.condition || null,
    paidAt: raw?.paidAt || raw?.paid_at || raw?.fundedAt || null,
    paymentId: raw?.paymentId || raw?.payment_id || null,
    raw,
  }
}

export function mapOfficialPlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const plan = unwrapOne(raw, ['plan', 'officialPlan', 'quote'])
  if (!plan || !plan.id && !plan.planId && !plan.quoteId && !plan.status && !plan.price && !plan.total) return plan || null
  const estimate = plan.estimate || plan.solvyEstimate || null
  return {
    id: plan.id || plan.planId || plan.quoteId || null,
    reference: plan.reference || plan.ref || plan.planReference || null,
    status: String(plan.status || 'ready').toLowerCase(),
    statusLabel: PLAN_STATUS_LABELS[String(plan.status || 'ready').toLowerCase()] || plan.status || 'Official Plan',
    issuedAt: plan.issuedAt || plan.issued_at || plan.createdAt || null,
    expiresAt: plan.expiresAt || plan.expires_at || plan.expiry || plan.validUntil || null,
    acceptedAt: plan.acceptedAt || plan.accepted_at || null,
    title: plan.title || null,
    taskId: plan.taskId || plan.task_id || null,
    taskTitle: plan.taskTitle || plan.task?.title || null,
    scope: plan.scope || plan.confirmedScope || plan.includedScope || null,
    excluded: plan.excluded || plan.exclusions || plan.excludedScope || null,
    delivery: plan.delivery || plan.deliveryDate || plan.deadline || plan.expectedDelivery || null,
    price: plan.price != null ? Number(plan.price) : plan.total != null ? Number(plan.total) : plan.amount != null ? Number(plan.amount) : null,
    currency: plan.currency || 'LKR',
    paymentStructure: plan.paymentStructure || plan.payment_structure || plan.structure || null,
    revisionAllowance: plan.revisionAllowance ?? plan.revisions ?? plan.revisionAllowanceText ?? null,
    estimate: estimate
      ? {
          low: estimate.low != null ? Number(estimate.low) : null,
          high: estimate.high != null ? Number(estimate.high) : null,
          label: estimate.label || null,
        }
      : null,
    canAccept: plan.canAccept ?? ['ready', 'awaiting_acceptance', 'pending_acceptance', 'draft'].includes(String(plan.status || '').toLowerCase()),
    isExpired: ['expired'].includes(String(plan.status || '').toLowerCase()),
    raw: plan,
  }
}

export function mapFundingStructure(raw, fallbackCurrency = 'LKR') {
  const payload = unwrapOne(raw, ['structure', 'funding', 'fundingStructure']) || raw
  if (!payload) return null
  const milestones = Array.isArray(payload.milestones) ? payload.milestones.map(mapMilestone) : []
  const model = payload.model || payload.paymentModel || payload.type || (milestones.length > 1 ? 'milestone' : 'full')
  return {
    model: model === 'installments' || model === 'milestones' || model === 'milestone' ? 'milestone' : 'full',
    currency: payload.currency || fallbackCurrency || 'LKR',
    amountDue: payload.amountDue != null ? Number(payload.amountDue) : payload.amount_due != null ? Number(payload.amount_due) : null,
    amountTotal: payload.amountTotal != null ? Number(payload.amountTotal) : payload.total != null ? Number(payload.total) : null,
    amountFunded: payload.amountFunded != null ? Number(payload.amountFunded) : payload.funded != null ? Number(payload.funded) : null,
    planConfirmed: Boolean(payload.planConfirmed ?? payload.planAccepted ?? true),
    workLocked: Boolean(payload.workLocked ?? payload.work_locked),
    workStateLabel: payload.workStateLabel || payload.workState || null,
    sequence: Array.isArray(payload.sequence) ? payload.sequence : null,
    explanation: payload.explanation || payload.note || null,
    afterFunding: payload.afterFunding || payload.after_funding || null,
    providerAvailable: payload.providerAvailable ?? payload.checkoutAvailable ?? false,
    milestones,
    raw: payload,
  }
}

export function mapPaymentRecord(raw) {
  if (!raw) return null
  return {
    id: raw.id || raw.paymentId || raw.payment_id || null,
    taskId: raw.taskId || raw.task_id || raw.task?.id || null,
    taskTitle: raw.taskTitle || raw.task?.title || 'Untitled task',
    type: raw.type || raw.kind || raw.fundingType || 'Funding',
    milestoneId: raw.milestoneId || raw.milestone_id || null,
    milestoneName: raw.milestoneName || raw.milestone?.name || null,
    planReference: raw.planReference || raw.plan_reference || null,
    amount: raw.amount != null ? Number(raw.amount) : null,
    currency: raw.currency || 'LKR',
    status: String(raw.status || 'pending').toLowerCase(),
    statusLabel: PAYMENT_STATUS_LABELS[String(raw.status || 'pending').toLowerCase()] || raw.status || 'Pending',
    paidAt: raw.paidAt || raw.paid_at || raw.createdAt || raw.created_at || null,
    createdAt: raw.createdAt || raw.created_at || null,
    reference: raw.reference || raw.studentReference || raw.clientReference || null,
    provider: raw.provider || null,
    receiptUrl: raw.receiptUrl || raw.receipt_url || null,
    hasReceipt: Boolean(raw.receiptUrl || raw.receipt_url || raw.hasReceipt || raw.canDownloadReceipt),
    failureReason: raw.failureReason || raw.failure_reason || null,
    refundAmount: raw.refundAmount != null ? Number(raw.refundAmount) : null,
    raw,
  }
}

export function mapScopeChange(raw) {
  if (!raw || typeof raw !== 'object') return null
  const payload = unwrapOne(raw, ['scopeChange', 'change']) || raw
  return {
    id: payload.id || payload.scopeChangeId || null,
    status: String(payload.status || 'requested').toLowerCase(),
    reason: payload.reason || payload.why || payload.justification || null,
    original: {
      scope: payload.original?.scope || payload.originalScope || payload.scopeBefore || null,
      price: payload.original?.price ?? payload.originalPrice ?? payload.priceBefore ?? null,
      delivery: payload.original?.delivery || payload.originalDelivery || null,
    },
    requested: {
      scope: payload.requested?.scope || payload.requestedScope || payload.scopeAfter || payload.addition || null,
      priceDelta: payload.requested?.priceDelta ?? payload.priceDelta ?? payload.additionalPrice ?? payload.priceAfter ?? null,
      deliveryDelta: payload.requested?.deliveryDelta ?? payload.deliveryDelta ?? payload.additionalTime ?? payload.deliveryAfter ?? null,
    },
    currency: payload.currency || 'LKR',
    newTotal: payload.newTotal != null ? Number(payload.newTotal) : null,
    canAccept: payload.canAccept ?? ['requested', 'pending', 'awaiting_acceptance'].includes(String(payload.status || '').toLowerCase()),
    raw: payload,
  }
}

export function resolveStudentFundingState(task) {
  const status = String(task?.status || task?.task?.status || '').toUpperCase()
  const display = task?.display || resolveStudentTaskState(task?.task || task)
  const planRaw = task?.plan
  const planStatus = String(planRaw?.status || planRaw?.state || '').toLowerCase()
  const fundingState = String(task?.fundingState || task?.funding?.state || '').toLowerCase()
  const amountDue = task?.amountDue
  const milestones = task?.milestones || []
  const currentMs = resolveCurrentMilestone(task)

  let plan = 'PLAN REVIEW'
  if (['accepted', 'ready'].includes(planStatus) || ['QUOTE_READY', 'AWAITING_ACCEPTANCE', 'PAYMENT_PENDING', 'PAID'].includes(status)) {
    if (planStatus === 'accepted' || status === 'PAYMENT_PENDING' || status === 'PAID' || status === 'ASSIGNMENT_PENDING' || ['IN_PROGRESS', 'QUALITY_REVIEW', 'DELIVERED', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS', 'COMPLETED'].includes(status)) {
      plan = 'PLAN ACCEPTED'
    } else if (status === 'QUOTE_READY' || planStatus === 'ready' || planStatus === 'awaiting_acceptance') {
      plan = 'PLAN READY'
    } else if (planStatus === 'expired') {
      plan = 'PLAN EXPIRED'
    } else if (planStatus === 'revised') {
      plan = 'PLAN REVISED'
    }
  } else if (['COMPLETED', 'PAID'].includes(status)) {
    plan = 'PLAN ACCEPTED'
  }

  let funding = 'FUNDING NOT REQUIRED'
  let tone = 'neutral'
  if (status === 'QUOTE_READY' || status === 'AWAITING_ACCEPTANCE' || planStatus === 'awaiting_acceptance' || planStatus === 'ready') {
    funding = planStatus === 'accepted' ? 'FUNDING REQUIRED' : 'PLAN DECISION'
    tone = 'attention'
  } else if (status === 'PAYMENT_PENDING' || fundingState === 'payment_required' || (amountDue != null && amountDue > 0)) {
    funding = currentMs && milestones.length ? `MILESTONE ${String(currentMs.sequence).padStart(2, '0')} FUNDING` : 'FUNDING REQUIRED'
    tone = 'attention'
  } else if (fundingState === 'processing' || status === 'PAYMENT_PROCESSING') {
    funding = 'PAYMENT PROCESSING'
    tone = 'attention'
  } else if (fundingState === 'funded' || fundingState === 'paid' || status === 'PAID' || amountDue === 0) {
    funding = 'FUNDED'
    tone = 'success'
  } else if (fundingState === 'failed') {
    funding = 'PAYMENT FAILED'
    tone = 'danger'
  } else if (fundingState === 'refunded') {
    funding = 'REFUNDED'
    tone = 'neutral'
  }

  let work = 'WORK LOCKED'
  if (['PAID', 'ASSIGNMENT_PENDING'].includes(status)) work = 'WORK STARTING'
  else if (['IN_PROGRESS', 'QUALITY_REVIEW', 'REVISION_IN_PROGRESS'].includes(status)) work = 'WORK IN PROGRESS'
  else if (['DELIVERED', 'REVISION_REQUESTED', 'COMPLETED'].includes(status)) work = 'WORK DELIVERED'
  else if (status === 'AWAITING_ACCEPTANCE' || planStatus === 'awaiting_acceptance') work = 'WORK LOCKED'
  else if (funding === 'FUNDED') work = work === 'WORK LOCKED' ? 'WORK ELIGIBLE' : work
  if (currentMs?.workState) {
    const ws = String(currentMs.workState).toLowerCase()
    if (['in_progress', 'active'].includes(ws)) work = 'WORK IN PROGRESS'
    else if (['complete', 'completed', 'done'].includes(ws)) work = 'WORK COMPLETE'
  }

  return { plan, funding, work, tone, display }
}

export function resolveCurrentMilestone(task) {
  const milestones = task?.milestones || task?.funding?.milestones || []
  if (!milestones.length) return null
  const normalized = milestones.map((m) => (typeof m === 'object' && m.fundingState ? m : mapMilestone(m)))
  return normalized.find((m) => ['payment_required', 'available', 'funding_required', 'current', 'due'].includes(String(m.fundingState).toLowerCase()))
    || normalized.find((m) => !['funded', 'paid', 'locked'].includes(String(m.fundingState).toLowerCase()))
    || null
}

export function resolvePaymentAction(task) {
  const fs = resolveStudentFundingState(task)
  const plan = task?.plan
  const planAcceptable = plan && ['ready', 'awaiting_acceptance', 'pending_acceptance'].includes(String(plan.status || '').toLowerCase())
  if (planAcceptable) return { kind: 'accept-plan', label: 'Accept Plan' }
  if (fs.funding === 'PLAN EXPIRED') return { kind: 'expired', label: null }
  if (fs.funding === 'PAYMENT PROCESSING') return { kind: 'processing', label: null }
  if (fs.funding === 'FUNDED' || fs.funding === 'REFUNDED' || fs.funding === 'PAYMENT FAILED') {
    if (fs.funding === 'PAYMENT FAILED') return { kind: 'retry', label: 'Try Again' }
    return { kind: 'none', label: null }
  }
  if (fs.funding === 'FUNDING REQUIRED' || fs.funding.startsWith('MILESTONE')) {
    const structure = task?.structure || null
    const current = resolveCurrentMilestone(task)
    if (current || task?.model === 'milestone' || structure?.model === 'milestone') {
      return { kind: 'fund-milestone', label: 'Fund Milestone', milestone: current }
    }
    return { kind: 'pay', label: 'Make Payment' }
  }
  if (fs.funding === 'PLAN DECISION') return { kind: 'review-plan', label: 'Review Plan' }
  return { kind: 'none', label: null }
}

export function resolveOfficialPlanDisplayState(plan) {
  if (!plan) return { key: 'none', label: 'No official plan', tone: 'muted', canAccept: false, isExpired: false }
  const status = String(plan.status || '').toLowerCase()
  if (status === 'accepted') return { key: 'accepted', label: 'Accepted', tone: 'success', canAccept: false, isExpired: false }
  if (status === 'expired') return { key: 'expired', label: 'Plan Expired', tone: 'attention', canAccept: false, isExpired: true }
  if (status === 'revised' || status === 'superseded') return { key: 'revised', label: 'Revised', tone: 'attention', canAccept: false, isExpired: false }
  if (status === 'declined') return { key: 'declined', label: 'Declined', tone: 'muted', canAccept: false, isExpired: false }
  if (status === 'ready' || status === 'awaiting_acceptance' || status === 'pending_acceptance' || status === 'draft') {
    return { key: 'awaiting', label: 'Awaiting Acceptance', tone: 'attention', canAccept: true, isExpired: false }
  }
  return { key: status || 'unknown', label: PLAN_STATUS_LABELS[status] || plan.status || 'Official Plan', tone: 'muted', canAccept: false, isExpired: false }
}

export function buildPaymentsRoute({ taskId, section, paymentId } = {}) {
  const params = new URLSearchParams()
  if (taskId) params.set('task', String(taskId))
  if (section) params.set('section', String(section))
  if (paymentId) params.set('payment', String(paymentId))
  const qs = params.toString()
  return `/student/payments${qs ? `?${qs}` : ''}`
}

export function parsePaymentsUrlState() {
  const params = new URLSearchParams(window.location.search)
  const section = params.get('section')
  const allowed = new Set(['plan', 'funding', 'milestones', 'history', 'scope-change'])
  return {
    taskId: params.get('task') || null,
    section: section && allowed.has(section) ? section : null,
    paymentId: params.get('payment') || null,
    search: params.get('q') || '',
  }
}

export function syncPaymentsUrlState(state) {
  const params = new URLSearchParams()
  if (state.taskId) params.set('task', String(state.taskId))
  if (state.section) params.set('section', String(state.section))
  if (state.paymentId) params.set('payment', String(state.paymentId))
  if (state.search) params.set('q', state.search)
  const qs = params.toString()
  window.history.replaceState({}, '', `/student/payments${qs ? `?${qs}` : ''}`)
}

export async function fetchTaskFundingSummaries({ search = '', filter = 'all', signal } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (filter && filter !== 'all') params.set('filter', filter)
  const qs = params.toString()
  const response = await apiFetch(`/api/student/payments/tasks${qs ? `?${qs}` : ''}`, { signal })
  if (!response.ok) throw new Error(`PAYMENTS_TASKS_${response.status}`)
  const payload = await readJson(response)
  const rows = unwrapList(payload, ['tasks', 'summaries', 'taskFundingSummaries'])
  return rows.map(mapTaskFundingSummary)
}

export async function fetchOfficialPlan(taskId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/tasks/${encodeURIComponent(taskId)}/plan`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`PAYMENTS_PLAN_${response.status}`)
  return mapOfficialPlan(await readJson(response))
}

export async function acceptOfficialPlan(planId) {
  const response = await apiFetch(`/api/student/payments/plans/${encodeURIComponent(planId)}/accept`, {
    method: 'POST',
    body: {},
  })
  if (!response.ok) {
    const payload = await readJson(response)
    const error = new Error(payload.message || `PAYMENTS_ACCEPT_${response.status}`)
    error.code = response.status
    throw error
  }
  return mapOfficialPlan(await readJson(response))
}

export async function fetchFundingStructure(taskId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/tasks/${encodeURIComponent(taskId)}/funding`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`PAYMENTS_STRUCTURE_${response.status}`)
  return mapFundingStructure(await readJson(response))
}

export async function initializePayment({ taskId, milestoneId, planId, idempotencyKey, signal } = {}) {
  const response = await apiFetch('/api/student/payments/checkout', {
    method: 'POST',
    signal,
    body: {
      taskId: taskId || null,
      milestoneId: milestoneId || null,
      planId: planId || null,
      idempotencyKey: idempotencyKey || null,
    },
  })
  const payload = await readJson(response)
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `PAYMENTS_INIT_${response.status}`)
    error.code = response.status
    error.unavailable = response.status === 501 || response.status === 404 || payload.code === 'PROVIDER_UNAVAILABLE'
    error.payload = payload
    throw error
  }
  return {
    paymentId: payload.paymentId || payload.payment_id || payload.id || null,
    checkoutUrl: payload.checkoutUrl || payload.checkout_url || payload.url || null,
    clientSecret: payload.clientSecret || payload.client_secret || null,
    provider: payload.provider || null,
    status: payload.status || 'pending',
    unavailable: Boolean(payload.unavailable || payload.code === 'PROVIDER_UNAVAILABLE'),
    message: payload.message || null,
  }
}

export async function fetchPaymentStatus(paymentId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/payments/${encodeURIComponent(paymentId)}/status`, { signal })
  if (!response.ok) throw new Error(`PAYMENTS_STATUS_${response.status}`)
  return mapPaymentRecord(await readJson(response))
}

export async function fetchPaymentHistory({ taskId = null, search = '', filter = 'all', signal } = {}) {
  const params = new URLSearchParams()
  if (taskId) params.set('task', String(taskId))
  if (search) params.set('search', search)
  if (filter && filter !== 'all') params.set('filter', filter)
  const qs = params.toString()
  const response = await apiFetch(`/api/student/payments/history${qs ? `?${qs}` : ''}`, { signal })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`PAYMENTS_HISTORY_${response.status}`)
  const payload = await readJson(response)
  return unwrapList(payload, ['payments', 'history', 'records']).map(mapPaymentRecord).filter(Boolean)
}

export async function fetchPaymentRecord(paymentId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/payments/${encodeURIComponent(paymentId)}`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`PAYMENTS_RECORD_${response.status}`)
  return mapPaymentRecord(await readJson(response))
}

export async function fetchReceipt(paymentId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/payments/${encodeURIComponent(paymentId)}/receipt`, { signal })
  if (response.status === 404 || response.status === 501) return null
  if (!response.ok) throw new Error(`PAYMENTS_RECEIPT_${response.status}`)
  const payload = await readJson(response)
  return {
    url: payload.url || payload.receiptUrl || payload.signedUrl || null,
    filename: payload.filename || payload.name || null,
    expiresAt: payload.expiresAt || null,
  }
}

export async function fetchScopeChange(taskId, { signal } = {}) {
  const response = await apiFetch(`/api/student/payments/tasks/${encodeURIComponent(taskId)}/scope-change`, { signal })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`PAYMENTS_SCOPE_${response.status}`)
  return mapScopeChange(await readJson(response))
}

export async function acceptRevisedPlan(scopeChangeId) {
  const response = await apiFetch(`/api/student/payments/scope-changes/${encodeURIComponent(scopeChangeId)}/accept`, {
    method: 'POST',
    body: {},
  })
  if (!response.ok) {
    const payload = await readJson(response)
    const error = new Error(payload.message || `PAYMENTS_SCOPE_ACCEPT_${response.status}`)
    error.code = response.status
    throw error
  }
  return mapScopeChange(await readJson(response))
}

function useAbortable(deps, run) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const runRef = useRef(run)
  runRef.current = run
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => runRef.current(controller.signal))
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!alive || error.name === 'AbortError') return
        setState({ data: null, loading: false, error })
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [...deps, tick])
  return { ...state, reload }
}

export function useFundingFocus() {
  return useAbortable([], async (signal) => {
    const response = await apiFetch('/api/student/payments/focus', { signal })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`PAYMENTS_FOCUS_${response.status}`)
    const payload = await readJson(response)
    if (!payload || !payload.taskId && !payload.task && !payload.amountDue) return null
    return mapTaskFundingSummary(payload)
  })
}

export function useTaskFundingNavigator(query = {}) {
  const search = query.search || ''
  const filter = query.filter || 'all'
  return useAbortable([search, filter], (signal) => fetchTaskFundingSummaries({ search, filter, signal }))
}

export function useOfficialPlan(taskId) {
  const planState = useAbortable([taskId], async (signal) => {
    if (!taskId) return null
    return fetchOfficialPlan(taskId, { signal })
  })
  const [accepting, setAccepting] = useState(false)
  const accept = useCallback(async () => {
    if (!planState.data?.id || accepting) return null
    setAccepting(true)
    try {
      const updated = await acceptOfficialPlan(planState.data.id)
      planState.reload()
      return updated
    } finally {
      setAccepting(false)
    }
  }, [planState, accepting])
  return { ...planState, accept, accepting }
}

export function useFundingStructure(taskId) {
  return useAbortable([taskId], async (signal) => {
    if (!taskId) return null
    return fetchFundingStructure(taskId, { signal })
  })
}

export function usePaymentCheckout() {
  const [state, setState] = useState({ status: 'idle', result: null, error: null, busy: false })
  const lockRef = useRef(false)
  const idempotencyRef = useRef(null)

  const start = useCallback(async ({ taskId, milestoneId, planId } = {}) => {
    if (lockRef.current) return null
    lockRef.current = true
    setState({ status: 'preparing', result: null, error: null, busy: true })
    if (!idempotencyRef.current) {
      idempotencyRef.current = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    }
    try {
      const result = await initializePayment({
        taskId,
        milestoneId,
        planId,
        idempotencyKey: idempotencyRef.current,
      })
      setState({ status: 'ready', result, error: null, busy: false })
      return result
    } catch (error) {
      setState({ status: 'error', result: null, error, busy: false })
      return null
    } finally {
      lockRef.current = false
    }
  }, [])

  const handoff = useCallback(() => {
    const url = state.result?.checkoutUrl
    if (url) window.location.assign(url)
  }, [state.result])

  const reset = useCallback(() => {
    idempotencyRef.current = null
    setState({ status: 'idle', result: null, error: null, busy: false })
  }, [])

  return { ...state, start, handoff, reset }
}

export function usePaymentStatusPolling(paymentId, { onStatusChanged, enabled = true, intervalMs = 4000 } = {}) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)
  const attemptRef = useRef(0)
  const onStatusChangedRef = useRef(onStatusChanged)
  onStatusChangedRef.current = onStatusChanged

  const refresh = useCallback(async () => {
    if (!paymentId) return null
    setChecking(true)
    try {
      const next = await fetchPaymentStatus(paymentId)
      setRecord(next)
      setError(null)
      const terminal = ['succeeded', 'paid', 'failed', 'cancelled', 'canceled', 'refunded', 'partially_refunded'].includes(next?.status)
      if (terminal) onStatusChangedRef.current?.(next)
      return next
    } catch (err) {
      if (err.name !== 'AbortError') setError(err)
      return null
    } finally {
      setChecking(false)
    }
  }, [paymentId])

  useEffect(() => {
    setRecord(null)
    setError(null)
    attemptRef.current = 0
    if (!paymentId || !enabled) return undefined
    let timer
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      const next = await refresh()
      if (cancelled) return
      const terminal = ['succeeded', 'paid', 'failed', 'cancelled', 'canceled', 'refunded', 'partially_refunded'].includes(next?.status)
      if (!terminal) {
        attemptRef.current += 1
        const delay = Math.min(intervalMs * (1 + attemptRef.current * 0.35), 20000)
        timer = setTimeout(tick, delay)
      }
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [paymentId, enabled, intervalMs, refresh])

  return { record, error, checking, refresh }
}

export function usePaymentHistory(query = {}) {
  const search = query.search || ''
  const filter = query.filter || 'all'
  const taskId = query.taskId || null
  return useAbortable([search, filter, taskId], (signal) => fetchPaymentHistory({ search, filter, taskId, signal }))
}

export function usePaymentRecord(paymentId) {
  return useAbortable([paymentId], async (signal) => {
    if (!paymentId) return null
    return fetchPaymentRecord(paymentId, { signal })
  })
}

export function useScopeChange(taskId) {
  const state = useAbortable([taskId], async (signal) => {
    if (!taskId) return null
    return fetchScopeChange(taskId, { signal })
  })
  const [accepting, setAccepting] = useState(false)
  const accept = useCallback(async () => {
    if (!state.data?.id || accepting) return null
    setAccepting(true)
    try {
      const updated = await acceptRevisedPlan(state.data.id)
      state.reload()
      return updated
    } finally {
      setAccepting(false)
    }
  }, [state, accepting])
  return { ...state, accept, accepting }
}

export function usePaymentRealtime({ onStatusChanged, onMilestoneFunded, onPlanAccepted, onFailure } = {}) {
  const handlers = useRef({ onStatusChanged, onMilestoneFunded, onPlanAccepted, onFailure })
  handlers.current = { onStatusChanged, onMilestoneFunded, onPlanAccepted, onFailure }

  const notify = useCallback((type, payload) => {
    if (type === 'status') handlers.current.onStatusChanged?.(payload)
    else if (type === 'milestone') handlers.current.onMilestoneFunded?.(payload)
    else if (type === 'plan') handlers.current.onPlanAccepted?.(payload)
    else if (type === 'fail') handlers.current.onFailure?.(payload)
  }, [])

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail || {}
      const kind = detail.kind || detail.type
      if (kind === 'payment.succeeded' || kind === 'payment_confirmed') notify('status', detail)
      else if (kind === 'milestone.funded' || kind === 'milestone_funded') notify('milestone', detail)
      else if (kind === 'plan.accepted' || kind === 'plan_accepted') notify('plan', detail)
      else if (kind === 'payment.failed' || kind === 'payment_failed') notify('fail', detail)
    }
    window.addEventListener('solvenest:payment', handler)
    return () => window.removeEventListener('solvenest:payment', handler)
  }, [notify])

  return { notify }
}

export function filterTaskFundingSummaries(rows, { search = '', filter = 'all' } = {}) {
  let list = Array.isArray(rows) ? rows : []
  const q = search.trim().toLowerCase()
  if (q) {
    list = list.filter((row) => {
      const hay = [row.task.title, row.task.reference, row.task.subject].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }
  if (filter === 'needs-payment') {
    list = list.filter((row) => {
      const action = resolvePaymentAction(row)
      return action.kind === 'pay' || action.kind === 'fund-milestone' || action.kind === 'accept-plan' || action.kind === 'retry'
    })
  } else if (filter === 'active') {
    list = list.filter((row) => !['COMPLETED', 'CANCELLED', 'DECLINED'].includes(row.task.status))
  } else if (filter === 'history') {
    list = list.filter((row) => {
      const action = resolvePaymentAction(row)
      return action.kind === 'none' || row.amountPaid > 0 || row.lastPaymentAt
    })
  }
  return list
}

export function filterPaymentHistory(rows, { search = '', filter = 'all' } = {}) {
  let list = Array.isArray(rows) ? rows : []
  const q = search.trim().toLowerCase()
  if (q) {
    list = list.filter((row) => [row.taskTitle, row.reference, row.type, row.id].filter(Boolean).join(' ').toLowerCase().includes(q))
  }
  if (filter === 'paid') list = list.filter((row) => ['succeeded', 'paid'].includes(row.status))
  else if (filter === 'processing') list = list.filter((row) => ['processing', 'pending', 'requires_action'].includes(row.status))
  else if (filter === 'refunded') list = list.filter((row) => ['refunded', 'partially_refunded'].includes(row.status))
  return list
}

export function buildStudentPaymentsViewModel({ focus, tasks, plan, structure, history, scopeChange, selectedTaskId } = {}) {
  const taskList = tasks || []
  const selectedTask = selectedTaskId ? taskList.find((t) => t.id === selectedTaskId) || null : taskList[0] || null
  const fundingFocus = focus
    || taskList.find((t) => {
      const action = resolvePaymentAction(t)
      return action.kind === 'pay' || action.kind === 'fund-milestone' || action.kind === 'accept-plan'
    })
    || null
  const needsFundingCount = taskList.filter((t) => {
    const action = resolvePaymentAction(t)
    return action.kind === 'pay' || action.kind === 'fund-milestone'
  }).length
  return {
    fundingFocus,
    taskFundingSummaries: taskList,
    selectedTask: selectedTaskId ? (selectedTask || taskList[0] || null) : null,
    officialPlan: plan || null,
    fundingStructure: structure || null,
    paymentHistory: history || [],
    scopeChange: scopeChange || null,
    paymentProviderState: structure ? { available: Boolean(structure.providerAvailable) } : null,
    needsFundingCount,
    isEmptyTasks: taskList.length === 0,
    isEmptyHistory: (history || []).length === 0,
  }
}

export { formatDate, formatRelativeTime }
