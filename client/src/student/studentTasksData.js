import { resolveStudentNextAction, resolveStudentTaskState, getTaskJourney, formatDate, formatRelativeTime } from './studentDashboardData.js'

export const TASK_VIEWS = [
  ['all', 'All'],
  ['needs-you', 'Needs You'],
  ['active', 'Active'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
]

export function mapStudentTask(raw) {
  const task = {
    ...raw,
    id: raw?.id || raw?.uuid,
    title: raw?.title || raw?.type || 'Untitled task',
    subject: raw?.subject || raw?.domain || null,
    deadline: raw?.deadline || raw?.deadline_at || null,
    latestUpdate: raw?.latestUpdate || raw?.latest_update || null,
    expert: raw?.expert || null,
    quote: raw?.quote || null,
    payment: raw?.payment || null,
    delivery: raw?.delivery || null,
  }
  return { ...task, display: resolveStudentTaskState(task), nextAction: resolveStudentNextAction(task) }
}

export async function fetchStudentTasks({ page = 1, perPage = 20, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  const response = await fetch(`/api/student/tasks?${params}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_TASKS_${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : payload.tasks || payload.data || []
  return { tasks: rows.map(mapStudentTask), meta: payload.meta || null }
}

export async function fetchStudentTaskPreview(taskId, { signal } = {}) {
  const response = await fetch(`/api/student/tasks/${encodeURIComponent(taskId)}/preview`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_TASK_PREVIEW_${response.status}`)
  const payload = await response.json()
  return mapStudentTask(payload.task || payload.data || payload)
}

export function matchesTaskView(task, view) {
  const status = task.display.key
  if (view === 'needs-you') return task.display.needsStudentAction
  if (view === 'active') return !['COMPLETED', 'CANCELLED', 'DECLINED'].includes(status)
  if (view === 'delivered') return status === 'DELIVERED'
  if (view === 'completed') return status === 'COMPLETED'
  return true
}

export function sortStudentTasks(tasks, sort) {
  return [...tasks].sort((a, b) => {
    if (sort === 'deadline') return compareNullableDates(a.deadline, b.deadline)
    if (sort === 'title') return a.title.localeCompare(b.title)
    if (sort === 'newest') return dateValue(b.createdAt) - dateValue(a.createdAt)
    return dateValue(b.updatedAt || b.latestUpdate?.createdAt) - dateValue(a.updatedAt || a.latestUpdate?.createdAt)
  })
}

function dateValue(value) { if (!value) return Number.MAX_SAFE_INTEGER; const time = new Date(value).getTime(); return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time }
function compareNullableDates(left, right) { const leftMissing = !left || Number.isNaN(new Date(left).getTime()); const rightMissing = !right || Number.isNaN(new Date(right).getTime()); if (leftMissing && rightMissing) return 0; if (leftMissing) return 1; if (rightMissing) return -1; return new Date(left).getTime() - new Date(right).getTime() }

export function filterStudentTasks(tasks, { search, view }) {
  const term = search.trim().toLowerCase()
  return tasks.filter((task) => {
    if (!matchesTaskView(task, view)) return false
    if (!term) return true
    return [task.title, task.subject, task.reference, task.type].filter(Boolean).join(' ').toLowerCase().includes(term)
  })
}

export { formatDate, formatRelativeTime, getTaskJourney }
