import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock3, Download, FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, Search, ShieldCheck, X } from 'lucide-react'
import { assignExpert, getAssignableExperts, getCase, getOverview, getQaCase, getQaQueue, getStaff, getSupportCase, getSupportQueue, issuePlan, loginStaff, logoutStaff, recordQaOutcome, recordReview, updateSupportStatus } from '../../admin/adminApi.js'
import './admin-workspace.css'

const pathFor = (id) => id ? `/admin/tasks/${encodeURIComponent(id)}` : '/admin'
const selectedFromPath = () => window.location.pathname.match(/^\/admin\/tasks\/([^/]+)$/)?.[1] || null
const routeFromPath = () => {
  const match = window.location.pathname.match(/^\/admin\/(qa|support)(?:\/([^/]+))?$/)
  if (!match) return { section: 'tasks', id: selectedFromPath() }
  try { return { section: match[1], id: match[2] ? decodeURIComponent(match[2]) : null } }
  catch { return { section: match[1], id: null } }
}
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'
const fmtTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not set'
const shortId = (value) => String(value || '').slice(0, 8).toUpperCase()
const reviewLabel = { QUEUED: 'Needs review', IN_REVIEW: 'In review', APPROVED: 'Approved internally', NEEDS_INFO: 'Needs information', DECLINED: 'Declined internally' }
const filters = [['queue', 'Needs review'], ['in-review', 'In review'], ['decided', 'Decisions'], ['all', 'All tasks']]

function go(id) {
  window.history.pushState({}, '', pathFor(id))
  window.dispatchEvent(new PopStateEvent('popstate'))
}
function goSection(section, id = null) {
  window.history.pushState({}, '', id ? `/admin/${section}/${encodeURIComponent(id)}` : `/admin/${section}`)
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

function AdminSidebar({ section, filter, setFilter, staff, mobileOpen, setMobileOpen }) {
  return <><div className={`adm-scrim ${mobileOpen ? 'is-open' : ''}`} onClick={() => setMobileOpen(false)} />
    <aside className={`adm-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="adm-brand"><span className="adm-brand-mark" aria-hidden="true">S</span><span>SolveNest<small>ADMIN</small></span><button className="adm-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav aria-label="Admin navigation">
        <p className="adm-nav-label">OPERATIONS</p>
        <button className={section === 'tasks' && filter === 'queue' ? 'is-active' : ''} onClick={() => { setFilter('queue'); setMobileOpen(false); go(null) }}><LayoutDashboard size={17} /> Action queue</button>
        <button className={section === 'tasks' && filter === 'in-review' ? 'is-active' : ''} onClick={() => { setFilter('in-review'); setMobileOpen(false); go(null) }}><Clock3 size={17} /> In review</button>
        <button className={section === 'tasks' && filter === 'decided' ? 'is-active' : ''} onClick={() => { setFilter('decided'); setMobileOpen(false); go(null) }}><CheckCircle2 size={17} /> Decisions</button>
        <button className={section === 'tasks' && filter === 'all' ? 'is-active' : ''} onClick={() => { setFilter('all'); setMobileOpen(false); go(null) }}><ClipboardList size={17} /> All tasks</button>
        <p className="adm-nav-label" style={{ marginTop: 22 }}>SERVICE DESK</p>
        <button className={section === 'qa' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('qa') }}><ShieldCheck size={17} /> Quality review</button>
        <button className={section === 'support' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('support') }}><LifeBuoy size={17} /> Support requests</button>
        {staff?.role === 'Superadmin' && <><p className="adm-nav-label" style={{ marginTop: 22 }}>GOVERNANCE</p><button onClick={() => window.location.assign('/superadmin')}><ShieldCheck size={17} /> Super Admin</button></>}
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
    <div className="adm-footnote"><ShieldCheck size={17} /><span>Approve feasibility, then issue an official plan from the task case.</span></div>
  </>
}

function CaseDetail({ detail, reload, onBack }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState({ scope: '', excluded: '', delivery: '', price: '', revisionAllowance: '1' })
  const [planBusy, setPlanBusy] = useState(false)
  const [planError, setPlanError] = useState('')
  const [experts, setExperts] = useState([])
  const [expertId, setExpertId] = useState('')
  const [expertError, setExpertError] = useState('')
  const [expertBusy, setExpertBusy] = useState(false)
  const task = detail.task
  const review = detail.review || {}
  const canDecide = ['QUEUED', 'IN_REVIEW'].includes(review.status || 'QUEUED')
  useEffect(() => {
    if (task.status !== 'PAID' || task.assignedExpertId) return
    let active = true
    getAssignableExperts().then(({ experts: rows }) => { if (active) setExperts(rows) }).catch((issue) => { if (active) setExpertError(issue.message) })
    return () => { active = false }
  }, [task.status, task.assignedExpertId])
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
  const submitPlan = async (event) => {
    event.preventDefault()
    setPlanBusy(true)
    setPlanError('')
    try { await issuePlan(task.id, { ...plan, price: Number(plan.price), revisionAllowance: Number(plan.revisionAllowance) }); await reload() }
    catch (issue) { setPlanError(issue.message) }
    finally { setPlanBusy(false) }
  }
  const submitAssignment = async (event) => {
    event.preventDefault()
    if (!expertId) return setExpertError('Choose an Expert.')
    setExpertBusy(true)
    setExpertError('')
    try { await assignExpert(task.id, expertId); await reload() }
    catch (issue) { setExpertError(issue.message) }
    finally { setExpertBusy(false) }
  }
  return <>
    <button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to queue</button>
    <header className="adm-case-head"><div><p className="adm-kicker">TASK CASE / {shortId(task.id)}</p><h1>{task.title}</h1><p>{task.type}{task.subject ? ` · ${task.subject}` : ''}</p></div><ReviewPill status={review.status} /></header>
    <div className="adm-case-grid"><div className="adm-case-main">
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">INTAKE</p><h2>What was submitted</h2></div><FileText size={20} /></div><dl className="adm-facts"><div><dt>Student ID</dt><dd>{task.studentId}</dd></div><div><dt>Submitted</dt><dd>{fmtTime(task.createdAt)}</dd></div><div><dt>Deadline</dt><dd>{fmtDate(task.deadline)}</dd></div><div><dt>Task status</dt><dd>{task.status}</dd></div></dl>{detail.analysis?.missingInformation?.length > 0 && <div className="adm-callout"><strong>Information to clarify</strong><p>{detail.analysis.missingInformation.join(', ')}</p></div>}{detail.analysis?.deliverables?.length > 0 && <div className="adm-list-block"><h3>Expected deliverables</h3><ul>{detail.analysis.deliverables.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.title || item.name || 'Deliverable'}</li>)}</ul></div>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">FILES</p><h2>Source materials</h2></div><span>{detail.files.length}</span></div>{detail.files.length ? <ul className="adm-files">{detail.files.map((file) => <li key={file.id}><FileText size={18} /><span><strong>{file.name}</strong><small>{file.role} · {Math.ceil((file.size || 0) / 1024)} KB</small></span><button className="adm-icon" onClick={() => window.open(`/api/admin/tasks/${encodeURIComponent(task.id)}/files/${encodeURIComponent(file.id)}/download`, '_blank', 'noopener,noreferrer')} aria-label={`Open ${file.name}`}><Download size={17} /></button></li>)}</ul> : <p className="adm-muted">No files are attached to this task.</p>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">CASE HISTORY</p><h2>Review activity</h2></div></div>{detail.audit.length ? <ol className="adm-timeline">{detail.audit.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{item.action.replace('_', ' ')}</strong><small>{fmtTime(item.at)} · {item.actorId}</small>{item.note && <p>{item.note}</p>}</div></li>)}</ol> : <p className="adm-muted">No Admin decisions have been recorded yet.</p>}</section>
    </div><aside className="adm-case-side"><section className="adm-panel adm-decision"><p className="adm-kicker">ADMIN DECISION</p><h2>Review this request</h2><p>Record the feasibility decision before issuing an official plan.</p>{canDecide ? <><label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record your reasoning or the information needed…" rows={5} maxLength={2000} /></label>{error && <div className="adm-alert" role="alert">{error}</div>}<div className="adm-action-stack">{review.status === 'QUEUED' && <button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('start')}>Start review</button>}<button className="adm-primary" disabled={Boolean(busy)} onClick={() => action('approve')}>Approve feasibility <ArrowRight size={15} /></button><button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('request_info')}>Needs information</button><button className="adm-danger" disabled={Boolean(busy)} onClick={() => action('decline')}>Decline request</button></div></> : <><ReviewPill status={review.status} />{review.internalNotes && <p className="adm-decision-note">{review.internalNotes}</p>}</>}</section>{review.status === 'APPROVED' && <form className="adm-panel adm-decision" onSubmit={submitPlan}><p className="adm-kicker">OFFICIAL PLAN</p><h2>{detail.plan ? 'Plan issued' : 'Issue a plan'}</h2>{detail.plan && <p>Current plan: {detail.plan.status} · LKR {Number(detail.plan.price).toLocaleString()}</p>}{detail.plan?.status !== 'ACCEPTED' && <><label>Scope<textarea required minLength={20} maxLength={4000} rows={5} value={plan.scope} onChange={(event) => setPlan({ ...plan, scope: event.target.value })} placeholder="Describe the work and deliverables…" /></label><label>Not included<textarea maxLength={2000} rows={3} value={plan.excluded} onChange={(event) => setPlan({ ...plan, excluded: event.target.value })} placeholder="Optional exclusions…" /></label><label>Delivery date<input type="date" required value={plan.delivery} onChange={(event) => setPlan({ ...plan, delivery: event.target.value })} /></label><label>Price in LKR<input type="number" min="1" step="1" required value={plan.price} onChange={(event) => setPlan({ ...plan, price: event.target.value })} /></label><label>Included revisions<input type="number" min="0" max="20" step="1" required value={plan.revisionAllowance} onChange={(event) => setPlan({ ...plan, revisionAllowance: event.target.value })} /></label>{planError && <div className="adm-alert" role="alert">{planError}</div>}<button className="adm-primary" disabled={planBusy}>{planBusy ? 'Issuing…' : detail.plan ? 'Issue revised plan' : 'Issue official plan'} <ArrowRight size={15} /></button></>}</form>}{task.status === 'PAID' && !task.assignedExpertId && <form className="adm-panel adm-decision" onSubmit={submitAssignment}><p className="adm-kicker">EXPERT ASSIGNMENT</p><h2>Assign funded task</h2><p>Only the selected Expert will receive this assignment and its source files.</p><label>Expert<select required value={expertId} onChange={(event) => setExpertId(event.target.value)}><option value="">Choose an Expert</option>{experts.map((expert) => <option key={expert.id} value={expert.id} disabled={expert.availability === 'unavailable'}>{expert.name} · {expert.availability} · {expert.activeAssignments} active</option>)}</select></label>{expertError && <div className="adm-alert" role="alert">{expertError}</div>}<button className="adm-primary" disabled={expertBusy || !experts.length}>{expertBusy ? 'Assigning…' : 'Confirm assignment'} <ArrowRight size={15} /></button></form>}{task.assignedExpertId && <section className="adm-panel adm-decision"><p className="adm-kicker">EXPERT ASSIGNMENT</p><h2>Assigned</h2><p>{task.assignedExpertName || task.assignedExpertId}</p><small>{task.assignmentId}</small></section>}</aside></div>
  </>
}

const supportStatus = { received: 'Received', in_progress: 'In progress', waiting_on_student: 'Waiting on student', resolved: 'Resolved' }

function SupportQueue({ tickets, onOpen }) {
  const [search, setSearch] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const visible = tickets.filter((ticket) => (showResolved || ticket.status !== 'resolved') && `${ticket.id} ${ticket.categoryLabel} ${ticket.context?.studentName || ''} ${ticket.message}`.toLowerCase().includes(search.toLowerCase()))
  return <><header className="adm-heading"><div><p className="adm-kicker">SERVICE DESK / SUPPORT</p><h1>Keep every request moving.</h1><p>Review Student issues and record the next support action.</p></div></header><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">SUPPORT INBOX</p><h2>{showResolved ? 'All requests' : 'Open requests'}</h2><p>{visible.length} requests in this view</p></div><label className="adm-search"><Search size={16} /><input type="search" placeholder="Search request, student or issue" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="adm-filters"><button className={!showResolved ? 'is-active' : ''} onClick={() => setShowResolved(false)}>Open</button><button className={showResolved ? 'is-active' : ''} onClick={() => setShowResolved(true)}>All requests</button></div>{visible.length ? <div className="adm-table-wrap"><table><thead><tr><th>Request</th><th>Student</th><th>Received</th><th>Status</th><th><span className="adm-sr">Open</span></th></tr></thead><tbody>{visible.map((ticket) => <tr key={ticket.id}><td><button className="adm-task-link" onClick={() => onOpen(ticket.id)}><strong>{ticket.categoryLabel || 'Support request'}</strong><small>{ticket.id} · {ticket.issueLabel || 'General issue'}</small></button></td><td>{ticket.context?.studentName || shortId(ticket.context?.studentId)}</td><td>{fmtDate(ticket.createdAt)}</td><td><span className="adm-status" data-state={ticket.status}>{supportStatus[ticket.status] || ticket.status}</span></td><td><button className="adm-icon" onClick={() => onOpen(ticket.id)} aria-label={`Open ${ticket.id}`}><ArrowRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><LifeBuoy size={28} /><h3>No requests in this view</h3><p>{search ? 'Try another search term.' : 'New support requests will appear here.'}</p></div>}</section></>
}

function SupportDetail({ ticket, reload, onBack }) {
  const [status, setStatus] = useState(ticket.status)
  const [note, setNote] = useState('')
  const [studentMessage, setStudentMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (event) => { event.preventDefault(); if (note.trim().length < 10) return setError('Add an internal note of at least 10 characters.'); if (status === 'waiting_on_student' && studentMessage.trim().length < 10) return setError('Explain what the Student needs to provide.'); setBusy(true); setError(''); try { await updateSupportStatus(ticket.id, status, note, studentMessage); await reload() } catch (issue) { setError(issue.message) } finally { setBusy(false) } }
  return <><button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to support</button><header className="adm-case-head"><div><p className="adm-kicker">SUPPORT CASE / {ticket.id}</p><h1>{ticket.categoryLabel || 'Support request'}</h1><p>{ticket.issueLabel || 'General issue'} · {fmtTime(ticket.createdAt)}</p></div><span className="adm-status" data-state={ticket.status}>{supportStatus[ticket.status] || ticket.status}</span></header><div className="adm-case-grid"><div className="adm-case-main"><section className="adm-panel"><p className="adm-kicker">STUDENT MESSAGE</p><h2 className="adm-section-title">What happened</h2><p className="adm-message">{ticket.message}</p><dl className="adm-facts"><div><dt>Student</dt><dd>{ticket.context?.studentName || ticket.context?.studentId || 'Unknown'}</dd></div><div><dt>Related task</dt><dd>{ticket.taskTitle || 'None'}</dd></div></dl></section><section className="adm-panel"><p className="adm-kicker">INTERNAL HISTORY</p><h2 className="adm-section-title">Actions recorded</h2>{ticket.history?.length ? <ol className="adm-timeline">{ticket.history.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{supportStatus[item.status] || item.status}</strong><small>{fmtTime(item.at)} · {item.actorId}</small><p>{item.note}</p></div></li>)}</ol> : <p className="adm-muted">No staff actions recorded yet.</p>}</section><section className="adm-panel"><p className="adm-kicker">STUDENT UPDATES</p><h2 className="adm-section-title">Messages sent</h2>{ticket.studentUpdates?.length ? <ol className="adm-timeline">{ticket.studentUpdates.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{supportStatus[item.status] || item.status}</strong><small>{fmtTime(item.at)}</small><p>{item.message}</p></div></li>)}</ol> : <p className="adm-muted">No message has been sent to the Student yet.</p>}</section></div><aside className="adm-case-side"><form className="adm-panel adm-decision" onSubmit={save}><p className="adm-kicker">NEXT ACTION</p><h2>Update this request</h2><p>The Student can see the status. Your note stays internal.</p><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(supportStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Internal note<textarea rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the next action or resolution…" /></label>{error && <div className="adm-alert" role="alert">{error}</div>}{status === 'waiting_on_student' && <label>Message to student<textarea rows={4} maxLength={2000} value={studentMessage} onChange={(event) => setStudentMessage(event.target.value)} placeholder="Tell the Student what information is needed…" /></label>}<button className="adm-primary" disabled={busy || status === ticket.status}>{busy ? 'Saving…' : 'Save status'} <ArrowRight size={15} /></button></form></aside></div></>
}

function QaQueue({ assignments, onOpen }) {
  return <><header className="adm-heading"><div><p className="adm-kicker">SERVICE DESK / QUALITY</p><h1>Review before delivery.</h1><p>Inspect Expert submissions and decide whether they are ready.</p></div></header><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">QUALITY GATE</p><h2>Waiting for review</h2><p>{assignments.length} submissions in this view</p></div></div>{assignments.length ? <div className="adm-table-wrap"><table><thead><tr><th>Assignment</th><th>Expert</th><th>Submitted</th><th>Cycle</th><th>Files</th><th><span className="adm-sr">Open</span></th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><button className="adm-task-link" onClick={() => onOpen(item.id)}><strong>{item.title}</strong><small>{item.reference || shortId(item.id)} · {item.domain || 'General'}</small></button></td><td>{item.expertName}</td><td>{fmtTime(item.submittedAt)}</td><td>{item.cycle}</td><td>{item.fileCount}</td><td><button className="adm-icon" onClick={() => onOpen(item.id)} aria-label={`Review ${item.title}`}><ArrowRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><ShieldCheck size={28} /><h3>Nothing is waiting for QA</h3><p>Expert submissions will appear here when sent for quality review.</p></div>}</section></>
}

function QaDetail({ detail, reload, onBack }) {
  const [note, setNote] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const decide = async (outcome) => { if (!reviewed) return setError('Confirm that you reviewed the submission files.'); if (outcome === 'changes_requested' && note.trim().length < 10) return setError('Explain the changes needed in at least 10 characters.'); setBusy(true); setError(''); try { await recordQaOutcome(detail.assignment.id, outcome, note); await reload() } catch (issue) { setError(issue.message) } finally { setBusy(false) } }
  const openFile = (fileId) => window.open(`/api/admin/qa/${encodeURIComponent(detail.assignment.id)}/files/${encodeURIComponent(fileId)}/download`, '_blank', 'noopener,noreferrer')
  return <><button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to quality queue</button><header className="adm-case-head"><div><p className="adm-kicker">QUALITY CASE / {detail.assignment.reference || shortId(detail.assignment.id)}</p><h1>{detail.assignment.title}</h1><p>{detail.assignment.expertName} · Cycle {detail.qa?.cycle || 1}</p></div><span className="adm-status" data-state={detail.qa?.state}>{detail.qa?.state === 'in_review' ? 'In review' : detail.qa?.state?.replaceAll('_', ' ')}</span></header><div className="adm-case-grid"><div className="adm-case-main"><section className="adm-panel"><p className="adm-kicker">SUBMISSION</p><h2 className="adm-section-title">Files to inspect</h2>{detail.submissionFiles.length ? <ul className="adm-files">{detail.submissionFiles.map((file) => <li key={file.id}><FileText size={18} /><span><strong>{file.name}</strong><small>{Math.ceil((file.size || 0) / 1024)} KB</small></span><button className="adm-icon" onClick={() => openFile(file.id)} aria-label={`Open ${file.name}`}><Download size={17} /></button></li>)}</ul> : <p className="adm-muted">No submission files are available.</p>}{error && <div className="adm-alert" role="alert">{error}</div>}</section><section className="adm-panel"><p className="adm-kicker">QUALITY HISTORY</p><h2 className="adm-section-title">Review decisions</h2>{detail.history.length ? <ol className="adm-timeline">{detail.history.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{item.outcome.replaceAll('_', ' ')}</strong><small>{fmtTime(item.at)} · {item.actorId}</small>{item.note && <p>{item.note}</p>}</div></li>)}</ol> : <p className="adm-muted">No staff decision recorded yet.</p>}</section></div><aside className="adm-case-side"><section className="adm-panel adm-decision"><p className="adm-kicker">QUALITY DECISION</p><h2>Ready to deliver?</h2><p>Approval moves Expert work to ready to deliver. Requested changes return feedback to the Expert.</p>{detail.qa?.state === 'in_review' ? <><label className="adm-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I reviewed the submission files</label><label>Review note<textarea rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the reason or changes needed…" /></label><div className="adm-action-stack"><button className="adm-primary" disabled={busy || !reviewed} onClick={() => decide('approved')}>Approve quality <ArrowRight size={15} /></button><button className="adm-secondary" disabled={busy || !reviewed} onClick={() => decide('changes_requested')}>Request changes</button></div></> : <p className="adm-muted">This submission has already been reviewed.</p>}</section></aside></div></>
}

export function AdminWorkspace() {
  const [staffState, setStaffState] = useState({ loading: true, staff: null, error: null })
  const [overview, setOverview] = useState({ loading: true, data: null, error: null })
  const [caseState, setCaseState] = useState({ loading: false, data: null, error: null })
  const [supportQueue, setSupportQueue] = useState({ loading: true, data: null, error: null })
  const [supportCase, setSupportCase] = useState({ loading: false, data: null, error: null })
  const [qaQueue, setQaQueue] = useState({ loading: true, data: null, error: null })
  const [qaCase, setQaCase] = useState({ loading: false, data: null, error: null })
  const [route, setRoute] = useState(routeFromPath)
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
  const loadSupportQueue = useCallback(async () => {
    setSupportQueue((prev) => ({ ...prev, loading: true, error: null }))
    try { setSupportQueue({ loading: false, data: await getSupportQueue(), error: null }) }
    catch (error) { setSupportQueue({ loading: false, data: null, error }) }
  }, [])
  const loadSupportCase = useCallback(async (id) => {
    setSupportCase({ loading: true, data: null, error: null })
    try { setSupportCase({ loading: false, data: await getSupportCase(id), error: null }) }
    catch (error) { setSupportCase({ loading: false, data: null, error }) }
  }, [])
  const loadQaQueue = useCallback(async () => {
    setQaQueue((prev) => ({ ...prev, loading: true, error: null }))
    try { setQaQueue({ loading: false, data: await getQaQueue(), error: null }) }
    catch (error) { setQaQueue({ loading: false, data: null, error }) }
  }, [])
  const loadQaCase = useCallback(async (id) => {
    setQaCase({ loading: true, data: null, error: null })
    try { setQaCase({ loading: false, data: await getQaCase(id), error: null }) }
    catch (error) { setQaCase({ loading: false, data: null, error }) }
  }, [])
  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { const update = () => setRoute(routeFromPath()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  useEffect(() => { if (staffState.staff) { loadOverview(); loadSupportQueue(); loadQaQueue() } }, [staffState.staff, loadOverview, loadSupportQueue, loadQaQueue])
  useEffect(() => { if (!staffState.staff || !route.id) return; if (route.section === 'tasks') loadCase(route.id); if (route.section === 'support') loadSupportCase(route.id); if (route.section === 'qa') loadQaCase(route.id) }, [staffState.staff, route, loadCase, loadSupportCase, loadQaCase])

  if (staffState.loading) return <div className="adm-gate"><div className="adm-loading" role="status">Loading Admin access…</div></div>
  if (staffState.error?.status === 401) return <Login onDone={loadStaff} />
  if (staffState.error) return <div className="adm-gate"><div className="adm-login"><p className="adm-kicker">COULD NOT CONNECT</p><h1>Admin access is unavailable.</h1><p>{staffState.error.message}</p><button className="adm-primary" onClick={loadStaff}>Try again <ArrowRight size={16} /></button></div></div>
  let content
  let state
  let retry
  if (route.section === 'support') {
    state = route.id ? supportCase : supportQueue
    retry = () => route.id ? loadSupportCase(route.id) : loadSupportQueue()
    if (state.data) content = route.id ? <SupportDetail key={route.id} ticket={state.data.ticket} reload={async () => { await Promise.all([loadSupportCase(route.id), loadSupportQueue(), loadOverview()]) }} onBack={() => goSection('support')} /> : <SupportQueue tickets={state.data.tickets} onOpen={(id) => goSection('support', id)} />
  } else if (route.section === 'qa') {
    state = route.id ? qaCase : qaQueue
    retry = () => route.id ? loadQaCase(route.id) : loadQaQueue()
    if (state.data) content = route.id ? <QaDetail key={route.id} detail={state.data} reload={async () => { await Promise.all([loadQaCase(route.id), loadQaQueue(), loadOverview()]) }} onBack={() => goSection('qa')} /> : <QaQueue assignments={state.data.assignments} onOpen={(id) => goSection('qa', id)} />
  } else {
    state = route.id ? caseState : overview
    retry = () => route.id ? loadCase(route.id) : loadOverview()
    if (state.data) content = route.id ? <CaseDetail key={route.id} detail={state.data} reload={async () => { await Promise.all([loadCase(route.id), loadOverview()]) }} onBack={() => go(null)} /> : <Queue overview={state.data} filter={filter} setFilter={setFilter} onOpen={go} />
  }
  if (!content && state.loading) content = <div className="adm-loading" role="status">Loading {route.section}…</div>
  if (!content && state.error) content = <div className="adm-panel adm-error"><h2>Could not load {route.section}</h2><p>{state.error.message}</p><button className="adm-primary" onClick={retry}>Try again</button></div>
  return <div className="adm-app"><AdminSidebar section={route.section} filter={filter} setFilter={setFilter} staff={staffState.staff} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><div className="adm-frame"><div className="adm-topbar"><button className="adm-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span>Admin <ChevronDown size={14} /> {route.section === 'tasks' ? 'Task intake' : route.section === 'qa' ? 'Quality review' : 'Support'}</span><div><span className="adm-role">{staffState.staff.demo ? 'LOCAL PREVIEW' : staffState.staff.role.toUpperCase()}</span>{!staffState.staff.demo && <button className="adm-icon" onClick={async () => { await logoutStaff().catch(() => {}); loadStaff() }} aria-label="Sign out"><LogOut size={18} /></button>}</div></div><main className="adm-content">{content}</main></div></div>
}
