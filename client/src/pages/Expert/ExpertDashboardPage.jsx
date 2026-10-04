import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Compass,
  FileText,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { buildExpertRoute, resolveExpertDeadlinePriority, EXPERT_FOCUS_PRIORITY } from '../../expert/expertState.js'
import { toExpertSafeTaskSummary, ExpertSafeTaskSummary } from '../../expert/expertSafe.jsx'
import { useExpertAvailabilityControl } from '../../expert/expertDashboardData.js'
import { expressInterest } from '../../expert/expertApi.js'
import { ExpertLoadingRow, goExpert } from './ExpertAppShell.jsx'

function formatDue(value) {
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

function timeAgo(value) {
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

const PRIORITY_ORDER = ['OVERDUE', 'DUE_SOON', 'DUE_LATER', 'NO_DEADLINE']

function priorityLabel(task) {
  const tone = resolveExpertDeadlinePriority(task)
  if (tone === 'red') return 'OVERDUE'
  if (tone === 'amber') return 'DUE_SOON'
  if (task?.deadline) return 'DUE_LATER'
  return 'NO_DEADLINE'
}

export function ExpertHeader({ expert, workspace }) {
  const activeCount = (workspace?.assignments || []).filter((item) => item.workState !== 'delivered').length
  return (
    <header className="exp-header">
      <div className="exp-header-copy">
        <p className="exp-overline">EXPERT WORKBENCH</p>
        <h1>Command Focus</h1>
        <p className="exp-header-sub">
          {activeCount > 0
            ? `${activeCount} active assignment${activeCount === 1 ? '' : 's'} in your queue.`
            : 'No active assignments right now.'}
        </p>
      </div>
      <div className="exp-header-meta">
        <div className="exp-header-meta-block">
          <span className="exp-overline">EXPERT</span>
          <strong>{expert?.name || 'Expert'}</strong>
          <small>{expert?.title || 'SolveNest Expert'}{expert?.verified ? ' · Verified' : ''}</small>
        </div>
        {expert?.verified && (
          <span className="exp-verified-chip">
            <ShieldCheck size={14} />
            Verified
          </span>
        )}
      </div>
    </header>
  )
}

export function ExpertCommandFocus({ focus, onSelectAssignment }) {
  const tierIndex = Math.max(0, EXPERT_FOCUS_PRIORITY.indexOf(focus.tier))
  const assignment = focus.assignment ? toExpertSafeTaskSummary(focus.assignment) : null
  const available = focus.available ? toExpertSafeTaskSummary(focus.available) : null
  const subject = assignment || available

  return (
    <motion.section
      className="exp-focus"
      data-kind={focus.kind}
      data-tier={focus.tier}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="exp-focus-rail">
        <span className="exp-overline">FOCUS PRIORITY</span>
        <ol className="exp-focus-tiers">
          {EXPERT_FOCUS_PRIORITY.slice(0, 9).map((tier, index) => (
            <li key={tier} className={index === tierIndex ? 'is-current' : index < tierIndex ? 'is-passed' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <em>{tier.replace(/_/g, ' ')}</em>
            </li>
          ))}
        </ol>
      </div>
      <div className="exp-focus-body">
        <div className="exp-focus-copy">
          <p className="exp-focus-state">{focus.state}</p>
          {subject && (
            <ExpertSafeTaskSummary task={subject}>
              {(safe) => (
                <div className="exp-focus-subject">
                  <p className="exp-focus-subject-meta">
                    {safe.domain || safe.type || 'Assignment'}
                    {safe.reference ? ` · ${safe.reference}` : ''}
                  </p>
                  <h2>{safe.title}</h2>
                  {safe.deadline && (
                    <p className="exp-focus-deadline" data-tone={resolveExpertDeadlinePriority(safe)}>
                      <CalendarClock size={15} />
                      {formatDue(safe.deadline)}
                    </p>
                  )}
                </div>
              )}
            </ExpertSafeTaskSummary>
          )}
          <p className="exp-focus-reason">{focus.reason}</p>
          {focus.otherActionCount > 0 && (
            <p className="exp-focus-more">{focus.otherActionCount} more item{focus.otherActionCount === 1 ? '' : 's'} need attention.</p>
          )}
        </div>
        <div className="exp-focus-actions">
          <button
            className="exp-button"
            onClick={() => {
              if (focus.kind === 'assignment' && assignment) onSelectAssignment?.(assignment.id)
              goExpert(buildExpertRoute({ section: focus.route, assignmentId: assignment?.id, taskId: available?.id }))
            }}
          >
            {focus.cta}
            <ArrowRight size={15} />
          </button>
          <button className="exp-button exp-button--ghost" onClick={() => goExpert('/expert/assignments')}>
            View all assignments
          </button>
        </div>
      </div>
    </motion.section>
  )
}

export function AssignmentLedgerRow({ assignment, selected, onSelect }) {
  const state = assignment.display
  const tone = resolveExpertDeadlinePriority(assignment)
  return (
    <button
      className={`exp-ledger-row ${selected ? 'is-selected' : ''}`}
      data-state={assignment.workState}
      onClick={() => onSelect?.(assignment.id)}
    >
      <span className="exp-ledger-dot" data-tone={tone} aria-hidden="true" />
      <div className="exp-ledger-main">
        <strong>{assignment.title}</strong>
        <small>
          {assignment.domain || assignment.type || 'Assignment'}
          {assignment.reference ? ` · ${assignment.reference}` : ''}
        </small>
      </div>
      <span className="exp-ledger-state" data-state={assignment.workState}>
        {state.label}
      </span>
      <span className="exp-ledger-due" data-tone={tone}>
        {formatDue(assignment.deadline)}
      </span>
      <span className="exp-ledger-next">
        <span>{assignment.next.label}</span>
        <ArrowRight size={14} />
      </span>
    </button>
  )
}

export function AssignmentDesk({ assignments, selected, onSelect, loading }) {
  const rows = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const toneRank = (item) => (resolveExpertDeadlinePriority(item) === 'red' ? 0 : resolveExpertDeadlinePriority(item) === 'amber' ? 1 : 2)
      const stateRank = (item) => (item.display.needsAction ? 0 : 1)
      return stateRank(a) - stateRank(b) || toneRank(a) - toneRank(b)
    })
  }, [assignments])

  return (
    <section className="exp-panel exp-desk">
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">ASSIGNMENT DESK</p>
          <h3>Active work</h3>
        </div>
        <button className="exp-button exp-button--ghost exp-button--sm" onClick={() => goExpert('/expert/assignments')}>
          Open desk
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="exp-ledger">
        {loading ? (
          <>
            <ExpertLoadingRow />
            <ExpertLoadingRow />
          </>
        ) : rows.length === 0 ? (
          <ExpertDashboardEmptyStates kind="assignments" />
        ) : (
          rows.slice(0, 6).map((assignment) => (
            <AssignmentLedgerRow
              key={assignment.id}
              assignment={assignment}
              selected={selected?.id === assignment.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  )
}

export function ExpertAssignmentPulse({ assignment, onSelect }) {
  if (!assignment) {
    return (
      <section className="exp-panel exp-pulse">
        <div className="exp-panel-head">
          <div>
            <p className="exp-overline">CURRENT ASSIGNMENT</p>
            <h3>Pulse</h3>
          </div>
        </div>
        <ExpertDashboardEmptyStates kind="pulse" />
      </section>
    )
  }

  const state = assignment.display
  const journey = assignment.journey
  const safe = toExpertSafeTaskSummary(assignment)

  return (
    <section className="exp-panel exp-pulse">
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">CURRENT ASSIGNMENT</p>
          <h3>{state.label}</h3>
        </div>
        <span className="exp-state-chip" data-state={assignment.workState}>{state.label}</span>
      </div>

      <div className="exp-pulse-scroll">
        {safe && (
          <div className="exp-pulse-subject">
            <p className="exp-pulse-meta">
              {safe.domain || safe.type || 'Assignment'}
              {safe.reference ? ` · ${safe.reference}` : ''}
            </p>
            <strong>{safe.title}</strong>
            {safe.requirements?.length > 0 && (
              <ul className="exp-pulse-reqs">
                {safe.requirements.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </div>
        )}

        <ol className="exp-journey" aria-label="Assignment journey">
          {journey.map((step) => (
            <li key={step.key} data-status={step.status}>
              <span className="exp-journey-node">
                {step.status === 'complete' ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
              </span>
              <em>{step.label}</em>
            </li>
          ))}
        </ol>

        <div className="exp-pulse-actions">
          <button
            className="exp-button"
            onClick={() => goExpert(buildExpertRoute({ section: 'assignments', assignmentId: assignment.id }))}
          >
            {assignment.next.label}
            <ArrowRight size={15} />
          </button>
          <span className="exp-pulse-due" data-tone={resolveExpertDeadlinePriority(assignment)}>
            <CalendarClock size={14} />
            {formatDue(assignment.deadline)}
          </span>
        </div>
        {assignment.latest && (
          <p className="exp-pulse-latest">
            <Radio size={13} />
            <span>{assignment.latest.text}</span>
            <time>{timeAgo(assignment.latest.at)}</time>
          </p>
        )}
      </div>
    </section>
  )
}

export function DeadlineRadar({ deadlines, limit = 6 }) {
  const ordered = useMemo(() => {
    return [...(deadlines || [])].sort((a, b) => {
      const rank = (item) => PRIORITY_ORDER.indexOf(priorityLabel(item))
      return rank(a) - rank(b)
    })
  }, [deadlines])

  return (
    <section className="exp-panel exp-radar">
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">DEADLINE RADAR</p>
          <h3>Upcoming</h3>
        </div>
        <CalendarClock size={17} aria-hidden="true" />
      </div>
      {ordered.length === 0 ? (
        <ExpertDashboardEmptyStates kind="deadlines" />
      ) : (
        <ul className="exp-radar-list">
          {ordered.slice(0, limit).map((task) => (
            <li key={task.id} data-tone={resolveExpertDeadlinePriority(task)}>
              <span className="exp-radar-marker" aria-hidden="true" />
              <div>
                <strong>{task.title}</strong>
                <small>{priorityLabel(task)} · {formatDue(task.deadline)}</small>
              </div>
              <button
                className="exp-radar-open"
                onClick={() => goExpert(buildExpertRoute({ section: 'assignments', assignmentId: task.id }))}
                aria-label={`Open ${task.title}`}
              >
                <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AvailableForYou({ tasks, compact = false }) {
  const [pending, setPending] = useState(null)
  const [states, setStates] = useState({})
  const [error, setError] = useState(null)

  const stateFor = (task) => states[task.id] || task.interestState || 'none'

  async function send(taskId) {
    if (pending) return
    setPending(taskId)
    setError(null)
    try {
      const result = await expressInterest(taskId)
      setStates((prev) => ({ ...prev, [taskId]: result.interestState || 'sent' }))
    } catch (err) {
      if (err?.message === 'EXPERT_ACCESS_REQUIRED') setError('Sign in to express interest.')
      else setError('Interest could not be recorded. Try again.')
    } finally {
      setPending(null)
    }
  }

  const list = compact ? tasks.slice(0, 3) : tasks

  return (
    <section className={`exp-panel exp-available ${compact ? 'is-compact' : ''}`}>
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">AVAILABLE FOR YOU</p>
          <h3>Open tasks you can express interest in</h3>
        </div>
        <Compass size={17} aria-hidden="true" />
      </div>
      <p className="exp-available-note">
        Expressing interest never assigns work. SolveNest reviews fit and confirms assignments directly — no bidding.
      </p>
      {error && <p className="exp-inline-error" role="alert">{error}</p>}
      {list.length === 0 ? (
        <ExpertDashboardEmptyStates kind="available" />
      ) : (
        <div className="exp-available-list">
          {list.map((task) => {
            const safe = toExpertSafeTaskSummary(task)
            if (!safe) return null
            const interest = stateFor(task)
            return (
              <article key={task.id} className="exp-available-card">
                <div className="exp-available-card-head">
                  <p className="exp-available-meta">
                    {safe.domain || safe.type || 'Task'}
                    {safe.complexity ? ` · ${safe.complexity}` : ''}
                  </p>
                  {safe.deadline && (
                    <span className="exp-available-due" data-tone={resolveExpertDeadlinePriority(safe)}>
                      {formatDue(safe.deadline)}
                    </span>
                  )}
                </div>
                <h4>{safe.title}</h4>
                {safe.requirements?.length > 0 && (
                  <ul className="exp-available-reqs">
                    {safe.requirements.slice(0, compact ? 2 : 4).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {safe.matchHints?.length > 0 && (
                  <div className="exp-available-hints">
                    {safe.matchHints.map((hint) => <span key={hint}>{hint}</span>)}
                  </div>
                )}
                <div className="exp-available-actions">
                  <button
                    className="exp-button exp-button--sm"
                    disabled={interest === 'sent' || pending === task.id}
                    onClick={() => send(task.id)}
                  >
                    {interest === 'sent' ? (
                      <>
                        <CheckCircle2 size={14} />
                        Interest sent
                      </>
                    ) : pending === task.id ? (
                      <>
                        <Loader2 size={14} className="exp-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        Express interest
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                  <button
                    className="exp-button exp-button--ghost exp-button--sm"
                    onClick={() => goExpert(buildExpertRoute({ section: 'available-tasks', taskId: task.id }))}
                  >
                    Review
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {compact && tasks.length > 3 && (
        <button className="exp-panel-footer-link" onClick={() => goExpert('/expert/available-tasks')}>
          See all open tasks
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  )
}

const MOVEMENT_ICONS = {
  interest: Sparkles,
  qa: ShieldCheck,
  delivery: FileText,
  message: MessageSquareWarning,
  assignment: Target,
}

export function RecentMovement({ movement, compact = false }) {
  const list = compact ? movement.slice(0, 5) : movement
  return (
    <section className={`exp-panel exp-movement ${compact ? 'is-compact' : ''}`}>
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">RECENT MOVEMENT</p>
          <h3>{compact ? 'Latest activity' : 'Activity log'}</h3>
        </div>
        <TrendingUp size={17} aria-hidden="true" />
      </div>
      {list.length === 0 ? (
        <ExpertDashboardEmptyStates kind="movement" />
      ) : (
        <ul className="exp-movement-list">
          {list.map((item) => {
            const Icon = MOVEMENT_ICONS[item.kind] || Radio
            return (
              <li key={item.id}>
                <span className="exp-movement-icon" aria-hidden="true"><Icon size={14} /></span>
                <div>
                  <strong>{item.label}</strong>
                  {item.title && <small>{item.title}</small>}
                </div>
                <time>{timeAgo(item.at)}</time>
              </li>
            )
          })}
        </ul>
      )}
      {compact && movement.length > 5 && (
        <button className="exp-panel-footer-link" onClick={() => goExpert('/expert/activity')}>
          Open activity log
          <ArrowRight size={14} />
        </button>
      )}
    </section>
  )
}

export function ExpertAvailabilityControl({ availability, onSignedIn = true }) {
  const control = useExpertAvailabilityControl(availability)
  const options = [
    ['available', 'Available', 'Accept new assignments at full capacity.'],
    ['limited', 'Limited', 'Slow down new work while finishing active assignments.'],
    ['unavailable', 'Unavailable', 'Pause new assignment offers entirely.'],
  ]

  return (
    <section className="exp-panel exp-availability">
      <div className="exp-panel-head">
        <div>
          <p className="exp-overline">AVAILABILITY</p>
          <h3>Control incoming work</h3>
        </div>
        <Radio size={17} aria-hidden="true" />
      </div>
      <div className="exp-availability-options" role="radiogroup" aria-label="Availability">
        {options.map(([key, label, hint]) => (
          <button
            key={key}
            role="radio"
            aria-checked={control.availability === key}
            className={`exp-availability-option ${control.availability === key ? 'is-active' : ''}`}
            data-status={key}
            disabled={control.saving || !onSignedIn}
            onClick={() => control.set(key)}
          >
            <span className="exp-availability-dot" aria-hidden="true" />
            <strong>{label}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      {control.error && <p className="exp-inline-error" role="alert">{control.error}</p>}
      <AnimatePresence>
        {control.toast && (
          <motion.div
            className="exp-toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
          >
            <CheckCircle2 size={15} />
            <div>
              <strong>{control.toast.title}</strong>
              <small>{control.toast.body}</small>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function ExpertDashboardEmptyStates({ kind }) {
  const copy = {
    assignments: {
      icon: <Inbox size={22} />,
      title: 'No active assignments',
      body: 'Confirmed work appears here the moment SolveNest assigns it to you.',
      cta: 'Browse available tasks',
      route: '/expert/available-tasks',
    },
    deadlines: {
      icon: <CalendarClock size={22} />,
      title: 'No deadlines on the radar',
      body: 'Assignments with due dates will show here in priority order.',
      cta: 'View assignments',
      route: '/expert/assignments',
    },
    available: {
      icon: <Compass size={22} />,
      title: 'No open tasks right now',
      body: 'New tasks matched to your expertise appear here. Express interest — never bid.',
      cta: 'Check again',
      route: '/expert/available-tasks',
    },
    movement: {
      icon: <TrendingUp size={22} />,
      title: 'No movement yet',
      body: 'Assignment, QA, and delivery updates will be logged here.',
      cta: 'Open dashboard',
      route: '/expert/dashboard',
    },
    pulse: {
      icon: <Target size={22} />,
      title: 'No assignment selected',
      body: 'Select an assignment from the desk to see its journey and next action.',
      cta: 'View assignments',
      route: '/expert/assignments',
    },
    notifications: {
      icon: <Inbox size={22} />,
      title: 'You are all caught up',
      body: 'Assignment, QA, and message notifications appear here.',
      cta: 'Open dashboard',
      route: '/expert/dashboard',
    },
  }
  const item = copy[kind] || copy.assignments
  return (
    <div className="exp-empty">
      <span className="exp-empty-icon" aria-hidden="true">{item.icon}</span>
      <p className="exp-empty-title">{item.title}</p>
      <p className="exp-empty-body">{item.body}</p>
      <button className="exp-button exp-button--ghost exp-button--sm" onClick={() => goExpert(item.route)}>
        {item.cta}
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

export function ExpertDashboardSkeletons() {
  return (
    <div className="exp-skeletons" aria-label="Loading expert workspace" aria-busy="true">
      <div className="exp-skeleton exp-skeleton--header" />
      <div className="exp-skeleton exp-skeleton--focus" />
      <div className="exp-skeleton-grid">
        <div className="exp-skeleton exp-skeleton--panel" />
        <div className="exp-skeleton exp-skeleton--panel" />
      </div>
      <div className="exp-skeleton-grid exp-skeleton-grid--three">
        <div className="exp-skeleton exp-skeleton--panel" />
        <div className="exp-skeleton exp-skeleton--panel" />
        <div className="exp-skeleton exp-skeleton--panel" />
      </div>
    </div>
  )
}

const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview', Icon: Target },
  { key: 'assignments', label: 'Assignments', Icon: Briefcase },
  { key: 'deadlines', label: 'Deadlines', Icon: CalendarClock },
  { key: 'opportunities', label: 'Opportunities', Icon: Compass },
  { key: 'activity', label: 'Activity', Icon: TrendingUp },
]

function DashboardTabs({ active, onChange, counts }) {
  return (
    <div className="exp-tabs" role="tablist" aria-label="Dashboard sections">
      {DASHBOARD_TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          id={`exp-tab-${key}`}
          aria-selected={active === key}
          aria-controls={`exp-panel-${key}`}
          className={active === key ? 'exp-tab is-active' : 'exp-tab'}
          onClick={() => onChange(key)}
        >
          <Icon size={15} />
          <span>{label}</span>
          {counts[key] > 0 && <b>{counts[key] > 99 ? '99+' : counts[key]}</b>}
        </button>
      ))}
    </div>
  )
}

export function ExpertDashboardPage({ dashboard }) {
  const {
    loading,
    error,
    workspace,
    expert,
    availability,
    assignments,
    focus,
    availableTaskPreview,
    deadlines,
    movement,
    selectedAssignment,
    selectAssignment,
    reload,
  } = dashboard
  const [tab, setTab] = useState('overview')

  if (error && !workspace) {
    return (
      <section className="exp-local-error" role="alert">
        <p className="exp-overline">COULD NOT LOAD</p>
        <h2>We could not load your expert dashboard.</h2>
        <p>The workspace service did not return data.</p>
        <button className="exp-button" onClick={reload}>Try again</button>
      </section>
    )
  }

  if (loading && !workspace) {
    return <ExpertDashboardSkeletons />
  }

  const openActionCount = assignments.filter((item) => item.display.needsAction && !item.display.closed).length
  const counts = {
    overview: 0,
    assignments: openActionCount,
    deadlines: deadlines.length,
    opportunities: availableTaskPreview.length,
    activity: 0,
  }

  const desk = (
    <AssignmentDesk
      assignments={assignments}
      selected={selectedAssignment}
      onSelect={selectAssignment}
      loading={loading}
    />
  )
  const pulse = <ExpertAssignmentPulse assignment={selectedAssignment} onSelect={selectAssignment} />

  return (
    <div className="exp-dashboard">
      <ExpertHeader expert={expert} workspace={workspace} />
      <DashboardTabs active={tab} onChange={setTab} counts={counts} />
      <div className="exp-tab-panels">
        {tab === 'overview' && (
          <div
            id="exp-panel-overview"
            role="tabpanel"
            aria-labelledby="exp-tab-overview"
            className="exp-tab-panel"
          >
            <ExpertCommandFocus focus={focus} onSelectAssignment={selectAssignment} />
            <div className="exp-dashboard-grid">
              {desk}
              {pulse}
              <DeadlineRadar deadlines={deadlines} limit={6} />
            </div>
          </div>
        )}
        {tab === 'assignments' && (
          <div
            id="exp-panel-assignments"
            role="tabpanel"
            aria-labelledby="exp-tab-assignments"
            className="exp-tab-panel"
          >
            <div className="exp-dashboard-grid exp-dashboard-grid--two">
              {desk}
              {pulse}
            </div>
          </div>
        )}
        {tab === 'deadlines' && (
          <div
            id="exp-panel-deadlines"
            role="tabpanel"
            aria-labelledby="exp-tab-deadlines"
            className="exp-tab-panel"
          >
            <DeadlineRadar deadlines={deadlines} limit={14} />
          </div>
        )}
        {tab === 'opportunities' && (
          <div
            id="exp-panel-opportunities"
            role="tabpanel"
            aria-labelledby="exp-tab-opportunities"
            className="exp-tab-panel"
          >
            <AvailableForYou tasks={availableTaskPreview} />
          </div>
        )}
        {tab === 'activity' && (
          <div
            id="exp-panel-activity"
            role="tabpanel"
            aria-labelledby="exp-tab-activity"
            className="exp-tab-panel"
          >
            <div className="exp-dashboard-grid exp-dashboard-grid--two">
              <RecentMovement movement={movement} />
              <ExpertAvailabilityControl availability={availability} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
