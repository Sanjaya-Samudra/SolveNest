import { useEffect, useMemo, useState } from 'react'
import { LogOut, ShieldCheck, Radio } from 'lucide-react'
import { useExpertAccountGate, useExpertDashboard } from '../../expert/expertDashboardData.js'
import { parseAssignmentRoute } from '../../expert/assignmentState.js'
import { fetchExpertEarnings, requestExpertPayout, signOutExpert, updateExpertProfile } from '../../expert/expertApi.js'
import './expert-dashboard.css'
import { ExpertAppShell, ExpertGate, goExpert } from './ExpertAppShell.jsx'
import {
  ExpertAvailabilityControl,
  ExpertDashboardPage,
  ExpertDashboardSkeletons,
  RecentMovement,
} from './ExpertDashboardPage.jsx'
import { ExpertAssignments } from './ExpertAssignments.jsx'
import { ExpertAssignmentWorkspace } from './ExpertAssignmentWorkspace.jsx'
import { ExpertAvailableForYou } from './ExpertAvailableForYou.jsx'

function currentPath() {
  return window.location.pathname.startsWith('/expert') ? window.location.pathname : '/expert/dashboard'
}

function normalizePath(path) {
  if (path === '/expert') return '/expert/dashboard'
  return path
}

function ActivitySection({ dashboard }) {
  return (
    <div className="exp-section">
      <header className="exp-section-head">
        <p className="exp-overline">ACTIVITY</p>
        <h1>Recent movement</h1>
        <p>Assignment, QA, delivery, and clarification events from your workspace.</p>
      </header>
      <RecentMovement movement={dashboard.movement} />
    </div>
  )
}

function NotificationsSection({ dashboard }) {
  useEffect(() => {
    fetch('/api/expert/notifications/read-all', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } }).then(() => dashboard.reload()).catch(() => {})
  }, [])
  const notifications = dashboard.workspace?.notifications || []
  return (
    <div className="exp-section">
      <header className="exp-section-head">
        <p className="exp-overline">NOTIFICATIONS</p>
        <h1>Notifications</h1>
        <p>Unread items are marked. Opening this page clears nothing — use each item&apos;s route to act.</p>
      </header>
      <section className="exp-panel">
        {notifications.length === 0 ? (
          <div className="exp-empty">
            <span className="exp-empty-icon" aria-hidden="true"><Radio size={22} /></span>
            <p className="exp-empty-title">You are all caught up</p>
            <p className="exp-empty-body">Assignment, QA, and message notifications appear here.</p>
          </div>
        ) : (
          <ul className="exp-movement-list">
            {notifications.map((item) => (
              <li key={item.id} className={item.isRead ? '' : 'is-unread'}>
                <span className="exp-movement-icon" aria-hidden="true" />
                <button type="button" onClick={() => item.route && goExpert(item.route)} disabled={!item.route}>
                  <strong>{item.title}</strong>
                  {item.body && <small>{item.body}</small>}
                </button>
                <time>{item.at ? new Date(item.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AccountSection({ dashboard, gate }) {
  const expert = dashboard.expert || gate.expert
  const availability = dashboard.availability || gate.availability
  const accountState = dashboard.accountState || gate.accountState
  const [profile, setProfile] = useState(() => ({ capacity: expert?.capacity || 4, competencies: (expert?.competencies || []).join(', '), conflictDomains: (expert?.conflictDomains || []).join(', '), timezone: expert?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', qualificationSummary: expert?.qualificationSummary || '', portfolioUrl: expert?.portfolioUrl || '', experienceYears: expert?.experienceYears || 0, payoutMethod: expert?.payoutMethod || '', payoutAccountName: expert?.payoutAccountName || '', payoutAccountLast4: expert?.payoutAccountLast4 || '', taxCountry: expert?.taxCountry || 'LK', taxIdentifierLast4: expert?.taxIdentifierLast4 || '' }))
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const saveProfile = async (event) => {
    event.preventDefault(); setProfileBusy(true); setProfileMessage('')
    try {
      await updateExpertProfile({ ...profile, capacity: Number(profile.capacity), experienceYears: Number(profile.experienceYears), competencies: profile.competencies.split(',').map((item) => item.trim()).filter(Boolean), conflictDomains: profile.conflictDomains.split(',').map((item) => item.trim()).filter(Boolean), timezone: profile.timezone.trim() })
      setProfileMessage('Assignment profile saved.'); dashboard.reload?.()
    } catch (error) { setProfileMessage(error.serverMessage || 'The assignment profile could not be saved.') }
    finally { setProfileBusy(false) }
  }

  return (
    <div className="exp-section">
      <header className="exp-section-head">
        <p className="exp-overline">ACCOUNT</p>
        <h1>{expert?.name || 'Expert account'}</h1>
        <p>{expert?.title || 'SolveNest Expert'}</p>
      </header>
      <div className="exp-account-grid">
        <section className="exp-panel">
          <div className="exp-panel-head">
            <div>
              <p className="exp-overline">PROFILE</p>
              <h3>Expert identity</h3>
            </div>
            <ShieldCheck size={17} aria-hidden="true" />
          </div>
          <dl className="exp-account-list">
            <div>
              <dt>Name</dt>
              <dd>{expert?.name || '—'}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{expert?.title || '—'}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>{expert?.verified ? 'Verified' : 'Not verified'}</dd>
            </div>
            <div>
              <dt>Account state</dt>
              <dd>{accountState === 'approved' ? 'Approved' : accountState === 'pending' ? 'Pending review' : 'Suspended'}</dd>
            </div>
          </dl>
          <button
            className="exp-button exp-button--secondary"
            onClick={async () => {
              try {
                await signOutExpert()
              } catch {}
              goExpert('/expert/login')
            }}
          >
            <LogOut size={15} />
            Sign out of expert workspace
          </button>
        </section>
        <div><ExpertAvailabilityControl availability={availability} /><form className="exp-panel" onSubmit={saveProfile}><div className="exp-panel-head"><div><p className="exp-overline">ASSIGNMENT FIT</p><h3>Capacity and expertise</h3></div></div><label>Maximum active assignments<input type="number" min="1" max="20" value={profile.capacity} onChange={(event) => setProfile({ ...profile, capacity: event.target.value })} /></label><label>Competencies<textarea required rows="3" value={profile.competencies} onChange={(event) => setProfile({ ...profile, competencies: event.target.value })} placeholder="Data analysis, Economics, Research methods" /><small>Separate specialties with commas.</small></label><label>Conflict domains<textarea rows="2" value={profile.conflictDomains} onChange={(event) => setProfile({ ...profile, conflictDomains: event.target.value })} placeholder="Organizations or subjects you cannot accept" /></label><label>Timezone<input required value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} placeholder="Asia/Colombo" /></label><label>Qualifications and experience<textarea rows="4" maxLength="2000" value={profile.qualificationSummary} onChange={(event) => setProfile({ ...profile, qualificationSummary: event.target.value })} placeholder="Degrees, certifications, and relevant professional experience" /></label><label>Years of experience<input type="number" min="0" max="60" value={profile.experienceYears} onChange={(event) => setProfile({ ...profile, experienceYears: event.target.value })} /></label><label>Portfolio URL<input type="url" value={profile.portfolioUrl} onChange={(event) => setProfile({ ...profile, portfolioUrl: event.target.value })} placeholder="https://…" /></label><p className="exp-overline">PAYOUT AND TAX</p><label>Payout method<input maxLength="80" value={profile.payoutMethod} onChange={(event) => setProfile({ ...profile, payoutMethod: event.target.value })} placeholder="Bank transfer" /></label><label>Account holder name<input maxLength="120" value={profile.payoutAccountName} onChange={(event) => setProfile({ ...profile, payoutAccountName: event.target.value })} /></label><label>Account last four digits<input inputMode="numeric" pattern="[0-9]{0,4}" maxLength="4" value={profile.payoutAccountLast4} onChange={(event) => setProfile({ ...profile, payoutAccountLast4: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label><label>Tax country<input maxLength="2" value={profile.taxCountry} onChange={(event) => setProfile({ ...profile, taxCountry: event.target.value.toUpperCase().slice(0, 2) })} /></label><label>Tax ID last four characters<input maxLength="4" value={profile.taxIdentifierLast4} onChange={(event) => setProfile({ ...profile, taxIdentifierLast4: event.target.value.slice(0, 4) })} /><small>Only a masked reference is stored here. Never enter a full tax or bank identifier.</small></label>{profileMessage && <p role="status">{profileMessage}</p>}<button className="exp-button exp-button--primary" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save assignment profile'}</button></form></div>
      </div>
    </div>
  )
}

function EarningsSection() {
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const [busy, setBusy] = useState(false)
  const load = async () => { setState((value) => ({ ...value, loading: true, error: '' })); try { setState({ loading: false, data: await fetchExpertEarnings(), error: '' }) } catch (error) { setState({ loading: false, data: null, error: error.serverMessage || 'Earnings could not be loaded.' }) } }
  useEffect(() => { load() }, [])
  if (state.loading) return <div className="exp-loading" role="status">Loading earnings…</div>
  if (state.error) return <div className="exp-panel"><h2>Could not load earnings</h2><p>{state.error}</p><button className="exp-button exp-button--secondary" onClick={load}>Try again</button></div>
  const data = state.data
  const money = (value, currency = 'lkr') => new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currency).toUpperCase(), maximumFractionDigits: 0 }).format(value || 0)
  const request = async () => { setBusy(true); try { await requestExpertPayout(data.rows.filter((row) => row.payoutState === 'available').map((row) => row.taskId)); await load() } catch (error) { setState((value) => ({ ...value, error: error.serverMessage || 'The payout request could not be submitted.' })) } finally { setBusy(false) } }
  return <div className="exp-section"><header className="exp-section-head"><p className="exp-overline">EARNINGS</p><h1>Delivery earnings</h1><p>Completed, funded assignments become available after delivery. Platform fees and payout status remain visible.</p></header><div className="exp-account-grid"><section className="exp-panel"><div className="exp-panel-head"><div><p className="exp-overline">AVAILABLE</p><h3>{money(data.totals.available, data.rows[0]?.currency)}</h3></div></div><dl className="exp-account-list"><div><dt>Gross earned</dt><dd>{money(data.totals.gross, data.rows[0]?.currency)}</dd></div><div><dt>Platform fees</dt><dd>{money(data.totals.fees, data.rows[0]?.currency)}</dd></div><div><dt>Your net earnings</dt><dd>{money(data.totals.net, data.rows[0]?.currency)}</dd></div><div><dt>Commission rate</dt><dd>{Math.round(data.commissionRate * 100)}%</dd></div></dl><button className="exp-button exp-button--primary" disabled={busy || data.totals.available <= 0} onClick={request}>{busy ? 'Requesting…' : 'Request available payout'}</button></section><section className="exp-panel"><div className="exp-panel-head"><div><p className="exp-overline">LEDGER</p><h3>Delivered assignments</h3></div></div>{data.rows.length ? <ul className="exp-movement-list">{data.rows.map((row) => <li key={row.assignmentId}><span className="exp-movement-icon" /><span><strong>{row.title}</strong><small>{money(row.net, row.currency)} net · {row.payoutState}</small></span><time>{row.deliveredAt ? new Date(row.deliveredAt).toLocaleDateString() : ''}</time></li>)}</ul> : <div className="exp-empty"><p className="exp-empty-title">No completed earnings yet</p><p className="exp-empty-body">Delivered and funded assignments will appear here.</p></div>}</section></div></div>
}

export function ExpertDashboard() {
  const gate = useExpertAccountGate()
  const dashboard = useExpertDashboard()
  const [path, setPath] = useState(normalizePath(currentPath()))
  const [search, setSearch] = useState(() => window.location.search)
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => {
      setPath(normalizePath(currentPath()))
      setSearch(window.location.search)
      setMenuOpen(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const gateReady = !gate.loading
  const profileOnly = gateReady && !gate.error && gate.accountState && gate.accountState !== 'approved' && path.startsWith('/expert/account')
  const gateBlocked = gateReady && (gate.error || (gate.accountState && gate.accountState !== 'approved' && !profileOnly))
  const shellReady = gateReady && !gate.error && dashboard.loaded

  const content = useMemo(() => {
    if (!shellReady) return null
    const detail = parseAssignmentRoute(path, search)
    if (detail.assignmentId) {
      return <ExpertAssignmentWorkspace assignmentId={detail.assignmentId} initialTab={detail.tab} />
    }
    if (path.startsWith('/expert/assignments')) return <ExpertAssignments />
    if (path.startsWith('/expert/available')) return <ExpertAvailableForYou path={path} search={search} />
    if (path.startsWith('/expert/activity')) return <ActivitySection dashboard={dashboard} />
    if (path.startsWith('/expert/earnings')) return <EarningsSection />
    if (path.startsWith('/expert/notifications')) return <NotificationsSection dashboard={dashboard} />
    if (path.startsWith('/expert/account')) return <AccountSection dashboard={dashboard} gate={gate} />
    if (path === '/expert' || path.startsWith('/expert/dashboard')) return <ExpertDashboardPage dashboard={dashboard} />
    return <ExpertDashboardPage dashboard={dashboard} />
  }, [path, search, shellReady, dashboard, gate])

  if (profileOnly) return <div className="expert-app"><main className="exp-main"><AccountSection dashboard={{ expert: gate.expert, availability: gate.availability, accountState: gate.accountState, reload: gate.reload }} gate={gate} /></main></div>

  if (gateBlocked) {
    return (
      <ExpertGate
        loading={false}
        error={gate.error}
        accountState={gate.accountState}
        onRetry={() => {
          gate.reload()
          dashboard.reload()
        }}
      />
    )
  }

  if (dashboard.error && !dashboard.workspace) {
    return <ExpertGate loading={false} error={dashboard.error} accountState={null} onRetry={dashboard.reload} />
  }

  if (!gateReady || !shellReady) {
    if (gate.error) return <ExpertGate loading={false} error={gate.error} accountState={null} onRetry={gate.reload} />
    return (
      <div className="expert-app expert-app--gate">
        <div className="exp-gate-card">
          <span className="exp-gate-spinner" aria-hidden="true" />
          <p className="exp-overline">PREPARING WORKSPACE</p>
          <h1>Loading your expert workbench…</h1>
        </div>
      </div>
    )
  }

  return (
    <ExpertAppShell
      path={path}
      expert={dashboard.expert || gate.expert}
      availability={dashboard.availability || gate.availability}
      unreadNotifications={dashboard.unreadNotifications}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      onSignOut={async () => {
        try {
          await signOutExpert()
        } catch {}
        goExpert('/expert/login')
      }}
    >
      {dashboard.loading && !dashboard.workspace ? <ExpertDashboardSkeletons /> : content}
    </ExpertAppShell>
  )
}
