import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BookOpen, ChevronDown, ChevronRight, ClipboardList, CreditCard, FolderOpen, HelpCircle, Home, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Settings, ShieldCheck, Sparkles, X, ArrowRight } from 'lucide-react'
import { fetchStudentDashboard, formatDate, formatRelativeTime, getTaskJourney } from '../../student/studentDashboardData.js'
import { TaskCreationStudio } from './TaskCreationStudio.jsx'
import logo from '../../assets/logo-background-white.png'

const go = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
const navItems = [['Dashboard', '/student/dashboard', Home], ['My Tasks', '/student/tasks', ClipboardList], ['Messages', '/student/messages', MessageCircle], ['Files & Deliveries', '/student/deliveries', FolderOpen], ['Explain & Defend', '/student/explain', BookOpen], ['Payments', '/student/payments', CreditCard]]
const moreItems = [['Notifications', '/student/notifications', Bell], ['Help', '/student/help', HelpCircle], ['Account', '/student/account', Settings]]
const labelOfPath = (path) => { const all = [...navItems, ...moreItems]; const found = all.find(([_, target]) => target === path); return found ? found[0] : 'Dashboard' }
const initials = (student) => (student?.name || student?.displayName || student?.email || 'Student').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
const nameOf = (student) => student?.name || student?.displayName || 'Student'
function ActionButton({ children, onClick, secondary = false }) { return <button className={secondary ? 'student-button student-button--secondary' : 'student-button'} onClick={onClick}>{children}<ChevronRight size={15} /></button> }

function StudentSidebar({ collapsed, setCollapsed, path, model }) { return <aside className={`student-sidebar ${collapsed ? 'is-collapsed' : ''}`}><div className="student-brand"><img src={logo} alt="SolveNest" /><span>SolveNest</span></div><nav aria-label="Student workspace"><p className="student-nav-label">Workspace</p>{navItems.map(([label, target, Icon]) => <button key={target} className={`student-nav-item ${path === target ? 'is-active' : ''}`} onClick={() => go(target)} title={collapsed ? label : undefined}><Icon size={17} /><span>{label}</span>{label === 'Messages' && model.unreadMessages > 0 && <b>{model.unreadMessages}</b>}</button>)}<p className="student-nav-label student-nav-label--lower">Personal</p>{moreItems.map(([label, target, Icon]) => <button key={target} className={`student-nav-item ${path === target ? 'is-active' : ''}`} onClick={() => go(target)} title={collapsed ? label : undefined}><Icon size={17} /><span>{label}</span>{label === 'Notifications' && model.notifications.length > 0 && <b>{model.notifications.length}</b>}</button>)}</nav><button className="student-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>{collapsed ? 'Expand' : 'Collapse'}</span></button></aside> }
function TopBar({ student, onNotifications, onNewTask, path }) { return <header className="student-topbar"><div className="student-context"><img className="student-mobile-logo" src={logo} alt="SolveNest" /><span>Student</span><ChevronRight size={14} /><strong>{labelOfPath(path)}</strong></div><div className="student-top-actions"><button className="student-new-task" onClick={onNewTask}><Plus size={17} /><span>New Task</span></button><button className="student-icon-button" onClick={onNotifications} aria-label="Open notifications"><Bell size={18} /></button><button className="student-profile" onClick={() => go('/student/account')} aria-label="My account"><span className="student-avatar">{student?.avatarUrl ? <img src={student.avatarUrl} alt="" /> : initials(student)}</span></button></div></header> }
function NotificationDrawer({ notifications, onClose }) { return <motion.aside className="student-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} aria-label="Notifications"><div className="student-drawer-header"><div><p className="student-overline">INBOX</p><h2>Notifications</h2></div><button className="student-icon-button" onClick={onClose} aria-label="Close notifications"><X size={18} /></button></div>{notifications.length === 0 ? <p className="student-muted-copy">You have no new notifications.</p> : notifications.map((item, index) => <button className="student-notification" key={item.id || index} onClick={() => { onClose(); if (item.route) go(item.route) }}><span className="student-state-dot tone-active" /><span><strong>{item.title || item.type || 'Notification'}</strong><small>{item.body || item.taskTitle || ''}</small><time>{formatRelativeTime(item.createdAt)}</time></span></button>)}</motion.aside> }
function DashboardError({ onRetry, access }) { return <section className="student-local-error" role="alert"><p className="student-overline">{access ? 'ACCESS REQUIRED' : 'COULD NOT LOAD'}</p><h2>{access ? 'Sign in to open your student workspace.' : 'We could not load your workspace.'}</h2><p>{access ? 'Your student session is missing or has expired.' : 'We could not retrieve the current workspace data.'}</p><ActionButton onClick={() => access ? go('/login') : onRetry()}>{access ? 'Sign in' : 'Try again'}</ActionButton></section> }
function DashboardSkeleton() { return <div className="student-dashboard-skeleton" aria-label="Loading student workspace"><span /><span /><div><span /><span /></div><span /><span /></div> }
function StudentMobileNav({ onNewTask, path }) {
  const [expanded, setExpanded] = useState(false)
  const allItems = [['Dashboard', '/student/dashboard', Home], ['Tasks', '/student/tasks', ClipboardList], ['Messages', '/student/messages', MessageCircle], ['Help', '/student/help', HelpCircle], ['Notifications', '/student/notifications', Bell], ['Account', '/student/account', Settings]]
  return <>
    {expanded && <div className="student-fab-overlay" onClick={() => setExpanded(false)} />}
    <nav className={`student-bottom-nav ${expanded ? 'is-expanded' : ''}`} aria-label="Mobile student workspace">
      <button className={path === '/student/dashboard' ? 'is-active' : ''} onClick={() => { setExpanded(false); go('/student/dashboard') }}><Home size={18} /><span>Dashboard</span></button>
      <button className={path === '/student/tasks' ? 'is-active' : ''} onClick={() => { setExpanded(false); go('/student/tasks') }}><ClipboardList size={18} /><span>Tasks</span></button>
      <button className="is-primary" onClick={() => setExpanded((v) => !v)}><Plus size={20} /></button>
      <button className={path === '/student/messages' ? 'is-active' : ''} onClick={() => { setExpanded(false); go('/student/messages') }}><MessageCircle size={18} /><span>Messages</span></button>
      <button className={path === '/student/account' ? 'is-active' : ''} onClick={() => { setExpanded(false); go('/student/account') }}><Settings size={18} /><span>More</span></button>
    </nav>
    {expanded && <div className="student-fab-menu">
      <button className="student-fab-item" onClick={() => { setExpanded(false); onNewTask() }}><Plus size={16} /><span>New Task</span></button>
      {allItems.filter(([label, target]) => target !== path).map(([label, target, Icon]) => <button className="student-fab-item" key={target} onClick={() => { setExpanded(false); go(target) }}><Icon size={16} /><span>{label}</span></button>)}
    </div>}
  </>
}

function resolveDashboardState(model) {
  if (!model || !model.focusAction) return { status: 'ALL CLEAR', headline: 'You are all caught up.', body: 'No action is required from you right now.', tone: 'neutral' }
  const key = model.focusAction?.task?.display?.key || ''
  if (['DELIVERED', 'REVISION_REQUESTED'].includes(key)) return { status: 'DELIVERY READY', headline: 'Your delivery is ready.', body: 'Your task is ready to review.', tone: 'delivery' }
  if (key === 'PAYMENT_PENDING') return { status: 'FUNDING REQUIRED', headline: 'A payment is needed.', body: 'Work begins once the required payment is completed.', tone: 'payment' }
  if (key === 'ASSIGNMENT_PENDING') return { status: 'MATCHING', headline: 'Matching expertise.', body: 'SolveNest is reviewing suitable expertise for your task.', tone: 'waiting' }
  if (['QUOTE_READY', 'AWAITING_ACCEPTANCE'].includes(key)) return { status: 'ACTION REQUIRED', headline: 'A decision is waiting.', body: 'Your official plan is ready to review.', tone: 'action' }
  if (key === 'NEEDS_INFORMATION') return { status: 'ACTION REQUIRED', headline: 'More information needed.', body: 'Please respond to complete the task.', tone: 'action' }
  if (['IN_PROGRESS', 'QUALITY_REVIEW', 'REVISION_IN_PROGRESS'].includes(key)) return { status: 'IN PROGRESS', headline: 'Your task is moving forward.', body: 'Solvy is working on your request.', tone: 'progress' }
  if (key === 'COMPLETED') return { status: 'DELIVERY READY', headline: 'Task completed.', body: 'Great work. Review the delivery below.', tone: 'delivery' }
  return { status: 'ACTION REQUIRED', headline: 'Something needs your attention.', body: 'Your most important task and next action are below.', tone: 'action' }
}

function getAttentionQueue(model) {
  if (!model || !model.tasks) return []
  const focusId = model.activeTask?.id || model.focusAction?.task?.id
  return model.tasks.filter((task) => task.display.needsStudentAction && task.id !== focusId)
}

function StageDetailStrip({ task, stageKey }) {
  const journey = getTaskJourney(task)
  const stage = journey.find((s) => s.key === stageKey) || journey[0]
  const update = task?.latestUpdate
  return <div className="student-stage-detail">
    <div>
      <p className="student-overline">{stage?.label?.toUpperCase() || 'STAGE'}</p>
      <strong>{task?.display?.label || stage?.label}</strong>
    </div>
    {update && <span><time>{formatRelativeTime(update.createdAt || update.date)}</time> — {update.text || update.title}</span>}
  </div>
}

function TaskPulse({ task }) {
  const stages = getTaskJourney(task)
  const current = stages.find((s) => s.status === 'current') || stages[0]
  const currentIndex = stages.indexOf(current)
  const [hoveredStage, setHoveredStage] = useState(null)
  return <div className="student-task-pulse" aria-label="Task journey">
    <div className="student-pulse-header">
      <span className="student-pulse-step">{String(currentIndex + 1).padStart(2, '0')} / {stages.length}</span>
      <span className="student-pulse-stage">{current?.label || 'PROGRESS'}</span>
    </div>
    <div className="student-pulse-rail" role="list" aria-label="Task stages">
      {stages.map((stage) => {
        const isComplete = stage.status === 'complete'
        const isCurrent = stage.status === 'current'
        return <div className={`student-pulse-node is-${stage.status}`} key={stage.key} role="listitem" onMouseEnter={() => setHoveredStage(stage.key)} onMouseLeave={() => setHoveredStage(null)} aria-label={`${stage.label}: ${isComplete ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}>
          <span className="student-pulse-dot" />
          <span className="student-pulse-label">{stage.label}</span>
        </div>
      })}
    </div>
    {hoveredStage && hoveredStage !== current?.key && <StageDetailStrip task={task} stageKey={hoveredStage} />}
  </div>
}

function StudentNowCanvas({ model, onNewTask }) {
  const action = model?.focusAction
  const task = action?.task || model?.activeTask
  const state = resolveDashboardState(model)
  if (!task) {
    return <section className="student-now-canvas student-now-canvas--empty">
      <div className="student-now-left">
        <div className="student-now-state-marker tone-neutral" />
        <div><p className="student-overline">NOW</p><p className="student-now-status">{state.status}</p></div>
      </div>
      <div className="student-now-center">
        <div className="student-now-empty">
          <span className="student-now-empty-icon"><Sparkles size={32} /></span>
          <h2>Your first task begins with the brief.</h2>
          <p>Upload the assignment instructions and Solvy will help structure what comes next.</p>
          <ActionButton onClick={onNewTask}>Create Your First Task <ArrowRight size={15} /></ActionButton>
        </div>
      </div>
      <div className="student-now-right">
        <p className="student-overline">NEXT</p>
        <p className="student-now-next-desc">Create a task to start your academic journey.</p>
      </div>
    </section>
  }
  const currentStage = getTaskJourney(task).find((s) => s.status === 'current') || getTaskJourney(task)[0]
  const nextAction = task?.nextAction || action
  const isDelivery = ['DELIVERED', 'REVISION_REQUESTED'].includes(task?.display?.key)
  const isPayment = task?.display?.key === 'PAYMENT_PENDING'
  return <section className="student-now-canvas" aria-label="Now Canvas">
    <div className="student-now-grid">
      <div className="student-now-left">
        <p className="student-overline">NOW</p>
        <div className="student-now-state">
          <div className={`student-now-state-marker tone-${state.tone}`} />
          <div>
            <p className="student-now-status">{state.status}</p>
            <p className="student-now-body">{state.body}</p>
          </div>
        </div>
        {nextAction && nextAction.route && <ActionButton onClick={() => go(nextAction.route)}>{nextAction.label}</ActionButton>}
        {!nextAction && <p className="student-now-noaction">No action required.</p>}
      </div>
      <div className="student-now-center">
        <div className="student-now-task">
          <div className="student-now-task-head">
            <div>
              <p className="student-overline">CURRENT TASK</p>
              <h2>{task.title || task.type || 'Untitled task'}</h2>
              {task.subject && <span className="student-now-domain">{task.subject}{task.domain ? ' - ' + task.domain : ''}{task.reference ? ' - ' + task.reference : ''}</span>}
            </div>
            {task.reference && <span className="student-now-ref">{task.reference}</span>}
          </div>
          <TaskPulse task={task} />
          <div className="student-now-meta">
            {task.deadline && <span><time>{formatDate(task.deadline)}</time></span>}
            {task?.latestUpdate && <span>Latest: {task.latestUpdate.text || task.latestUpdate.title}</span>}
          </div>
        </div>
      </div>
      <div className="student-now-right">
        <p className="student-overline">NEXT</p>
        {task.expert && <div className="student-now-expert">
          <span className="student-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(task.expert)}</span>
          <div>
            <small>ASSIGNED EXPERT</small>
            <strong>{task.expert.name}</strong>
            <span>{task.expert.verified ? 'Verified Expert' : 'SolveNest expert'}</span>
          </div>
        </div>}
        {task?.latestUpdate && <div className="student-now-update">
          <p className="student-overline">LATEST UPDATE</p>
          <p>{task.latestUpdate.text || task.latestUpdate.title}</p>
          <time>{formatRelativeTime(task.latestUpdate.createdAt)}</time>
        </div>}
        {isDelivery && <ActionButton onClick={() => go('/student/deliveries')}>Review Delivery <ArrowRight size={15} /></ActionButton>}
        {isPayment && <ActionButton onClick={() => go('/student/payments')}>Make Payment <ArrowRight size={15} /></ActionButton>}
        {!isDelivery && !isPayment && nextAction && nextAction.route && <ActionButton onClick={() => go(nextAction.route)}>Open Task <ArrowRight size={15} /></ActionButton>}
      </div>
    </div>
  </section>
}

function AttentionQueue({ queue }) {
  if (!queue || queue.length === 0) return null
  return <section className="student-attention-queue" aria-label="Attention queue">
    <div className="student-attention-header">
      <p className="student-overline">ATTENTION QUEUE</p>
      <span>{queue.length} item{queue.length !== 1 ? 's' : ''} need you</span>
    </div>
    {queue.map((task, index) => <div className="student-attention-row" key={task.id || task.reference} style={{ animationDelay: index * 0.06 + 's' }}>
      <span className={`student-state-dot tone-${task.display.tone}`} />
      <div><strong>{task.title || task.type}</strong><small>{task.display.label}</small></div>
      <ActionButton secondary onClick={() => go(task.nextAction.route || '/student/tasks')}>{task.nextAction.label}</ActionButton>
    </div>)}
  </section>
}

function ActiveTasks({ tasks, onNewTask }) {
  const [expanded, setExpanded] = useState(null)
  const displayTasks = (tasks || []).slice(0, 5)
  return <section className="student-active-tasks">
    <div className="student-section-heading">
      <div><p className="student-overline">ACTIVE TASKS</p><h2>What you are working on</h2></div>
      <button className="student-link-button" onClick={() => go('/student/tasks')}>View all <ChevronRight size={15} /></button>
    </div>
    {displayTasks.length === 0 ? <div className="student-empty-inline">
      <p className="student-overline">START WITH YOUR BRIEF</p>
      <h2>Your workspace begins with one task.</h2>
      <p>Upload an assignment brief and let Solvy structure what comes next.</p>
      <ActionButton onClick={onNewTask}>Create your first task</ActionButton>
    </div> : <div className="student-ledger" role="list">
      {displayTasks.map((task) => <div className="student-task-row" key={task.id || task.reference} role="listitem">
        <button className="student-task-main" onClick={() => setExpanded(expanded === task.id ? null : task.id)} aria-expanded={expanded === task.id}>
          <span className={`student-state-dot tone-${task.display.tone}`} />
          <span className="student-task-name"><strong>{task.title || task.type || 'Untitled task'}</strong><small>{task.subject || task.domain || task.reference || 'Task'}</small></span>
          <span className="student-task-state">{task.display.label}</span>
          <span className="student-task-date">{formatDate(task.deadline)}</span>
          <span className="student-task-action">{task.nextAction.label}</span>
          <ChevronDown size={16} />
        </button>
        {expanded === task.id && <motion.div className="student-task-expanded" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <p>{task.latestUpdate?.text || task.latestUpdate || 'No latest update available.'}</p>
          <ActionButton secondary onClick={() => go(task.nextAction.route)}>Open task</ActionButton>
        </motion.div>}
      </div>)}
    </div>}
  </section>
}

function RecentMovement({ items }) {
  return <section className="student-recent-movement">
    <div className="student-section-heading">
      <div><p className="student-overline">RECENT MOVEMENT</p><span>What changed in your workspace</span></div>
    </div>
    {items.length === 0 ? <p className="student-muted-copy">Updates will appear here as your work moves forward.</p> : <div className="student-activity-feed">
      {items.map((item, index) => <button key={item.id || item.createdAt + '-' + index} className="student-activity-item" onClick={() => item.route && go(item.route)} style={{ animationDelay: index * 0.04 + 's' }}>
        <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
        <span><strong>{item.title || item.type || 'Task update'}</strong><small>{item.taskTitle || item.taskReference || ''}</small></span>
        <ChevronRight size={15} />
      </button>)}
    </div>}
  </section>
}

function UpcomingSection({ actions }) {
  if (!actions || actions.length === 0) return null
  return <section className="student-upcoming">
    <div className="student-section-heading">
      <div><p className="student-overline">UPCOMING</p><span>What is coming up</span></div>
    </div>
    <div className="student-upcoming-list">
      {actions.map((item, index) => <div className="student-upcoming-item" key={item.id || index} style={{ animationDelay: index * 0.06 + 's' }} onClick={() => item.route && go(item.route)}>
        <div className="student-upcoming-date">
          <span className="student-upcoming-day">{new Date(item.date || item.deadline).getDate()}</span>
          <span className="student-upcoming-month">{(new Date(item.date || item.deadline).toLocaleString('en', { month: 'short' })).toUpperCase()}</span>
        </div>
        <div><strong>{item.title || item.type}</strong><small>{item.taskTitle || item.taskReference || ''}</small></div>
      </div>)}
    </div>
  </section>
}

export function StudentDashboard() {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('sn-student-sidebar') === 'collapsed')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [state, setState] = useState({ loading: true, error: null, model: null })
  const load = () => { const controller = new AbortController(); setState((current) => ({ ...current, loading: true, error: null })); fetchStudentDashboard(controller.signal).then((model) => setState({ loading: false, error: null, model })).catch((error) => { if (error.name !== 'AbortError') setState({ loading: false, error, model: null }) }); return () => controller.abort() }
  useEffect(() => load(), [])
  useEffect(() => { window.localStorage.setItem('sn-student-sidebar', collapsed ? 'collapsed' : 'expanded') }, [collapsed])
  const model = state.model
  const path = window.location.pathname
  const onCreated = () => { load() }
  const attentionQueue = getAttentionQueue(model)
  return <div className="student-app">
    <StudentSidebar collapsed={collapsed} setCollapsed={setCollapsed} path={path} model={model || { unreadMessages: 0, notifications: [] }} />
    <div className="student-main">
      <TopBar student={model?.student} onNotifications={() => setNotificationsOpen(true)} onNewTask={() => setStudioOpen(true)} path={path} />
      <main className="student-content">
        {studioOpen ? <TaskCreationStudio onClose={() => setStudioOpen(false)} onCreated={onCreated} /> : path === '/student/help' ? <div className="student-help-panel"><p className="student-overline">HELP & SUPPORT</p><h2>How can we help you?</h2><div className="student-help-grid"><div className="student-help-card"><h3><BookOpen size={20} /> Getting Started</h3><p>Learn how to create your first task, upload assignment briefs, and work with Solvy to structure your academic workflow.</p></div><div className="student-help-card"><h3><MessageCircle size={20} /> Messages</h3><p>Communicate with your assigned expert, ask questions, and receive updates on your tasks.</p></div><div className="student-help-card"><h3><FolderOpen size={20} /> Files & Deliveries</h3><p>Access your completed work, download deliverables, and review revisions.</p></div><div className="student-help-card"><h3><CreditCard size={20} /> Payments</h3><p>View invoices, manage payment methods, and track transaction history.</p></div></div><div className="student-help-contact"><p className="student-overline">NEED MORE HELP?</p><p>If you have any questions or need assistance, reach out to our support team.</p><ActionButton onClick={() => go('/student/messages')}>Contact Support</ActionButton></div></div> : state.loading ? <DashboardSkeleton /> : state.error ? <DashboardError onRetry={load} access={state.error.message === 'STUDENT_ACCESS_REQUIRED'} /> : <div><section className="student-dashboard-heading"><p className="student-overline">STUDENT WORKSPACE</p><h1>{resolveDashboardState(model).headline}</h1><p>{model.focusAction ? 'Your most important task and next action are below.' : model.tasks.length ? 'Your tasks, progress, and updates are together here.' : 'Upload a brief and let Solvy help you understand it before you commit.'}</p></section><StudentNowCanvas model={model} onNewTask={() => setStudioOpen(true)} /><AttentionQueue queue={attentionQueue} /><ActiveTasks tasks={model.tasks} onNewTask={() => setStudioOpen(true)} /><div className="student-lower-grid"><RecentMovement items={model.recentActivity} /><UpcomingSection actions={model.upcomingActions} /></div></div>}
      </main>
      <StudentMobileNav onNewTask={() => setStudioOpen(true)} path={path} />
    </div>
    <AnimatePresence>
      {notificationsOpen && model && <NotificationDrawer notifications={model.notifications} onClose={() => setNotificationsOpen(false)} />}
    </AnimatePresence>
  </div>
}
