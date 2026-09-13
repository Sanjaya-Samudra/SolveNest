import { useEffect, useMemo, useRef, useState } from 'react'
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform, useMotionTemplate,
} from 'framer-motion'
import { ArrowRight, Check, FileSearch, ClipboardCheck, TrendingUp, ShieldCheck } from 'lucide-react'
import { PolicyReader } from './PolicyReader.jsx'

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function useReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    setR(q.matches)
    const on = (e) => setR(e.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return r
}

const STAGE_LABEL = {
  idle: ['Your workspace is waiting', 'Sign in to continue'],
  identity: ['Confirming identity', 'We just need your email'],
  security: ['Secure access', 'Enter your password'],
  ready: ['Ready when you are', 'Review your details, then continue'],
  verifying: ['Verifying', 'Checking your details'],
  verified: ['Identity verified', 'Opening your workspace'],
  failed: ['Access not confirmed', 'Check your details and try again'],
  recovery: ['Account recovery', 'Reset your password'],
}

/* ── Stack data + layout slots ── */
const CARD_DATA = [
  {
    id: 'research', tag: 'Assessment 02', title: 'Research Report', due: 'Due in 4 days',
    items: [
      { label: 'Sources gathered', done: true },
      { label: 'Outline approved', done: true },
      { label: 'Draft in progress', done: false },
    ],
  },
  {
    id: 'lit', tag: 'Reading', title: 'Literature Review', due: 'Due in 9 days',
    items: [
      { label: '4 sources annotated', done: true },
      { label: 'Summary drafted', done: false },
      { label: 'Citations checked', done: false },
    ],
  },
  {
    id: 'peer', tag: 'Workshop', title: 'Peer Feedback', due: '2 comments pending',
    items: [
      { label: 'Shared for review', done: true },
      { label: 'Feedback read', done: false },
    ],
  },
]
const SLOTS = [
  { left: 24, top: 38, rotate: 0, scale: 1, zIndex: 3 },
  { left: -10, top: 6, rotate: -8, scale: 0.9, zIndex: 2 },
  { left: 166, top: 6, rotate: 8, scale: 0.9, zIndex: 1 },
]

function ProgressRing({ percent }) {
  const spring = useSpring(percent, { stiffness: 120, damping: 20 })
  const bg = useMotionTemplate`conic-gradient(#6BA292 ${spring}%, rgba(20,33,61,0.12) 0)`
  const label = useTransform(spring, (v) => `${Math.round(v)}%`)
  return (
    <motion.div className="snx-ring" style={{ backgroundImage: bg }}>
      <motion.span>{label}</motion.span>
    </motion.div>
  )
}

function Confetti() {
  const dots = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    angle: (Math.PI * 2 * i) / 10 + Math.random() * 0.4,
    dist: 36 + Math.random() * 28,
  })), [])
  return (
    <div className="snx-confetti" aria-hidden="true">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className={d.id % 2 ? 'is-alt' : ''}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(d.angle) * d.dist, y: Math.sin(d.angle) * d.dist - 12, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function StackCard({ card, slot, isFront, reduced, checklist, onBringToFront, onToggle, onDragComplete }) {
  const pct = (checklist.filter((i) => i.done).length / checklist.length) * 100
  return (
    <motion.div
      className={`snx-card ${isFront ? 'snx-card--front' : 'snx-card--back'}`}
      style={{ zIndex: slot.zIndex }}
      animate={{ left: `${slot.left}px`, top: `${slot.top}px`, rotate: slot.rotate, scale: slot.scale }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      drag={isFront && !reduced ? 'y' : false}
      dragConstraints={{ top: -70, bottom: 0 }}
      dragElastic={0.25}
      dragSnapToOrigin
      onDragEnd={(_, info) => { if (isFront && info.offset.y < -46) onDragComplete(card.id) }}
      onClick={() => { if (!isFront) onBringToFront(card.id) }}
      onKeyDown={(e) => { if (!isFront && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onBringToFront(card.id) } }}
      role={!isFront ? 'button' : undefined}
      tabIndex={!isFront ? 0 : undefined}
      aria-label={!isFront ? `Bring ${card.title} to front` : undefined}
      whileHover={!isFront ? { y: -4 } : undefined}
    >
      {isFront ? (
        <>
          <div className="snx-card-top">
            <div>
              <span className="snx-card-eyebrow">{card.tag}</span>
              <h3>{card.title}</h3>
            </div>
            <ProgressRing percent={pct} />
          </div>
          <ul className="snx-checklist">
            {checklist.map((item, i) => (
              <li key={i} className={item.done ? 'is-done' : ''}>
                <button
                  type="button" className="snx-check-btn" aria-pressed={item.done}
                  aria-label={`${item.done ? 'Mark incomplete' : 'Mark complete'}: ${item.label}`}
                  onClick={(e) => { e.stopPropagation(); onToggle(card.id, i) }}
                >
                  {item.done ? <Check size={11} /> : null}
                </button>
                {item.label}
              </li>
            ))}
          </ul>
          <div className="snx-card-foot">{card.due} · drag up to check off a task</div>
        </>
      ) : (
        <>
          <span className="snx-card-tag">{card.tag}</span>
          <span className="snx-card-title-sm">{card.title}</span>
        </>
      )}
    </motion.div>
  )
}

function WorkspacePreview({ stage, reduced, hoverCta }) {
  const [stageLabel, stageSub] = STAGE_LABEL[stage] || STAGE_LABEL.idle
  const [order, setOrder] = useState(CARD_DATA.map((c) => c.id))
  const [checklists, setChecklists] = useState(() => Object.fromEntries(CARD_DATA.map((c) => [c.id, c.items.map((i) => ({ ...i }))])))
  const [burst, setBurst] = useState(0)
  const stageRef = useRef(null)

  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const smx = useSpring(mx, { stiffness: 150, damping: 20 })
  const smy = useSpring(my, { stiffness: 150, damping: 20 })
  const rotateX = useTransform(smy, [0, 1], [7, -7])
  const rotateY = useTransform(smx, [0, 1], [-7, 7])
  const spotX = useTransform(smx, (v) => `${v * 100}%`)
  const spotY = useTransform(smy, (v) => `${v * 100}%`)
  const spotlight = useMotionTemplate`radial-gradient(220px circle at ${spotX} ${spotY}, rgba(255,255,255,0.10), transparent 70%)`

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 650)
    return () => clearTimeout(t)
  }, [burst])

  const onPointerMove = (e) => {
    if (reduced || !stageRef.current) return
    const r = stageRef.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  const onPointerLeave = () => { mx.set(0.5); my.set(0.5) }

  const bringToFront = (id) => setOrder((o) => [id, ...o.filter((x) => x !== id)])
  const toggle = (id, idx) => setChecklists((s) => ({ ...s, [id]: s[id].map((it, i) => (i === idx ? { ...it, done: !it.done } : it)) }))
  const complete = (id) => {
    setChecklists((s) => {
      const items = s[id]
      const next = items.findIndex((i) => !i.done)
      if (next === -1) return s
      setBurst(Date.now())
      return { ...s, [id]: items.map((it, i) => (i === next ? { ...it, done: true } : it)) }
    })
  }

  return (
    <div className="snx-stage-wrap">
      <motion.div
        ref={stageRef}
        className="snx-stage"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={reduced ? undefined : { rotateX, rotateY }}
      >
        {!reduced && <motion.div className="snx-spotlight" style={{ backgroundImage: spotlight }} />}
        {order.map((id, i) => {
          const card = CARD_DATA.find((c) => c.id === id)
          return (
            <StackCard
              key={id} card={card} slot={SLOTS[i]} isFront={i === 0} reduced={reduced}
              checklist={checklists[id]} onBringToFront={bringToFront} onToggle={toggle} onDragComplete={complete}
            />
          )
        })}
        <AnimatePresence>{burst ? <Confetti key={burst} /> : null}</AnimatePresence>
      </motion.div>

      <div className={`snx-status ${hoverCta ? 'is-pulse' : ''}`} aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={stageLabel}
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -4 }}
            transition={{ duration: 0.2 }}
          >
            <span className={`snx-status-dot is-${stage}`} />
            <b>{stageLabel}</b>
            <span>{stageSub}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export function SignInPage() {
  const reduced = useReducedMotion()

  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [focused, setFocused] = useState(null)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [resetSent, setResetSent] = useState(false)
  const [hoverCta, setHoverCta] = useState(false)
  const [policy, setPolicy] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sn-email')
      if (saved) { setEmail(saved); setRemember(true) }
    } catch {}
  }, [])

  const emailOk = EMAIL_RE.test(email.trim())
  const hasPw = password.length > 0
  const stage = status === 'sending' ? 'verifying'
    : status === 'granted' ? 'verified'
    : status === 'failed' ? 'failed'
    : mode === 'reset' ? 'recovery'
    : emailOk && hasPw ? 'ready'
    : focused === 'email' ? 'identity'
    : focused === 'password' ? 'security'
    : 'idle'

  const onFocusField = (k) => setFocused(k)
  const onBlurField = () => setFocused(null)
  const touch = (k) => {
    if (status === 'failed') setStatus('idle')
    setErrors((e) => ({ ...e, [k]: null, form: null }))
  }

  const submit = (e) => {
    e.preventDefault()
    if (status === 'sending' || status === 'granted') return
    const errs = {}
    if (!email.trim()) errs.email = 'Enter your email address.'
    else if (!emailOk) errs.email = 'Enter a valid email address.'
    if (!password) errs.password = 'Enter your password.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      if (remember) window.localStorage.setItem('sn-email', email.trim())
      else window.localStorage.removeItem('sn-email')
    } catch {}
    setStatus('sending')
    timers.current.push(setTimeout(() => {
      let fail = false
      try { fail = new URLSearchParams(window.location.search).get('demo') === 'fail' } catch {}
      setStatus(fail ? 'failed' : 'granted')
      if (fail) setErrors({ form: 'Those details did not match an account.' })
    }, 900))
  }
  const sendReset = (e) => {
    e.preventDefault()
    const errs = {}
    if (!email.trim()) errs.email = 'Enter your email address.'
    else if (!emailOk) errs.email = 'Enter a valid email address.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setResetSent(true)
  }

  return (
    <div className={`sn-page ${status === 'granted' ? 'is-granted' : ''}`}>
      {/* ── LEFT: interactive workspace preview ── */}
      <section className="sn-visual snx-visual" aria-label="SolveNest workspace preview">
        
        <div className="snx-inner">

          <div className="snx-copy">
            <h2>Pick up your assignment<br />right where you left it.</h2>
            <p>Drag a task up to check it off, or click a card behind to bring it forward — this is a live preview of your workspace.</p>
          </div>

          <WorkspacePreview stage={stage} reduced={reduced} hoverCta={hoverCta} />

          <blockquote className="snx-quote">
            "Everything I was working on was still connected — I didn't lose a single citation."
          </blockquote>

          <ul className="snx-features">
            <li><FileSearch size={15} /> Analyze sources</li>
            <li><ClipboardCheck size={15} /> Confirm citations</li>
            <li><TrendingUp size={15} /> Track progress</li>
            <li><ShieldCheck size={15} /> Academic integrity</li>
          </ul>
        </div>
      </section>
      <span className={`sn-divider ${status === 'granted' ? 'is-open' : ''}`} aria-hidden="true" />
      {/* ── RIGHT: auth (unchanged) ── */}
      <section className="sn-auth" aria-label="Sign in">
        <div className="sn-auth-inner">
          {mode === 'signin' && status !== 'granted' && (
            <>
              <span className="sn-eyebrow">WELCOME BACK</span>
              <h1>Continue your<br /><em>SolveNest journey.</em></h1>
              <p className="sn-lede">Sign in to access your tasks, progress, messages and academic workspace.</p>
              <form className={`sn-form ${status === 'sending' ? 'is-busy' : ''}`} onSubmit={submit} noValidate>
                <label className="sn-field" htmlFor="sn-email">
                  <span>Email</span>
                  <span className="sn-control">
                    <input id="sn-email" type="email" autoComplete="email" value={email} placeholder="you@example.com"
                      aria-describedby="sn-email-err" aria-invalid={!!errors.email}
                      onFocus={() => onFocusField('email')} onBlur={onBlurField}
                      onChange={(e) => { setEmail(e.target.value); touch('email') }} />
                  </span>
                  <span className="sn-err" id="sn-email-err" role={errors.email ? 'alert' : undefined}>{errors.email || ''}</span>
                </label>
                <label className="sn-field" htmlFor="sn-password">
                  <span>Password</span>
                  <span className="sn-control has-toggle">
                    <input id="sn-password" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} placeholder="Your password"
                      aria-describedby="sn-password-err" aria-invalid={!!errors.password}
                      onFocus={() => onFocusField('password')} onBlur={onBlurField}
                      onChange={(e) => { setPassword(e.target.value); touch('password') }} />
                    <button type="button" className="sn-show" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}
                      onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
                  </span>
                  <span className="sn-err" id="sn-password-err" role={errors.password ? 'alert' : undefined}>{errors.password || ''}</span>
                </label>
                <div className="sn-row">
                  <label className="sn-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember Me</label>
                  <button type="button" className="sn-link" onClick={() => { setMode('reset'); setErrors({}); setResetSent(false) }}>Forgot Password?</button>
                </div>
                {errors.form && <p className="sn-form-err" role="alert">{errors.form}</p>}
                <button className="sn-cta" type="submit" disabled={status === 'sending'}
                  onMouseEnter={() => setHoverCta(true)} onMouseLeave={() => setHoverCta(false)} onFocus={() => setHoverCta(true)} onBlur={() => setHoverCta(false)}>
                  {status === 'sending' ? 'Signing in…' : <>Sign In <ArrowRight size={15} /></>}
                </button>
              </form>
              <p className="sn-switch">New to SolveNest? <button onClick={() => nav('/register')}>Create Student Account →</button></p>
              <div className="sn-divider-soft" />
              <p className="sn-policy">By continuing, you acknowledge the SolveNest{' '}
                <button onClick={() => setPolicy('terms')}>Terms of Use</button>,{' '}
                <button onClick={() => setPolicy('privacy')}>Privacy Notice</button> and{' '}
                <button onClick={() => setPolicy('integrity')}>Academic Integrity</button> rules.
              </p>
            </>
          )}
          {mode === 'reset' && (
            <>
              <span className="sn-eyebrow">ACCOUNT RECOVERY</span>
              <h1>Reset your<br /><em>password.</em></h1>
              <p className="sn-lede">Enter your account email and we’ll send a reset link.</p>
              {!resetSent ? (
                <form className="sn-form" onSubmit={sendReset} noValidate>
                  <label className="sn-field" htmlFor="sn-reset-email">
                    <span>Email</span>
                    <span className="sn-control">
                      <input id="sn-reset-email" type="email" autoComplete="email" value={email} placeholder="you@example.com"
                        aria-describedby="sn-email-err" aria-invalid={!!errors.email}
                        onFocus={() => onFocusField('email')} onBlur={onBlurField}
                        onChange={(e) => { setEmail(e.target.value); touch('email') }} />
                    </span>
                    <span className="sn-err" id="sn-email-err" role={errors.email ? 'alert' : undefined}>{errors.email || ''}</span>
                  </label>
                  <button className="sn-cta" type="submit">Send Reset Link <ArrowRight size={15} /></button>
                </form>
              ) : (
                <p className="sn-reset-done" role="status">If an account exists for this email, a reset link is on its way.</p>
              )}
              <button className="sn-link" onClick={() => { setMode('signin'); setErrors({}); setResetSent(false) }}>← Back to Sign In</button>
            </>
          )}
          {status === 'granted' && (
            <motion.div className="sn-granted" initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.3 }} aria-live="polite">
              <span className="sn-granted-check"><Check size={18} /></span>
              <span className="sn-eyebrow">WORKSPACE RESTORED</span>
              <h1>Your workspace<br /><em>is ready.</em></h1>
              <p className="sn-lede">Identity verified. Continue into SolveNest.</p>
              <div className="sn-granted-actions">
                <button className="sn-cta" onClick={() => nav('/analyze')}>Analyze My Task <ArrowRight size={15} /></button>
                <button className="sn-link" onClick={() => nav('/help')}>Visit Help Centre →</button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
      {policy && <PolicyReader initial={policy} backLabel="Back to Sign In" onClose={() => setPolicy(null)} />}
    </div>
  )
}

/* Scoped styles for the new left panel only — the right (.sn-auth) panel is untouched. */
