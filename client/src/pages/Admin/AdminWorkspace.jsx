import { useNavigationDialog } from '../../shared/useNavigationDialog.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock3, CreditCard, Download, FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, MessageCircle, Search, ShieldCheck, X } from 'lucide-react'
import { assignExpert, decideExpertRequest, decidePayout, decideRefund, getAssignableExperts, getCase, getExpertRequests, getConversation, getConversations, getOpportunityInterests, getOverview, getPaymentOperations, getPayoutQueue, getQaCase, getQaQueue, getRefundQueue, getSolvyJobs, getStaff, getSupportCase, getSupportQueue, issuePlan, issueScopeChange, loginStaff, logoutStaff, markConversationRead, publishOpportunity, recordQaOutcome, recordReview, retrySolvyJob, reviewExpert, sendConversationReply, updatePaymentDispute, updateSupportStatus } from '../../admin/adminApi.js'
import logo from '../../assets/logo-mark.webp'
import './admin-workspace.css'

const pathFor = (id) => id ? `/admin/tasks/${encodeURIComponent(id)}` : '/admin'
const selectedFromPath = () => window.location.pathname.match(/^\/admin\/tasks\/([^/]+)$/)?.[1] || null
const routeFromPath = () => {
  const match = window.location.pathname.match(/^\/admin\/(qa|support|messages|refunds|payments|payouts|experts|expert-requests|opportunities|solvy)(?:\/([^/]+))?$/)
  if (!match) return { section: 'tasks', id: selectedFromPath() }
  try { return { section: match[1], id: match[2] ? decodeURIComponent(match[2]) : null } }
  catch { return { section: match[1], id: null } }
}
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'
const fmtTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not set'
const shortId = (value) => String(value || '').slice(0, 8).toUpperCase()
const reviewLabel = { QUEUED: 'Needs review', IN_REVIEW: 'In review', APPROVED: 'Approved internally', NEEDS_INFO: 'Needs information', DECLINED: 'Declined internally' }
const filters = [['queue', 'Needs review'], ['in-review', 'In review'], ['ready', 'Ready to assign'], ['decided', 'Decisions'], ['all', 'All tasks']]

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
  const [otp, setOtp] = useState('')
  const [mfa, setMfa] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await loginStaff(email.trim(), password, otp, mfa?.factorId); onDone() }
    catch (issue) { if (issue.mfa) setMfa(issue.mfa); setError(issue.message); setBusy(false) }
  }
  return <div className="adm-gate"><form className="adm-login" onSubmit={submit}>
    <div className="adm-login-mark"><ShieldCheck size={24} /></div>
    <p className="adm-kicker">SOLVENEST OPERATIONS</p>
    <h1>Admin sign in</h1>
    <p>Use an approved Admin account to manage task reviews.</p>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {mfa && <><div className="adm-callout"><strong>{mfa.enrolled ? 'Two-step verification' : 'Set up two-step verification'}</strong>{!mfa.enrolled && <><p>Add this account to your authenticator app, then enter its six-digit code.</p>{mfa.qrCode && <img src={mfa.qrCode} alt="Authenticator setup QR code" width="180" height="180" />}{mfa.secret && <code>{mfa.secret}</code>}</>}</div><label>Verification code<input type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label></>}
    {error && <div className="adm-alert" role="alert">{error}</div>}
    <button className="adm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Admin workspace'} <ArrowRight size={16} /></button>
    <a href="/">Return to SolveNest</a>
  </form></div>
}

function ReviewPill({ status }) { return <span className="adm-status" data-state={status || 'QUEUED'}>{reviewLabel[status] || status || 'Needs review'}</span> }

function AdminSidebar({ section, filter, setFilter, staff, mobileOpen, setMobileOpen }) {
  useNavigationDialog(mobileOpen, () => setMobileOpen(false), '.adm-sidebar')
  return <><div className={`adm-scrim ${mobileOpen ? 'is-open' : ''}`} onClick={() => setMobileOpen(false)} />
    <aside id="admin-navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} aria-label="Admin navigation" className={`adm-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="adm-brand"><img className="adm-brand-logo" src={logo} alt="SolveNest" /><span>SolveNest<small>ADMIN</small></span><button className="adm-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav aria-label="Admin navigation">
        <p className="adm-nav-label">OPERATIONS</p>
        <button className={section === 'tasks' && filter === 'queue' ? 'is-active' : ''} onClick={() => { setFilter('queue'); setMobileOpen(false); go(null) }}><LayoutDashboard size={17} /> Action queue</button>
        <button className={section === 'tasks' && filter === 'in-review' ? 'is-active' : ''} onClick={() => { setFilter('in-review'); setMobileOpen(false); go(null) }}><Clock3 size={17} /> In review</button>
        <button className={section === 'tasks' && filter === 'ready' ? 'is-active' : ''} onClick={() => { setFilter('ready'); setMobileOpen(false); go(null) }}><Bell size={17} /> Ready to assign</button>
        <button className={section === 'tasks' && filter === 'decided' ? 'is-active' : ''} onClick={() => { setFilter('decided'); setMobileOpen(false); go(null) }}><CheckCircle2 size={17} /> Decisions</button>
        <button className={section === 'tasks' && filter === 'all' ? 'is-active' : ''} onClick={() => { setFilter('all'); setMobileOpen(false); go(null) }}><ClipboardList size={17} /> All tasks</button>
        <p className="adm-nav-label" style={{ marginTop: 22 }}>SERVICE DESK</p>
        <button className={section === 'qa' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('qa') }}><ShieldCheck size={17} /> Quality review</button>
        <button className={section === 'support' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('support') }}><LifeBuoy size={17} /> Support requests</button>
        <button className={section === 'messages' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('messages') }}><MessageCircle size={17} /> Task messages</button>
        <button className={section === 'refunds' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('refunds') }}><CreditCard size={17} /> Refund reviews</button>
        <button className={section === 'payments' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('payments') }}><CreditCard size={17} /> Payment disputes</button>
        <button className={section === 'payouts' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('payouts') }}><CreditCard size={17} /> Expert payouts</button>
        <button className={section === 'experts' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('experts') }}><ShieldCheck size={17} /> Expert approvals</button>
        <button className={section === 'expert-requests' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('expert-requests') }}><LifeBuoy size={17} /> Expert requests</button>
        <button className={section === 'opportunities' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('opportunities') }}><Bell size={17} /> Opportunities</button>
        <button className={section === 'solvy' ? 'is-active' : ''} onClick={() => { setMobileOpen(false); goSection('solvy') }}><Clock3 size={17} /> Solvy jobs</button>
      </nav>
      <div className="adm-sidebar-foot"><span className="adm-avatar">{staff?.name?.slice(0, 1) || 'A'}</span><span><strong>{staff?.name || 'Admin'}</strong><small>{staff?.demo ? 'Local preview' : staff?.role}</small></span></div>
    </aside></>
}

function Metric({ value, label, icon: Icon, tone }) { return <div className="adm-metric" data-tone={tone}><div><span>{label}</span><strong>{value}</strong></div><Icon size={22} /></div> }

function Queue({ overview, filter, setFilter, onOpen }) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => (overview.tasks || []).filter((task) => {
    const stateMatch = filter === 'all' || (filter === 'queue' && task.reviewStatus === 'QUEUED') || (filter === 'in-review' && task.reviewStatus === 'IN_REVIEW') || (filter === 'ready' && task.status === 'PAID' && !task.assignedExpertId) || (filter === 'decided' && ['APPROVED', 'NEEDS_INFO', 'DECLINED'].includes(task.reviewStatus))
    return stateMatch && `${task.title} ${task.subject || ''} ${task.id} ${task.studentId}`.toLowerCase().includes(search.toLowerCase())
  }), [overview.tasks, filter, search])
  return <>
    <header className="adm-heading"><div><p className="adm-kicker">OPERATIONS / REVIEW</p><h1>Decisions start here.</h1><p>Review new student requests and keep the next action clear.</p></div><span className="adm-today">{fmtDate(new Date())}</span></header>
    <div className="adm-metrics">
      <Metric label="Needs review" value={overview.metrics.queued} icon={Bell} tone="amber" />
      <Metric label="In review" value={overview.metrics.inReview} icon={Clock3} tone="blue" />
      <Metric label="Ready to assign" value={overview.metrics.readyToAssign || 0} icon={Bell} tone="green" />
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

function ScopeChangeForm({ detail, onSaved }) {
  const [scope, setScope] = useState('')
  const [reason, setReason] = useState('')
  const [delivery, setDelivery] = useState('')
  const [priceDelta, setPriceDelta] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const task = detail.task
  if (detail.plan?.status !== 'ACCEPTED' || !['PAID', 'ASSIGNMENT_PENDING', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS'].includes(task.status)) return null
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await issueScopeChange(task.id, { scope, reason, delivery, priceDelta: Number(priceDelta) }); await onSaved() }
    catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }
  if (detail.scopeChange) return <section className="adm-panel adm-decision"><p className="adm-kicker">SCOPE CHANGE</p><h2>Awaiting Student</h2><p>{detail.scopeChange.status === 'AWAITING_PAYMENT' ? 'The Student accepted this change; additional payment is pending.' : 'The revised scope is waiting for Student approval.'}</p><p>{detail.scopeChange.requested.scope}</p><small>Additional LKR {Number(detail.scopeChange.requested.priceDelta).toLocaleString()} · {fmtDate(detail.scopeChange.requested.delivery)}</small></section>
  return <form className="adm-panel adm-decision" onSubmit={submit}><p className="adm-kicker">SCOPE CHANGE</p><h2>Propose revised work</h2><p>Student acceptance and any additional payment are required before this changes the Expert brief.</p><label>Reason<textarea required minLength={10} maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label>Revised scope<textarea required minLength={20} maxLength={4000} rows={4} value={scope} onChange={(event) => setScope(event.target.value)} /></label><label>Revised delivery date<input type="date" required value={delivery} onChange={(event) => setDelivery(event.target.value)} /></label><label>Additional price in LKR<input type="number" min="0" max="100000000" step="1" required value={priceDelta} onChange={(event) => setPriceDelta(event.target.value)} /></label>{error && <div className="adm-alert" role="alert">{error}</div>}<button className="adm-primary" disabled={busy}>{busy ? 'Issuing…' : 'Send scope change'} <ArrowRight size={15} /></button></form>
}

function CaseDetail({ detail, reload, onBack }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState({ scope: '', excluded: '', delivery: '', price: '', revisionAllowance: '1', paymentModel: 'full', firstMilestonePercent: '50' })
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
    try { await issuePlan(task.id, { ...plan, price: Number(plan.price), revisionAllowance: Number(plan.revisionAllowance), firstMilestonePercent: Number(plan.firstMilestonePercent) }); await reload() }
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
    </div><aside className="adm-case-side"><section className="adm-panel adm-decision"><p className="adm-kicker">ADMIN DECISION</p><h2>Review this request</h2><p>Record the feasibility decision before issuing an official plan.</p>{canDecide ? <><label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record your reasoning or the information needed…" rows={5} maxLength={2000} /></label>{error && <div className="adm-alert" role="alert">{error}</div>}<div className="adm-action-stack">{review.status === 'QUEUED' && <button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('start')}>Start review</button>}<button className="adm-primary" disabled={Boolean(busy)} onClick={() => action('approve')}>Approve feasibility <ArrowRight size={15} /></button><button className="adm-secondary" disabled={Boolean(busy)} onClick={() => action('request_info')}>Needs information</button><button className="adm-danger" disabled={Boolean(busy)} onClick={() => action('decline')}>Decline request</button></div></> : <><ReviewPill status={review.status} />{review.internalNotes && <p className="adm-decision-note">{review.internalNotes}</p>}</>}</section>{review.status === 'APPROVED' && <form className="adm-panel adm-decision" onSubmit={submitPlan}><p className="adm-kicker">OFFICIAL PLAN</p><h2>{detail.plan ? 'Plan issued' : 'Issue a plan'}</h2>{detail.plan && <p>Current plan: {detail.plan.status} · LKR {Number(detail.plan.price).toLocaleString()}</p>}{detail.plan?.status !== 'ACCEPTED' && <><label>Scope<textarea required minLength={20} maxLength={4000} rows={5} value={plan.scope} onChange={(event) => setPlan({ ...plan, scope: event.target.value })} placeholder="Describe the work and deliverables…" /></label><label>Not included<textarea maxLength={2000} rows={3} value={plan.excluded} onChange={(event) => setPlan({ ...plan, excluded: event.target.value })} placeholder="Optional exclusions…" /></label><label>Delivery date<input type="date" required value={plan.delivery} onChange={(event) => setPlan({ ...plan, delivery: event.target.value })} /></label><label>Price in LKR<input type="number" min="1" step="1" required value={plan.price} onChange={(event) => setPlan({ ...plan, price: event.target.value })} /></label><label>Payment schedule<select value={plan.paymentModel} onChange={(event) => setPlan({ ...plan, paymentModel: event.target.value })}><option value="full">Full payment before work</option><option value="milestone">Two milestones</option></select></label>{plan.paymentModel === 'milestone' && <label>First milestone percentage<input type="number" min="10" max="90" step="1" required value={plan.firstMilestonePercent} onChange={(event) => setPlan({ ...plan, firstMilestonePercent: event.target.value })} /><small>First payment starts Expert work; the balance is due before delivery.</small></label>}<label>Included revisions<input type="number" min="0" max="20" step="1" required value={plan.revisionAllowance} onChange={(event) => setPlan({ ...plan, revisionAllowance: event.target.value })} /></label>{planError && <div className="adm-alert" role="alert">{planError}</div>}<button className="adm-primary" disabled={planBusy}>{planBusy ? 'Issuing…' : detail.plan ? 'Issue revised plan' : 'Issue official plan'} <ArrowRight size={15} /></button></>}</form>}{task.status === 'PAID' && !task.assignedExpertId && <form className="adm-panel adm-decision" onSubmit={submitAssignment}><p className="adm-kicker">EXPERT ASSIGNMENT</p><h2>Assign funded task</h2><p>Only the selected Expert will receive this assignment and its source files.</p><label>Expert<select required value={expertId} onChange={(event) => setExpertId(event.target.value)}><option value="">Choose an Expert</option>{experts.map((expert) => <option key={expert.id} value={expert.id} disabled={!expert.eligible}>{expert.name} · {expert.eligible ? `${expert.activeAssignments}/${expert.capacity} active · ${expert.competencies.join(', ')}` : 'Not eligible for assignment'}</option>)}</select></label>{expertError && <div className="adm-alert" role="alert">{expertError}</div>}<button className="adm-primary" disabled={expertBusy || !experts.length}>{expertBusy ? 'Assigning…' : 'Confirm assignment'} <ArrowRight size={15} /></button></form>}{task.assignedExpertId && <section className="adm-panel adm-decision"><p className="adm-kicker">EXPERT ASSIGNMENT</p><h2>Assigned</h2><p>{task.assignedExpertName || task.assignedExpertId}</p><small>{task.assignmentId}</small></section>}<ScopeChangeForm detail={detail} onSaved={reload} /></aside></div>
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
  const [priority, setPriority] = useState(ticket.priority || 'normal')
  const [assignToMe, setAssignToMe] = useState(!ticket.ownerId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (event) => { event.preventDefault(); if (note.trim().length < 10) return setError('Add an internal note of at least 10 characters.'); if (status === 'waiting_on_student' && studentMessage.trim().length < 10) return setError('Explain what the Student needs to provide.'); setBusy(true); setError(''); try { await updateSupportStatus(ticket.id, status, note, studentMessage, priority, assignToMe); await reload() } catch (issue) { setError(issue.message) } finally { setBusy(false) } }
  return <><button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to support</button><header className="adm-case-head"><div><p className="adm-kicker">SUPPORT CASE / {ticket.id}</p><h1>{ticket.categoryLabel || 'Support request'}</h1><p>{ticket.issueLabel || 'General issue'} · {fmtTime(ticket.createdAt)}</p></div><span className="adm-status" data-state={ticket.status}>{supportStatus[ticket.status] || ticket.status}</span></header><div className="adm-case-grid"><div className="adm-case-main"><section className="adm-panel"><p className="adm-kicker">STUDENT MESSAGE</p><h2 className="adm-section-title">What happened</h2><p className="adm-message">{ticket.message}</p><dl className="adm-facts"><div><dt>Student</dt><dd>{ticket.context?.studentName || ticket.context?.studentId || 'Unknown'}</dd></div><div><dt>Related task</dt><dd>{ticket.taskTitle || 'None'}</dd></div><div><dt>Priority</dt><dd>{ticket.priority || 'normal'}</dd></div><div><dt>Owner</dt><dd>{ticket.ownerName || ticket.ownerId || 'Unassigned'}</dd></div><div><dt>First response due</dt><dd>{fmtTime(ticket.firstResponseDueAt)}</dd></div></dl></section><section className="adm-panel"><p className="adm-kicker">INTERNAL HISTORY</p><h2 className="adm-section-title">Actions recorded</h2>{ticket.history?.length ? <ol className="adm-timeline">{ticket.history.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{supportStatus[item.status] || item.status}</strong><small>{fmtTime(item.at)} · {item.actorId}</small><p>{item.note}</p></div></li>)}</ol> : <p className="adm-muted">No staff actions recorded yet.</p>}</section><section className="adm-panel"><p className="adm-kicker">STUDENT UPDATES</p><h2 className="adm-section-title">Messages sent</h2>{ticket.studentUpdates?.length ? <ol className="adm-timeline">{ticket.studentUpdates.map((item) => <li key={item.id}><span className="adm-timeline-dot" /><div><strong>{supportStatus[item.status] || item.status}</strong><small>{fmtTime(item.at)}</small><p>{item.message}</p></div></li>)}</ol> : <p className="adm-muted">No message has been sent to the Student yet.</p>}</section></div><aside className="adm-case-side"><form className="adm-panel adm-decision" onSubmit={save}><p className="adm-kicker">NEXT ACTION</p><h2>Update this request</h2><p>The Student can see the status. Your note stays internal.</p><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="adm-check"><input type="checkbox" checked={assignToMe} onChange={(event) => setAssignToMe(event.target.checked)} /> Assign this case to me</label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(supportStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Internal note<textarea rows={5} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the next action or resolution…" /></label>{error && <div className="adm-alert" role="alert">{error}</div>}{status === 'waiting_on_student' && <label>Message to student<textarea rows={4} maxLength={2000} value={studentMessage} onChange={(event) => setStudentMessage(event.target.value)} placeholder="Tell the Student what information is needed…" /></label>}<button className="adm-primary" disabled={busy || (status === ticket.status && priority === (ticket.priority || 'normal') && !assignToMe)}>{busy ? 'Saving…' : 'Save status'} <ArrowRight size={15} /></button></form></aside></div></>
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

function MessagesQueue({ conversations, onOpen }) {
  const [search, setSearch] = useState('')
  const visible = conversations.filter((item) => `${item.taskTitle} ${item.taskRef} ${item.lastMessage?.body || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <><header className="adm-heading"><div><p className="adm-kicker">SERVICE DESK / TASK MESSAGES</p><h1>Student conversations.</h1><p>Read and answer messages from each task room.</p></div></header><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Inbox</h2><p>{visible.filter((item) => item.staffUnread).length} need a reply</p></div><label className="adm-search"><Search size={16} /><input type="search" placeholder="Search task or message" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>{visible.length ? <div className="adm-table-wrap"><table><thead><tr><th>Task</th><th>Latest message</th><th>Updated</th><th>Status</th><th><span className="adm-sr">Open</span></th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><button className="adm-task-link" onClick={() => onOpen(item.id)}><strong>{item.taskTitle}</strong><small>{shortId(item.taskId)}</small></button></td><td>{item.lastMessage?.body?.slice(0, 90) || 'No messages yet'}</td><td>{fmtTime(item.updatedAt)}</td><td>{item.staffUnread ? <span className="adm-status" data-state="QUEUED">Needs reply</span> : 'Current'}</td><td><button className="adm-icon" onClick={() => onOpen(item.id)} aria-label={`Open messages for ${item.taskTitle}`}><ArrowRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><MessageCircle size={28} /><h3>No conversations found</h3><p>{search ? 'Try another search term.' : 'Task rooms will appear here when Students submit tasks.'}</p></div>}</section></>
}

function MessagesDetail({ data, reload, onBack }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try { await sendConversationReply(data.conversation.id, body.trim()); setBody(''); await reload() }
    catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }
  return <><button className="adm-back" onClick={onBack}><ArrowLeft size={16} /> Back to messages</button><header className="adm-case-head"><div><p className="adm-kicker">TASK ROOM / {shortId(data.conversation.taskId)}</p><h1>{data.conversation.taskTitle}</h1><p>Student conversation · {data.messages.length} messages</p></div></header><section className="adm-panel adm-conversation"><div className="adm-conversation-list">{data.messages.length ? data.messages.map((message) => <article key={message.id} className={message.from === 'student' ? 'is-student' : 'is-staff'}><div><strong>{message.author || (message.from === 'student' ? 'Student' : 'SolveNest')}</strong><time>{fmtTime(message.createdAt)}</time></div><p>{message.body}</p></article>) : <p className="adm-muted">No messages have been sent yet.</p>}</div><form onSubmit={send}><label htmlFor="adm-message-reply">Reply to Student</label><textarea id="adm-message-reply" rows={4} maxLength={4000} required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a clear reply…" />{error && <div className="adm-alert" role="alert">{error}</div>}<button className="adm-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send reply'} <ArrowRight size={15} /></button></form></section></>
}

function RefundQueue({ refunds, reload }) {
  const [notes, setNotes] = useState({})
  const [reviewed, setReviewed] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const pending = refunds.filter((item) => item.status === 'pending_admin')
  const decide = async (item, decision) => {
    const note = String(notes[item.id] || '').trim()
    if (note.length < 10) return setError('Record a decision note of at least 10 characters.')
    if (item.deliveredWork && !reviewed[item.id]) return setError('Confirm that you reviewed the completed work and accepted scope.')
    setBusy(item.id); setError('')
    try { await decideRefund(item.id, decision, note, Boolean(reviewed[item.id])); await reload() }
    catch (issue) { setError(issue.message) }
    finally { setBusy('') }
  }
  return <><header className="adm-heading"><div><p className="adm-kicker">FINANCE / REFUNDS</p><h1>Review refund requests.</h1><p>Check payment history, accepted scope, and delivered work before deciding.</p></div></header>{error && <div className="adm-alert" role="alert">{error}</div>}<section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">DECISION QUEUE</p><h2>Student requests</h2><p>{pending.length} waiting for Admin review</p></div></div>{pending.length ? <div className="adm-table-wrap"><table><thead><tr><th>Request</th><th>Amount</th><th>Reason</th><th>Review</th></tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td><strong>{item.taskTitle}</strong><small>{item.id} · {fmtDate(item.requestedAt)}</small></td><td>{String(item.currency).toUpperCase()} {Number(item.amount).toLocaleString()}<small>{item.highValue ? 'Second approval required' : item.deliveredWork ? 'Completed work review' : 'Standard review'}</small></td><td><p>{item.reason}</p>{item.expectedScope && <><strong>Accepted scope</strong><p>{item.expectedScope}</p></>}{item.deliveredDifference && <><strong>Claimed difference</strong><p>{item.deliveredDifference}</p></>}{item.evidenceReferences?.length > 0 && <small>Evidence: {item.evidenceReferences.join(' · ')}</small>}{item.workCompletedClaim && <small>Student says delivered work did not match the scope.</small>}</td><td><label>Decision note<textarea rows={3} maxLength={2000} value={notes[item.id] || ''} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>{item.deliveredWork && <label className="adm-check"><input type="checkbox" checked={Boolean(reviewed[item.id])} onChange={(event) => setReviewed({ ...reviewed, [item.id]: event.target.checked })} /> I reviewed the scope and delivered files</label>}<div className="adm-action-stack"><button className="adm-primary" disabled={busy === item.id} onClick={() => decide(item, 'approved')}>{item.highValue || item.deliveredWork || item.workCompletedClaim ? 'Send for second approval' : 'Approve refund'}</button><button className="adm-secondary" disabled={busy === item.id} onClick={() => decide(item, 'rejected')}>Reject</button></div></td></tr>)}</tbody></table></div> : <div className="adm-empty"><CheckCircle2 size={28} /><h3>No refund requests waiting</h3><p>New Student requests will appear here.</p></div>}</section></>
}

function ExpertApprovals({ experts, reload }) {
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const decide = async (expert, decision) => { const note = String(notes[expert.id] || '').trim(); if (note.length < 10) return setError('Add a decision note of at least 10 characters.'); setBusy(expert.id); setError(''); try { await reviewExpert(expert.id, decision, note); await reload() } catch (issue) { setError(issue.message) } finally { setBusy('') } }
  return <><header className="adm-heading"><div><p className="adm-kicker">PEOPLE / EXPERTS</p><h1>Verify Expert access.</h1><p>Approve complete profiles, suspend access when needed, and keep every decision traceable.</p></div></header>{error && <div className="adm-alert" role="alert">{error}</div>}<section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Expert directory</h2><p>{experts.length} Expert accounts</p></div></div>{experts.length ? <div className="adm-table-wrap"><table><thead><tr><th>Expert</th><th>Profile</th><th>Capacity</th><th>Access decision</th></tr></thead><tbody>{experts.map((expert) => <tr key={expert.id}><td><strong>{expert.name}</strong><small>{expert.email || expert.id}</small><span className="adm-status" data-state={expert.accountState}>{expert.accountState}</span></td><td><p>{expert.competencies.length ? expert.competencies.join(', ') : 'No competencies added'}</p><small>{expert.availability} · {expert.verified ? 'Identity verified' : 'Verification pending'} · {expert.experienceYears || 0} years</small>{expert.qualificationSummary && <small>{expert.qualificationSummary}</small>}{expert.portfolioUrl && <a href={expert.portfolioUrl} target="_blank" rel="noreferrer">View portfolio</a>}<small>{expert.payoutReady ? 'Payout profile ready' : 'Payout profile incomplete'} · Tax country {expert.taxCountry}</small></td><td>{expert.activeAssignments}/{expert.capacity}</td><td><label>Decision note<textarea rows={3} maxLength={2000} value={notes[expert.id] || ''} onChange={(event) => setNotes({ ...notes, [expert.id]: event.target.value })} /></label><div className="adm-action-stack">{expert.accountState !== 'approved' && <button className="adm-primary" disabled={busy === expert.id || !expert.competencies.length} onClick={() => decide(expert, expert.accountState === 'suspended' ? 'reactivate' : 'approve')}>{expert.accountState === 'suspended' ? 'Reactivate' : 'Approve Expert'}</button>}{expert.accountState === 'approved' && <button className="adm-secondary" disabled={busy === expert.id} onClick={() => decide(expert, 'suspend')}>Suspend access</button>}</div></td></tr>)}</tbody></table></div> : <div className="adm-empty"><ShieldCheck size={28} /><h3>No Expert accounts</h3><p>Registered Experts will appear here.</p></div>}</section></>
}

function PayoutQueue({ payouts, reload }) {
  const [forms, setForms] = useState({}); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const save = async (item, status) => { const form = forms[item.id] || {}; if (String(form.note || '').trim().length < 10) return setError('Add a decision note of at least 10 characters.'); if (status === 'paid' && String(form.reference || '').trim().length < 4) return setError('Add the bank or provider payment reference.'); setBusy(item.id); setError(''); try { await decidePayout(item.id, status, form.note, form.reference); await reload() } catch (issue) { setError(issue.message) } finally { setBusy('') } }
  return <><header className="adm-heading"><div><p className="adm-kicker">FINANCE / EXPERTS</p><h1>Settle Expert earnings.</h1><p>Approve payout requests, record the transfer reference, and retain a complete ledger.</p></div></header>{error && <div className="adm-alert" role="alert">{error}</div>}<section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Payout ledger</h2><p>{payouts.filter((item) => !['paid', 'rejected'].includes(item.status)).length} requests need action</p></div></div>{payouts.length ? <div className="adm-table-wrap"><table><thead><tr><th>Expert</th><th>Amount</th><th>Status</th><th>Decision</th></tr></thead><tbody>{payouts.map((item) => <tr key={item.id}><td><strong>{item.expertName}</strong><small>{item.id} · {item.taskIds.length} assignments</small></td><td>{String(item.currency).toUpperCase()} {Number(item.amount).toLocaleString()}<small>Fee {Number(item.platformFee).toLocaleString()}</small></td><td><span className="adm-status" data-state={item.status}>{item.status}</span></td><td>{['paid', 'rejected'].includes(item.status) ? <small>{item.paymentReference || item.history?.[0]?.note}</small> : <><label>Decision note<textarea rows={2} maxLength={2000} value={forms[item.id]?.note || ''} onChange={(event) => setForms({ ...forms, [item.id]: { ...forms[item.id], note: event.target.value } })} /></label>{item.status === 'approved' && <label>Payment reference<input value={forms[item.id]?.reference || ''} onChange={(event) => setForms({ ...forms, [item.id]: { ...forms[item.id], reference: event.target.value } })} /></label>}<div className="adm-action-stack"><button className="adm-primary" disabled={busy === item.id} onClick={() => save(item, item.status === 'pending' ? 'approved' : 'paid')}>{item.status === 'pending' ? 'Approve payout' : 'Mark paid'}</button><button className="adm-secondary" disabled={busy === item.id} onClick={() => save(item, 'rejected')}>Reject</button></div></>}</td></tr>)}</tbody></table></div> : <div className="adm-empty"><CreditCard size={28} /><h3>No payout requests</h3><p>Expert requests appear after funded work is delivered.</p></div>}</section></>
}

function OpportunityQueue({ interests, reload }) {
  const [form, setForm] = useState({ title: '', domain: '', deadline: '', summary: '' }); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const submit = async (event) => { event.preventDefault(); setBusy(true); setMessage(''); try { const result = await publishOpportunity(form); setMessage(`Published to ${result.published} Expert workspaces.`); setForm({ title: '', domain: '', deadline: '', summary: '' }); await reload() } catch (issue) { setMessage(issue.message) } finally { setBusy(false) } }
  return <><header className="adm-heading"><div><p className="adm-kicker">OPERATIONS / OPPORTUNITIES</p><h1>Match work with interest.</h1><p>Publish anonymized opportunities and use Expert interest as evidence during assignment.</p></div></header><div className="adm-case-grid"><form className="adm-panel adm-decision" onSubmit={submit}><p className="adm-kicker">NEW OPPORTUNITY</p><h2>Publish to eligible Experts</h2><label>Title<input required minLength={5} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Domain<input required maxLength={100} value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} /></label><label>Deadline<input type="date" required value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label>Scope summary<textarea required minLength={20} maxLength={2000} rows={5} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>{message && <p role="status">{message}</p>}<button className="adm-primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish opportunity'}</button></form><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Expert interest</h2><p>{interests.length} responses</p></div></div>{interests.length ? <div className="adm-table-wrap"><table><thead><tr><th>Opportunity</th><th>Expert</th><th>Received</th><th>Assignment</th></tr></thead><tbody>{interests.map((item) => <tr key={`${item.taskId}-${item.expertId}`}><td><strong>{item.title}</strong><small>{item.taskId}</small></td><td>{item.expertName}</td><td>{fmtTime(item.sentAt)}</td><td><button className="adm-secondary" onClick={() => go(item.taskId)}>Review task</button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><Bell size={28} /><h3>No interest received</h3><p>Responses appear here after Experts express interest.</p></div>}</section></div></>
}

function ExpertRequests({ requests, reload }) {
  const [notes, setNotes] = useState({}); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const decide = async (item, decision) => { const note = String(notes[item.id] || '').trim(); if (note.length < 10) return setError('Add a decision note of at least 10 characters.'); setBusy(item.id); setError(''); try { await decideExpertRequest(item.id, decision, note); await reload() } catch (issue) { setError(issue.message) } finally { setBusy('') } }
  const pending = requests.filter((item) => item.status === 'pending')
  return <><header className="adm-heading"><div><p className="adm-kicker">OPERATIONS / EXPERTS</p><h1>Assignment change requests.</h1><p>Review declines, reassignments, and deadline extensions without losing an audit trail.</p></div></header>{error && <div className="adm-alert">{error}</div>}<section className="adm-panel adm-queue">{pending.length ? <div className="adm-table-wrap"><table><thead><tr><th>Assignment</th><th>Request</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td><strong>{item.taskTitle}</strong><small>{item.expertName}</small></td><td>{item.type.replaceAll('_', ' ')}<small>{item.requestedDeadline ? fmtDate(item.requestedDeadline) : fmtTime(item.requestedAt)}</small></td><td>{item.reason}</td><td><label>Decision note<textarea rows={2} value={notes[item.id] || ''} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label><div className="adm-action-stack"><button className="adm-primary" disabled={busy === item.id} onClick={() => decide(item, 'approved')}>Approve</button><button className="adm-secondary" disabled={busy === item.id} onClick={() => decide(item, 'rejected')}>Reject</button></div></td></tr>)}</tbody></table></div> : <div className="adm-empty"><CheckCircle2 size={28} /><h3>No pending Expert requests</h3></div>}</section></>
}

function PaymentOperations({ payments, reload }) {
  const [notes, setNotes] = useState({})
  const [statuses, setStatuses] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const disputes = payments.filter((payment) => payment.dispute)
  const save = async (payment) => { const note = String(notes[payment.id] || '').trim(); const status = statuses[payment.id] || payment.dispute.status; setBusy(payment.id); setError(''); try { await updatePaymentDispute(payment.id, status, note); await reload() } catch (issue) { setError(issue.message) } finally { setBusy('') } }
  return <><header className="adm-heading"><div><p className="adm-kicker">FINANCE / DISPUTES</p><h1>Payment operations.</h1><p>Review chargebacks, keep provider state visible, and record each operational decision.</p></div></header>{error && <div className="adm-alert" role="alert">{error}</div>}<section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Stripe disputes</h2><p>{disputes.length} disputed payments</p></div></div>{disputes.length ? <div className="adm-table-wrap"><table><thead><tr><th>Payment</th><th>Provider state</th><th>Amount</th><th>Operations</th></tr></thead><tbody>{disputes.map((payment) => <tr key={payment.id}><td><strong>{payment.taskTitle || shortId(payment.taskId)}</strong><small>{payment.id} · {fmtTime(payment.createdAt)}</small></td><td><span className="adm-status" data-state={payment.dispute.status}>{payment.dispute.status}</span><small>{payment.dispute.id || 'Provider dispute'}</small></td><td>{String(payment.currency).toUpperCase()} {Number(payment.amount).toLocaleString()}</td><td><label>Status<select value={statuses[payment.id] || payment.dispute.status} onChange={(event) => setStatuses({ ...statuses, [payment.id]: event.target.value })}><option value="needs_response">Needs response</option><option value="under_review">Under review</option><option value="won">Won</option><option value="lost">Lost</option></select></label><label>Internal note<textarea rows={2} maxLength={2000} value={notes[payment.id] || ''} onChange={(event) => setNotes({ ...notes, [payment.id]: event.target.value })} /></label><button className="adm-secondary" disabled={busy === payment.id || String(notes[payment.id] || '').trim().length < 10} onClick={() => save(payment)}>{busy === payment.id ? 'Saving…' : 'Record update'}</button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><CheckCircle2 size={28} /><h3>No payment disputes</h3><p>Stripe chargebacks will appear automatically from verified webhooks.</p></div>}</section></>
}

function SolvyJobs({ jobs, reload }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const retry = async (id) => { setBusy(id); setError(''); try { await retrySolvyJob(id); await reload() } catch (issue) { setError(issue.message) } finally { setBusy('') } }
  const sorted = [...jobs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return <><header className="adm-heading"><div><p className="adm-kicker">OPERATIONS / SOLVY</p><h1>Analysis job operations.</h1><p>Track durable document analysis, usage, failures, versions, and retry eligible work.</p></div></header>{error && <div className="adm-alert" role="alert">{error}</div>}<section className="adm-panel adm-queue"><div className="adm-panel-head"><div><h2>Recent analysis jobs</h2><p>{sorted.length} jobs retained</p></div></div>{sorted.length ? <div className="adm-table-wrap"><table><thead><tr><th>Job</th><th>Status</th><th>Usage</th><th>Timing</th><th>Action</th></tr></thead><tbody>{sorted.map((job) => <tr key={job.id}><td><strong>{shortId(job.id)}</strong><small>{job.modelVersion || 'default model'} · {job.promptVersion || 'current prompt'}</small></td><td><span className="adm-status" data-state={job.status}>{job.status}</span>{job.errorCode && <small>{job.errorCode}</small>}</td><td>{job.fileIds?.length || 0} files<small>{job.estimatedCost ? `Estimated cost ${job.estimatedCost}` : 'No cost recorded'}</small></td><td>{fmtTime(job.createdAt)}<small>{job.attempts || 0} attempts</small></td><td>{job.status === 'failed' ? <button className="adm-secondary" disabled={busy === job.id} onClick={() => retry(job.id)}>{busy === job.id ? 'Queuing…' : 'Retry'}</button> : <small>{job.status === 'completed' ? 'Completed' : 'Worker will continue'}</small>}</td></tr>)}</tbody></table></div> : <div className="adm-empty"><Clock3 size={28} /><h3>No analysis jobs</h3><p>New Student analyses will appear here.</p></div>}</section></>
}

export function AdminWorkspace() {
  const [staffState, setStaffState] = useState({ loading: true, staff: null, error: null })
  const [overview, setOverview] = useState({ loading: true, data: null, error: null })
  const [caseState, setCaseState] = useState({ loading: false, data: null, error: null })
  const [supportQueue, setSupportQueue] = useState({ loading: true, data: null, error: null })
  const [supportCase, setSupportCase] = useState({ loading: false, data: null, error: null })
  const [qaQueue, setQaQueue] = useState({ loading: true, data: null, error: null })
  const [qaCase, setQaCase] = useState({ loading: false, data: null, error: null })
  const [messagesQueue, setMessagesQueue] = useState({ loading: true, data: null, error: null })
  const [messagesCase, setMessagesCase] = useState({ loading: false, data: null, error: null })
  const [refundQueue, setRefundQueue] = useState({ loading: true, data: null, error: null })
  const [expertQueue, setExpertQueue] = useState({ loading: true, data: null, error: null })
  const [expertRequests, setExpertRequests] = useState({ loading: true, data: null, error: null })
  const [payoutQueue, setPayoutQueue] = useState({ loading: true, data: null, error: null })
  const [paymentQueue, setPaymentQueue] = useState({ loading: true, data: null, error: null })
  const [opportunityQueue, setOpportunityQueue] = useState({ loading: true, data: null, error: null })
  const [solvyQueue, setSolvyQueue] = useState({ loading: true, data: null, error: null })
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
    try { const data = await getCase(id); const current = routeFromPath(); if (current.section === 'tasks' && current.id === id) setCaseState({ loading: false, data, error: null }) }
    catch (error) { setCaseState({ loading: false, data: null, error }) }
  }, [])
  const loadSupportQueue = useCallback(async () => {
    setSupportQueue((prev) => ({ ...prev, loading: true, error: null }))
    try { setSupportQueue({ loading: false, data: await getSupportQueue(), error: null }) }
    catch (error) { setSupportQueue({ loading: false, data: null, error }) }
  }, [])
  const loadSupportCase = useCallback(async (id) => {
    setSupportCase({ loading: true, data: null, error: null })
    try { const data = await getSupportCase(id); const current = routeFromPath(); if (current.section === 'support' && current.id === id) setSupportCase({ loading: false, data, error: null }) }
    catch (error) { setSupportCase({ loading: false, data: null, error }) }
  }, [])
  const loadQaQueue = useCallback(async () => {
    setQaQueue((prev) => ({ ...prev, loading: true, error: null }))
    try { setQaQueue({ loading: false, data: await getQaQueue(), error: null }) }
    catch (error) { setQaQueue({ loading: false, data: null, error }) }
  }, [])
  const loadQaCase = useCallback(async (id) => {
    setQaCase({ loading: true, data: null, error: null })
    try { const data = await getQaCase(id); const current = routeFromPath(); if (current.section === 'qa' && current.id === id) setQaCase({ loading: false, data, error: null }) }
    catch (error) { setQaCase({ loading: false, data: null, error }) }
  }, [])
  const loadMessagesQueue = useCallback(async () => {
    setMessagesQueue((prev) => ({ ...prev, loading: true, error: null }))
    try { setMessagesQueue({ loading: false, data: await getConversations(), error: null }) }
    catch (error) { setMessagesQueue({ loading: false, data: null, error }) }
  }, [])
  const loadMessagesCase = useCallback(async (id) => {
    setMessagesCase({ loading: true, data: null, error: null })
    try { const data = await getConversation(id); const current = routeFromPath(); if (current.section === 'messages' && current.id === id) setMessagesCase({ loading: false, data, error: null }); await markConversationRead(id); loadMessagesQueue() }
    catch (error) { setMessagesCase({ loading: false, data: null, error }) }
  }, [loadMessagesQueue])
  const loadRefundQueue = useCallback(async () => { setRefundQueue((prev) => ({ ...prev, loading: true, error: null })); try { setRefundQueue({ loading: false, data: await getRefundQueue(), error: null }) } catch (error) { setRefundQueue({ loading: false, data: null, error }) } }, [])
  const loadExpertQueue = useCallback(async () => { setExpertQueue((prev) => ({ ...prev, loading: true, error: null })); try { setExpertQueue({ loading: false, data: await getAssignableExperts(), error: null }) } catch (error) { setExpertQueue({ loading: false, data: null, error }) } }, [])
  const loadExpertRequests = useCallback(async () => { setExpertRequests((prev) => ({ ...prev, loading: true, error: null })); try { setExpertRequests({ loading: false, data: await getExpertRequests(), error: null }) } catch (error) { setExpertRequests({ loading: false, data: null, error }) } }, [])
  const loadPaymentQueue = useCallback(async () => { setPaymentQueue((prev) => ({ ...prev, loading: true, error: null })); try { setPaymentQueue({ loading: false, data: await getPaymentOperations(), error: null }) } catch (error) { setPaymentQueue({ loading: false, data: null, error }) } }, [])
  const loadPayoutQueue = useCallback(async () => { setPayoutQueue((prev) => ({ ...prev, loading: true, error: null })); try { setPayoutQueue({ loading: false, data: await getPayoutQueue(), error: null }) } catch (error) { setPayoutQueue({ loading: false, data: null, error }) } }, [])
  const loadOpportunityQueue = useCallback(async () => { setOpportunityQueue((prev) => ({ ...prev, loading: true, error: null })); try { setOpportunityQueue({ loading: false, data: await getOpportunityInterests(), error: null }) } catch (error) { setOpportunityQueue({ loading: false, data: null, error }) } }, [])
  const loadSolvyQueue = useCallback(async () => { setSolvyQueue((prev) => ({ ...prev, loading: true, error: null })); try { setSolvyQueue({ loading: false, data: await getSolvyJobs(), error: null }) } catch (error) { setSolvyQueue({ loading: false, data: null, error }) } }, [])
  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { const update = () => setRoute(routeFromPath()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  useEffect(() => { if (staffState.staff) { loadOverview(); loadSupportQueue(); loadQaQueue(); loadMessagesQueue(); loadRefundQueue(); loadExpertQueue(); loadExpertRequests(); loadPaymentQueue(); loadPayoutQueue(); loadOpportunityQueue(); loadSolvyQueue() } }, [staffState.staff, loadOverview, loadSupportQueue, loadQaQueue, loadMessagesQueue, loadRefundQueue, loadExpertQueue, loadExpertRequests, loadPaymentQueue, loadPayoutQueue, loadOpportunityQueue, loadSolvyQueue])
  useEffect(() => {
    if (!staffState.staff) return undefined
    const timer = window.setInterval(() => { loadOverview(); loadSupportQueue(); loadQaQueue(); loadMessagesQueue(); loadRefundQueue(); loadExpertQueue() }, 30_000)
    return () => window.clearInterval(timer)
  }, [staffState.staff, loadOverview, loadSupportQueue, loadQaQueue, loadMessagesQueue, loadRefundQueue, loadExpertQueue])
  useEffect(() => { if (!staffState.staff || !route.id) return; if (route.section === 'tasks') loadCase(route.id); if (route.section === 'support') loadSupportCase(route.id); if (route.section === 'qa') loadQaCase(route.id); if (route.section === 'messages') loadMessagesCase(route.id) }, [staffState.staff, route, loadCase, loadSupportCase, loadQaCase, loadMessagesCase])

  if (staffState.loading) return <div className="adm-gate"><div className="adm-loading" role="status">Loading Admin access…</div></div>
  if (staffState.error?.status === 401) return <Login onDone={loadStaff} />
  if (staffState.error) return <div className="adm-gate"><div className="adm-login"><p className="adm-kicker">COULD NOT CONNECT</p><h1>Admin access is unavailable.</h1><p>{staffState.error.message}</p><button className="adm-primary" onClick={loadStaff}>Try again <ArrowRight size={16} /></button></div></div>
  let content
  let state
  let retry
  if (route.section === 'expert-requests') {
    state = expertRequests; retry = loadExpertRequests
    if (state.data) content = <ExpertRequests requests={state.data.requests} reload={loadExpertRequests} />
  } else if (route.section === 'payments') {
    state = paymentQueue; retry = loadPaymentQueue
    if (state.data) content = <PaymentOperations payments={state.data.payments} reload={loadPaymentQueue} />
  } else if (route.section === 'solvy') {
    state = solvyQueue; retry = loadSolvyQueue
    if (state.data) content = <SolvyJobs jobs={state.data.jobs} reload={loadSolvyQueue} />
  } else if (route.section === 'opportunities') {
    state = opportunityQueue; retry = loadOpportunityQueue
    if (state.data) content = <OpportunityQueue interests={state.data.interests} reload={loadOpportunityQueue} />
  } else if (route.section === 'payouts') {
    state = payoutQueue; retry = loadPayoutQueue
    if (state.data) content = <PayoutQueue payouts={state.data.payouts} reload={loadPayoutQueue} />
  } else if (route.section === 'experts') {
    state = expertQueue
    retry = loadExpertQueue
    if (state.data) content = <ExpertApprovals experts={state.data.experts} reload={loadExpertQueue} />
  } else if (route.section === 'refunds') {
    state = refundQueue
    retry = loadRefundQueue
    if (state.data) content = <RefundQueue refunds={state.data.refunds} reload={loadRefundQueue} />
  } else if (route.section === 'messages') {
    state = route.id ? messagesCase : messagesQueue
    retry = () => route.id ? loadMessagesCase(route.id) : loadMessagesQueue()
    if (state.data) content = route.id ? <MessagesDetail key={route.id} data={state.data} reload={async () => { await Promise.all([loadMessagesCase(route.id), loadMessagesQueue()]) }} onBack={() => goSection('messages')} /> : <MessagesQueue conversations={state.data.conversations} onOpen={(id) => goSection('messages', id)} />
  } else if (route.section === 'support') {
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
  return <div className="adm-app"><AdminSidebar section={route.section} filter={filter} setFilter={setFilter} staff={staffState.staff} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><div className="adm-frame"><div className="adm-topbar"><button className="adm-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="admin-navigation"><Menu size={20} /></button><span>Admin <ChevronDown size={14} /> {route.section === 'tasks' ? 'Task intake' : route.section === 'qa' ? 'Quality review' : route.section === 'messages' ? 'Task messages' : route.section === 'refunds' ? 'Refund reviews' : route.section === 'experts' ? 'Expert approvals' : 'Support'}</span><div><span className="adm-role">{staffState.staff.demo ? 'LOCAL PREVIEW' : staffState.staff.role.toUpperCase()}</span>{!staffState.staff.demo && <button className="adm-icon" onClick={async () => { await logoutStaff().catch(() => {}); loadStaff() }} aria-label="Sign out"><LogOut size={18} /></button>}</div></div><main className="adm-content">{content}</main></div></div>
}
