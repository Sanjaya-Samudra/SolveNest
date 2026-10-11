import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  buildExpertAssignmentRoute,
  EXPERT_ASSIGNMENT_FILTERS,
  EXPERT_ASSIGNMENT_SORTS,
  formatAssignmentDue,
  formatAssignmentTime,
} from '../../expert/assignmentState.js'
import { useAssignmentInspector, useAssignmentRealtime, useExpertAssignments } from '../../expert/assignmentData.js'
import { goExpert } from './ExpertAppShell.jsx'
import './expert-assignments.css'

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1099px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)')
    const onChange = (event) => setCompact(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return compact
}

export function AssignmentLedgerRow({ assignment, selected, onSelect, onOpen }) {
  const attention = assignment.attention
  return (
    <div className="exp-a-row" data-state={assignment.workState} data-attn={attention.level} data-selected={selected ? 'true' : 'false'}>
      <button
        type="button"
        className="exp-a-row-hit"
        onClick={() => onSelect?.(assignment)}
        aria-label={`Select ${assignment.title}`}
      />
      <span className="exp-a-row-attn" data-level={attention.level} aria-hidden="true" />
      <div className="exp-a-row-main">
        <div className="exp-a-row-title">
          <strong>{assignment.title}</strong>
          {attention.needsAttention && (
            <span className="exp-a-row-badge" data-level={attention.level}>{attention.badge}</span>
          )}
        </div>
        <div className="exp-a-row-meta">
          <span className="exp-a-row-state" data-state={assignment.workState}>{assignment.display.label}</span>
          <small>
            {assignment.reference || 'Assignment'}
            {assignment.domain || assignment.type ? ` · ${assignment.domain || assignment.type}` : ''}
          </small>
        </div>
      </div>
      <span className="exp-a-row-due" data-tone={assignment.deadlineState.tone}>{formatAssignmentDue(assignment.deadline, { completed: assignment.display.closed })}</span>
      <span className="exp-a-row-next">
        <span>{assignment.next.label}</span>
        <ChevronRight size={14} aria-hidden="true" />
      </span>
      <button
        type="button"
        className="exp-a-row-open"
        onClick={() => onOpen?.(assignment)}
        aria-label={`Open workspace for ${assignment.title}`}
      >
        <ArrowRight size={15} />
      </button>
    </div>
  )
}

export function ExpertAssignmentsSkeletons({ rows = 5 }) {
  return (
    <div className="exp-a-ledger-rows" aria-label="Loading assignments">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="exp-a-row-skeleton" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export function ExpertAssignmentsEmptyStates({ kind = 'empty', search, onClear, onRetry }) {
  const copy = {
    empty: {
      icon: <Briefcase size={22} />,
      title: 'No assignments yet',
      body: 'Confirmed SolveNest assignments appear here with their work state, deadline, and next action.',
    },
    search: {
      icon: <Search size={22} />,
      title: 'No matches found',
      body: search ? `Nothing matches “${search}”. Try a different reference, title, or domain.` : 'Nothing matches your search.',
      action: onClear ? { label: 'Clear search', onClick: onClear } : null,
    },
    filter: {
      icon: <Inbox size={22} />,
      title: 'Nothing in this view',
      body: 'No assignments match the selected filter.',
      action: onClear ? { label: 'Show all assignments', onClick: onClear } : null,
    },
    error: {
      icon: <Inbox size={22} />,
      title: 'Could not load assignments',
      body: 'The assignment ledger could not be loaded. Try again.',
      action: onRetry ? { label: 'Try again', onClick: onRetry } : null,
    },
  }[kind] || null
  if (!copy) return null
  return (
    <div className="exp-empty">
      <span className="exp-empty-icon" aria-hidden="true">{copy.icon}</span>
      <p className="exp-empty-title">{copy.title}</p>
      <p className="exp-empty-body">{copy.body}</p>
      {copy.action && (
        <button type="button" className="exp-button exp-button--secondary exp-button--sm" onClick={copy.action.onClick}>
          {copy.action.label}
        </button>
      )}
    </div>
  )
}

export function ExpertAssignmentInspector({ assignment, loading, error, onOpen, onRetry, onClear }) {
  if (loading) {
    return (
      <div className="exp-a-inspector-body">
        <div className="exp-a-inspector-skeleton">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="exp-a-inspector-body">
        <ExpertAssignmentsEmptyStates kind="error" onRetry={onRetry} />
      </div>
    )
  }
  if (!assignment) {
    return (
      <div className="exp-a-inspector-body">
        <div className="exp-empty">
          <span className="exp-empty-icon" aria-hidden="true"><Inbox size={22} /></span>
          <p className="exp-empty-title">Select an assignment</p>
          <p className="exp-empty-body">Pick a row in the ledger to preview its state, journey, and next action.</p>
        </div>
      </div>
    )
  }

  const attention = assignment.attention
  const counts = assignment.workspace?.counts || {}
  const qaState = assignment.workspace?.qa?.state
  const delivery = assignment.workspace?.delivery

  return (
    <div className="exp-a-inspector-body">
      <header className="exp-a-inspector-head">
        <div className="exp-a-inspector-meta">
          <span className="exp-state-chip" data-state={assignment.workState}>{assignment.display.label}</span>
          {assignment.reference && <span className="exp-a-ref">{assignment.reference}</span>}
        </div>
        <h3>{assignment.title}</h3>
        <p className="exp-a-inspector-sub">
          {[assignment.domain, assignment.type, assignment.deliverable].filter(Boolean).join(' · ') || 'Assignment'}
        </p>
        <p className="exp-a-deadline" data-tone={assignment.deadlineState.tone}>
          <CalendarClock size={14} />
          {assignment.deadlineState.detail}
        </p>
      </header>

      {attention.needsAttention && (
        <div className="exp-a-attn" data-level={attention.level}>
          <strong>{attention.badge}</strong>
          <span>{attention.detail}</span>
        </div>
      )}

      <ol className="exp-journey exp-a-journey" aria-label="Assignment journey">
        {assignment.stage.steps.map((step) => (
          <li key={step.key} data-status={step.status}>
            <span className="exp-journey-node">
              {step.status === 'complete' ? <CheckCircle2 size={14} /> : <span className="exp-a-journey-dot" />}
            </span>
            <em>{step.label}</em>
          </li>
        ))}
      </ol>

      <dl className="exp-a-facts">
        <div>
          <dt>Next action</dt>
          <dd>{assignment.next.label}</dd>
        </div>
        <div>
          <dt>Latest activity</dt>
          <dd>
            {assignment.latest ? assignment.latest.text : 'No activity yet'}
            {assignment.latest?.at && <time> · {formatAssignmentTime(assignment.latest.at)}</time>}
          </dd>
        </div>
        <div>
          <dt>Messages</dt>
          <dd>{counts.messages || 0}{counts.unreadMessages ? ` · ${counts.unreadMessages} unread` : ''}</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>{counts.files || 0} in workspace</dd>
        </div>
        <div>
          <dt>Quality review</dt>
          <dd>{qaLabel(qaState)}{delivery?.state === 'delivered' ? ` · Delivered v${delivery.version}` : ''}</dd>
        </div>
      </dl>

      <footer className="exp-a-inspector-foot">
        <button type="button" className="exp-button" onClick={() => onOpen?.(assignment)}>
          Open workspace
          <ArrowRight size={15} />
        </button>
        {onClear && (
          <button type="button" className="exp-button exp-button--ghost" onClick={onClear}>
            Clear selection
          </button>
        )}
      </footer>
    </div>
  )
}

export function qaLabel(state) {
  if (state === 'in_review') return 'In quality review'
  if (state === 'changes_requested') return 'Changes requested'
  if (state === 'approved') return 'QA approved'
  return 'Not submitted'
}

export function AssignmentQuickViewSheet({ assignment, onClose, onOpen }) {
  if (!assignment) return null
  const attention = assignment.attention
  const counts = assignment.workspace?.counts || {}
  return (
    <div className="exp-a-sheet-backdrop" onClick={onClose}>
      <motion.div
        className="exp-a-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Assignment quick view"
      >
        <div className="exp-a-sheet-handle" aria-hidden="true" />
        <header className="exp-a-sheet-head">
          <div className="exp-a-inspector-meta">
            <span className="exp-state-chip" data-state={assignment.workState}>{assignment.display.label}</span>
            {attention.needsAttention && (
              <span className="exp-a-row-badge" data-level={attention.level}>{attention.badge}</span>
            )}
          </div>
          <button type="button" className="exp-a-sheet-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="exp-a-sheet-body">
          <p className="exp-a-sheet-meta">
            {[assignment.reference, assignment.domain || assignment.type].filter(Boolean).join(' · ')}
          </p>
          <h2>{assignment.title}</h2>
          <p className="exp-a-deadline" data-tone={assignment.deadlineState.tone}>
            <CalendarClock size={14} />
            {assignment.deadlineState.detail}
          </p>
          {attention.reason && <p className="exp-a-sheet-reason">{attention.detail}</p>}
          <ol className="exp-journey exp-a-journey" aria-label="Assignment journey">
            {assignment.stage.steps.map((step) => (
              <li key={step.key} data-status={step.status}>
                <span className="exp-journey-node">
                  {step.status === 'complete' ? <CheckCircle2 size={14} /> : <span className="exp-a-journey-dot" />}
                </span>
                <em>{step.label}</em>
              </li>
            ))}
          </ol>
          <div className="exp-a-stat-grid">
            <div><span>Next</span><strong>{assignment.next.label}</strong></div>
            <div><span>Messages</span><strong>{counts.messages || 0}</strong></div>
            <div><span>Files</span><strong>{counts.files || 0}</strong></div>
            <div><span>Feedback</span><strong>{counts.openFeedback || 0}</strong></div>
          </div>
          {assignment.latest && (
            <p className="exp-a-sheet-latest">
              <span>{assignment.latest.text}</span>
              <time>{formatAssignmentTime(assignment.latest.at)}</time>
            </p>
          )}
        </div>
        <footer className="exp-a-sheet-foot">
          <button type="button" className="exp-a-sheet-cta" onClick={() => onOpen?.(assignment)}>
            Open workspace
            <ArrowRight size={15} />
          </button>
        </footer>
      </motion.div>
    </div>
  )
}

function OptionSheet({ title, options, value, onPick, onClose }) {
  return (
    <div className="exp-a-sheet-backdrop" onClick={onClose}>
      <motion.div
        className="exp-a-sheet exp-a-sheet--options"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="exp-a-sheet-handle" aria-hidden="true" />
        <header className="exp-a-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="exp-a-sheet-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="exp-a-sheet-options">
          {options.map((option) => (
            <button
              type="button"
              key={option.key}
              className={`exp-a-option ${value === option.key ? 'is-active' : ''}`}
              onClick={() => {
                onPick(option.key)
                onClose()
              }}
            >
              {option.label}
              {value === option.key && <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export function ExpertAssignments() {
  const list = useExpertAssignments()
  const compact = useCompactLayout()
  const [selectedId, setSelectedId] = useState(null)
  const [sheetAssignment, setSheetAssignment] = useState(null)
  const [toolSheet, setToolSheet] = useState(null)
  const inspector = useAssignmentInspector(selectedId)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get('assignment')
    if (wanted) setSelectedId(wanted)
  }, [])

  const reloadAll = useCallback(() => {
    list.reload()
    inspector.reload()
  }, [list, inspector])

  useAssignmentRealtime({
    onAssignmentChanged: () => reloadAll(),
    onMessage: () => reloadAll(),
    onQaUpdate: () => reloadAll(),
  })

  const openAssignment = (assignment) => goExpert(buildExpertAssignmentRoute({ assignmentId: assignment.id }))
  const selectAssignment = (assignment) => {
    if (compact) setSheetAssignment(assignment)
    else setSelectedId(assignment.id)
  }

  const rows = list.assignments
  const errorKind = list.error && !list.assignments.length ? 'error' : null
  const emptyKind = list.query.search
    ? 'search'
    : list.query.filter !== 'all'
      ? 'filter'
      : 'empty'
  const selected = inspector.assignment && inspector.assignment.id === selectedId ? inspector.assignment : null

  return (
    <div className="exp-section exp-a-page">
      <header className="exp-section-head">
        <p className="exp-overline">ASSIGNMENTS</p>
        <h1>Assignment workspace</h1>
        <p>Every confirmed SolveNest assignment with its work state, quality review stage, and next action.</p>
      </header>

      <div className="exp-a-toolbar">
        <label className="exp-a-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={list.query.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Search title, reference, domain…"
            aria-label="Search assignments"
          />
        </label>
        <div className="exp-a-filters">
          {EXPERT_ASSIGNMENT_FILTERS.map((option) => (
            <button
              type="button"
              key={option.key}
              className={`exp-a-chip ${list.query.filter === option.key ? 'is-active' : ''}`}
              onClick={() => list.setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="exp-a-tool-actions">
          <button type="button" className="exp-a-tool-button" onClick={() => setToolSheet('filter')}>
            <SlidersHorizontal size={14} />
            Filter
          </button>
          <button type="button" className="exp-a-tool-button" onClick={() => setToolSheet('sort')}>
            Sort
          </button>
        </div>
        <span className="exp-a-count">
          {list.loading && !list.loaded ? 'Loading…' : `Showing ${list.meta.filtered} of ${list.meta.total}`}
        </span>
      </div>

      <div className="exp-a-split">
        <section className="exp-panel exp-a-ledger">
          <div className="exp-panel-head">
            <div>
              <p className="exp-overline">ASSIGNMENT LEDGER</p>
              <h3>{rows.length === 1 ? '1 assignment' : `${rows.length} assignments`}</h3>
            </div>
            {list.loading && list.loaded && <Loader2 className="exp-a-spin" size={16} aria-label="Refreshing" />}
          </div>
          {errorKind ? (
            <ExpertAssignmentsEmptyStates kind="error" onRetry={list.reload} />
          ) : !list.loaded ? (
            <ExpertAssignmentsSkeletons />
          ) : rows.length === 0 ? (
            <ExpertAssignmentsEmptyStates
              kind={emptyKind}
              search={list.query.search}
              onClear={emptyKind === 'search' ? () => list.setSearch('') : () => list.setFilter('all')}
            />
          ) : (
            <div className="exp-a-ledger-rows">
              {rows.map((assignment) => (
                <AssignmentLedgerRow
                  key={assignment.id}
                  assignment={assignment}
                  selected={selectedId === assignment.id}
                  onSelect={selectAssignment}
                  onOpen={openAssignment}
                />
              ))}
            </div>
          )}
        </section>

        {!compact && (
          <aside className="exp-panel exp-a-inspector">
            <div className="exp-panel-head">
              <div>
                <p className="exp-overline">INSPECTOR</p>
                <h3>Quick view</h3>
              </div>
              <Inbox size={17} aria-hidden="true" />
            </div>
            <ExpertAssignmentInspector
              assignment={selected}
              loading={inspector.loading && Boolean(selectedId)}
              error={inspector.error}
              onOpen={openAssignment}
              onRetry={inspector.reload}
              onClear={selectedId ? () => setSelectedId(null) : null}
            />
          </aside>
        )}
      </div>

      <AnimatePresence>
        {compact && sheetAssignment && (
          <AssignmentQuickViewSheet
            assignment={sheetAssignment}
            onClose={() => setSheetAssignment(null)}
            onOpen={openAssignment}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toolSheet === 'filter' && (
          <OptionSheet
            title="FILTER ASSIGNMENTS"
            options={EXPERT_ASSIGNMENT_FILTERS}
            value={list.query.filter}
            onPick={list.setFilter}
            onClose={() => setToolSheet(null)}
          />
        )}
        {toolSheet === 'sort' && (
          <OptionSheet
            title="SORT BY"
            options={EXPERT_ASSIGNMENT_SORTS}
            value={list.query.sort}
            onPick={list.setSort}
            onClose={() => setToolSheet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
