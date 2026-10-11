import { formatAssignmentDue } from './assignmentState.js'
import { resolveExpertDeadlinePriority, resolveExpertInterestState } from './expertState.js'

export const OPPORTUNITY_PHASES = ['open', 'sending', 'sent', 'under_review', 'assigned', 'closed']

export const EXPERT_OPPORTUNITY_SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'deadline', label: 'Soonest deadline' },
  { key: 'complexity', label: 'Complexity' },
]

const COMPLEXITY_RANK = { Light: 0, Moderate: 1, Complex: 2 }

const SAFE_OPPORTUNITY_KEYS = [
  'id',
  'title',
  'domain',
  'type',
  'requirements',
  'skills',
  'deadline',
  'complexity',
  'interestState',
  'matchHints',
  'publishedAt',
]

export function toExpertOpportunity(rawTask) {
  if (!rawTask || typeof rawTask !== 'object') return null
  const safe = {}
  for (const key of SAFE_OPPORTUNITY_KEYS) {
    if (rawTask[key] !== undefined) safe[key] = rawTask[key]
  }
  if (!safe.id && rawTask.taskId) safe.id = String(rawTask.taskId)
  if (!safe.title) return null
  safe.id = String(safe.id)
  safe.title = String(safe.title)
  safe.requirements = Array.isArray(safe.requirements) ? safe.requirements.map(String).slice(0, 10) : []
  safe.skills = Array.isArray(safe.skills) ? safe.skills.map(String).slice(0, 10) : []
  safe.matchHints = Array.isArray(safe.matchHints) ? safe.matchHints.map(String).slice(0, 6) : []
  safe.domain = safe.domain ? String(safe.domain) : null
  safe.type = safe.type ? String(safe.type) : null
  safe.complexity = safe.complexity ? String(safe.complexity) : null
  safe.deadline = safe.deadline || null
  safe.publishedAt = safe.publishedAt || null
  safe.interestState = ['none', 'sent', 'declined'].includes(safe.interestState) ? safe.interestState : 'none'
  return safe
}

export function resolveOpportunityPhase(opportunity, override) {
  if (OPPORTUNITY_PHASES.includes(override) && override !== 'open') return override
  if (!opportunity) return 'closed'
  const interest = resolveExpertInterestState(opportunity)
  if (interest === 'sent') return 'sent'
  if (interest === 'declined') return 'closed'
  if (opportunity.assignedToYou) return 'assigned'
  if (opportunity.underReview) return 'under_review'
  return 'open'
}

export function resolveOpportunityState(opportunity, override) {
  const phase = resolveOpportunityPhase(opportunity, override)
  const view = {
    open: { phase, label: 'EXPRESS INTEREST', buttonLabel: 'Express interest', canExpress: true, disabled: false, tone: 'neutral' },
    sending: { phase, label: 'SENDING', buttonLabel: 'Sending…', canExpress: false, disabled: true, tone: 'neutral' },
    sent: { phase, label: 'INTEREST SENT', buttonLabel: 'Interest sent', canExpress: false, disabled: true, tone: 'green' },
    under_review: { phase, label: 'UNDER REVIEW', buttonLabel: 'Under review', canExpress: false, disabled: true, tone: 'amber' },
    assigned: { phase, label: 'ASSIGNED TO YOU', buttonLabel: 'Open assignment', canExpress: false, disabled: false, tone: 'green' },
    closed: { phase, label: 'NO LONGER AVAILABLE', buttonLabel: 'No longer available', canExpress: false, disabled: true, tone: 'neutral' },
  }
  return view[phase] || view.open
}

export function resolveOpportunityDeadline(opportunity) {
  if (!opportunity?.deadline) return { label: null, tone: 'neutral' }
  return {
    label: formatAssignmentDue(opportunity.deadline, { completed: false }),
    tone: resolveExpertDeadlinePriority(opportunity),
  }
}

export function resolveFitTrace(opportunity) {
  const hints = opportunity?.matchHints || []
  const skills = opportunity?.skills || []
  const signals = hints.map((text) => ({ key: `hint:${text}`, kind: 'hint', text }))
  return {
    signals,
    skills,
    count: signals.length,
    hasSignals: signals.length > 0,
  }
}

export function resolveOpportunityDomains(opportunities = []) {
  const domains = []
  for (const item of opportunities) {
    if (item.domain && !domains.includes(item.domain)) domains.push(item.domain)
  }
  return domains.sort((a, b) => a.localeCompare(b))
}

export function filterOpportunities(opportunities = [], { search = '', domain = 'all' } = {}) {
  const needle = search.trim().toLowerCase()
  return opportunities.filter((item) => {
    if (domain !== 'all' && item.domain !== domain) return false
    if (!needle) return true
    const haystack = [item.title, item.domain, item.type, ...item.skills, ...item.requirements]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function sortOpportunities(opportunities = [], sort = 'newest') {
  const list = opportunities.slice()
  if (sort === 'deadline') {
    return list.sort((a, b) => {
      const left = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER
      const right = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER
      return left - right
    })
  }
  if (sort === 'complexity') {
    return list.sort((a, b) => (COMPLEXITY_RANK[a.complexity] ?? 9) - (COMPLEXITY_RANK[b.complexity] ?? 9))
  }
  return list.sort((a, b) => {
    const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
    const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
    return right - left
  })
}

export function buildOpportunityRoute({ opportunityId } = {}) {
  if (!opportunityId) return '/expert/available'
  return `/expert/available?task=${encodeURIComponent(opportunityId)}`
}

export function parseOpportunityRoute(pathname = '', search = '') {
  if (!pathname.startsWith('/expert/available')) return { opportunityId: null }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const opportunityId = params.get('task')
  return { opportunityId: opportunityId || null }
}
