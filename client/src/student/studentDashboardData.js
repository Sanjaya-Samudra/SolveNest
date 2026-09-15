const TASK_STATES = {
  DRAFT: { label: 'Draft', tone: 'muted', stage: 'UNDERSTAND', next: 'Open task', route: '/student/tasks' },
  SUBMITTED: { label: 'Submitted', tone: 'calm', stage: 'UNDERSTAND', next: 'View task', route: '/student/tasks' },
  VALIDATING: { label: 'Validating', tone: 'calm', stage: 'UNDERSTAND', next: 'View task', route: '/student/tasks' },
  AI_ANALYZED: { label: 'Analysis ready', tone: 'calm', stage: 'CONFIRM', next: 'Review analysis', route: '/student/tasks' },
  NEEDS_INFORMATION: { label: 'Information needed', tone: 'attention', stage: 'UNDERSTAND', next: 'Respond', route: '/student/tasks' },
  FEASIBILITY_REVIEW: { label: 'Human review', tone: 'calm', stage: 'CONFIRM', next: 'View task', route: '/student/tasks' },
  QUOTE_READY: { label: 'Quote ready', tone: 'attention', stage: 'CONFIRM', next: 'Review official plan', route: '/student/tasks' },
  AWAITING_ACCEPTANCE: { label: 'Awaiting your decision', tone: 'attention', stage: 'CONFIRM', next: 'Review official plan', route: '/student/tasks' },
  PAYMENT_PENDING: { label: 'Payment required', tone: 'attention', stage: 'FUND', next: 'Fund task', route: '/student/payments' },
  PAID: { label: 'Funded', tone: 'calm', stage: 'MATCH', next: 'View progress', route: '/student/tasks' },
  ASSIGNMENT_PENDING: { label: 'Matching expertise', tone: 'calm', stage: 'MATCH', next: 'View task', route: '/student/tasks' },
  IN_PROGRESS: { label: 'In progress', tone: 'active', stage: 'PROGRESS', next: 'View progress', route: '/student/tasks' },
  QUALITY_REVIEW: { label: 'Quality review', tone: 'active', stage: 'VERIFY', next: 'View task', route: '/student/tasks' },
  DELIVERED: { label: 'Delivery ready', tone: 'attention', stage: 'DELIVER', next: 'Review delivery', route: '/student/deliveries' },
  REVISION_REQUESTED: { label: 'Revision requested', tone: 'attention', stage: 'DELIVER', next: 'Review revision', route: '/student/tasks' },
  REVISION_IN_PROGRESS: { label: 'Revision in progress', tone: 'active', stage: 'PROGRESS', next: 'View progress', route: '/student/tasks' },
  COMPLETED: { label: 'Completed', tone: 'complete', stage: 'LEARN', next: 'Open task', route: '/student/tasks' },
  DECLINED: { label: 'Declined', tone: 'muted', stage: 'CONFIRM', next: 'Open task', route: '/student/tasks' },
  CANCELLED: { label: 'Cancelled', tone: 'muted', stage: 'CONFIRM', next: 'Open task', route: '/student/tasks' },
  DISPUTED: { label: 'Needs support', tone: 'attention', stage: 'VERIFY', next: 'Open task', route: '/student/tasks' },
}

const JOURNEY = [
  ['UNDERSTAND', 'Understand'],
  ['CONFIRM', 'Confirm'],
  ['FUND', 'Fund'],
  ['MATCH', 'Match'],
  ['PROGRESS', 'Progress'],
  ['VERIFY', 'Verify'],
  ['DELIVER', 'Deliver'],
  ['LEARN', 'Learn'],
]

const ACTIONABLE = new Set(['NEEDS_INFORMATION', 'QUOTE_READY', 'AWAITING_ACCEPTANCE', 'PAYMENT_PENDING', 'DELIVERED', 'REVISION_REQUESTED', 'DISPUTED'])
const STAGE_RANK = Object.fromEntries(JOURNEY.map(([key], index) => [key, index]))

export function resolveStudentTaskState(task) {
  const key = String(task?.status || '').toUpperCase()
  const state = TASK_STATES[key] || { label: 'Task update', tone: 'muted', stage: 'UNDERSTAND', next: 'Open task', route: '/student/tasks' }
  const backendAction = task?.nextAction || task?.actionRequired
  return {
    ...state,
    key,
    needsStudentAction: Boolean(backendAction || ACTIONABLE.has(key)),
    next: backendAction?.label || state.next,
    route: backendAction?.route || state.route,
  }
}

export function resolveStudentNextAction(task) {
  const state = resolveStudentTaskState(task)
  return { label: state.next, route: state.route, needsStudentAction: state.needsStudentAction }
}

export function getTaskJourney(task) {
  const state = resolveStudentTaskState(task)
  const current = STAGE_RANK[state.stage] ?? 0
  return JOURNEY.map(([key, label], index) => ({ key, label, status: index < current ? 'complete' : index === current ? 'current' : 'future' }))
}

export function buildStudentDashboardViewModel(snapshot) {
  const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : []
  const resolved = tasks.map((task) => ({ ...task, display: resolveStudentTaskState(task), nextAction: resolveStudentNextAction(task) }))
  const focusTask = resolved.filter((task) => task.display.needsStudentAction).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0]
    || resolved.find((task) => !['COMPLETED', 'CANCELLED', 'DECLINED'].includes(task.display.key))
    || resolved[0]
  return {
    student: snapshot?.student || null,
    tasks: resolved,
    activeTask: focusTask || null,
    focusAction: snapshot?.nextAction || (focusTask ? { ...focusTask.nextAction, task: focusTask } : null),
    notifications: Array.isArray(snapshot?.notifications) ? snapshot.notifications : [],
    recentActivity: Array.isArray(snapshot?.recentActivity) ? snapshot.recentActivity : [],
    upcomingActions: Array.isArray(snapshot?.upcomingActions) ? snapshot.upcomingActions.slice(0, 5) : [],
    unreadMessages: Number(snapshot?.unreadMessages || 0),
    explainAndDefend: snapshot?.explainAndDefend || null,
  }
}

export async function fetchStudentDashboard(signal) {
  const response = await fetch('/api/student/dashboard', { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_DASHBOARD_${response.status}`)
  return buildStudentDashboardViewModel(await response.json())
}

export function formatDate(value, options = {}) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...options }).format(date)
}

export function formatRelativeTime(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
