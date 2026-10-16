import { useNavigationDialog } from '../../shared/useNavigationDialog.js'
import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, CheckCircle2, ChevronRight, ClipboardList, Crown, Database, LogOut, Menu, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react'
import { changeRole, decideRoleApproval, getActivity, getSuperOverview, getSuperStaff, getTeam, loginSuperadmin, logoutSuperadmin, lookupTeamEmail } from '../../superadmin/superadminApi.js'
import logo from '../../assets/logo-mark.webp'
import '../Admin/admin-workspace.css'
import './superadmin-workspace.css'

const tabs = [['overview', 'Overview', Activity], ['team', 'Team access', Users], ['activity', 'Activity', ClipboardList], ['systems', 'Systems', Settings2]]
const validTabs = new Set(tabs.map(([key]) => key))
const currentTab = () => { const part = window.location.pathname.split('/')[2] || 'overview'; return validTabs.has(part) ? part : 'overview' }
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
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
  const [otp, setOtp] = useState('')
  const [mfa, setMfa] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await loginSuperadmin(email.trim(), password, otp, mfa?.factorId); onDone() }
    catch (issue) { if (issue.mfa) setMfa(issue.mfa); setError(issue.message); setBusy(false) }
  }
  return <div className="adm-gate"><form className="adm-login" onSubmit={submit}>
    <div className="adm-login-mark"><Crown size={24} /></div>
    <p className="adm-kicker">SOLVENEST GOVERNANCE</p><h1>Super Admin sign in</h1><p>Use an approved Superadmin account to oversee the platform.</p>
    <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {mfa && <><div className="adm-callout"><strong>{mfa.enrolled ? 'Two-step verification' : 'Set up two-step verification'}</strong>{!mfa.enrolled && <><p>Add this account to your authenticator app, then enter its six-digit code.</p>{mfa.qrCode && <img src={mfa.qrCode} alt="Authenticator setup QR code" width="180" height="180" />}{mfa.secret && <code>{mfa.secret}</code>}</>}</div><label>Verification code<input type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label></>}
    {error && <div className="adm-alert" role="alert">{error}</div>}
    <button className="adm-primary" disabled={busy}>{busy ? 'Signing in…' : 'Open Super Admin workspace'} <ArrowRight size={16} /></button>
    <a href="/">Return to SolveNest</a>
  </form></div>
}

function ControlNav({ active, staff, onSignOut, mobileOpen, setMobileOpen }) {
  useNavigationDialog(mobileOpen, () => setMobileOpen(false), '.sad-sidebar')
  const select = (key) => { setMobileOpen(false); go(key) }
  return <><div className={`sad-nav-scrim ${mobileOpen ? 'is-open' : ''}`} onClick={() => setMobileOpen(false)} /><aside id="superadmin-navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} className={`sad-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Super Admin navigation"><div className="sad-sidebar-brand"><img src={logo} alt="SolveNest" /><span>SolveNest<small>SUPER ADMIN</small></span><button onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div><nav><p>GOVERNANCE</p>{tabs.map(([key, label, Icon]) => <button key={key} className={active === key ? 'is-active' : ''} onClick={() => select(key)}><Icon size={17} /><span>{label}</span></button>)}</nav><div className="sad-sidebar-profile"><span className="sad-control-profile">{staff.name?.slice(0, 1) || 'S'}</span><span><strong>{staff.name}</strong><small>{staff.demo ? 'Local preview' : 'Super Admin'}</small></span>{!staff.demo && <button onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button>}</div></aside></>
}

function Overview({ data, team, setActive }) {
  const attention = data.metrics.needsReview + data.metrics.qaWaiting + data.metrics.supportOpen
  const ready = data.services.filter((service) => service.configured).length
  const fraction = data.services.length ? Math.round(ready / data.services.length * 100) : 0
  const staffCount = team?.directory ? (team.directory.counts.Admin || 0) + (team.directory.counts.Superadmin || 0) : null
  return <>
    <section className="sad-hero"><div className="sad-hero-copy"><p className="sad-eyebrow"><span /> PLATFORM COMMAND / {fmtDate(new Date()).toUpperCase()}</p><h1>Keep the whole<br /><em>system in focus.</em></h1><p>Govern access, audit decisions, and monitor platform readiness from one protected workspace.</p><div className="sad-hero-actions"><button onClick={() => { setActive('activity'); go('activity') }}>View decision history <ArrowRight size={16} /></button></div></div><div className="sad-orbit" style={{ '--sad-fill': `${Math.min(100, Math.round(attention / Math.max(1, data.metrics.totalTasks + data.metrics.supportOpen + data.metrics.qaWaiting) * 100))}%` }}><div className="sad-orbit-ring"><div><span>OPERATING SIGNALS</span><strong>{attention}</strong><small>visible across the platform</small></div></div><span className="sad-orbit-dot one" /><span className="sad-orbit-dot two" /><span className="sad-orbit-dot three" /></div></section>
    <div className="sad-signal-row"><article><span className="sad-signal-number">01</span><span><small>INTAKE SIGNAL</small><strong>{data.metrics.needsReview} awaiting review</strong><em>{data.metrics.totalTasks} total tasks</em></span></article><article><span className="sad-signal-number">02</span><span><small>QUALITY SIGNAL</small><strong>{data.metrics.qaWaiting} awaiting approval</strong><em>Expert submissions</em></span></article><article><span className="sad-signal-number">03</span><span><small>SUPPORT SIGNAL</small><strong>{data.metrics.supportOpen} open requests</strong><em>Student service desk</em></span></article></div>
    <div className="sad-command-grid"><section className="sad-command-panel sad-readiness"><div className="sad-command-head"><div><p className="sad-eyebrow">INFRASTRUCTURE</p><h2>Service map</h2></div><button onClick={() => { setActive('systems'); go('systems') }}>Inspect systems <ArrowRight size={15} /></button></div><div className="sad-readiness-score"><strong>{ready}<span>/{data.services.length}</span></strong><div><b>services configured</b><small>Configuration presence, not live uptime</small></div><span className="sad-ready-bar"><i style={{ width: `${fraction}%` }} /></span></div><div className="sad-service-map">{data.services.map((service) => <div key={service.id}><span className={service.configured ? 'is-ready' : ''} /><span>{service.label}</span><small>{service.configured ? 'READY' : 'SETUP NEEDED'}</small></div>)}</div></section><section className="sad-command-panel sad-people"><div className="sad-command-head"><div><p className="sad-eyebrow">ACCESS GOVERNANCE</p><h2>The people layer</h2></div><button onClick={() => { setActive('team'); go('team') }}>Manage access <ArrowRight size={15} /></button></div><div className="sad-people-value"><Users size={29} /><strong>{staffCount ?? '—'}</strong><span>Admin and Super Admin accounts</span></div><div className="sad-people-breakdown"><span>Experts <b>{team?.directory?.counts.Expert ?? '—'}</b></span><span>Students <b>{team?.directory?.counts.Student ?? '—'}</b></span></div><p>Role changes are reviewed and recorded in the governance history.</p></section></div>
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
  const [page, setPage] = useState(1)
  const [listing, setListing] = useState(data.directory)
  const [listError, setListError] = useState('')
  const [listBusy, setListBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [decisionBusy, setDecisionBusy] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const directory = listing
  const people = directory?.people || []
  useEffect(() => {
    if (!data.directory) return undefined
    let current = true
    const timer = setTimeout(async () => {
      setListBusy(true)
      try { const result = await getTeam({ page, search: query }); if (current) { setListing(result.directory); setListError('') } }
      catch (error) { if (current) setListError(error.message) }
      finally { if (current) setListBusy(false) }
    }, query ? 300 : 0)
    return () => { current = false; clearTimeout(timer) }
  }, [data.directory, page, query])
  const lookup = async (event) => { event.preventDefault(); setLookupBusy(true); setLookupError(''); setLookupResult(null); try { const result = await lookupTeamEmail(lookupEmail.trim()); if (result.person) setLookupResult(result.person); else setLookupError('No SolveNest account was found with that email.') } catch (issue) { setLookupError(issue.message) } finally { setLookupBusy(false) } }
  const decide = async (id, decision) => { setDecisionBusy(id); setDecisionError(''); try { await decideRoleApproval(id, decision); await refresh() } catch (issue) { setDecisionError(issue.message) } finally { setDecisionBusy('') } }
  return <><header className="adm-heading"><div><p className="adm-kicker">GOVERNANCE / TEAM</p><h1>Team access.</h1><p>See who can work in SolveNest and manage their roles.</p></div></header>
    {!directory ? <div className="adm-panel sad-inset"><Database size={28} /><h2>Connect Supabase to view staff accounts</h2><p>The local preview shows platform operations. Team access is available after signing in with a real Superadmin account.</p></div> : <><div className="adm-metrics"><Metric label="Students" value={directory.counts.Student} icon={Users} /><Metric label="Experts" value={directory.counts.Expert} icon={ShieldCheck} tone="blue" /><Metric label="Admins" value={directory.counts.Admin} icon={ClipboardList} tone="amber" /><Metric label="Super Admins" value={directory.counts.Superadmin} icon={Crown} tone="green" /></div>{data.approvals?.length > 0 && <section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">SECOND APPROVAL</p><h2>Super Admin access requests</h2><p>A different Super Admin must approve each grant within 24 hours.</p></div></div>{decisionError && <div className="adm-alert" role="alert">{decisionError}</div>}<div className="adm-table-wrap"><table><thead><tr><th>Person</th><th>Requested by</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{data.approvals.map((item) => <tr key={item.id}><td><strong>{item.target?.name || item.target_id}</strong><small>{item.target?.email}</small></td><td>{item.requester?.name || item.requested_by}</td><td>{item.note}</td><td><div className="sad-dialog-actions"><button className="adm-secondary" disabled={decisionBusy === item.id || item.requested_by === staff.id} onClick={() => decide(item.id, 'rejected')}>Reject</button><button className="adm-primary" disabled={decisionBusy === item.id || item.requested_by === staff.id} onClick={() => decide(item.id, 'approved')}>{item.requested_by === staff.id ? 'Second approver required' : decisionBusy === item.id ? 'Saving…' : 'Approve'}</button></div></td></tr>)}</tbody></table></div></section>}<section className="adm-panel sad-lookup"><div><p className="adm-kicker">GRANT ACCESS</p><h2>Find an existing account</h2><p>Look up a registered Student by exact email, then assign a staff role.</p></div><form onSubmit={lookup}><input type="email" required placeholder="person@example.com" value={lookupEmail} onChange={(event) => setLookupEmail(event.target.value)} /><button className="adm-primary" disabled={lookupBusy}>{lookupBusy ? 'Finding…' : 'Find account'}</button></form>{lookupError && <div className="adm-alert" role="alert">{lookupError}</div>}{lookupResult && <div className="sad-found"><span><strong>{lookupResult.name}</strong><small>{lookupResult.email} · {lookupResult.role}</small></span><button className="sad-text-button" disabled={lookupResult.id === staff.id} onClick={() => setSelected(lookupResult)}>Manage access <ArrowRight size={15} /></button></div>}</section><section className="adm-panel adm-queue"><div className="adm-panel-head"><div><p className="adm-kicker">ACCESS DIRECTORY</p><h2>Experts and administrators</h2><p>{`${directory.total} accounts · page ${directory.page} of ${directory.pages}`}</p></div><label className="adm-search"><Search size={16} /><input type="search" placeholder="Search name, email or role" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></label></div>{people.length ? <div className="adm-table-wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Added</th><th>Access</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><div className="sad-person"><span className="adm-avatar">{person.name?.slice(0, 1) || '?'}</span><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td><td><span className="sad-role">{person.role}</span></td><td>{fmtDate(person.created_at)}</td><td><button className="sad-text-button" disabled={staff.demo || person.id === staff.id} onClick={() => setSelected(person)}>{person.id === staff.id ? 'Your account' : 'Manage'} <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div> : <div className="adm-empty"><Users size={28} /><h3>No matching accounts</h3><p>Try a different search term.</p></div>}{listError && <div className="adm-alert" role="alert">{listError}</div>}{listBusy && <p className="adm-muted" role="status">Loading directory…</p>}<div className="sad-pagination"><button className="adm-secondary" disabled={page <= 1 || listBusy} onClick={() => setPage(page - 1)}>Previous</button><span>Page {directory.page} of {directory.pages}</span><button className="adm-secondary" disabled={page >= directory.pages || listBusy} onClick={() => setPage(page + 1)}>Next</button></div></section><p className="adm-footnote">New staff accounts must register before you can assign access.</p></>}
    {selected && <RoleDialog person={selected} staff={staff} onClose={() => setSelected(null)} onSaved={async () => { await refresh(); setLookupResult(null) }} />}</>
}

function ActivityView({ data }) { const labels = { role: 'Role changed', review: 'Task review', quality: 'Quality review', support: 'Support update' }; return <><header className="adm-heading"><div><p className="adm-kicker">GOVERNANCE / ACTIVITY</p><h1>Decision history.</h1><p>Task, quality, support, and access decisions in one place.</p></div></header><section className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">LATEST EVENTS</p><h2>Platform activity</h2></div><span>{data.activity.length} events</span></div>{data.activity.length ? <ol className="adm-timeline sad-activity">{data.activity.map((item) => <li key={`${item.kind}-${item.id}`}><span className="adm-timeline-dot" /><div><strong>{labels[item.kind] || 'Activity'}: {item.action.replaceAll('_', ' ')}</strong><small>{fmtTime(item.at)} · {item.actor} · {item.subject}</small>{item.note && <p>{item.note}</p>}</div></li>)}</ol> : <p className="adm-muted">No activity has been recorded yet.</p>}</section></> }

function Systems({ data }) { const ready = data.services.filter((service) => service.configured).length; const notes = { auth: 'Supabase credentials for secure account sign in.', data: 'Persistent application state in Supabase.', storage: 'Private file storage for Student and Expert materials.', analysis: 'Solvy endpoint and key for document analysis.', payments: 'Stripe key and webhook for payment events.', email: 'SMTP transport for account and support messages.' }; return <><section className="sad-systems-intro"><div><p className="sad-eyebrow">PLATFORM / SYSTEMS</p><h1>Know what is<br />ready to run.</h1><p>Configuration signals from the server environment. No credentials are shown here.</p></div><div><strong>{ready}<span> / {data.services.length}</span></strong><small>services configured</small></div></section><section className="sad-systems-list" aria-label="Service configuration">{data.services.map((service, index) => <div key={service.id}><span className="sad-systems-index">0{index + 1}</span><span className="sad-system-icon">{service.configured ? <CheckCircle2 size={21} /> : <Settings2 size={21} />}</span><span className="sad-systems-description"><strong>{service.label}</strong><small>{notes[service.id]}</small></span><span className={service.configured ? 'sad-service-ok' : 'sad-service-off'}>{service.configured ? 'Configured' : 'Needs setup'}</span></div>)}</section><div className="adm-footnote"><ShieldCheck size={17} /><span>Configuration presence does not verify provider connectivity or uptime.</span></div></> }

export function SuperAdminWorkspace() {
  const [staff, setStaff] = useState({ loading: true, data: null, error: null })
  const [active, setActive] = useState(currentTab)
  const [overview, setOverview] = useState({ loading: true, data: null, error: null })
  const [team, setTeam] = useState({ loading: true, data: null, error: null })
  const [activity, setActivity] = useState({ loading: true, data: null, error: null })
  const [mobileOpen, setMobileOpen] = useState(false)
  const loadStaff = useCallback(async () => { setStaff({ loading: true, data: null, error: null }); try { const result = await getSuperStaff(); setStaff({ loading: false, data: result.staff, error: null }) } catch (error) { setStaff({ loading: false, data: null, error }) } }, [])
  const loadOverview = useCallback(async () => { setOverview((prev) => ({ ...prev, loading: true, error: null })); try { setOverview({ loading: false, data: await getSuperOverview(), error: null }) } catch (error) { setOverview({ loading: false, data: null, error }) } }, [])
  const loadTeam = useCallback(async () => { setTeam((prev) => ({ ...prev, loading: true, error: null })); try { setTeam({ loading: false, data: await getTeam(), error: null }) } catch (error) { setTeam({ loading: false, data: null, error }) } }, [])
  const loadActivity = useCallback(async () => { setActivity((prev) => ({ ...prev, loading: true, error: null })); try { setActivity({ loading: false, data: await getActivity(), error: null }) } catch (error) { setActivity({ loading: false, data: null, error }) } }, [])
  useEffect(() => { loadStaff() }, [loadStaff])
  useEffect(() => { const update = () => setActive(currentTab()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  useEffect(() => { if (staff.data?.role === 'Superadmin') { loadOverview(); loadTeam(); loadActivity() } }, [staff.data, loadOverview, loadTeam, loadActivity])
  if (staff.loading) return <div className="adm-gate"><div className="adm-loading" role="status">Loading Super Admin access…</div></div>
  if (staff.error?.status === 401) return <Login onDone={loadStaff} />
  if (staff.error) return <div className="adm-gate"><div className="adm-login"><h1>Could not check access</h1><p>{staff.error.message}</p><button className="adm-primary" onClick={loadStaff}>Try again</button></div></div>
  if (staff.data?.role !== 'Superadmin') return <div className="adm-gate"><div className="adm-login"><div className="adm-login-mark"><ShieldCheck size={24} /></div><p className="adm-kicker">ACCESS RESTRICTED</p><h1>Super Admin access is required.</h1><p>Sign in with an approved Super Admin account.</p><a href="/">Return to SolveNest</a>{!staff.data?.demo && <button className="adm-secondary" onClick={async () => { await logoutSuperadmin().catch(() => {}); loadStaff() }}>Sign out</button>}</div></div>
  const current = active === 'team' ? team : active === 'activity' ? activity : overview
  const retry = active === 'team' ? loadTeam : active === 'activity' ? loadActivity : loadOverview
  const activeLabel = tabs.find(([key]) => key === active)?.[1] || 'Overview'
  const signOut = async () => { await logoutSuperadmin().catch(() => {}); loadStaff() }
  return <div className="sad-app"><ControlNav active={active} staff={staff.data} onSignOut={signOut} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><div className="sad-frame"><header className="sad-topbar"><div><button onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="superadmin-navigation"><Menu size={20} /></button><span>Super Admin</span><ChevronRight size={14} /><strong>{activeLabel}</strong></div><span className="sad-role-pill">GOVERNANCE</span></header><main className="sad-main">{staff.data.demo && <div className="sad-preview">LOCAL PREVIEW · Team access changes require a real Superadmin account.</div>}{current.loading ? <div className="adm-loading" role="status">Loading {active}…</div> : current.error ? <LoadError error={current.error} retry={retry} /> : active === 'overview' ? <Overview data={overview.data} team={team.data} setActive={setActive} /> : active === 'team' ? <Team data={team.data} staff={staff.data} refresh={async () => { await Promise.all([loadTeam(), loadActivity()]) }} /> : active === 'activity' ? <ActivityView data={activity.data} /> : <Systems data={overview.data} />}</main></div></div>
}
