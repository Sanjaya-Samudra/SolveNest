import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
  X,
} from 'lucide-react'
import logo from '../../assets/logo-background-white.png'

export const goExpert = (path) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const workspaceItems = [
  ['Dashboard', '/expert/dashboard', Home],
  ['Assignments', '/expert/assignments', Briefcase],
  ['Available for You', '/expert/available-tasks', Compass],
  ['Activity', '/expert/activity', Activity],
]

const systemItems = [
  ['Notifications', '/expert/notifications', Bell],
  ['Account', '/expert/account', Settings],
]

function labelOfPath(path) {
  const found = [...workspaceItems, ...systemItems].find(([, target]) => target === path)
  return found ? found[0] : 'Dashboard'
}

function expertInitials(expert) {
  const source = expert?.name || 'Expert'
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function ExpertSidebar({ collapsed, setCollapsed, path, expert, unreadNotifications, availability }) {
  return (
    <aside className={`exp-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="exp-brand">
        <img src={logo} alt="SolveNest" />
        {!collapsed && <span>SolveNest</span>}
        {!collapsed && <em>EXPERT</em>}
      </div>
      <nav aria-label="Expert workspace">
        <p className="exp-nav-label">{collapsed ? '·' : 'Workspace'}</p>
        {workspaceItems.map(([label, target, Icon]) => (
          <button
            key={target}
            className={`exp-nav-item ${path === target ? 'is-active' : ''}`}
            onClick={() => goExpert(target)}
            title={collapsed ? label : undefined}
          >
            <Icon size={17} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
        <p className="exp-nav-label exp-nav-label--lower">{collapsed ? '·' : 'System'}</p>
        {systemItems.map(([label, target, Icon]) => (
          <button
            key={target}
            className={`exp-nav-item ${path === target ? 'is-active' : ''}`}
            onClick={() => goExpert(target)}
            title={collapsed ? label : undefined}
          >
            <Icon size={17} />
            {!collapsed && <span>{label}</span>}
            {!collapsed && label === 'Notifications' && unreadNotifications > 0 && <b>{unreadNotifications}</b>}
          </button>
        ))}
      </nav>
      {!collapsed && (
        <div className="exp-availability-chip" data-status={availability}>
          <span className="exp-availability-dot" aria-hidden="true" />
          {availability === 'limited' ? 'Limited' : availability === 'unavailable' ? 'Unavailable' : 'Available'}
        </div>
      )}
      <button
        className="exp-collapse"
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}

export function ExpertTopBar({ path, expert, unreadNotifications, onOpenMenu, menuOpen, availability, onSignOut }) {
  return (
    <header className="exp-topbar">
      <div className="exp-context">
        <button
          type="button"
          className="exp-mobile-logo-btn"
          onClick={onOpenMenu}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-haspopup="dialog"
          aria-expanded={Boolean(menuOpen)}
        >
          <img className="exp-mobile-logo" src={logo} alt="" />
        </button>
        <span>Expert</span>
        <ChevronRight size={14} />
        <strong>{labelOfPath(path)}</strong>
      </div>
      <div className="exp-top-actions">
        <span className="exp-status-pill" data-status={availability}>
          <span className="exp-availability-dot" aria-hidden="true" />
          {availability === 'limited' ? 'Limited' : availability === 'unavailable' ? 'Unavailable' : 'Available'}
        </span>
        <button
          className="exp-icon-button exp-bell"
          onClick={() => goExpert('/expert/notifications')}
          aria-label={unreadNotifications > 0 ? `Open notifications, ${unreadNotifications} unread` : 'Open notifications'}
        >
          <Bell size={18} />
          {unreadNotifications > 0 && (
            <span className="exp-bell-badge" aria-hidden="true">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
          )}
        </button>
        <button className="exp-signout" onClick={onSignOut} aria-label="Sign out">
          <LogOut size={17} />
        </button>
        <button className="exp-profile" onClick={() => goExpert('/expert/account')} aria-label="Expert account">
          <span className="exp-avatar">{expert?.avatarUrl ? <img src={expert.avatarUrl} alt="" /> : expertInitials(expert)}</span>
        </button>
      </div>
    </header>
  )
}

export function ExpertMobileNav({ open, onClose, path, expert, availability, unreadNotifications, onSignOut }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <motion.div
        className="exp-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        className="exp-drawer"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Expert navigation"
      >
        <div className="exp-drawer-head">
          <div className="exp-brand">
            <img src={logo} alt="SolveNest" />
            <span>SolveNest</span>
            <em>EXPERT</em>
          </div>
          <button className="exp-icon-button" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <div className="exp-drawer-expert">
          <span className="exp-avatar">{expert?.avatarUrl ? <img src={expert.avatarUrl} alt="" /> : expertInitials(expert)}</span>
          <div>
            <strong>{expert?.name || 'Expert'}</strong>
            <small>{expert?.title || 'SolveNest Expert'}</small>
          </div>
          <span className="exp-status-pill" data-status={availability}>
            <span className="exp-availability-dot" aria-hidden="true" />
            {availability === 'limited' ? 'Limited' : availability === 'unavailable' ? 'Unavailable' : 'Available'}
          </span>
        </div>
        <nav aria-label="Expert sections">
          <p className="exp-nav-label">Workspace</p>
          {workspaceItems.map(([label, target, Icon]) => (
            <button
              key={target}
              className={`exp-nav-item ${path === target ? 'is-active' : ''}`}
              onClick={() => {
                onClose()
                goExpert(target)
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
          <p className="exp-nav-label exp-nav-label--lower">System</p>
          {systemItems.map(([label, target, Icon]) => (
            <button
              key={target}
              className={`exp-nav-item ${path === target ? 'is-active' : ''}`}
              onClick={() => {
                onClose()
                goExpert(target)
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {label === 'Notifications' && unreadNotifications > 0 && <b>{unreadNotifications}</b>}
            </button>
          ))}
        </nav>
        <button className="exp-drawer-signout" onClick={onSignOut}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </motion.aside>
    </>
  )
}

export function ExpertAppShell({ path, expert, availability, unreadNotifications = 0, collapsed, setCollapsed, menuOpen, setMenuOpen, onSignOut, children }) {
  return (
    <div className={`expert-app ${collapsed ? 'is-collapsed' : ''}`}>
      <ExpertSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        path={path}
        expert={expert}
        unreadNotifications={unreadNotifications}
        availability={availability}
      />
      <div className="exp-main-col">
        <ExpertTopBar
          path={path}
          expert={expert}
          unreadNotifications={unreadNotifications}
          onOpenMenu={() => setMenuOpen((value) => !value)}
          menuOpen={menuOpen}
          availability={availability}
          onSignOut={onSignOut}
        />
        <main className="exp-workspace">{children}</main>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <ExpertMobileNav
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            path={path}
            expert={expert}
            availability={availability}
            unreadNotifications={unreadNotifications}
            onSignOut={onSignOut}
          />
        )}
      </AnimatePresence>
      <nav className="exp-bottom-nav" aria-label="Expert quick navigation">
        {workspaceItems.slice(0, 4).map(([label, target, Icon]) => (
          <button key={target} className={path === target ? 'is-active' : ''} onClick={() => goExpert(target)}>
            <Icon size={18} />
            <span>{label === 'Available for You' ? 'Available' : label}</span>
          </button>
        ))}
        <button className={path === '/expert/account' ? 'is-active' : ''} onClick={() => goExpert('/expert/account')}>
          <User size={18} />
          <span>Account</span>
        </button>
      </nav>
    </div>
  )
}

export function ExpertGate({ loading, error, accountState, onRetry }) {
  if (loading) {
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

  const access = error?.message === 'EXPERT_ACCESS_REQUIRED' || error?.code === 401 || error?.code === 403

  if (error) {
    return (
      <div className="expert-app expert-app--gate">
        <div className="exp-gate-card">
          <span className="exp-gate-icon" aria-hidden="true">{access ? <Settings size={22} /> : <Clock3 size={22} />}</span>
          <p className="exp-overline">{access ? 'ACCESS REQUIRED' : 'COULD NOT LOAD'}</p>
          <h1>{access ? 'Sign in to open your expert workspace.' : 'We could not load your workspace.'}</h1>
          <p>{access ? 'Your expert session is missing or has expired.' : 'We could not retrieve the current workspace data.'}</p>
          <button className="exp-button" onClick={access ? () => goExpert('/login') : onRetry}>
            {access ? 'Sign in' : 'Try again'}
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  if (accountState === 'pending') {
    return (
      <div className="expert-app expert-app--gate">
        <div className="exp-gate-card">
          <span className="exp-gate-icon" aria-hidden="true"><Clock3 size={22} /></span>
          <p className="exp-overline">ACCOUNT REVIEW</p>
          <h1>Your expert account is being reviewed</h1>
          <p>Assignments unlock once SolveNest completes verification of your expert profile.</p>
          <button className="exp-button exp-button--secondary" onClick={() => goExpert('/expert/account')}>
            View account
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  if (accountState === 'suspended') {
    return (
      <div className="expert-app expert-app--gate">
        <div className="exp-gate-card">
          <span className="exp-gate-icon" aria-hidden="true"><X size={22} /></span>
          <p className="exp-overline">ACCOUNT SUSPENDED</p>
          <h1>This expert account is suspended</h1>
          <p>Contact SolveNest support to review the status of this account.</p>
          <button className="exp-button exp-button--secondary" onClick={() => goExpert('/expert/account')}>
            Open account
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  return null
}

export function ExpertLoadingRow({ label = 'Loading assignments' }) {
  return (
    <div className="exp-skeleton-row" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  )
}

export const ExpertIcons = { CheckCircle2, Settings, User }
