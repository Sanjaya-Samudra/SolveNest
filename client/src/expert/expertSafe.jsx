import React from 'react'

const SAFE_KEYS = [
  'id',
  'taskId',
  'reference',
  'title',
  'domain',
  'type',
  'deliverable',
  'requirements',
  'skills',
  'deadline',
  'complexity',
  'workState',
  'interestState',
  'latest',
  'nextAction',
  'matchHints',
  'updatedAt',
  'publishedAt',
]

export function toExpertSafeTaskSummary(raw) {
  if (!raw || typeof raw !== 'object') return null
  const safe = {}
  for (const key of SAFE_KEYS) {
    if (raw[key] !== undefined) safe[key] = raw[key]
  }
  if (!safe.id && safe.taskId) safe.id = safe.taskId
  if (!safe.title) return null
  safe.requirements = Array.isArray(safe.requirements) ? safe.requirements : []
  safe.skills = Array.isArray(safe.skills) ? safe.skills : []
  safe.matchHints = Array.isArray(safe.matchHints) ? safe.matchHints : []
  return safe
}

export function ExpertSafeTaskSummary({ task, children }) {
  const safe = toExpertSafeTaskSummary(task)
  if (!safe) return null
  if (typeof children === 'function') return children(safe)
  return (
    <div className="exp-safe-summary">
      <p className="exp-safe-summary__meta">
        {safe.domain || safe.type || 'Assignment'}
        {safe.reference ? ` · ${safe.reference}` : ''}
      </p>
      <strong className="exp-safe-summary__title">{safe.title}</strong>
      {safe.requirements.length > 0 && (
        <p className="exp-safe-summary__reqs">{safe.requirements.slice(0, 4).join(' · ')}</p>
      )}
      {safe.deadline && (
        <p className="exp-safe-summary__deadline">Due {new Date(safe.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
      )}
    </div>
  )
}
