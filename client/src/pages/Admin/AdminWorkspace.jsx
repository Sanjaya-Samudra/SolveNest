import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock3, FileText, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { getCase, getOverview, getStaff, loginStaff, logoutStaff, recordReview } from '../../admin/adminApi.js'
import './admin-workspace.css'

const pathFor = (id) => id ? `/admin/tasks/${encodeURIComponent(id)}` : '/admin'
const selectedFromPath = () => window.location.pathname.match(/^\/admin\/tasks\/([^/]+)$/)?.[1] || null
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'
const fmtTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not set'
const shortId = (value) => String(value || '').slice(0, 8).toUpperCase()
const reviewLabel = { QUEUED: 'Needs review', IN_REVIEW: 'In review', APPROVED: 'Approved internally', NEEDS_INFO: 'Needs information', DECLINED: 'Declined internally' }
const filters = [['queue', 'Needs review'], ['in-review', 'In review'], ['decided', 'Decisions'], ['all', 'All tasks']]

function go(id) {
  window.history.pushState({}, '', pathFor(id))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Login({ onDone }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await loginStaff(email.trim(), password); onDone() }
    catch (issue) { setError(issue.message); setBusy(false) }
  }
  return <div className="adm-gate"><form className="adm-login" onSubmit={submit}>
    <div className="adm-login-mark"><ShieldCheck size={24} /></div>
    <p className="adm-kicker">SOLVENEST OPERATIONS</p>
    <h1>Admin sign in</h1>
    <p>Use an approved Admin account to manage task reviews.</p>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="adm-alert" role="alert">{error}</div>}
    <button className="adm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Admin workspace'} <ArrowRight size={16} /></button>
    <a href="/">Return to SolveNest</a>
  </form></div>
}

function ReviewPill({ status }) { return <span className="adm-status" data-state={status || 'QUEUED'}>{reviewLabel[status] || status || 'Needs review'}</span> }

function AdminSidebar({ filter, setFilter, staff, mobileOpen, setMobileOpen }) {
  return <><div className={`adm-scrim ${mobileOpen ? 'is-open' : ''}`} onClick={() => setMobileOpen(false)} />
    <aside className={`adm-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="adm-brand"><span className="adm-brand-mark" aria-hidden="true">S</span><span>SolveNest<small>ADMIN</small></span><button className="adm-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav aria-label="Admin navigation">
        <p className="adm-nav-label">OPERATIONS</p>
        <button className={filter === 'queue' ? 'is-active' : ''} onClick={() => { setFilter('queue'); setMobileOpen(false); go(null) }}><LayoutDashboard size={17} /> Action queue</button>
        <button className={filter === 'in-review' ? 'is-active' : ''} onClick={() => { setFilter('in-review'); setMobileOpen(false); go(null) }}><Clock3 size={17} /> In review</button>
        <button className={filter === 'decided' ? 'is-active' : ''} onClick={() => { setFilter('decided'); setMobileOpen(false); go(null) }}><CheckCircle2 size={17} /> Decisions</button>
        <button className={filter === 'all' ? 'is-active' : ''} onClick={() => { setFilter('all'); setMobileOpen(false); go(null) }}><ClipboardList size={17} /> All tasks</button>
      </nav>
      <div className="adm-sidebar-foot"><span className="adm-avatar">{staff?.name?.slice(0, 1) || 'A'}</span><span><strong>{staff?.name || 'Admin'}</strong><small>{staff?.demo ? 'Local preview' : staff?.role}</small></span></div>
    </aside></>
}

function Metric({ value, label, icon: Icon, tone }) { return <div className="adm-metric" data-tone={tone}><div><span>{label}</span><strong>{value}</strong></div><Icon size={22} /></div> }

function Queue({ overview, filter, setFilter, onOpen }) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => (overview.tasks || []).filter((task) => {
    const stateMatch = filter === 'all' || (filter === 'queue' && task.reviewStatus === 'QUEUED') || (filter === 'in-review' && task.reviewStatus === 'IN_REVIEW') || (filter === 'decided' && ['APPROVED', 'NEEDS_INFO', 'DECLINED'].includes(task.reviewStatus))
    return stateMatch && `${task.title} ${task.subject || ''} ${task.id} ${task.studentId}`.toLowerCase().includes(search.toLowerCase())
  }), [overview.tasks, filter, search])
  return <>
    <header className="adm-heading"><div><p className="adm-kicker">OPERATIONS / REVIEW</p><h1>Decisions start here.</h1><p>Review new student requests and keep the next action clear.</p></div><span className="adm-today">{fmtDate(new Date())}</span></header>
    <div className="adm-metrics">
      <Metric label="Needs review" value={overview.metrics.queued} icon={Bell} tone="amber" />
      <Metric label="In review" value={overview.metrics.inReview} icon={Clock3} tone="blue" />
      <Metric label="Decisions recorded" value={overview.metrics.decided} icon={CheckCircle2} tone="green" />
      <Metric label="QA waiting" value={overview.metrics.qaWaiting} icon={ShieldCheck} />
    </div>
    <section className="adm-panel adm-queue">
      <div className="adm-panel-head"><div><p className="adm-kicker">TASK REVIEW QUEUE</p><h2>{filters.find(([key]) => key === filter)?.[1]}</h2><p>{list.length} {list.length === 1 ? 'task' : 'tasks'} in this view</p></div><label className="adm-search"><Search size={16} /><input type="search" placeholder="Search title, ID or student" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="adm-filters">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {list.length ? <div className="adm-table-wrap"><table><thead><tr><th>Task</th><th>Student</th><th>Submitted</th><th>Deadline</th><th>Review</th><th><span className="adm-sr">Open</span></th></tr></thead><tbody>{list.map((task) => <tr key={task.id}><td><button className="adm-task-link" onClick={() => onOpen(task.id)}><strong>{task.title}</strong><small>{task.type} · {shortId(task.id)}</small></button></td><td>{shortId(task.studentId)}</td><td>{fmtDate(task.createdAt)}</td><td>{fmtDate(task.deadline)}</td><td><ReviewPill status={task.reviewStatus} /></td><td><button className="adm-icon" onClick={() => onOpen(task.id)} aria-label={`Open ${task.title}`}><ArrowRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><ClipboardList size={28} /><h3>No tasks in this view</h3><p>{search ? 'Try another search term.' : 'Tasks will appear here when they reach this review stage.'}</p></div>}
    </section>
    <div className="adm-footnote"><ShieldCheck size={17} /><span>Review decisions are internal. Official quotes, Expert assignment, and student updates follow their own workflows.</span></div>
  </>
}

function CaseDetail({ detail, reload, onBack }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const task = detail.task
  const review = detail.review || {}
  const canDecide = ['QUEUED', 'IN_REVIEW'].includes(review.status || 'QUEUED')
  const action = async (kind) => {
    if (['request_info', 'decline'].includes(kind) && note.trim().length < 10) {
      setError('Add an internal note of at least 10 characters for this decision.')
      return
    }
    setBusy(kind)
    setError('')
    try { await recordReview(task.id, kind, note); setNote(''); await reload() }
    catch (issue) { setError(issue.message) }
    finally { setBusy(null) }
  }
  return <>
    <button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to queue</button>
    <header className="adm-case-head"><div><p className="adm-kicker">TASK CASE / {shortId(task.id)}</p><h1>{task.title}</h1><p>{task.type}{task.subject ? ` · ${task.subject}` : ''}</p></div><ReviewPill status={review.status} /></header>
    <div className="adm-case-grid"><div className="adm-case-main">
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">INTAKE</p><h2>What was submitted</h2></div><FileText size={20} /></div><dl className="adm-facts"><div><dt>Student ID</dt><dd>{task.studentId}</dd></div><div><dt>Submitted</dt><dd>{fmtTime(task.createdAt)}</dd></div><div><dt>Deadline</dt><dd>{fmtDate(task.deadline)}</dd></div><div><dt>Task status</dt><dd>{task.status}</dd></div></dl>{detail.analysis?.missingInformation?.length > 0 && <div className="adm-callout"><strong>Information to clarify</strong><p>{detail.analysis.missingInformation.join(', ')}</p></div>}{detail.analysis?.deliverables?.length > 0 && <div className="adm-list-block"><h3>Expected deliverables</h3><ul>{detail.analysis.deliverables.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.title || item.name || 'Deliverable'}</li>)}</ul></div>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">FILES</p><h2>Source materials</h2></div><span>{detail.files.length}</span></div>{detail.files.length ? <ul className="adm-files">{detail.files.map((file) => <li key={file.id}><FileText size={18} /><span><strong>{file.name}</strong><small>{file.role} · {Math.ceil((file.size || 0) / 1024)} KB</small></span></li>)}</ul> : <p className="adm-muted">No files are attached to this task.</p>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">CASE HISTORY</p><h2>Review activity</h2></div></div>{detail.audit.length ? <ol className="adm-timeline">{detail.audit.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{item.action.replace('_', ' ')}</strong><small>{fmtTime(item.at)} · {item.actorId}</small>{item.note && <p>{item.note}</p>}</div></li>)}</ol> : <p className="adm-muted">No Admin decisions have been recorded yet.</p>}</section>
    </div><aside className="adm-case-side"><section className="adm-panel adm-decision"><p className="adm-kicker">ADMIN DECISION</p><h2>Review this request</h2><p>Record an internal feasibility decision. This does not send a quote or change the Student’s task status.</p>{canDecide ? <><label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record your reasoning or the information needed…" rows={5} maxLength={2000} /></label>{error && <div className="adm-alert" role="alert">{error}</div>}<div className="adm-action-stack">{review.status === 'QUEUED' && <button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('start')}>Start review</button>}<button className="adm-primary" disabled={Boolean(busy)} onClick={() => action('approve')}>Approve feasibility <ArrowRight size={15} /></button><button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('request_info')}>Needs information</button><button className="adm-danger" disabled={Boolean(busy)} onClick={() => action('decline')}>Decline request</button></div></> : <><ReviewPill status={review.status} />{review.internalNotes && <p className="adm-decision-note">{review.internalNotes}</p>}</>}</section></aside></div>
  </>
}

export function AdminWorkspace() {
  const [staffState, setStaffState] = useState({ loading: true, staff: null, error: null })
  const [overview, setOverview] = useState({ loading: true, data: null, error: null })
  const [caseState, setCaseState] = useState({ loading: false, data: null, error: null })
  const [selectedId, setSelectedId] = useState(selectedFromPath)
  const [filter, setFilter] = useState('queue')
  const [mobileOpen, setMobileOpen] = useState(false)

  const loadStaff = useCallback(async () => {
    setStaffState({ loading: true, staff: null, error: null })
    try { const payload = await getStaff(); setStaffState({ loading: false, staff: payload.staff, error: null }) }
    catch (error) { setStaffState({ loading: false, staff: null, error }) }
  }, [])
  const loadOverview = useCallback(async () => {
    setOverview((prev) => ({ ...prev, loading: true, error: null }))
    try { const data = await getOverview(); setOverview({ loading: false, data, error: null }) }
    catch (error) { setOverview((prev) => ({ ...prev, loading: false, error })) }
  }, [])
  const loadCase = useCallback(async (id) => {
    if (!id) return
    setCaseState({ loading: true, data: null, error: null })
    try { const data = await getCase(id); setCaseState({ loading: false, data, error: null }) }
    catch (error) { setCaseState({ loading: false, data: null, error }) }
  }, [])
  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { const update = () => setSelectedId(selectedFromPath()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  useEffect(() => { if (staffState.staff) loadOverview() }, [staffState.staff, loadOverview])
  useEffect(() => { if (staffState.staff && selectedId) loadCase(selectedId) }, [staffState.staff, selectedId, loadCase])

  if (staffState.loading) return <div className="adm-gate"><div className="adm-loading" role="status">Loading Admin access…</div></div>
  if (staffState.error?.status === 401) return <Login onDone={loadStaff} />
  if (staffState.error) return <div className="adm-gate"><div className="adm-login"><p className="adm-kicker">COULD NOT CONNECT</p><h1>Admin access is unavailable.</h1><p>{staffState.error.message}</p><button className="adm-primary" onClick={loadStaff}>Try again <ArrowRight size={16} /></button></div></div>
  return <div className="adm-app"><AdminSidebar filter={filter} setFilter={setFilter} staff={staffState.staff} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><div className="adm-frame"><div className="adm-topbar"><button className="adm-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span>Admin <ChevronDown size={14} /> {selectedId ? 'Task case' : 'Operations'}</span><div><span className="adm-role">{staffState.staff.demo ? 'LOCAL PREVIEW' : staffState.staff.role.toUpperCase()}</span>{!staffState.staff.demo && <button className="adm-icon" onClick={async () => { await logoutStaff().catch(() => {}); loadStaff() }} aria-label="Sign out"><LogOut size={18} /></button>}</div></div><main className="adm-content">{selectedId ? caseState.loading ? <div className="adm-loading" role="status">Loading task case…</div> : caseState.error ? <div className="adm-panel adm-error"><h2>Could not open this case</h2><p>{caseState.error.message}</p><button className="adm-primary" onClick={() => loadCase(selectedId)}>Try again</button><button className="adm-secondary" onClick={() => go(null)}>Back to queue</button></div> : caseState.data && <CaseDetail key={selectedId} detail={caseState.data} reload={async () => { await Promise.all([loadCase(selectedId), loadOverview()]) }} onBack={() => go(null)} /> : overview.loading && !overview.data ? <div className="adm-loading" role="status">Loading operations…</div> : overview.error && !overview.data ? <div className="adm-panel adm-error"><h2>Could not load operations</h2><p>{overview.error.message}</p><button className="adm-primary" onClick={loadOverview}>Try again</button></div> : overview.data && <Queue overview={overview.data} filter={filter} setFilter={setFilter} onOpen={go} />}</main></div></div>
}
