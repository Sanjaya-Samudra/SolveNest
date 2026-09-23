import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTone,
  subscribeNotifications,
} from '../../student/studentNotificationsData.js'

const go = (path) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs-you', label: 'Needs you' },
  { key: 'unread', label: 'Unread' },
  { key: 'task', label: 'Tasks' },
  { key: 'payment', label: 'Payments' },
  { key: 'delivery', label: 'Deliveries' },
]

const CATEGORY_ICON = {
  task: (props) => (
    <svg viewBox="0 0 16 16" width="13" height="13" {...props}>
      <rect x="2" y="2" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8.2l1.8 1.8L11 6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  message: (props) => (
    <svg viewBox="0 0 16 16" width="13" height="13" {...props}>
      <path d="M2.5 3.5h11a1 1 0 011 1v6a1 1 0 01-1 1H6.8L3.8 14v-2.5H2.5a1 1 0 01-1-1v-6a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  payment: (props) => (
    <svg viewBox="0 0 16 16" width="13" height="13" {...props}>
      <path d="M4 2.5h8v11l-2-1.3-2 1.3-2-1.3-2 1.3v-11z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 6h4M6 8.3h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  delivery: (props) => (
    <svg viewBox="0 0 16 16" width="13" height="13" {...props}>
      <path d="M2.5 5.5L8 2.5l5.5 3v5L8 13.5l-5.5-3v-5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.7 5.6L8 8.5l5.3-2.9M8 8.5V13.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

function isYesterday(a, b) {
  const y = new Date(b)
  y.setDate(b.getDate() - 1)
  return a.toDateString() === y.toDateString()
}

function timeAgo(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const mins = Math.floor((now - d) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  if (isSameDay(d, now)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (isYesterday(d, now)) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function groupLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Earlier'
  const now = new Date()
  if (isSameDay(d, now)) return 'Today'
  if (isYesterday(d, now)) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function fullTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

export default function StudentNotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeNotifications((snapshot) => {
      setItems(snapshot.items)
      setLoading(snapshot.loading)
      setError(snapshot.error)
      if (!selectedId && snapshot.items.length) setSelectedId(snapshot.items[0].id)
    })
    loadNotifications({ force: true }).catch(() => {})
    return unsubscribe
  }, [selectedId])

  const unreadCount = items.filter((n) => !n.isRead).length

  const counts = {
    all: items.length,
    'needs-you': items.filter((n) => n.requiresAction).length,
    unread: unreadCount,
    task: items.filter((n) => n.category === 'task').length,
    payment: items.filter((n) => n.category === 'payment').length,
    delivery: items.filter((n) => n.category === 'delivery').length,
  }

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === 'needs-you' && !n.requiresAction) return false
      if (filter === 'unread' && n.isRead) return false
      if (['task', 'payment', 'delivery'].includes(filter) && n.category !== filter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${n.title} ${n.task?.title || ''} ${n.task?.ref || ''} ${n.description || n.body || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, filter, search])

  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((n) => {
      const g = groupLabel(n.createdAt)
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(n)
    })
    return Array.from(map.entries())
  }, [filtered])

  const selected = items.find((n) => n.id === selectedId) || null

  async function selectRow(id) {
    setSelectedId(id)
    const target = items.find((n) => n.id === id)
    if (target && !target.isRead) {
      try {
        await markNotificationRead(id)
      } catch {}
    }
  }

  async function markAllRead() {
    setBusy(true)
    try {
      await markAllNotificationsRead()
    } catch {} finally {
      setBusy(false)
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      await loadNotifications({ force: true })
    } catch {}
  }

  function threaded(i) {
    if (i <= 0) return false
    return filtered[i].task?.ref && filtered[i].task.ref === filtered[i - 1].task?.ref
  }

  if (error && error.message === 'STUDENT_ACCESS_REQUIRED') {
    return (
      <div className="sn-ntf">
        <div className="sn-ntf__empty">
          <p className="student-overline">ACCESS REQUIRED</p>
          <h2 className="sn-ntf__empty-title">Sign in to open notifications</h2>
          <p className="sn-ntf__empty-body">Your student session is missing or has expired.</p>
          <button type="button" className="sn-ntf__link-btn" onClick={() => go('/login')}>Sign in →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sn-ntf sn-ntf-page">
      <header className="sn-ntf__header">
        <div className="sn-ntf__header-text">
          <span className="student-overline">Notifications</span>
          <h1 className="sn-ntf__title">Signal centre</h1>
          <p className="sn-ntf__subtitle">
            Everything important that changed across your SolveNest workspace.
          </p>
        </div>
        <div className="sn-ntf__header-actions">
          {unreadCount > 0 && (
            <button type="button" className="sn-ntf__unread-link" onClick={() => setFilter('unread')}>
              {unreadCount} unread update{unreadCount === 1 ? '' : 's'}
            </button>
          )}
          <button
            type="button"
            className="student-button student-button--secondary student-button--sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              className="student-button student-button--sm"
              onClick={markAllRead}
              disabled={busy}
            >
              Mark all as read
            </button>
          )}
        </div>
      </header>

      <div className="sn-ntf__control">
        <label className="sn-ntf__search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            aria-label="Search notifications"
          />
        </label>
        <nav className="sn-ntf__filters" aria-label="Notification filters">
          {FILTERS.map((f) => {
            const active = filter === f.key
            const c = counts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                className={`sn-ntf__filter ${active ? 'is-active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {c > 0 ? <span className="sn-ntf__filter-count">{c}</span> : null}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="sn-ntf__workspace">
        <div className="sn-ntf__stream">
          {loading && !items.length ? (
            <p className="sn-ntf__status">Loading notifications…</p>
          ) : null}

          {!loading && error && !items.length ? (
            <div className="sn-ntf__empty">
              <h2 className="sn-ntf__empty-title">Could not load notifications</h2>
              <p className="sn-ntf__empty-body">The notifications service did not respond.</p>
              <button type="button" className="sn-ntf__link-btn" onClick={refresh}>Try again →</button>
            </div>
          ) : null}

          {!loading && groups.length === 0 && items.length > 0 ? (
            <div className="sn-ntf__empty">
              <h2 className="sn-ntf__empty-title">No matching notifications</h2>
              <p className="sn-ntf__empty-body">We couldn&apos;t find anything matching “{search}”.</p>
              <button type="button" className="sn-ntf__link-btn" onClick={() => setSearch('')}>Clear search →</button>
            </div>
          ) : null}

          {!loading && items.length === 0 && !error ? (
            <div className="sn-ntf__empty">
              <h2 className="sn-ntf__empty-title">You&apos;re all caught up</h2>
              <p className="sn-ntf__empty-body">New task, payment, delivery, and message updates will appear here.</p>
            </div>
          ) : null}

          {groups.map(([label, groupItems]) => (
            <div key={label}>
              <div className="sn-ntf__group-label">{label}</div>
              <div>
                {groupItems.map((n) => {
                  const globalIdx = filtered.indexOf(n)
                  const connect = threaded(globalIdx)
                  const isSelected = n.id === selectedId
                  const tone = resolveNotificationTone(n)
                  const Icon = CATEGORY_ICON[n.category] || CATEGORY_ICON.task
                  return (
                    <div key={n.id} className="sn-ntf__row-wrap">
                      {connect ? <div className="sn-ntf__thread" /> : null}
                      <button
                        type="button"
                        className={[
                          'sn-ntf__row',
                          isSelected ? 'is-selected' : '',
                          n.isRead ? '' : 'is-unread',
                        ].filter(Boolean).join(' ')}
                        onClick={() => selectRow(n.id)}
                        aria-selected={isSelected}
                      >
                        <span
                          className={[
                            'sn-ntf__dot',
                            n.isRead ? 'is-read' : `is-unread-${tone === 'neutral' ? 'active' : tone}`,
                          ].join(' ')}
                        />
                        <span className={`sn-ntf__icon tone-${tone}`}>
                          <Icon />
                        </span>
                        <span className="sn-ntf__row-body">
                          <span className="sn-ntf__row-top">
                            <span className="sn-ntf__row-title">{n.title}</span>
                            {n.requiresAction && !n.isRead ? (
                              <span className="sn-ntf__action-tag">Action required</span>
                            ) : null}
                          </span>
                          <span className="sn-ntf__row-task">
                            {n.task?.title}{' '}
                            {n.task?.ref ? <span className="sn-ntf__row-ref">· {n.task.ref}</span> : null}
                          </span>
                        </span>
                        <span className="sn-ntf__row-time">{timeAgo(n.createdAt)}</span>
                        {n.primaryAction || n.route ? <span className="sn-ntf__arrow">→</span> : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <aside className="sn-ntf__inspector" key={selected?.id || 'empty'}>
          {selected ? (
            <>
              <div className="sn-ntf__insp-top">
                <span className={`sn-ntf__insp-category tone-${resolveNotificationTone(selected)}`}>
                  {selected.category}
                </span>
                <span className="sn-ntf__insp-dot">·</span>
                <span className="sn-ntf__insp-meta">{selected.isRead ? 'Read' : 'Unread'}</span>
                <span className="sn-ntf__insp-dot">·</span>
                <span className="sn-ntf__insp-meta">{fullTime(selected.createdAt)}</span>
              </div>
              <h2 className="sn-ntf__insp-title">{selected.title}</h2>
              <div className="sn-ntf__insp-task">
                {selected.task?.title}
                <span className="sn-ntf__insp-task-sub">
                  {[selected.task?.subject, selected.task?.ref].filter(Boolean).join(' · ')}
                </span>
              </div>

              <p className="sn-ntf__insp-desc">{selected.description}</p>

              {selected.previousState ? (
                <div className="sn-ntf__block">
                  <div className="sn-ntf__label">What changed</div>
                  <div className="sn-ntf__change">
                    <span className="sn-ntf__change-old">{selected.previousState}</span>
                    <span aria-hidden="true">→</span>
                    <span className="sn-ntf__change-new">{selected.currentState}</span>
                  </div>
                </div>
              ) : null}

              {selected.meaning ? (
                <div className="sn-ntf__block">
                  <div className="sn-ntf__label">What this means</div>
                  <p className="sn-ntf__body-text">{selected.meaning}</p>
                </div>
              ) : null}

              {selected.next ? (
                <div className="sn-ntf__block">
                  <div className="sn-ntf__label">Next</div>
                  <p className="sn-ntf__body-text">{selected.next}</p>
                </div>
              ) : null}

              {selected.category === 'message' && selected.sender ? (
                <div className="sn-ntf__entity">
                  <div className="sn-ntf__sender-row">
                    <span className="sn-ntf__sender-name">{selected.sender.name}</span>
                    <span className="sn-ntf__sender-role">{selected.sender.role}</span>
                  </div>
                  {selected.preview ? (
                    <p className="sn-ntf__preview">“{selected.preview}”</p>
                  ) : null}
                </div>
              ) : null}

              {selected.category === 'payment' && selected.entity?.amount ? (
                <div className="sn-ntf__entity">
                  <span className="sn-ntf__entity-amount">{selected.entity.amount}</span>
                  <span className="sn-ntf__entity-status">{selected.entity.status}</span>
                </div>
              ) : null}

              {selected.category === 'delivery' && selected.entity ? (
                <div className="sn-ntf__entity">
                  <span className="sn-ntf__entity-amount">{selected.entity.version}</span>
                  <span className="sn-ntf__entity-status">{selected.entity.state}</span>
                </div>
              ) : null}

              {selected.entity?.priceDelta ? (
                <div className="sn-ntf__entity">
                  <span className="sn-ntf__entity-amount">{selected.entity.priceDelta}</span>
                  <span className="sn-ntf__entity-status">{selected.entity.timeDelta}</span>
                </div>
              ) : null}

              <div className="sn-ntf__actions">
                {selected.primaryAction ? (
                  <button
                    type="button"
                    className="sn-ntf__primary"
                    onClick={() => go(selected.primaryAction.route)}
                  >
                    {selected.primaryAction.label} →
                  </button>
                ) : selected.route ? (
                  <button type="button" className="sn-ntf__primary" onClick={() => go(selected.route)}>
                    Open update →
                  </button>
                ) : (
                  <div className="sn-ntf__no-action">No action required</div>
                )}
                {selected.secondaryAction ? (
                  <button
                    type="button"
                    className="sn-ntf__secondary"
                    onClick={() => go(selected.secondaryAction.route)}
                  >
                    {selected.secondaryAction.label}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="sn-ntf__empty">
              <h2 className="sn-ntf__empty-title">Select a notification</h2>
              <p className="sn-ntf__empty-body">Choose an item from the stream to see full context here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
