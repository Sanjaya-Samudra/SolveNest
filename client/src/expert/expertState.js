export const EXPERT_WORK_STATE = {
  ASSIGNED: 'assigned',
  NEEDS_REVIEW: 'needs_review',
  WORKING: 'working',
  WAITING_CLARIFICATION: 'waiting_clarification',
  READY_FOR_QA: 'ready_for_qa',
  QA_REVIEW: 'qa_review',
  CHANGES_REQUESTED: 'changes_requested',
  READY_TO_DELIVER: 'ready_to_deliver',
  DELIVERED: 'delivered',
}

export const EXPERT_FOCUS_PRIORITY = [
  'blocked_clarification',
  'qa_return',
  'imminent_deadline',
  'delivery_due',
  'unread_critical',
  'active_assignment',
  'new_assignment',
  'available_opportunity',
  'no_action',
]

export const EXPERT_JOURNEY = ['assigned', 'understand', 'work', 'submit', 'qa', 'deliver']

const WORK_STATE_LABELS = {
  assigned: 'Assigned',
  needs_review: 'Needs Review',
  working: 'Working',
  waiting_clarification: 'Waiting for Clarification',
  ready_for_qa: 'Ready for QA',
  qa_review: 'QA Review',
  changes_requested: 'Changes Requested',
  ready_to_deliver: 'Ready to Deliver',
  delivered: 'Delivered',
}

const TASK_STATUS_TO_WORK_STATE = {
  PAID: EXPERT_WORK_STATE.ASSIGNED,
  ASSIGNMENT_PENDING: EXPERT_WORK_STATE.ASSIGNED,
  IN_PROGRESS: EXPERT_WORK_STATE.WORKING,
  QUALITY_REVIEW: EXPERT_WORK_STATE.QA_REVIEW,
  DELIVERED: EXPERT_WORK_STATE.DELIVERED,
  REVISION_REQUESTED: EXPERT_WORK_STATE.CHANGES_REQUESTED,
  REVISION_IN_PROGRESS: EXPERT_WORK_STATE.WORKING,
  DISPUTED: EXPERT_WORK_STATE.WAITING_CLARIFICATION,
  COMPLETED: EXPERT_WORK_STATE.DELIVERED,
}

const WORK_STATE_NEXT = {
  assigned: { key: 'review', label: 'Review Assignment', route: 'assignments' },
  needs_review: { key: 'review', label: 'Review Assignment', route: 'assignments' },
  working: { key: 'continue', label: 'Continue', route: 'assignments' },
  waiting_clarification: { key: 'respond', label: 'Respond', route: 'assignments' },
  ready_for_qa: { key: 'submit', label: 'Submit for QA', route: 'assignments' },
  qa_review: { key: 'wait', label: 'Waiting', route: 'assignments' },
  changes_requested: { key: 'review-qa', label: 'Review QA Feedback', route: 'assignments' },
  ready_to_deliver: { key: 'prepare', label: 'Prepare Delivery', route: 'assignments' },
  delivered: { key: 'open', label: 'Open Assignment', route: 'assignments' },
}

const FOCUS_COPY = {
  waiting_clarification: { state: 'CLARIFICATION NEEDED', cta: 'Respond →', reason: 'A question is waiting for your response.' },
  changes_requested: { state: 'CHANGES REQUESTED', cta: 'Review QA Feedback →', reason: 'Quality review returned feedback requiring your attention.' },
  ready_to_deliver: { state: 'READY TO SUBMIT', cta: 'Submit for Review →', reason: 'Your work is ready for the next SolveNest review stage.' },
  ready_for_qa: { state: 'READY TO SUBMIT', cta: 'Submit for QA →', reason: 'Your work is ready for quality review.' },
  needs_review: { state: 'NEW ASSIGNMENT', cta: 'Review Assignment →', reason: 'Review the confirmed requirements before beginning.' },
  assigned: { state: 'NEW ASSIGNMENT', cta: 'Review Assignment →', reason: 'Review the confirmed requirements before beginning.' },
  working: { state: 'IN PROGRESS', cta: 'Continue →', reason: 'Continue work on this assignment.' },
  qa_review: { state: 'QA REVIEW', cta: 'Open Assignment →', reason: 'Quality review is in progress on this assignment.' },
  delivered: { state: 'DELIVERED', cta: 'Open Assignment →', reason: 'This delivery is complete.' },
}

const CLOSED_STATES = new Set(['delivered'])

function parseDeadline(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function resolveExpertTaskState(task) {
  const workState = TASK_STATUS_TO_WORK_STATE[String(task?.workState || task?.status || '').toUpperCase()]
    || (WORK_STATE_LABELS[task?.workState] ? task.workState : EXPERT_WORK_STATE.ASSIGNED)
  return {
    key: workState,
    label: WORK_STATE_LABELS[workState] || 'Assigned',
    needsAction: workState === 'waiting_clarification' || workState === 'changes_requested' || workState === 'ready_to_deliver' || workState === 'ready_for_qa' || workState === 'needs_review' || workState === 'assigned' || workState === 'working',
    closed: CLOSED_STATES.has(workState),
    copy: FOCUS_COPY[workState] || FOCUS_COPY.assigned,
  }
}

export function resolveExpertNextAction(task) {
  const state = resolveExpertTaskState(task)
  const custom = task?.nextAction
  if (custom?.label) return { ...custom, key: custom.key || state.key }
  const fallback = WORK_STATE_NEXT[state.key] || WORK_STATE_NEXT.assigned
  return { ...fallback, route: task?.nextAction?.route || fallback.route }
}

export function resolveExpertDeadlinePriority(task) {
  const deadline = parseDeadline(task?.deadline)
  if (!deadline) return 'neutral'
  const diff = deadline - Date.now()
  if (diff < 0) return 'red'
  if (diff <= 48 * 60 * 60 * 1000) return 'amber'
  return 'neutral'
}

function urgencyRank(task) {
  const priority = resolveExpertDeadlinePriority(task)
  if (priority === 'red') return 0
  if (priority === 'amber') return 1
  return 2
}

function deadlineSoon(task) {
  const deadline = parseDeadline(task?.deadline)
  if (!deadline) return false
  return deadline - Date.now() <= 48 * 60 * 60 * 1000
}

export function resolveExpertAssignmentJourney(task) {
  const state = resolveExpertTaskState(task)
  const stepFor = {
    assigned: 'assigned',
    needs_review: 'assigned',
    working: 'work',
    waiting_clarification: 'work',
    ready_for_qa: 'submit',
    qa_review: 'qa',
    changes_requested: 'qa',
    ready_to_deliver: 'deliver',
    delivered: 'deliver',
  }
  const currentStep = stepFor[state.key] || 'assigned'
  const currentIndex = Math.max(0, EXPERT_JOURNEY.indexOf(currentStep))
  const labels = {
    assigned: 'Assigned',
    understand: 'Requirements Reviewed',
    work: 'Work in Progress',
    submit: 'Submit for QA',
    qa: 'Quality Review',
    deliver: 'Delivery',
  }
  const statusFor = (step, index) => {
    if (state.key === 'delivered') return 'complete'
    if (index < currentIndex) return 'complete'
    if (index === currentIndex) return 'current'
    return 'future'
  }
  return EXPERT_JOURNEY.map((step, index) => ({
    key: step,
    label: labels[step],
    status: statusFor(step, index),
  }))
}

export function resolveExpertInterestState(task) {
  const value = task?.interestState
  if (value === 'sent' || value === 'declined') return value
  return 'none'
}

export function resolveExpertDashboardFocus(assignments = [], availableTasks = []) {
  const list = Array.isArray(assignments) ? assignments.filter(Boolean) : []
  const open = list.filter((task) => !resolveExpertTaskState(task).closed)
  const pick = (match) => open.filter(match).sort((a, b) => urgencyRank(a) - urgencyRank(b))[0] || null
  let assignment = null
  let tier = 'no_action'
  let stateKey = null

  assignment = pick((task) => resolveExpertTaskState(task).key === 'waiting_clarification')
  if (assignment) { tier = 'blocked_clarification'; stateKey = 'waiting_clarification' }
  if (!assignment) {
    assignment = pick((task) => resolveExpertTaskState(task).key === 'changes_requested')
    if (assignment) { tier = 'qa_return'; stateKey = 'changes_requested' }
  }
  if (!assignment) {
    assignment = pick((task) => resolveExpertDeadlinePriority(task) !== 'neutral' && deadlineSoon(task))
    if (assignment) { tier = 'imminent_deadline'; stateKey = resolveExpertTaskState(assignment).key }
  }
  if (!assignment) {
    assignment = pick((task) => ['ready_to_deliver', 'ready_for_qa'].includes(resolveExpertTaskState(task).key))
    if (assignment) { tier = 'delivery_due'; stateKey = resolveExpertTaskState(assignment).key }
  }
  if (!assignment) {
    assignment = pick((task) => resolveExpertTaskState(task).key === 'working')
    if (assignment) { tier = 'active_assignment'; stateKey = 'working' }
  }
  if (!assignment) {
    assignment = pick((task) => ['assigned', 'needs_review'].includes(resolveExpertTaskState(task).key))
    if (assignment) { tier = 'new_assignment'; stateKey = resolveExpertTaskState(assignment).key }
  }

  if (!assignment && Array.isArray(availableTasks) && availableTasks.length) {
    return {
      tier: 'available_opportunity',
      kind: 'opportunity',
      state: 'OPPORTUNITY',
      assignment: null,
      available: availableTasks[0],
      reason: 'A task matching your expertise is open for Expert interest.',
      cta: 'Review Task →',
      route: 'available-tasks',
    }
  }

  if (!assignment) {
    return {
      tier: 'no_action',
      kind: 'clear',
      state: 'ALL CLEAR',
      assignment: null,
      available: null,
      reason: 'No immediate action is required.',
      cta: 'Open Assignments →',
      route: 'assignments',
    }
  }

  const copy = FOCUS_COPY[stateKey] || FOCUS_COPY.assigned
  const others = open.filter((task) => task.id !== assignment.id && resolveExpertTaskState(task).needsAction).length
  return {
    tier,
    kind: 'assignment',
    state: copy.state,
    assignment,
    available: null,
    reason: copy.reason,
    cta: copy.cta,
    route: 'assignments',
    otherActionCount: others,
  }
}

export function buildExpertRoute({ section, assignmentId, taskId } = {}) {
  const key = section || 'dashboard'
  if (key === 'dashboard') return '/expert/dashboard'
  if (key === 'available-tasks' && taskId) return `/expert/available-tasks?task=${encodeURIComponent(taskId)}`
  if (key === 'assignments' && assignmentId) return `/expert/assignments?assignment=${encodeURIComponent(assignmentId)}`
  return `/expert/${key}`
}
