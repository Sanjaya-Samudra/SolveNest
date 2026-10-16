import { useEffect, useMemo, useState } from 'react'
import { LogOut, ShieldCheck, Radio } from 'lucide-react'
import { useExpertAccountGate, useExpertDashboard } from '../../expert/expertDashboardData.js'
import { parseAssignmentRoute } from '../../expert/assignmentState.js'
import { signOutExpert, updateExpertProfile } from '../../expert/expertApi.js'
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
  const [profile, setProfile] = useState(() => ({ capacity: expert?.capacity || 4, competencies: (expert?.competencies || []).join(', '), conflictDomains: (expert?.conflictDomains || []).join(', '), timezone: expert?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }))
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const saveProfile = async (event) => {
    event.preventDefault(); setProfileBusy(true); setProfileMessage('')
    try {
      await updateExpertProfile({ capacity: Number(profile.capacity), competencies: profile.competencies.split(',').map((item) => item.trim()).filter(Boolean), conflictDomains: profile.conflictDomains.split(',').map((item) => item.trim()).filter(Boolean), timezone: profile.timezone.trim() })
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
        <div><ExpertAvailabilityControl availability={availability} /><form className="exp-panel" onSubmit={saveProfile}><div className="exp-panel-head"><div><p className="exp-overline">ASSIGNMENT FIT</p><h3>Capacity and expertise</h3></div></div><label>Maximum active assignments<input type="number" min="1" max="20" value={profile.capacity} onChange={(event) => setProfile({ ...profile, capacity: event.target.value })} /></label><label>Competencies<textarea required rows="3" value={profile.competencies} onChange={(event) => setProfile({ ...profile, competencies: event.target.value })} placeholder="Data analysis, Economics, Research methods" /><small>Separate specialties with commas.</small></label><label>Conflict domains<textarea rows="2" value={profile.conflictDomains} onChange={(event) => setProfile({ ...profile, conflictDomains: event.target.value })} placeholder="Organizations or subjects you cannot accept" /></label><label>Timezone<input required value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} placeholder="Asia/Colombo" /></label>{profileMessage && <p role="status">{profileMessage}</p>}<button className="exp-button exp-button--primary" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save assignment profile'}</button></form></div>
      </div>
    </div>
  )
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
  const gateBlocked = gateReady && (gate.error || (gate.accountState && gate.accountState !== 'approved'))
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
    if (path.startsWith('/expert/notifications')) return <NotificationsSection dashboard={dashboard} />
    if (path.startsWith('/expert/account')) return <AccountSection dashboard={dashboard} gate={gate} />
    if (path === '/expert' || path.startsWith('/expert/dashboard')) return <ExpertDashboardPage dashboard={dashboard} />
    return <ExpertDashboardPage dashboard={dashboard} />
  }, [path, search, shellReady, dashboard, gate])

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
