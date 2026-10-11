import {
  resolveExpertAssignmentJourney,
  resolveExpertDeadlinePriority,
  resolveExpertNextAction,
  resolveExpertTaskState,
} from './expertState.js'

export const EXPERT_ASSIGNMENT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'work', label: 'Work log' },
  { key: 'messages', label: 'Messages' },
  { key: 'files', label: 'Files' },
  { key: 'qa', label: 'QA & delivery' },
]

export const EXPERT_ASSIGNMENT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'active', label: 'In progress' },
  { key: 'qa', label: 'In QA' },
  { key: 'delivered', label: 'Delivered' },
]

export const EXPERT_ASSIGNMENT_SORTS = [
  { key: 'deadline', label: 'Deadline' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'reference', label: 'Reference' },
  { key: 'title', label: 'Title' },
]

export const EXPERT_FILE_SECTIONS = [
  { key: 'source', label: 'Assignment source', hint: 'Files SolveNest attached when the assignment was confirmed.', editable: false },
  { key: 'shared', label: 'Shared with you', hint: 'Reference material shared for this assignment.', editable: false },
  { key: 'working', label: 'Working files', hint: 'Your drafts and in-progress material.', editable: true },
  { key: 'submission', label: 'Submission package', hint: 'Files included in QA submissions and deliveries.', editable: true },
]

export function buildExpertAssignmentRoute({ assignmentId, tab } = {}) {
  if (!assignmentId) return '/expert/assignments'
  const base = `/expert/assignments/${encodeURIComponent(assignmentId)}`
  return tab && tab !== 'overview' ? `${base}?tab=${encodeURIComponent(tab)}` : base
}

export function parseAssignmentRoute(pathname, search = '') {
  const prefix = '/expert/assignments/'
  if (!pathname.startsWith(prefix)) return { assignmentId: null, tab: 'overview' }
  const assignmentId = decodeURIComponent(pathname.slice(prefix.length).split('/')[0] || '')
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tab = params.get('tab') || 'overview'
  const validTab = EXPERT_ASSIGNMENT_TABS.some((item) => item.key === tab) ? tab : 'overview'
  return { assignmentId: assignmentId || null, tab: validTab }
}

const SAFE_ASSIGNMENT_KEYS = [
  'id',
  'taskId',
  'reference',
  'title',
  'domain',
  'type',
  'deliverable',
  'requirements',
  'deadline',
  'workState',
  'latest',
  'nextAction',
  'updatedAt',
  'workspace',
]

export function toExpertSafeAssignment(raw) {
  if (!raw || typeof raw !== 'object') return null
  const safe = {}
  for (const key of SAFE_ASSIGNMENT_KEYS) {
    if (raw[key] !== undefined) safe[key] = raw[key]
  }
  if (!safe.id && safe.taskId) safe.id = safe.taskId
  if (!safe.title) return null
  safe.requirements = Array.isArray(safe.requirements) ? safe.requirements : []
  return safe
}

function parseTime(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function resolveExpertDeadlineState(assignment) {
  const state = resolveExpertTaskState(assignment)
  if (state.closed) return { key: 'completed', label: 'Completed', detail: 'Completed', tone: 'green' }
  const deadline = parseTime(assignment?.deadline)
  if (!deadline) return { key: 'no_deadline', label: 'No deadline', detail: 'No deadline', tone: 'neutral' }
  const diff = deadline - Date.now()
  if (diff < 0) {
    const days = Math.max(1, Math.ceil(-diff / (24 * 60 * 60 * 1000)))
    return { key: 'overdue', label: 'Overdue', detail: `Overdue by ${days} day${days === 1 ? '' : 's'}`, tone: 'red' }
  }
  const hours = Math.ceil(diff / (60 * 60 * 1000))
  if (diff <= 48 * 60 * 60 * 1000) {
    const label = hours <= 24 ? `Due in ${Math.max(1, hours)}h` : `Due in ${Math.ceil(hours / 24)}d`
    return { key: 'due_soon', label: 'Due soon', detail: label, tone: 'amber' }
  }
  const date = new Date(deadline)
  return {
    key: 'on_track',
    label: 'On track',
    detail: `Due ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    tone: 'neutral',
  }
}

export function resolveExpertAssignmentStage(assignment) {
  const state = resolveExpertTaskState(assignment)
  const steps = resolveExpertAssignmentJourney(assignment)
  const currentIndex = Math.max(0, steps.findIndex((step) => step.status === 'current'))
  const current = steps[currentIndex] || steps[0]
  return {
    key: current?.key || 'assigned',
    label: current?.label || 'Assigned',
    steps,
    index: currentIndex,
    total: steps.length,
    done: state.key === 'delivered',
    state,
  }
}

export function resolveNeedsExpertAttention(assignment) {
  const state = resolveExpertTaskState(assignment)
  const deadline = resolveExpertDeadlineState(assignment)
  const unread = Number(assignment?.workspace?.counts?.unreadMessages || 0)
  const openFeedback = Number(assignment?.workspace?.counts?.openFeedback || 0)
  const build = (level, badge, reason, detail) => ({
    level,
    needsAttention: level === 'critical' || level === 'warn',
    badge,
    reason,
    detail,
  })
  if (state.closed) return { level: 'none', needsAttention: false, badge: null, reason: null, detail: null }
  if (state.key === 'waiting_clarification') {
    return build('critical', 'CLARIFICATION NEEDED', 'Clarification needed', 'A question on this assignment is waiting for your response.')
  }
  if (state.key === 'changes_requested' || openFeedback > 0) {
    return build('critical', 'CHANGES REQUESTED', 'QA feedback returned', 'Resolve every feedback item, then resubmit for quality review.')
  }
  if (deadline.key === 'overdue') {
    return build('critical', 'DEADLINE PASSED', 'Deadline passed', 'The delivery deadline for this assignment has passed.')
  }
  if (state.key === 'ready_for_qa') {
    return build('warn', 'READY TO SUBMIT', 'Ready to submit', 'Your work is ready to enter quality review.')
  }
  if (state.key === 'ready_to_deliver') {
    return build('warn', 'READY TO DELIVER', 'Approved — delivery due', 'Quality review approved this work. Prepare and submit the delivery package.')
  }
  if (deadline.key === 'due_soon') {
    return build('warn', 'DUE SOON', 'Deadline approaching', deadline.detail)
  }
  if (unread > 0) {
    return build('warn', 'UNREAD MESSAGES', 'Unread messages', `${unread} unread message${unread === 1 ? '' : 's'} on this assignment.`)
  }
  if (state.key === 'qa_review') {
    return build('info', 'IN QA REVIEW', 'In quality review', 'SolveNest quality review is in progress on this assignment.')
  }
  if (state.key === 'assigned' || state.key === 'needs_review') {
    return build('info', 'NEW ASSIGNMENT', 'New assignment', 'Review the confirmed requirements before beginning work.')
  }
  if (state.key === 'working') {
    return build('info', 'IN PROGRESS', 'In progress', 'Continue work on this assignment.')
  }
  return { level: 'none', needsAttention: false, badge: null, reason: null, detail: null }
}

export function formatAssignmentDue(value, options = {}) {
  if (options.completed) return 'Completed'
  if (!value) return 'No deadline'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No deadline'
  const diff = date.getTime() - Date.now()
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  if (diff < 0) return 'Overdue'
  if (days <= 1) return 'Due today'
  if (days === 2) return 'Due tomorrow'
  return `Due in ${days} days`
}

export function formatAssignmentTime(value) {
  if (!value) return ''
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatAssignmentStamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatFileSize(bytes) {
  const size = Number(bytes || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export { resolveExpertTaskState, resolveExpertNextAction, resolveExpertDeadlinePriority }
