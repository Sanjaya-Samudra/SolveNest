import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  LogOut,
  Mail,
  Monitor,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
  X,
} from 'lucide-react'
import {
  loadAccount,
  saveAccountPreferences,
  saveAccountProfile,
  signOut,
  signOutSession,
  subscribeAccount,
} from '../../student/studentAccountData.js'

const go = (path) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, copy: 'Name and study details used across your workspace.' },
  { id: 'security', label: 'Security', icon: Shield, copy: 'Sign-in status and active sessions.' },
  { id: 'preferences', label: 'Preferences', icon: Fingerprint, copy: 'How updates reach you in this workspace.' },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck, copy: 'What you can request about your account data.' },
  { id: 'policies', label: 'Policies', icon: Mail, copy: 'Agreements recorded on this account.' },
]

const SECTION_IDS = SECTIONS.map((section) => section.id)

const PREFERENCE_ROWS = [
  { key: 'inApp', label: 'In-app updates', copy: 'Task, message, and payment changes in your student workspace.' },
  { key: 'email', label: 'Email summaries', copy: 'Periodic email when email delivery is available on your account.' },
  { key: 'tasks', label: 'Task activity', copy: 'Status changes, reviews, and delivery notices.' },
  { key: 'messages', label: 'Messages', copy: 'New replies from Experts and workspace participants.' },
  { key: 'payments', label: 'Payments', copy: 'Funding, receipts, and payment status updates.' },
]

const PROFILE_FIELDS = [
  { key: 'fullName', label: 'Full name', autoComplete: 'name' },
  { key: 'preferredName', label: 'Preferred name', autoComplete: 'nickname' },
  { key: 'institution', label: 'Institution', autoComplete: 'organization' },
  { key: 'program', label: 'Program or course', autoComplete: 'off' },
]

const EMPTY_PROFILE = { fullName: '', preferredName: '', institution: '', program: '' }
const EMPTY_PREFERENCES = { inApp: true, email: false, tasks: true, messages: true, payments: false }

function sectionFromPath(pathname, search) {
  const fromQuery = new URLSearchParams(search || '').get('section')
  if (fromQuery && SECTION_IDS.includes(fromQuery)) return fromQuery
  const [, , , extra] = String(pathname || '').split('/')
  if (extra && SECTION_IDS.includes(extra)) return extra
  return null
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatWhen(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name) {
  return (name || 'Student')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function sessionIcon(device = '') {
  const text = String(device).toLowerCase()
  if (/iphone|ipad|ios|android/.test(text)) return Smartphone
  return Monitor
}

function setSectionUrl(section) {
  const base = '/student/account'
  const next = section ? `${base}?section=${encodeURIComponent(section)}` : base
  if (`${window.location.pathname}${window.location.search}` !== next) {
    window.history.replaceState({}, '', next)
  }
}

export default function StudentAccountPage() {
  const [snapshot, setSnapshot] = useState({
    account: null,
    loading: true,
    error: null,
    loaded: false,
  })
  const [section, setSection] = useState(() => sectionFromPath(window.location.pathname, window.location.search))
  const [draftProfile, setDraftProfile] = useState(EMPTY_PROFILE)
  const [draftPreferences, setDraftPreferences] = useState(EMPTY_PREFERENCES)
  const [dirtyProfile, setDirtyProfile] = useState(false)
  const [dirtyPreferences, setDirtyPreferences] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [revokingId, setRevokingId] = useState(null)

  useEffect(() => subscribeAccount(setSnapshot), [])

  useEffect(() => {
    loadAccount({ force: false }).catch(() => {})
  }, [])

  const account = snapshot.account
  const identity = account?.identity || null
  const security = account?.security || null
  const privacyControls = account?.privacyControls || null
  const capabilities = account?.capabilities || null
  const policyConsents = account?.policyConsents || []
  const activeSessions = account?.activeSessions || []

  useEffect(() => {
    if (!account) return
    const nextProfile = { ...EMPTY_PROFILE, ...(account.profile || {}) }
    const nextPreferences = { ...EMPTY_PREFERENCES, ...(account.preferences || {}) }
    setDraftProfile(nextProfile)
    setDraftPreferences(nextPreferences)
    setDirtyProfile(false)
    setDirtyPreferences(false)
  }, [account])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onPop = () => setSection(sectionFromPath(window.location.pathname, window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const isDirty = dirtyProfile || dirtyPreferences
  const activeSection = section
    ? SECTIONS.find((item) => item.id === section) || SECTIONS[0]
    : null

  const displayName = identity?.name || draftProfile.fullName || 'Student'
  const memberSince = formatDate(identity?.memberSince)

  const securityRows = useMemo(() => {
    const rows = []
    rows.push({
      key: 'email',
      label: 'Email',
      value: identity?.email || null,
      status: identity?.email
        ? identity.emailVerified
          ? 'Verified'
          : 'Not verified'
        : null,
      tone: identity?.emailVerified ? 'ok' : 'muted',
      icon: Mail,
    })
    rows.push({
      key: 'password',
      label: 'Password',
      value: security?.passwordChangedAt ? `Changed ${formatDate(security.passwordChangedAt)}` : null,
      status: security?.passwordChangeSupported ? 'Change available' : 'Managed with your sign-in',
      tone: 'muted',
      icon: Shield,
      showChange: Boolean(security?.passwordChangeSupported),
    })
    rows.push({
      key: 'two-step',
      label: 'Two-step verification',
      value: null,
      status: security?.twoStepSupported
        ? security.twoStepEnabled
          ? 'On'
          : 'Off'
        : 'Not available yet',
      tone: security?.twoStepSupported ? (security.twoStepEnabled ? 'ok' : 'muted') : 'muted',
      icon: Fingerprint,
    })
    return rows
  }, [identity, security])

  const openSection = (id) => {
    setActionError('')
    setConfirmDiscard(false)
    setSection(id)
    setSectionUrl(id)
  }

  const closeSection = () => {
    if (isDirty) {
      setConfirmDiscard(true)
      return
    }
    setSection(null)
    setSectionUrl(null)
    setActionError('')
  }

  const discardChanges = () => {
    if (account) {
      setDraftProfile({ ...EMPTY_PROFILE, ...(account.profile || {}) })
      setDraftPreferences({ ...EMPTY_PREFERENCES, ...(account.preferences || {}) })
    }
    setDirtyProfile(false)
    setDirtyPreferences(false)
    setActionError('')
    setConfirmDiscard(false)
    setSection(null)
    setSectionUrl(null)
  }

  const updateProfileField = (key, value) => {
    setDraftProfile((prev) => ({ ...prev, [key]: value }))
    setDirtyProfile(true)
    setActionError('')
  }

  const togglePreference = (key) => {
    setDraftPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
    setDirtyPreferences(true)
    setActionError('')
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setActionError('')
    try {
      if (dirtyProfile) await saveAccountProfile(draftProfile)
      if (dirtyPreferences) await saveAccountPreferences(draftPreferences)
      setDirtyProfile(false)
      setDirtyPreferences(false)
      setToast('Changes saved')
    } catch (error) {
      if (error?.message === 'STUDENT_ACCESS_REQUIRED') setActionError('Sign in to save account changes.')
      else setActionError('We could not save those changes. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setActionError('')
    try {
      await signOut()
      go('/login')
    } catch {
      setActionError('We could not sign you out. Try again.')
      setSigningOut(false)
    }
  }

  const handleRevoke = async (session) => {
    if (!session?.id || revokingId) return
    setRevokingId(session.id)
    setActionError('')
    try {
      await signOutSession(session.id)
      if (session.current) {
        go('/login')
        return
      }
      await loadAccount({ force: true }).catch(() => {})
      setToast('Session signed out')
    } catch (error) {
      if (error?.message === 'STUDENT_ACCESS_REQUIRED') go('/login')
      else setActionError('We could not end that session. Try again.')
    } finally {
      setRevokingId(null)
    }
  }

  if (snapshot.error?.message === 'STUDENT_ACCESS_REQUIRED') {
    return (
      <div className="sn-acc sn-acc-page">
        <div className="sn-acc__access" role="alert">
          <span className="sn-acc__access-icon" aria-hidden="true"><Shield size={22} /></span>
          <p className="student-overline">ACCESS REQUIRED</p>
          <h1>Sign in to open Account</h1>
          <p>Your student session is missing or has expired.</p>
          <button type="button" className="student-button" onClick={() => go('/login')}>
            Sign in
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  if (snapshot.loading && !account) {
    return (
      <div className="sn-acc sn-acc-page">
        <div className="sn-acc__skeleton" role="status" aria-live="polite" aria-label="Loading account">
          <span className="sn-acc__skeleton-head" />
          <div className="sn-acc__skeleton-split">
            <span />
            <span />
          </div>
        </div>
      </div>
    )
  }

  if (snapshot.error && !account) {
    return (
      <div className="sn-acc sn-acc-page">
        <div className="sn-acc__access" role="alert">
          <span className="sn-acc__access-icon sn-acc__access-icon--warn" aria-hidden="true"><AlertTriangle size={22} /></span>
          <p className="student-overline">COULD NOT LOAD</p>
          <h1>We could not load Account</h1>
          <p>Check your connection and try again.</p>
          <button type="button" className="student-button" onClick={() => loadAccount({ force: true }).catch(() => {})}>
            Try again
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  if (activeSection) {
    return (
      <div className="sn-acc sn-acc-page">
        <a className="sn-acc__skip" href="#sn-acc-main">
          Skip to account section
        </a>

        <header className="sn-acc__header">
          <div className="sn-acc__header-text">
            <p className="student-overline sn-acc__eyebrow">Account</p>
            <h1 className="sn-acc__title">{activeSection.label}</h1>
            <p className="sn-acc__subtitle">{activeSection.copy}</p>
          </div>
          <button type="button" className="student-button student-button--secondary student-button--sm" onClick={closeSection}>
            <X size={15} aria-hidden="true" />
            Close section
          </button>
        </header>

        <div className="sn-acc__body" id="sn-acc-main">
          <div className="sn-acc__main-col">
            {activeSection.id === 'profile' && (
              <section className="sn-acc__card" aria-labelledby="sn-acc-profile-title">
                <div className="sn-acc__card-head">
                  <div className="sn-acc__avatar" aria-hidden="true">{initials(displayName)}</div>
                  <div>
                    <p className="student-overline">Signed in as</p>
                    <h2 id="sn-acc-profile-title">{displayName}</h2>
                    <p className="sn-acc__card-meta">
                      {identity?.email || 'No email on this session'}
                      {memberSince ? ` · Member since ${memberSince}` : ''}
                    </p>
                  </div>
                </div>
                <div className="sn-acc__fields">
                  {PROFILE_FIELDS.map((field) => (
                    <label key={field.key} className="sn-acc__field">
                      <span>{field.label}</span>
                      <input
                        type="text"
                        value={draftProfile[field.key] || ''}
                        autoComplete={field.autoComplete}
                        onChange={(event) => updateProfileField(field.key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}

            {activeSection.id === 'security' && (
              <>
                <section className="sn-acc__card" aria-labelledby="sn-acc-security-title">
                  <div className="sn-acc__card-head sn-acc__card-head--plain">
                    <div>
                      <p className="student-overline">Sign-in health</p>
                      <h2 id="sn-acc-security-title">How you get in</h2>
                    </div>
                  </div>
                  <ul className="sn-acc__status-list">
                    {securityRows.map((row) => {
                      const Icon = row.icon
                      return (
                        <li key={row.key} className="sn-acc__status-row">
                          <span className={`sn-acc__status-icon tone-${row.tone}`} aria-hidden="true"><Icon size={16} /></span>
                          <div className="sn-acc__status-body">
                            <div className="sn-acc__status-top">
                              <strong>{row.label}</strong>
                              {row.status && (
                                <span className={`sn-acc__pill tone-${row.tone}`}>{row.status}</span>
                              )}
                            </div>
                            {row.value && <p>{row.value}</p>}
                          </div>
                          {row.showChange && (
                            <button type="button" className="student-button student-button--secondary student-button--sm" disabled>
                              Change
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section className="sn-acc__card" aria-labelledby="sn-acc-sessions-title">
                  <div className="sn-acc__card-head sn-acc__card-head--plain">
                    <div>
                      <p className="student-overline">Active sessions</p>
                      <h2 id="sn-acc-sessions-title">Where you are signed in</h2>
                    </div>
                  </div>
                  {activeSessions.length === 0 ? (
                    <p className="sn-acc__empty-inline">No other active sessions were reported.</p>
                  ) : (
                    <ul className="sn-acc__session-list">
                      {activeSessions.map((session) => {
                        const Icon = sessionIcon(session.device)
                        return (
                          <li key={session.id} className={`sn-acc__session ${session.current ? 'is-current' : ''}`}>
                            <span className="sn-acc__session-icon" aria-hidden="true"><Icon size={16} /></span>
                            <div className="sn-acc__session-body">
                              <div className="sn-acc__session-top">
                                <strong>{session.device || 'This device'}</strong>
                                {session.current && <span className="sn-acc__pill tone-ok">This device</span>}
                              </div>
                              <p>{session.lastActiveAt ? `Last active ${formatWhen(session.lastActiveAt)}` : 'Active now'}</p>
                            </div>
                            <button
                              type="button"
                              className="student-button student-button--secondary student-button--sm"
                              onClick={() => handleRevoke(session)}
                              disabled={revokingId === session.id}
                            >
                              {revokingId === session.id ? 'Ending…' : session.current ? 'Sign out' : 'End session'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <div className="sn-acc__card-actions">
                    <button type="button" className="student-button sn-acc__signout" onClick={handleSignOut} disabled={signingOut}>
                      <LogOut size={15} aria-hidden="true" />
                      {signingOut ? 'Signing out…' : 'Sign out of this device'}
                    </button>
                  </div>
                </section>
              </>
            )}

            {activeSection.id === 'preferences' && (
              <section className="sn-acc__card" aria-labelledby="sn-acc-prefs-title">
                <div className="sn-acc__card-head sn-acc__card-head--plain">
                  <div>
                    <p className="student-overline">Notifications</p>
                    <h2 id="sn-acc-prefs-title">Choose how you hear from us</h2>
                  </div>
                </div>
                <ul className="sn-acc__toggle-list">
                  {PREFERENCE_ROWS.map((row) => (
                    <li key={row.key} className="sn-acc__toggle-row">
                      <div className="sn-acc__toggle-copy">
                        <strong>{row.label}</strong>
                        <p>{row.copy}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(draftPreferences[row.key])}
                        aria-label={row.label}
                        className={`sn-acc__switch ${draftPreferences[row.key] ? 'is-on' : ''}`}
                        onClick={() => togglePreference(row.key)}
                      >
                        <span className="sn-acc__switch-knob" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {activeSection.id === 'privacy' && (
              <section className="sn-acc__card" aria-labelledby="sn-acc-privacy-title">
                <div className="sn-acc__card-head sn-acc__card-head--plain">
                  <div>
                    <p className="student-overline">Your data</p>
                    <h2 id="sn-acc-privacy-title">Privacy controls</h2>
                  </div>
                </div>
                <ul className="sn-acc__status-list">
                  <li className="sn-acc__status-row">
                    <span className="sn-acc__status-icon tone-muted" aria-hidden="true"><Save size={16} /></span>
                    <div className="sn-acc__status-body">
                      <div className="sn-acc__status-top">
                        <strong>Data export</strong>
                        <span className="sn-acc__pill tone-muted">
                          {privacyControls?.dataExport ? 'Available' : 'Not available yet'}
                        </span>
                      </div>
                      <p>
                        {privacyControls?.dataExport
                          ? 'Request a copy of the data tied to this account.'
                          : 'Export is not open on this account right now.'}
                      </p>
                    </div>
                  </li>
                  <li className="sn-acc__status-row">
                    <span className="sn-acc__status-icon tone-muted" aria-hidden="true"><AlertTriangle size={16} /></span>
                    <div className="sn-acc__status-body">
                      <div className="sn-acc__status-top">
                        <strong>Close account</strong>
                        <span className="sn-acc__pill tone-muted">
                          {privacyControls?.accountClosure
                            ? privacyControls.activeTaskBlock
                              ? 'Blocked by active tasks'
                              : 'Available'
                            : 'Not available yet'}
                        </span>
                      </div>
                      <p>
                        {privacyControls?.accountClosure
                          ? privacyControls.activeTaskBlock
                            ? 'Finish or resolve active tasks before closing this account.'
                            : 'Closure can be requested when no task blocks apply.'
                          : 'Account closure is not open on this account right now.'}
                      </p>
                    </div>
                  </li>
                  <li className="sn-acc__status-row">
                    <span className="sn-acc__status-icon tone-muted" aria-hidden="true"><ShieldCheck size={16} /></span>
                    <div className="sn-acc__status-body">
                      <div className="sn-acc__status-top">
                        <strong>Workspace visibility</strong>
                        <span className="sn-acc__pill tone-ok">On</span>
                      </div>
                      <p>Task files and messages stay in your student workspace with assigned participants for that task.</p>
                    </div>
                  </li>
                </ul>
                <div className="sn-acc__card-actions">
                  <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => go('/student/help')}>
                    Privacy questions
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {activeSection.id === 'policies' && (
              <section className="sn-acc__card" aria-labelledby="sn-acc-policies-title">
                <div className="sn-acc__card-head sn-acc__card-head--plain">
                  <div>
                    <p className="student-overline">Agreements</p>
                    <h2 id="sn-acc-policies-title">Policy consents</h2>
                  </div>
                </div>
                {policyConsents.length === 0 ? (
                  <div className="sn-acc__empty-inline" role="status">
                    <p className="student-overline">No consents recorded</p>
                    <p>No policy acceptances are stored on this account yet.</p>
                    <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => go('/student/help')}>
                      Open Help policies
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <ul className="sn-acc__consent-list">
                    {policyConsents.map((consent) => (
                      <li key={consent.id} className="sn-acc__consent">
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <div>
                          <strong>{consent.title}</strong>
                          <p>
                            {consent.version ? `Version ${consent.version}` : 'Policy'}
                            {consent.acceptedAt ? ` · Accepted ${formatDate(consent.acceptedAt)}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="sn-acc__card-actions">
                  <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => go('/student/help')}>
                    Read product policies
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="sn-acc__side" aria-label="Account sections">
            {SECTIONS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sn-acc__side-item ${item.id === activeSection.id ? 'is-active' : ''}`}
                  onClick={() => openSection(item.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                  <ChevronRight size={14} className="sn-acc__side-chevron" aria-hidden="true" />
                </button>
              )
            })}
          </aside>
        </div>

        {isDirty && (
          <div className="sn-acc__savebar" role="region" aria-label="Unsaved changes">
            <div className="sn-acc__savebar-copy">
              <strong>Unsaved changes</strong>
              <span>{actionError || 'Save or discard before leaving this section.'}</span>
            </div>
            <div className="sn-acc__savebar-actions">
              <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => setConfirmDiscard(true)} disabled={saving}>
                Discard
              </button>
              <button type="button" className="student-button student-button--sm" onClick={save} disabled={saving}>
                <Save size={14} aria-hidden="true" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {!isDirty && actionError && (
          <p className="sn-acc__inline-error" role="alert">{actionError}</p>
        )}

        {confirmDiscard && (
          <div className="sn-acc__dialog-backdrop" role="presentation" onClick={() => setConfirmDiscard(false)}>
            <div
              className="sn-acc__dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="sn-acc-discard-title"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="student-overline">DISCARD CHANGES?</p>
              <h2 id="sn-acc-discard-title">Your edits in this section will be lost.</h2>
              <p>You have unsaved account changes. Discarding returns the section to the last saved values.</p>
              <div className="sn-acc__dialog-actions">
                <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </button>
                <button type="button" className="student-button student-button--sm" onClick={discardChanges}>
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="sn-acc__toast" role="status" aria-live="polite">
            <CheckCircle2 size={15} aria-hidden="true" />
            {toast}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sn-acc sn-acc-page">
      <a className="sn-acc__skip" href="#sn-acc-main">
        Skip to account content
      </a>

      <header className="sn-acc__header">
        <div className="sn-acc__header-text">
          <p className="student-overline sn-acc__eyebrow">Student account</p>
          <h1 className="sn-acc__title">Your account</h1>
          <p className="sn-acc__subtitle">
            Profile, security, and workspace preferences for this student session.
          </p>
        </div>
        <button type="button" className="student-button student-button--secondary student-button--sm" onClick={() => loadAccount({ force: true }).catch(() => {})}>
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <div className="sn-acc__home" id="sn-acc-main">
        <section className="sn-acc__identity" aria-label="Signed-in identity">
          <div className="sn-acc__avatar sn-acc__avatar--lg" aria-hidden="true">{initials(displayName)}</div>
          <div className="sn-acc__identity-copy">
            <p className="student-overline">Signed in</p>
            <h2>{displayName}</h2>
            <p>
              {identity?.email || identity?.studentId || 'Student session'}
              {memberSince ? ` · Member since ${memberSince}` : ''}
            </p>
            <div className="sn-acc__identity-pills">
              <span className={`sn-acc__pill ${identity?.emailVerified ? 'tone-ok' : 'tone-muted'}`}>
                {identity?.email ? (identity.emailVerified ? 'Email verified' : 'Email unverified') : 'Email not set'}
              </span>
              <span className="sn-acc__pill tone-muted">
                {activeSessions.length} active session{activeSessions.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </section>

        <div className="sn-acc__grid">
          {SECTIONS.map((item) => {
            const Icon = item.icon
            let detail = ''
            if (item.id === 'profile') detail = draftProfile.fullName || draftProfile.institution || 'Add your study details'
            if (item.id === 'security') detail = security?.passwordChangedAt ? `Password changed ${formatDate(security.passwordChangedAt)}` : 'Sessions and sign-in status'
            if (item.id === 'preferences') {
              const on = PREFERENCE_ROWS.filter((row) => draftPreferences[row.key]).length
              detail = `${on} of ${PREFERENCE_ROWS.length} updates on`
            }
            if (item.id === 'privacy') detail = privacyControls?.accountClosure ? 'Controls available' : 'Review data controls'
            if (item.id === 'policies') detail = policyConsents.length ? `${policyConsents.length} recorded consent${policyConsents.length === 1 ? '' : 's'}` : 'No consents recorded'
            return (
              <button key={item.id} type="button" className="sn-acc__tile" onClick={() => openSection(item.id)}>
                <span className="sn-acc__tile-icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="sn-acc__tile-body">
                  <strong>{item.label}</strong>
                  <span>{item.copy}</span>
                  <em>{detail}</em>
                </span>
                <ChevronRight size={16} className="sn-acc__tile-chevron" aria-hidden="true" />
              </button>
            )
          })}
        </div>

        <section className="sn-acc__card sn-acc__card--sessions" aria-labelledby="sn-acc-home-sessions">
          <div className="sn-acc__card-head sn-acc__card-head--plain">
            <div>
              <p className="student-overline">Sessions</p>
              <h2 id="sn-acc-home-sessions">Currently active</h2>
            </div>
            <button type="button" className="sn-acc__link" onClick={() => openSection('security')}>
              Manage
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          <ul className="sn-acc__session-list">
            {activeSessions.map((session) => {
              const Icon = sessionIcon(session.device)
              return (
                <li key={session.id} className={`sn-acc__session ${session.current ? 'is-current' : ''}`}>
                  <span className="sn-acc__session-icon" aria-hidden="true"><Icon size={16} /></span>
                  <div className="sn-acc__session-body">
                    <div className="sn-acc__session-top">
                      <strong>{session.device || 'This device'}</strong>
                      {session.current && <span className="sn-acc__pill tone-ok">This device</span>}
                    </div>
                    <p>{session.lastActiveAt ? `Last active ${formatWhen(session.lastActiveAt)}` : 'Active now'}</p>
                  </div>
                </li>
              )
            })}
            {activeSessions.length === 0 && (
              <li className="sn-acc__empty-inline">No active sessions were reported.</li>
            )}
          </ul>
        </section>

        <div className="sn-acc__home-footer">
          <button type="button" className="student-button sn-acc__signout" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={15} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          <button type="button" className="student-button student-button--secondary" onClick={() => go('/student/help')}>
            Get help
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {toast && (
        <div className="sn-acc__toast" role="status" aria-live="polite">
          <CheckCircle2 size={15} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  )
}
