import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock3, Crown, Database, LogOut, Menu, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react'
import { getStaff, loginStaff, logoutStaff } from '../../admin/adminApi.js'
import { changeRole, getActivity, getSuperOverview, getTeam, lookupTeamEmail } from '../../superadmin/superadminApi.js'
import '../Admin/admin-workspace.css'
import './superadmin-workspace.css'

const tabs = [['overview', 'Overview', Activity], ['team', 'Team access', Users], ['activity', 'Activity', ClipboardList], ['systems', 'Systems', Settings2]]
const validTabs = new Set(tabs.map(([key]) => key))
const currentTab = () => { const part = window.location.pathname.split('/')[2] || 'overview'; return validTabs.has(part) ? part : 'overview' }
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
const shortId = (value) => String(value || '').slice(0, 8).toUpperCase()
const roleOptions = ['Student', 'Expert', 'Admin', 'Superadmin']

function go(tab) {
  window.history.pushState({}, '', tab === 'overview' ? '/superadmin' : `/superadmin/${tab}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function LoadError({ error, retry }) { return <div className="adm-panel adm-error"><h2>Could not load this view</h2><p>{error.message}</p><button className="adm-primary" onClick={retry}>Try again <ArrowRight size={15} /></button></div> }
function Metric({ label, value, icon: Icon, tone }) { return <div className="adm-metric" data-tone={tone}><div><span>{label}</span><strong>{value ?? '—'}</strong></div><Icon size={22} /></div> }

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
    <div className="adm-login-mark"><Crown size={24} /></div>
    <p className="adm-kicker">SOLVENEST GOVERNANCE</p><h1>Super Admin sign in</h1><p>Use an approved Superadmin account to oversee the platform.</p>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="adm-alert" role="alert">{error}</div>}
    <button className="adm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Super Admin workspace'} <ArrowRight size={16} /></button>
    <a href="/">Return to SolveNest</a>
  </form></div>
}

function Sidebar({ active, setActive, staff, open, setOpen }) {
  return <><div className={`adm-scrim ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} />
    <aside className={`adm-sidebar ${open ? 'is-open' : ''}`}>
      <div className="adm-brand"><span className="adm-brand-mark" aria-hidden="true">S</span><span>SolveNest<small>SUPER ADMIN</small></span><button className="adm-mobile-close" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav aria-label="Super Admin navigation"><p className="adm-nav-label">GOVERNANCE</p>{tabs.map(([key, label, Icon]) => <button key={key} className={active === key ? 'is-active' : ''} onClick={() => { setActive(key); setOpen(false); go(key) }}><Icon size={17} /> {label}</button>)}<p className="adm-nav-label sad-nav-second">OPERATIONS</p><a className="sad-nav-link" href="/admin"><ShieldCheck size={17} /> Admin review queue <ArrowRight size={14} /></a></nav>
      <div className="adm-sidebar-foot"><span className="adm-avatar">{staff?.name?.slice(0, 1) || 'S'}</span><span><strong>{staff?.name || 'Super Admin'}</strong><small>{staff?.demo ? 'Local preview' : 'Superadmin'}</small></span></div>
    </aside></>
}

function Overview({ data, team, setActive }) {
  return <>
    <header className="adm-heading"><div><p className="adm-kicker">PLATFORM / OVERVIEW</p><h1>Everything in view.</h1><p>Track the work, access, and services that keep SolveNest running.</p></div><span className="adm-today">{fmtDate(new Date())}</span></header>
    <div className="sad-metrics"><Metric label="Total tasks" value={data.metrics.totalTasks} icon={ClipboardList} /><Metric label="Needs review" value={data.metrics.needsReview} icon={Bell} tone="amber" /><Metric label="In review" value={data.metrics.inReview} icon={Clock3} tone="blue" /><Metric label="Open support" value={data.metrics.supportOpen} icon={Activity} tone="green" /><Metric label="Staff accounts" value={team?.directory ? (team.directory.counts.Admin || 0) + (team.directory.counts.Superadmin || 0) : null} icon={Users} /></div>
    <div className="sad-overview-grid"><section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">OPERATIONS</p><h2>Recent tasks</h2></div><button className="sad-text-button" onClick={() => window.location.assign('/admin')}>Open queue <ArrowRight size={15} /></button></div>{data.recentTasks.length ? <div className="sad-task-list">{data.recentTasks.map((task) => <div key={task.id}><span><strong>{task.title}</strong><small>{shortId(task.id)} · {fmtDate(task.createdAt)}</small></span><span className="adm-status" data-state={task.reviewStatus}>{task.reviewStatus?.replace('_', ' ')}</span></div>)}</div> : <p className="adm-muted">No tasks have been submitted yet.</p>}</section>
      <section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">SYSTEM READINESS</p><h2>Connected services</h2></div><button className="sad-text-button" onClick={() => { setActive('systems'); go('systems') }}>View all <ArrowRight size={15} /></button></div><div className="sad-service-list">{data.services.map((service) => <div key={service.id}><span>{service.label}</span><span className={service.configured ? 'sad-service-ok' : 'sad-service-off'}>{service.configured ? 'Configured' : 'Needs setup'}</span></div>)}</div></section></div>
  </>
}

function RoleDialog({ person, staff, onClose, onSaved }) {
  const [role, setRole] = useState(person.role)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const self = person.id === staff.id
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) onClose() }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [busy, onClose])
  const review = (event) => { event.preventDefault(); setError(''); if (role === person.role) return setError('Choose a different role.'); if (note.trim().length < 10) return setError('Add a reason of at least 10 characters.'); setConfirm(true) }
  const save = async () => { setBusy(true); setError(''); try { await changeRole(person.id, person.role, role, note.trim()); await onSaved(); onClose() } catch (issue) { setError(issue.message); setConfirm(false) } finally { setBusy(false) } }
  return <div className="sad-dialog-backdrop" onClick={onClose}><section className="sad-dialog" role="dialog" aria-modal="true" aria-labelledby="sad-dialog-title" onClick={(event) => event.stopPropagation()}><div className="sad-dialog-head"><div><p className="adm-kicker">TEAM ACCESS</p><h2 id="sad-dialog-title">Manage {person.name}</h2><p>{person.email}</p></div><button className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    {self ? <div className="adm-callout"><strong>Your account is protected</strong><p>You cannot change your own role. Another Super Admin must manage it.</p></div> : confirm ? <><div className="sad-confirm"><span>{person.role}</span><ArrowRight size={18} /><span>{role}</span></div><p className="sad-confirm-copy">This change will update this account’s access. Active staff access is checked on each request.</p><div className="sad-reason"><strong>Reason</strong><p>{note.trim()}</p></div>{error && <div className="adm-alert" role="alert">{error}</div>}<div className="sad-dialog-actions"><button className="adm-secondary" disabled={busy} onClick={() => setConfirm(false)}>Back</button><button className="adm-primary" disabled={busy} onClick={save}>{busy ? 'Updating…' : 'Confirm role change'}</button></div></> : <form onSubmit={review}><label>New role<select value={role} onChange={(event) => setRole(event.target.value)}>{roleOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Reason for change<textarea rows={4} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why this access should change…" /></label><p className="sad-help">Expert access also needs a matching Expert workspace assignment.</p>{error && <div className="adm-alert" role="alert">{error}</div>}<div className="sad-dialog-actions"><button className="adm-secondary" type="button" onClick={onClose}>Cancel</button><button className="adm-primary" type="submit">Review change <ArrowRight size={15} /></button></div></form>}</section></div>
}

function Team({ data, staff, refresh }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const directory = data.directory
  const people = useMemo(() => (directory?.people || []).filter((person) => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(query.toLowerCase())), [directory, query])
  const lookup = async (event) => { event.preventDefault(); setLookupBusy(true); setLookupError(''); setLookupResult(null); try { const result = await lookupTeamEmail(lookupEmail.trim()); if (result.person) setLookupResult(result.person); else setLookupError('No SolveNest account was found with that email.') } catch (issue) { setLookupError(issue.message) } finally { setLookupBusy(false) } }
  return <><header className="adm-heading"><div><p className="adm-kicker">GOVERNANCE / TEAM</p><h1>Team access.</h1><p>See who can work in SolveNest and manage their roles.</p></div></header>
    {!directory ? <div className="adm-panel sad-inset"><Database size={28} /><h2>Connect Supabase to view staff accounts</h2><p>The local preview shows platform operations. Team access is available after signing in with a real Superadmin account.</p></div> : <><div className="adm-metrics"><Metric label="Students" value={directory.counts.Student} icon={Users} /><Metric label="Experts" value={directory.counts.Expert} icon={ShieldCheck} tone="blue" /><Metric label="Admins" value={directory.counts.Admin} icon={ClipboardList} tone="amber" /><Metric label="Super Admins" value={directory.counts.Superadmin} icon={Crown} tone="green" /></div><section className="adm-panel sad-lookup"><div><p className="adm-kicker">GRANT ACCESS</p><h2>Find an existing account</h2><p>Look up a registered Student by exact email, then assign a staff role.</p></div><form onSubmit={lookup}><input type="email" required placeholder="person@example.com" value={lookupEmail} onChange={(event) => setLookupEmail(event.target.value)} /><button className="adm-primary" disabled={lookupBusy}>{lookupBusy ? 'Finding…' : 'Find account'}</button></form>{lookupError && <div className="adm-alert" role="alert">{lookupError}</div>}{lookupResult && <div className="sad-found"><span><strong>{lookupResult.name}</strong><small>{lookupResult.email} · {lookupResult.role}</small></span><button className="sad-text-button" disabled={lookupResult.id === staff.id} onClick={() => setSelected(lookupResult)}>Manage access <ArrowRight size={15} /></button></div>}</section><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">ACCESS DIRECTORY</p><h2>Experts and administrators</h2><p>{directory.capped ? 'Showing the 200 newest accounts' : `${directory.people.length} accounts`}</p></div><label className="adm-search"><Search size={16} /><input type="search" placeholder="Search name, email or role" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>{people.length ? <div className="adm-table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Added</th><th>Access</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><div className="sad-person"><span className="adm-avatar">{person.name?.slice(0, 1) || '?'}</span><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td><td><span className="sad-role">{person.role}</span></td><td>{fmtDate(person.created_at)}</td><td><button className="sad-text-button" disabled={staff.demo || person.id === staff.id} onClick={() => setSelected(person)}>{person.id === staff.id ? 'Your account' : 'Manage'} <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><Users size={28} /><h3>No matching accounts</h3><p>Try a different search term.</p></div>}</section><p className="adm-footnote">New staff accounts must register before you can assign access.</p></>}
    {selected && <RoleDialog person={selected} staff={staff} onClose={() => setSelected(null)} onSaved={async () => { await refresh(); setLookupResult(null) }} />}</>
}

function ActivityView({ data }) { return <><header className="adm-heading"><div><p className="adm-kicker">GOVERNANCE / ACTIVITY</p><h1>Decision history.</h1><p>Recent Admin reviews and staff role changes in one place.</p></div></header><section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">LATEST EVENTS</p><h2>Platform activity</h2></div><span>{data.activity.length} events</span></div>{data.activity.length ? <ol className="adm-timeline sad-activity">{data.activity.map((item) => <li key={`${item.kind}-${item.id}`}><span className="adm-timeline-dot" /><div><strong>{item.kind === 'role' ? `Role changed: ${item.action}` : `Task review: ${item.action.replace('_', ' ')}`}</strong><small>{fmtTime(item.at)} · {item.actor} · {item.subject}</small>{item.note && <p>{item.note}</p>}</div></li>)}</ol> : <p className="adm-muted">No activity has been recorded yet.</p>}</section></> }

function Systems({ data }) { return <><header className="adm-heading"><div><p className="adm-kicker">GOVERNANCE / SYSTEMS</p><h1>Service readiness.</h1><p>See which integrations are configured for this environment.</p></div></header><div className="sad-system-grid">{data.services.map((service) => <div className="adm-panel sad-system" key={service.id}><div className="sad-system-icon">{service.configured ? <CheckCircle2 size={21} /> : <Settings2 size={21} />}</div><div><h2>{service.label}</h2><p>{service.configured ? 'Configuration detected' : 'Configuration needed before this service can run'}</p></div><span className={service.configured ? 'sad-service-ok' : 'sad-service-off'}>{service.configured ? 'Configured' : 'Needs setup'}</span></div>)}</div><div className="adm-footnote"><ShieldCheck size={17} /><span>This view checks configuration presence. It does not verify provider connectivity or expose credentials.</span></div></> }

export function SuperAdminWorkspace() {
  const [staff, setStaff] = useState({ loading: true, data: null, error: null })
  const [active, setActive] = useState(currentTab)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [overview, setOverview] = useState({ loading: true, data: null, error: null })
  const [team, setTeam] = useState({ loading: true, data: null, error: null })
  const [activity, setActivity] = useState({ loading: true, data: null, error: null })
  const loadStaff = useCallback(async () => { setStaff({ loading: true, data: null, error: null }); try { const result = await getStaff(); setStaff({ loading: false, data: result.staff, error: null }) } catch (error) { setStaff({ loading: false, data: null, error }) } }, [])
  const loadOverview = useCallback(async () => { setOverview((prev) => ({ ...prev, loading: true, error: null })); try { setOverview({ loading: false, data: await getSuperOverview(), error: null }) } catch (error) { setOverview({ loading: false, data: null, error }) } }, [])
  const loadTeam = useCallback(async () => { setTeam((prev) => ({ ...prev, loading: true, error: null })); try { setTeam({ loading: false, data: await getTeam(), error: null }) } catch (error) { setTeam({ loading: false, data: null, error }) } }, [])
  const loadActivity = useCallback(async () => { setActivity((prev) => ({ ...prev, loading: true, error: null })); try { setActivity({ loading: false, data: await getActivity(), error: null }) } catch (error) { setActivity({ loading: false, data: null, error }) } }, [])
  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { const update = () => setActive(currentTab()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  useEffect(() => { if (staff.data?.role === 'Superadmin') { loadOverview(); loadTeam(); loadActivity() } }, [staff.data, loadOverview, loadTeam, loadActivity])
  if (staff.loading) return <div className="adm-gate"><div className="adm-loading" role="status">Loading Super Admin access…</div></div>
  if (staff.error?.status === 401) return <Login onDone={loadStaff} />
  if (staff.error) return <div className="adm-gate"><div className="adm-login"><h1>Could not check access</h1><p>{staff.error.message}</p><button className="adm-primary" onClick={loadStaff}>Try again</button></div></div>
  if (staff.data?.role !== 'Superadmin') return <div className="adm-gate"><div className="adm-login"><div className="adm-login-mark"><ShieldCheck size={24} /></div><p className="adm-kicker">ACCESS RESTRICTED</p><h1>Super Admin access is required.</h1><p>Your account can still use its assigned workspace.</p><a href="/admin">Open Admin workspace</a>{!staff.data?.demo && <button className="adm-secondary" onClick={async () => { await logoutStaff().catch(() => {}); loadStaff() }}>Sign out and use another account</button>}</div></div>
  const current = active === 'team' ? team : active === 'activity' ? activity : overview
  const retry = active === 'team' ? loadTeam : active === 'activity' ? loadActivity : loadOverview
  return <div className="adm-app sad-app"><Sidebar active={active} setActive={setActive} staff={staff.data} open={mobileOpen} setOpen={setMobileOpen} /><div className="adm-frame"><div className="adm-topbar"><button className="adm-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span>Super Admin <ChevronDown size={14} /> {tabs.find(([key]) => key === active)?.[1]}</span><div><span className="adm-role">{staff.data.demo ? 'LOCAL PREVIEW' : 'SUPERADMIN'}</span>{!staff.data.demo && <button className="adm-icon" onClick={async () => { await logoutStaff().catch(() => {}); loadStaff() }} aria-label="Sign out"><LogOut size={18} /></button>}</div></div><main className="adm-content">{current.loading ? <div className="adm-loading" role="status">Loading {active}…</div> : current.error ? <LoadError error={current.error} retry={retry} /> : active === 'overview' ? <Overview data={overview.data} team={team.data} setActive={setActive} /> : active === 'team' ? <Team data={team.data} staff={staff.data} refresh={async () => { await Promise.all([loadTeam(), loadActivity()]) }} /> : active === 'activity' ? <ActivityView data={activity.data} /> : <Systems data={overview.data} />}</main></div></div>
}
