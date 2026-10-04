import { useEffect, useMemo, useState } from 'react'
import { LogOut, ShieldCheck, Radio } from 'lucide-react'
import { useExpertAccountGate, useExpertDashboard } from '../../expert/expertDashboardData.js'
import { signOutExpert } from '../../expert/expertApi.js'
import { ExpertAppShell, ExpertGate, goExpert } from './ExpertAppShell.jsx'
import {
  AssignmentDesk,
  AvailableForYou,
  DeadlineRadar,
  ExpertAssignmentPulse,
  ExpertAvailabilityControl,
  ExpertDashboardPage,
  ExpertDashboardSkeletons,
  RecentMovement,
} from './ExpertDashboardPage.jsx'

function currentPath() {
  return window.location.pathname.startsWith('/expert') ? window.location.pathname : '/expert/dashboard'
}

function normalizePath(path) {
  if (path === '/expert') return '/expert/dashboard'
  return path
}

function AssignmentsSection({ dashboard }) {
  const { assignments, selectedAssignment, selectAssignment, loading } = dashboard
  return (
    <div className="exp-section">
      <header className="exp-section-head">
        <p className="exp-overline">ASSIGNMENTS</p>
        <h1>Assignment desk</h1>
        <p>Every confirmed SolveNest assignment with its current work state and next action.</p>
      </header>
      <div className="exp-section-split">
        <AssignmentDesk
          assignments={assignments}
          selected={selectedAssignment}
          onSelect={selectAssignment}
          loading={loading}
        />
        <ExpertAssignmentPulse assignment={selectedAssignment} onSelect={selectAssignment} />
      </div>
      <DeadlineRadar deadlines={dashboard.deadlines} />
    </div>
  )
}

function AvailableSection({ dashboard }) {
  const tasks = dashboard.workspace?.availableTaskPreview || []
  return (
    <div className="exp-section">
      <header className="exp-section-head">
        <p className="exp-overline">AVAILABLE FOR YOU</p>
        <h1>Open tasks</h1>
        <p>Express interest in work that matches your expertise. SolveNest confirms assignments — there is no bidding.</p>
      </header>
      <AvailableForYou tasks={tasks} />
    </div>
  )
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
                <div>
                  <strong>{item.title}</strong>
                  {item.body && <small>{item.body}</small>}
                </div>
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
              goExpert('/')
            }}
          >
            <LogOut size={15} />
            Sign out of expert workspace
          </button>
        </section>
        <ExpertAvailabilityControl availability={availability} />
      </div>
    </div>
  )
}

export function ExpertDashboard() {
  const gate = useExpertAccountGate()
  const dashboard = useExpertDashboard()
  const [path, setPath] = useState(normalizePath(currentPath()))
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => {
      setPath(normalizePath(currentPath()))
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
    if (path.startsWith('/expert/assignments')) return <AssignmentsSection dashboard={dashboard} />
    if (path.startsWith('/expert/available-tasks')) return <AvailableSection dashboard={dashboard} />
    if (path.startsWith('/expert/activity')) return <ActivitySection dashboard={dashboard} />
    if (path.startsWith('/expert/notifications')) return <NotificationsSection dashboard={dashboard} />
    if (path.startsWith('/expert/account')) return <AccountSection dashboard={dashboard} gate={gate} />
    if (path === '/expert' || path.startsWith('/expert/dashboard')) return <ExpertDashboardPage dashboard={dashboard} />
    return <ExpertDashboardPage dashboard={dashboard} />
  }, [path, shellReady, dashboard, gate])

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
        goExpert('/')
      }}
    >
      {dashboard.loading && !dashboard.workspace ? <ExpertDashboardSkeletons /> : content}
    </ExpertAppShell>
  )
}
