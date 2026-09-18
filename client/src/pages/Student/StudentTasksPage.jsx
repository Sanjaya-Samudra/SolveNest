import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Clock, Filter, MoreHorizontal, RefreshCw, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { fetchStudentTaskPreview, fetchStudentTasks, filterStudentTasks, formatDate, formatRelativeTime, getTaskJourney, sortStudentTasks, TASK_VIEWS } from '../../student/studentTasksData.js'

const go = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
const CLOSED = new Set(['COMPLETED', 'CANCELLED', 'DECLINED'])
const SORT_OPTIONS = [['updated', 'Recently updated'], ['deadline', 'Deadline soonest'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['title', 'Title A–Z']]

const STAGE_OPTIONS = [['UNDERSTAND', 'Understand'], ['CONFIRM', 'Confirm'], ['FUND', 'Fund'], ['MATCH', 'Match'], ['PROGRESS', 'Progress'], ['VERIFY', 'Verify'], ['DELIVER', 'Deliver'], ['LEARN', 'Learn']]
const DEADLINE_OPTIONS = [['any', 'Any time'], ['this-week', 'This week'], ['this-month', 'This month'], ['no-deadline', 'No deadline']]

function initialsOf(name) { return (name || 'Student').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() }

function formatDeadline(value) {
  if (!value) return { text: 'Not set', tone: 'muted' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { text: 'Not set', tone: 'muted' }
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { text: formatDate(value), tone: 'overdue', title: 'Overdue' }
  if (diffDays === 0) return { text: 'Today', tone: 'urgent' }
  if (diffDays === 1) return { text: 'Tomorrow', tone: 'urgent' }
  if (diffDays <= 7) return { text: formatDate(value), tone: 'soon' }
  return { text: formatDate(value), tone: 'normal' }
}

const DEADLINE_FILTER_MAP = { 'this-week': 7, 'this-month': 30 }
function matchesDeadlineFilter(task, filter) {
  if (!filter || filter === 'any') return true
  if (filter === 'no-deadline') return !task.deadline
  const deadline = new Date(task.deadline)
  if (Number.isisNaN(deadline.getTime())) return false
  const now = new Date()
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (filter === 'this-week') return diffDays >= 0 && diffDays <= 7
  if (filter === 'this-month') return diffDays >= 0 && diffDays <= 30
  return true
}

function countActiveFilters(filters) {
  let count = 0
  if (filters.stage) count++
  if (filters.deadline && filters.deadline !== 'any') count++
  if (filters.expert === 'assigned') count++
  if (filters.expert === 'unassigned') count++
  return count
}

/* ─── Shared UI Primitives ──────────────────────────────────────────────── */

function Dot({ tone }) { return <span className={`my-task-dot tone-${tone}`} aria-hidden="true" /> }

function InlineButton({ onClick, children }) { return <button className="my-task-inline-button" onClick={onClick}>{children}</button> }

/* ─── Sort Dropdown ─────────────────────────────────────────────────────── */

function SortDropdown({ value, onChange, triggerClassName }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = SORT_OPTIONS.find(([key]) => key === value)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return <div className="my-tasks-sort" ref={ref}>
    <span className="my-tasks-sort-label">Sort</span>
    <button className={`my-tasks-sort-trigger ${triggerClassName || ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox">
      {current?.[1] || 'Recently updated'}<ChevronDown size={14} />
    </button>
    {open && <div className="my-tasks-sort-dropdown" role="listbox">
      {SORT_OPTIONS.map(([key, label]) => <button key={key} role="option" aria-selected={value === key} className={value === key ? 'is-active' : ''} onClick={() => { onChange(key); setOpen(false) }}>{label}{value === key && <Check size={14} />}</button>)}
    </div>}
  </div>
}

/* ─── Advanced Filter Popover ───────────────────────────────────────────── */

function FilterPopover({ filters, onChange, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [draft, setDraft] = useState(filters)
  useEffect(() => { setDraft(filters) }, [filters])
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const count = countActiveFilters(filters)
  const apply = () => { onChange(draft); setOpen(false) }
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(filters)
  return <div className="my-tasks-filter" ref={ref}>
    <button className="my-tasks-filter-trigger" onClick={() => { setDraft(filters); setOpen((v) => !v) }} aria-expanded={open}>
      <Filter size={14} />Filter{count > 0 && <span className="my-tasks-filter-count">{count}</span>}
    </button>
    {open && <div className="my-tasks-filter-popover">
      <div className="my-tasks-filter-head"><p className="student-overline">FILTER TASKS</p><button onClick={() => { onClear(); setOpen(false) }}>Clear all</button></div>
      <div className="my-tasks-filter-section">
        <p className="my-tasks-filter-section-title">Stage</p>
        <div className="my-tasks-filter-options">{STAGE_OPTIONS.map(([key, label]) => <button key={key} className={draft.stage === key ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, stage: f.stage === key ? null : key }))}>{label}</button>)}</div>
      </div>
      <div className="my-tasks-filter-section">
        <p className="my-tasks-filter-section-title">Deadline</p>
        <div className="my-tasks-filter-options">{DEADLINE_OPTIONS.map(([key, label]) => <button key={key} className={draft.deadline === key ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, deadline: key }))}>{label}</button>)}</div>
      </div>
      <div className="my-tasks-filter-section">
        <p className="my-tasks-filter-section-title">Expert</p>
        <div className="my-tasks-filter-options">
          <button className={draft.expert === 'assigned' ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, expert: f.expert === 'assigned' ? null : 'assigned' }))}>Assigned</button>
          <button className={draft.expert === 'unassigned' ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, expert: f.expert === 'unassigned' ? null : 'unassigned' }))}>Not assigned</button>
        </div>
      </div>
      <div className="my-tasks-filter-actions">
        <button className="my-tasks-filter-cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button className="my-tasks-filter-apply" onClick={apply} disabled={!hasChanges}>Apply filters</button>
      </div>
    </div>}
  </div>
}

/* ─── Active Filter Tokens ──────────────────────────────────────────────── */

function ActiveFilterTokens({ filters, onRemove, onClear }) {
  const tokens = []
  if (filters.stage) { const s = STAGE_OPTIONS.find(([k]) => k === filters.stage); tokens.push({ key: 'stage', label: `Stage: ${s?.[1] || filters.stage}` }) }
  if (filters.deadline && filters.deadline !== 'any') { const d = DEADLINE_OPTIONS.find(([k]) => k === filters.deadline); tokens.push({ key: 'deadline', label: `Due: ${d?.[1] || filters.deadline}` }) }
  if (filters.expert === 'assigned') tokens.push({ key: 'expert', label: 'Expert: Assigned' })
  if (filters.expert === 'unassigned') tokens.push({ key: 'expert', label: 'Expert: Not assigned' })
  if (tokens.length === 0) return null
  return <div className="my-tasks-tokens">
    {tokens.map((t) => <span key={t.key} className="my-tasks-token">{t.label}<button onClick={() => onRemove(t.key)} aria-label={`Remove ${t.label}`}><X size={12} /></button></span>)}
    <button className="my-tasks-token-clear" onClick={onClear}>Clear filters</button>
  </div>
}

/* ─── Ledger Header ─────────────────────────────────────────────────────── */

function LedgerHeader() {
  return <div className="my-task-header-row" role="row">
    <div className="my-task-header-cell my-task-header-title">Task</div>
    <div className="my-task-header-cell my-task-header-stage">Stage</div>
    <div className="my-task-header-cell my-task-header-deadline">Deadline</div>
    <div className="my-task-header-cell my-task-header-updated">Updated</div>
    <div className="my-task-header-cell my-task-header-action">Next</div>
  </div>
}

/* ─── Task Menu ─────────────────────────────────────────────────────────── */

function TaskMenu({ task }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [open])
  const actions = [
    { label: 'Open task', route: task.nextAction.route || '/student/tasks' },
    task.display.key === 'DELIVERED' && { label: 'Review delivery', route: '/student/deliveries' },
    { label: 'Open messages', route: '/student/messages' },
  ].filter(Boolean)
  return <div className="my-task-menu-wrap" ref={ref}>
    <button className="my-task-menu" aria-label={`Actions for ${task.title}`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}><MoreHorizontal size={17} /></button>
    {open && <div className="my-task-menu-popover" role="menu">{actions.map((a) => <button key={a.label} role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); go(a.route) }}>{a.label}</button>)}</div>}
  </div>
}

/* ─── Task Row ──────────────────────────────────────────────────────────── */

const TaskRow = forwardRef(function TaskRow({ task, selected, tabIndex, select, onKeyDown }, ref) {
  const dl = formatDeadline(task.deadline)
  return <div ref={ref} className={`my-task-row ${selected ? 'is-selected' : ''}`} role="row" tabIndex={tabIndex} aria-selected={selected} onClick={() => select(task)} onKeyDown={(e) => onKeyDown(e, task)}>
    <div className="my-task-row-title"><Dot tone={task.display.tone} /><div><strong>{task.title}</strong><small>{[task.subject, task.reference].filter(Boolean).join(' · ') || 'Task'}</small></div></div>
    <div className="my-task-row-stage"><Dot tone={task.display.tone} />{task.display.label}</div>
    <div className={`my-task-row-deadline tone-${dl.tone}`}>{dl.text}</div>
    <div className="my-task-row-updated">{formatRelativeTime(task.updatedAt || task.latestUpdate?.createdAt)}</div>
    <div className="my-task-row-action"><button className="my-task-row-action-button" onClick={(e) => { e.stopPropagation(); if (task.nextAction.route) go(task.nextAction.route) }}>{task.nextAction.needsStudentAction ? task.nextAction.label : <span className="my-task-no-action">No action needed</span>}</button></div>
    <TaskMenu task={task} />
  </div>
})

/* ─── Compact Vertical Journey Rail ─────────────────────────────────────── */

function JourneyRail({ task }) {
  const journey = getTaskJourney(task)
  return <ol className="my-preview-journey">{journey.map((stage, i) => <li key={stage.key} className={`is-${stage.status}`}>
    <span className="my-preview-journey-mark">{stage.status === 'complete' ? <Check size={10} /> : stage.status === 'current' ? <span className="my-preview-journey-dot" /> : null}</span>
    <span className="my-preview-journey-label">{stage.label}</span>
  </li>)}</ol>
}

/* ─── Quick Context Rows ────────────────────────────────────────────────── */

function QuickContext({ task }) {
  const rows = []
  if (task.deadline) rows.push({ label: 'Deadline', value: formatDeadline(task.deadline).text })
  if (task.quote?.total) rows.push({ label: 'Plan', value: task.quote.total })
  if (task.payment?.amountDue) rows.push({ label: 'Payment', value: task.payment.amountDue })
  if (task.delivery) rows.push({ label: 'Delivery', value: task.delivery.available ? 'Available' : 'Not yet available' })
  if (rows.length === 0) return null
  return <div className="my-preview-context">{rows.map((r) => <div key={r.label} className="my-preview-context-row"><span>{r.label}</span><strong>{r.value}</strong></div>)}</div>
}

/* ─── Lifecycle-Specific Preview Header ─────────────────────────────────── */

function lifecyclePreviewHeader(state) {
  const map = {
    DELIVERED: { status: 'DELIVERY READY', tone: 'delivery' },
    REVISION_REQUESTED: { status: 'REVISION REQUESTED', tone: 'attention' },
    QUOTE_READY: { status: 'OFFICIAL PLAN READY', tone: 'action' },
    AWAITING_ACCEPTANCE: { status: 'AWAITING YOUR DECISION', tone: 'action' },
    PAYMENT_PENDING: { status: 'FUNDING REQUIRED', tone: 'payment' },
    ASSIGNMENT_PENDING: { status: 'MATCHING', tone: 'waiting' },
    IN_PROGRESS: { status: 'IN PROGRESS', tone: 'progress' },
    QUALITY_REVIEW: { status: 'QUALITY REVIEW', tone: 'review' },
    REVISION_IN_PROGRESS: { status: 'REVISION IN PROGRESS', tone: 'progress' },
    COMPLETED: { status: 'COMPLETED', tone: 'complete' },
  }
  return map[state.key] || { status: state.label.toUpperCase(), tone: state.tone }
}

/* ─── Live Task Preview ─────────────────────────────────────────────────── */

function TaskPreview({ task, loading, error, access, retry }) {
  if (!task && loading) return <aside className="my-task-preview"><div className="my-task-preview-skeleton"><span /><span /><span /><span /></div></aside>
  if (!task) return <aside className="my-task-preview my-task-preview--empty"><p>Select a task to see its progress and next step.</p></aside>
  if (error) return <aside className="my-task-preview my-task-preview--empty" role="alert"><p>{access ? 'Sign in to view this task preview.' : 'We couldn\'t load this task preview.'}</p><InlineButton onClick={() => access ? go('/login') : retry()}>{access ? 'Sign in' : 'Retry'} <RefreshCw size={14} /></InlineButton></aside>

  const state = task.display
  const journey = getTaskJourney(task)
  const currentIndex = journey.findIndex((s) => s.status === 'current')
  const lifecycle = lifecyclePreviewHeader(state)

  return <aside className="my-task-preview" aria-live="polite">
    <div className={`my-preview-status tone-${lifecycle.tone}`}>{lifecycle.status}</div>
    <h2 className="my-preview-title">{task.title}</h2>
    <p className="my-preview-subtitle">{[task.subject, task.reference].filter(Boolean).join(' · ')}</p>

    {!CLOSED.has(state.key) && task.nextAction?.route && <button className="my-preview-cta" onClick={() => go(task.nextAction.route)}>{task.nextAction.label} <ArrowRight size={15} /></button>}

    <div className="my-preview-body">
      <div className="my-preview-section"><p className="my-preview-section-label">Journey</p><JourneyRail task={task} /></div>

      <div className="my-preview-section">
        <p className="my-preview-section-label">Current</p>
        <strong>{state.label}</strong>
        <p className="my-preview-section-desc">{task.latestUpdate?.text || task.latestUpdate || 'No latest update available.'}</p>
      </div>

      {currentIndex >= 0 && currentIndex < journey.length - 1 && !CLOSED.has(state.key) && <div className="my-preview-section">
        <p className="my-preview-section-label">Next</p>
        <strong>{journey[currentIndex + 1].label}</strong>
        <p className="my-preview-section-desc">{task.nextAction?.label || 'No action required.'}</p>
      </div>}

      {task.latestUpdate && <div className="my-preview-section">
        <p className="my-preview-section-label">Latest update</p>
        <p className="my-preview-section-desc">{task.latestUpdate.text || task.latestUpdate.title || formatRelativeTime(task.latestUpdate.createdAt)}</p>
      </div>}

      {task.expert && <div className="my-preview-section my-preview-expert">
        <p className="my-preview-section-label">Assigned expert</p>
        <div className="my-preview-expert-row">
          <span className="my-preview-expert-avatar">{initialsOf(task.expert.name)}</span>
          <div><strong>{task.expert.name}</strong><small>{task.expert.verified ? 'Verified Expert' : 'SolveNest expert'}</small></div>
        </div>
      </div>}

      <QuickContext task={task} />
    </div>
  </aside>
}

/* ─── Mobile Quick View Sheet ───────────────────────────────────────────── */

function TaskQuickViewSheet({ task, onClose }) {
  if (!task) return null
  const state = task.display
  const lifecycle = lifecyclePreviewHeader(state)
  return <div className="my-sheet-backdrop" onClick={onClose}>
    <motion.div className="my-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
      <div className="my-sheet-handle" />
      <div className="my-sheet-head">
        <span className={`my-sheet-status tone-${lifecycle.tone}`}>{lifecycle.status}</span>
        <button className="my-sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="my-sheet-body">
        <h2>{task.title}</h2>
        <p className="my-sheet-subtitle">{[task.subject, task.reference].filter(Boolean).join(' · ')}</p>
        <JourneyRail task={task} />
        <div className="my-preview-section"><p className="my-preview-section-label">Current</p><strong>{state.label}</strong><p className="my-preview-section-desc">{task.latestUpdate?.text || 'No update available.'}</p></div>
        {task.expert && <div className="my-preview-section my-preview-expert"><p className="my-preview-section-label">Assigned expert</p><div className="my-preview-expert-row"><span className="my-preview-expert-avatar">{initialsOf(task.expert.name)}</span><div><strong>{task.expert.name}</strong></div></div></div>}
        <QuickContext task={task} />
      </div>
      <div className="my-sheet-footer">
        <button className="my-sheet-cta" onClick={() => { onClose(); if (task.nextAction.route) go(task.nextAction.route) }}>{task.nextAction.label} <ArrowRight size={15} /></button>
      </div>
    </motion.div>
  </div>
}

/* ─── Mobile Filter Bottom Sheet ────────────────────────────────────────── */

function FilterSheet({ open, onClose, filters, onChange, onClear }) {
  const [draft, setDraft] = useState(filters)
  useEffect(() => { setDraft(filters) }, [filters, open])
  if (!open) return null
  return <div className="my-sheet-backdrop" onClick={onClose}>
    <motion.div className="my-sheet my-sheet--filters" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
      <div className="my-sheet-handle" />
      <div className="my-sheet-head"><h2>FILTER TASKS</h2><button className="my-sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <div className="my-sheet-body">
        <div className="my-tasks-filter-section"><p className="my-tasks-filter-section-title">Stage</p><div className="my-tasks-filter-options">{STAGE_OPTIONS.map(([key, label]) => <button key={key} className={draft.stage === key ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, stage: f.stage === key ? null : key }))}>{label}</button>)}</div></div>
        <div className="my-tasks-filter-section"><p className="my-tasks-filter-section-title">Deadline</p><div className="my-tasks-filter-options">{DEADLINE_OPTIONS.map(([key, label]) => <button key={key} className={draft.deadline === key ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, deadline: key }))}>{label}</button>)}</div></div>
        <div className="my-tasks-filter-section"><p className="my-tasks-filter-section-title">Expert</p><div className="my-tasks-filter-options"><button className={draft.expert === 'assigned' ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, expert: f.expert === 'assigned' ? null : 'assigned' }))}>Assigned</button><button className={draft.expert === 'unassigned' ? 'is-active' : ''} onClick={() => setDraft((f) => ({ ...f, expert: f.expert === 'unassigned' ? null : 'unassigned' }))}>Not assigned</button></div></div>
      </div>
      <div className="my-sheet-footer my-sheet-footer--dual">
        <button className="my-sheet-footer-clear" onClick={() => { onClear(); onClose() }}>Clear</button>
        <button className="my-sheet-footer-apply" onClick={() => { onChange(draft); onClose() }}>Apply filters</button>
      </div>
    </motion.div>
  </div>
}

/* ─── Mobile Sort Bottom Sheet ──────────────────────────────────────────── */

function SortSheet({ open, onClose, value, onChange }) {
  if (!open) return null
  return <div className="my-sheet-backdrop" onClick={onClose}>
    <motion.div className="my-sheet my-sheet--sort" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
      <div className="my-sheet-handle" />
      <div className="my-sheet-head"><h2>SORT BY</h2><button className="my-sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <div className="my-sheet-body">{SORT_OPTIONS.map(([key, label]) => <button key={key} className={`my-sheet-option ${value === key ? 'is-active' : ''}`} onClick={() => { onChange(key); onClose() }}>{label}{value === key && <Check size={16} />}</button>)}</div>
    </motion.div>
  </div>
}

/* ─── Empty / Loading / Error States ────────────────────────────────────── */

function LedgerSkeleton() {
  return <div className="my-task-skeleton" aria-label="Loading tasks">{Array.from({ length: 6 }, (_, i) => <div key={i} className="my-task-skeleton-row"><span /><i /><i /><i /><i /></div>)}</div>
}

function LedgerError({ access, retry }) {
  return <div className="my-tasks-state" role="alert"><p className="student-overline">{access ? 'ACCESS REQUIRED' : 'COULD NOT LOAD TASKS'}</p><h2>{access ? 'Sign in to view your tasks.' : 'We couldn\'t load your tasks.'}</h2><p>{access ? 'Your student session is missing or has expired.' : 'We couldn\'t retrieve your task ledger.'}</p><InlineButton onClick={() => access ? go('/login') : retry()}>{access ? 'Sign in' : 'Retry'} <RefreshCw size={14} /></InlineButton></div>
}

function NoTasksEmpty({ onCreate }) {
  return <div className="my-tasks-state my-tasks-state--empty">
    <div className="my-empty-lines"><span /><span /><span /><span /><span /></div>
    <p className="student-overline">MY TASKS</p>
    <h2>No tasks yet.</h2>
    <p>When you create your first task, its progress will stay organized here.</p>
    <InlineButton onClick={onCreate}>Create Your First Task <ArrowRight size={14} /></InlineButton>
  </div>
}

function NoSearchResults({ term, onClear }) {
  return <div className="my-tasks-state"><p className="student-overline">NO MATCHING TASKS</p><h2>We couldn't find a task matching '{term}'.</h2><p>Try another title, subject, or reference.</p><InlineButton onClick={onClear}>Clear search <X size={14} /></InlineButton></div>
}

function FilteredEmpty({ view, onClear }) {
  const label = TASK_VIEWS.find(([k]) => k === view)?.[1] || view
  return <div className="my-tasks-state"><p className="student-overline">NO {label.toUpperCase()} TASKS</p><h2>{label} tasks will appear here.</h2><InlineButton onClick={onClear}>Clear filter</InlineButton></div>
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export function StudentTasksPage() {
  const [state, setState] = useState({ loading: true, loadingMore: false, error: null, tasks: [], meta: null })
  const params = new URLSearchParams(window.location.search)
  const [search, setSearch] = useState(params.get('q') || '')
  const [view, setView] = useState(params.get('view') || 'all')
  const [sort, setSort] = useState(params.get('sort') || 'updated')
  const [filters, setFilters] = useState({ stage: null, deadline: null, expert: null })
  const [selectedId, setSelectedId] = useState(params.get('task'))
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [quickView, setQuickView] = useState(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const rows = useRef([])
  const previewRequest = useRef(null)

  const load = useCallback((page = 1, append = false) => {
    const controller = new AbortController()
    setState((c) => ({ ...c, loading: !append, loadingMore: append, error: null }))
    fetchStudentTasks({ page, signal: controller.signal }).then(({ tasks, meta }) => {
      setState((c) => ({ loading: false, loadingMore: false, error: null, tasks: append ? [...c.tasks, ...tasks] : tasks, meta }))
    }).catch((error) => {
      if (error.name !== 'AbortError') setState((c) => ({ ...c, loading: false, loadingMore: false, error }))
    })
    return () => controller.abort()
  }, [])

  useEffect(() => load(), [load])

  const tasks = useMemo(() => {
    let result = filterStudentTasks(state.tasks, { search, view })
    if (filters.stage) result = result.filter((t) => t.display.stage === filters.stage)
    if (filters.deadline) result = result.filter((t) => matchesDeadlineFilter(t, filters.deadline))
    if (filters.expert === 'assigned') result = result.filter((t) => t.expert)
    if (filters.expert === 'unassigned') result = result.filter((t) => !t.expert)
    return sortStudentTasks(result, sort)
  }, [state.tasks, search, view, sort, filters])

  const selected = tasks.find((t) => String(t.id) === String(selectedId)) || null

  const select = useCallback((task) => {
    previewRequest.current?.abort()
    const controller = new AbortController()
    previewRequest.current = controller
    setSelectedId(String(task.id))
    setPreview(task)
    setPreviewError(null)
    setPreviewLoading(true)
    fetchStudentTaskPreview(task.id, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setPreview(result)
    }).catch((error) => {
      if (!controller.signal.aborted) { setPreviewError(error); setPreview(task) }
    }).finally(() => { if (!controller.signal.aborted) setPreviewLoading(false) })
  }, [])

  useEffect(() => {
    if (selected && !preview && window.innerWidth >= 1024) select(selected)
    else if (!selected && tasks[0] && window.innerWidth >= 1024) select(tasks[0])
  }, [selected?.id, tasks.length])

  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    if (view !== 'all') next.set('view', view)
    if (sort !== 'updated') next.set('sort', sort)
    if (selectedId) next.set('task', selectedId)
    window.history.replaceState({}, '', `${window.location.pathname}${next.toString() ? `?${next}` : ''}`)
  }, [search, view, sort, selectedId])

  const keyboard = useCallback((event, task) => {
    const index = tasks.findIndex((item) => item.id === task.id)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(0, Math.min(tasks.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
      rows.current[next]?.focus()
      select(tasks[next])
    }
    if (event.key === 'ArrowRight') { event.preventDefault(); rows.current[index]?.querySelector('.my-task-menu')?.focus() }
    if (event.key === 'Home') { event.preventDefault(); rows.current[0]?.focus(); select(tasks[0]) }
    if (event.key === 'End') { event.preventDefault(); rows.current[tasks.length - 1]?.focus(); select(tasks[tasks.length - 1]) }
    if (event.key === 'Enter') { event.preventDefault(); if (task.nextAction.route) go(task.nextAction.route) }
  }, [tasks, select])

  const activeCount = state.tasks.filter((t) => !CLOSED.has(t.display.key)).length
  const needsCount = state.tasks.filter((t) => t.display.needsStudentAction).length
  const hasMore = state.meta?.hasMore || state.meta?.current_page < state.meta?.last_page
  const hasActiveFilters = countActiveFilters(filters) > 0

  const clearFilters = () => { setFilters({ stage: null, deadline: null, expert: null }) }

  const renderContent = () => {
    if (state.loading) return <div className="my-tasks-layout"><div className="my-tasks-ledger"><LedgerHeader /><LedgerSkeleton /></div><TaskPreview loading /></div>
    if (state.error) return <div className="my-tasks-layout"><div className="my-tasks-ledger"><LedgerError access={state.error.message === 'STUDENT_ACCESS_REQUIRED'} retry={() => load()} /></div><TaskPreview /></div>
    if (tasks.length === 0) {
      if (search) return <NoSearchResults term={search} onClear={() => setSearch('')} />
      if (hasActiveFilters || view !== 'all') return <FilteredEmpty view={view} onClear={() => { clearFilters(); setView('all') }} />
      return <NoTasksEmpty onCreate={() => go('/student/tasks/new')} />
    }
    return <div className="my-tasks-layout">
      <div className="my-tasks-ledger" role="grid" aria-label="Your tasks">
        <LedgerHeader />
        {tasks.map((task, index) => <TaskRow key={task.id} task={task} selected={String(task.id) === String(selectedId)} tabIndex={index === 0 ? 0 : -1} select={(t) => { if (window.innerWidth < 1024) setQuickView(t); else select(t) }} onKeyDown={keyboard} ref={(el) => { rows.current[index] = el }} />)}
        {hasMore && <button className="my-task-load-more" onClick={() => load((state.meta.current_page || 1) + 1, true)} disabled={state.loadingMore}>{state.loadingMore ? 'Loading…' : 'Load more'}</button>}
      </div>
      <TaskPreview task={preview || selected} loading={previewLoading} error={previewError} access={previewError?.message === 'STUDENT_ACCESS_REQUIRED'} retry={() => selected && select(selected)} />
    </div>
  }

  return <div className="my-tasks-page">
    <header className="my-tasks-header">
      <div><p className="student-overline">STUDENT WORKSPACE</p><h1>My Tasks</h1><p>Track every task from first review to delivery.</p>
        {needsCount > 0 && <button className="my-tasks-context-line" onClick={() => setView('needs-you')}>{needsCount} task{needsCount === 1 ? '' : 's'} need{needsCount === 1 ? 's' : ''} your attention.</button>}
      </div>
      <span className="my-tasks-count"><strong>{activeCount}</strong><small>active task{activeCount === 1 ? '' : 's'}</small></span>
    </header>

    <div className="my-tasks-controls">
      <div className="my-tasks-controls-top">
        <label className="my-tasks-search"><Search size={16} /><span className="sr-only">Search tasks</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label>
        <div className="my-tasks-controls-right">
          <FilterPopover filters={filters} onChange={setFilters} onClear={clearFilters} />
          <SortDropdown value={sort} onChange={setSort} />
        </div>
      </div>
      <div className="my-tasks-controls-bottom">
        <div className="my-tasks-views" role="tablist" aria-label="Task views">{TASK_VIEWS.map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} onClick={() => setView(key)}>{label}{key === 'needs-you' && needsCount > 0 && <span>{needsCount}</span>}</button>)}</div>
        <div className="my-tasks-mobile-controls">
          <button className="my-tasks-mobile-filter-btn" onClick={() => setFilterSheetOpen(true)}><Filter size={15} />Filter{hasActiveFilters && <span>{countActiveFilters(filters)}</span>}</button>
          <button className="my-tasks-mobile-sort-btn" onClick={() => setSortSheetOpen(true)}><Clock size={15} />{SORT_OPTIONS.find(([k]) => k === sort)?.[1] || 'Sort'}</button>
        </div>
      </div>
      <ActiveFilterTokens filters={filters} onRemove={(key) => setFilters((f) => ({ ...f, [key]: null }))} onClear={clearFilters} />
    </div>

    {renderContent()}

    <AnimatePresence>
      {quickView && <TaskQuickViewSheet task={quickView} onClose={() => setQuickView(null)} />}
      <FilterSheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} filters={filters} onChange={setFilters} onClear={clearFilters} />
      <SortSheet open={sortSheetOpen} onClose={() => setSortSheetOpen(false)} value={sort} onChange={setSort} />
    </AnimatePresence>
  </div>
}
