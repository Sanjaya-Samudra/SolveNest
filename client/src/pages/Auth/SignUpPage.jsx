import { useEffect, useMemo, useRef, useState } from 'react'
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform, useMotionTemplate,
} from 'framer-motion'
import { ArrowRight, Check, Mail, ClipboardList, Sparkles, FolderOpen, TrendingUp } from 'lucide-react'
import { PolicyReader } from './PolicyReader.jsx'

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const maskEmail = (e) => {
  const [u, d] = (e || '').split('@')
  if (!u || !d) return e
  return `${u[0]}•••@${d}`
}

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

const TILES = [
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'solvy', label: 'Solvy', icon: Sparkles },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
]

function Confetti() {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (Math.PI * 2 * i) / 12 + Math.random() * 0.3,
    dist: 60 + Math.random() * 46,
  })), [])
  return (
    <div className="idc-confetti" aria-hidden="true">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className={d.id % 3 === 0 ? 'is-gold' : d.id % 3 === 1 ? 'is-sage' : 'is-paper'}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(d.angle) * d.dist, y: Math.sin(d.angle) * d.dist - 16, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

/* ── The interactive ID card: fills in as you type, flips to verify, then activates ── */
function IdCardVisual({ step, name, email, password, verified, onSealClick, reduced }) {
  const stageRef = useRef(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const smx = useSpring(mx, { stiffness: 140, damping: 20 })
  const smy = useSpring(my, { stiffness: 140, damping: 20 })
  const rotateX = useTransform(smy, [0, 1], [8, -8])
  const rotateY = useTransform(smx, [0, 1], [-8, 8])
  const sheenX = useTransform(smx, (v) => `${v * 100}%`)
  const sheenY = useTransform(smy, (v) => `${v * 100}%`)
  const sheen = useMotionTemplate`linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) ${sheenX}, transparent 62%)`

  const onPointerMove = (e) => {
    if (reduced || !stageRef.current) return
    const r = stageRef.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  const onPointerLeave = () => { mx.set(0.5); my.set(0.5) }

  const showBack = step === 1 && !verified
  const active = step >= 2
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3

  return (
    <div className="idc-wrap">
      <div
        ref={stageRef}
        className="idc-stage"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={reduced ? undefined : { rotateX, rotateY }}
      >
        <motion.div className="idc-inner" animate={{ rotateY: showBack ? 180 : 0 }} transition={{ type: 'spring', stiffness: 180, damping: 22 }}>
          {/* front face */}
          <div className="idc-face idc-front">
            {!reduced && <motion.div className="idc-sheen" style={{ backgroundImage: sheen }} />}
            <div className="idc-row-top">
              <span className="idc-eyebrow">{active ? 'Workspace active' : 'Student ID · in progress'}</span>
              <AnimatePresence>
                {active && (
                  <motion.span
                    className="idc-stamp"
                    initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
                    animate={{ opacity: 1, scale: 1, rotate: -12 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  >
                    Active
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="idc-name">{name.trim() || 'Your name'}</div>
            <div className="idc-meta">
              <div>
                <span>ID number</span>
                <b>{email.trim() ? maskEmail(email.trim()) : '—'}</b>
              </div>
              <div>
                <span>Access key</span>
                <div className="idc-strength">
                  {[1, 2, 3].map((n) => <i key={n} className={strength >= n ? 'is-on' : ''} />)}
                </div>
              </div>
            </div>
          </div>
          {/* back face */}
          <div className="idc-face idc-back">
            <span className="idc-eyebrow">Confirm it's you</span>
            <button type="button" className="idc-envelope" onClick={onSealClick} aria-label="Confirm email verification">
              <Mail size={20} />
              <span>Break the seal to confirm</span>
              <span className="idc-seal" />
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div className="idc-tiles" initial="hidden" animate="show">
            {TILES.map((t, i) => {
              const Icon = t.icon
              return (
                <motion.div
                  key={t.id} className="idc-tile"
                  initial={{ opacity: 0, y: 10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: reduced ? 0 : 0.08 * i, type: 'spring', stiffness: 240, damping: 20 }}
                  whileHover={reduced ? undefined : { y: -3, scale: 1.05 }}
                >
                  <Icon size={16} /><span>{t.label}</span>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{active && <Confetti key="confetti" />}</AnimatePresence>
    </div>
  )
}

export function SignUpPage() {
  const reduced = useReducedMotion()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [verified, setVerified] = useState(false)
  const [policy, setPolicy] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const valid = { name: name.trim().length >= 2, email: EMAIL_RE.test(email.trim()), password: password.length > 0 }

  const confirmVerification = () => {
    if (verified) return
    setVerified(true)
    timers.current.push(setTimeout(() => setStep(2), 650))
  }

  const submitAccount = (e) => {
    e.preventDefault()
    if (status === 'sending') return
    const errs = {}
    if (!valid.name) errs.name = 'Enter your full name.'
    if (!email.trim()) errs.email = 'Enter your email address.'
    else if (!valid.email) errs.email = 'Enter a valid email address.'
    if (!password) errs.password = 'Create a password.'
    if (!confirmPw) errs.confirmPw = 'Confirm your password.'
    else if (confirmPw !== password) errs.confirmPw = 'Passwords do not match.'
    if (!agree) errs.agree = 'Please read and accept the policies to continue.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setStatus('sending')
    timers.current.push(setTimeout(() => {
      let fail = false
      try { fail = new URLSearchParams(window.location.search).get('demo') === 'fail' } catch {}
      if (fail) { setStatus('idle'); setErrors({ form: 'We couldn’t create your account with those details.' }) }
      else { setStatus('idle'); setStep(1) }
    }, 900))
  }

  return (
    <div className="sn-page sn-signup">
      {/* ── LEFT: interactive ID card ── */}
      <section className="sn-visual idc-visual" aria-label="Your SolveNest student ID, assembling as you sign up">
        <div className="idc-inner-wrap">

          <div className="idc-copy">
            <h2>{step < 2 ? <>Your student ID<br />builds itself.</> : <>Your workspace<br />is live.</>}</h2>
            <p>{step === 0 && 'Type your details and watch your card fill in — nothing here is stored until you continue.'}
              {step === 1 && (verified ? 'Confirmed. Assembling your workspace…' : 'Click the seal on the card, or confirm on the right, once you’ve opened the email.')}
              {step === 2 && 'Four tools are already waiting for you inside.'}</p>
          </div>

          <IdCardVisual step={step} name={name} email={email} password={password} verified={verified} onSealClick={confirmVerification} reduced={reduced} />

          <div className="idc-progress" role="group" aria-label="Signup progress">
            <span className="idc-progress-line"><i style={{ transform: `scaleX(${step / 2})` }} /></span>
            {['Account', 'Verify', 'Ready'].map((s, i) => (
              <span key={s} className={step > i ? 'is-done' : step === i ? 'is-on' : ''}>{i + 1}. {s}</span>
            ))}
          </div>

          <blockquote className="idc-quote">"Start with a blank page. Build your SolveNest workspace."</blockquote>
        </div>
      </section>
      <span className="sn-divider" aria-hidden="true" />
      {/* ── RIGHT: steps (unchanged) ── */}
      <section className="sn-auth" aria-label="Create student account">
        <div className="sn-auth-inner">
          <div className="sn-steps" aria-label="Signup progress">
            {['01 Account', '02 Verify', '03 Ready'].map((s, i) => (
              <span key={s} className={i < step ? 'is-done' : i === step ? 'is-on' : ''}>{s}</span>
            ))}
            <span className="sn-steps-bar" aria-hidden="true"><i style={{ transform: `scaleX(${step / 2})` }} /></span>
          </div>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: reduced ? 0 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -14 }} transition={{ duration: 0.25 }}>
                <span className="sn-eyebrow">01 · ACCOUNT</span>
                <h1>Create your<br /><em>SolveNest account.</em></h1>
                <p className="sn-lede">Start with the essentials. You can analyze a task before creating an account, and saved analysis can continue with you after signup.</p>
                <form className="sn-form" onSubmit={submitAccount} noValidate>
                  <label className="sn-field" htmlFor="su-name">
                    <span>Full Name</span>
                    <span className="sn-control">
                      <input id="su-name" type="text" autoComplete="name" value={name} placeholder="Your name"
                        aria-describedby="su-name-err" aria-invalid={!!errors.name}
                        onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: null })) }} />
                    </span>
                    <span className="sn-err" id="su-name-err" role={errors.name ? 'alert' : undefined}>{errors.name || ''}</span>
                  </label>
                  <label className="sn-field" htmlFor="su-email">
                    <span>Email</span>
                    <span className="sn-control">
                      <input id="su-email" type="email" autoComplete="email" value={email} placeholder="you@example.com"
                        aria-describedby="su-email-err" aria-invalid={!!errors.email}
                        onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: null })) }} />
                    </span>
                    <span className="sn-err" id="su-email-err" role={errors.email ? 'alert' : undefined}>{errors.email || ''}</span>
                  </label>
                  <label className="sn-field" htmlFor="su-password">
                    <span>Password</span>
                    <span className="sn-control has-toggle">
                      <input id="su-password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password} placeholder="Create a password"
                        aria-describedby="su-password-err" aria-invalid={!!errors.password}
                        onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: null })) }} />
                      <button type="button" className="sn-show" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
                    </span>
                    <span className="sn-err" id="su-password-err" role={errors.password ? 'alert' : undefined}>{errors.password || ''}</span>
                  </label>
                  <label className="sn-field" htmlFor="su-confirm">
                    <span>Confirm Password</span>
                    <span className="sn-control has-toggle">
                      <input id="su-confirm" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirmPw} placeholder="Repeat your password"
                        aria-describedby="su-confirm-err" aria-invalid={!!errors.confirmPw}
                        onChange={(e) => { setConfirmPw(e.target.value); setErrors((x) => ({ ...x, confirmPw: null })) }} />
                      <button type="button" className="sn-show" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
                    </span>
                    <span className="sn-err" id="su-confirm-err" role={errors.confirmPw ? 'alert' : undefined}>{errors.confirmPw || ''}</span>
                  </label>
                  <div className="sn-agree">
                    <label className="sn-check"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: null })) }} />
                      <span>I have read and agree to the <button type="button" className="sn-linklike" onClick={() => setPolicy('terms')}>Terms of Use</button> and acknowledge the <button type="button" className="sn-linklike" onClick={() => setPolicy('privacy')}>Privacy Notice</button> and <button type="button" className="sn-linklike" onClick={() => setPolicy('integrity')}>Academic Integrity</button> rules.</span>
                    </label>
                    <span className="sn-err" role={errors.agree ? 'alert' : undefined}>{errors.agree || ''}</span>
                  </div>
                  {errors.form && <p className="sn-form-err" role="alert">{errors.form}</p>}
                  <button className="sn-cta" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Creating…' : <>Continue <ArrowRight size={15} /></>}</button>
                </form>
                <p className="sn-switch">Already have an account? <button onClick={() => nav('/login')}>Sign in</button></p>
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: reduced ? 0 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -14 }} transition={{ duration: 0.25 }}>
                <span className="sn-eyebrow">02 · VERIFY</span>
                <h1>Verify your<br /><em>access.</em></h1>
                <p className="sn-lede">We sent a verification link to your email. Open it to confirm it’s really you — the demo continues once confirmed.</p>
                <div className="sn-verify-rows">
                  <div className={`sn-verify-row ${verified ? 'is-done' : ''}`}>
                    <span className="sn-card-label">EMAIL</span>
                    <b>Sent to: {maskEmail(email)}</b>
                    <span className="sn-verify-state">{verified ? <><Check size={12} /> EMAIL VERIFIED</> : 'AWAITING CONFIRMATION'}</span>
                  </div>
                </div>
                {!verified ? (
                  <button className="sn-cta" onClick={confirmVerification}>I’ve Verified — Continue <ArrowRight size={15} /></button>
                ) : (
                  <p className="sn-note">Email confirmed — assembling your workspace…</p>
                )}
                <button className="sn-link" onClick={() => setStep(0)}>← Back to details</button>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: reduced ? 0 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -14 }} transition={{ duration: 0.25 }} aria-live="polite">
                <span className="sn-eyebrow">03 · READY</span>
                <h1>Your workspace<br /><em>is created.</em></h1>
                <p className="sn-lede">Account ready. Your empty SolveNest workspace is waiting inside.</p>
                <div className="sn-granted-actions">
                  <button className="sn-cta" onClick={() => nav('/')}>Continue to SolveNest <ArrowRight size={15} /></button>
                  <button className="sn-link" onClick={() => nav('/analyze')}>Analyze My Task →</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="sn-policy">By continuing, you acknowledge the SolveNest{' '}
            <button onClick={() => setPolicy('terms')}>Terms of Use</button>,{' '}
            <button onClick={() => setPolicy('privacy')}>Privacy Notice</button>,{' '}
            <button onClick={() => setPolicy('integrity')}>Academic Integrity</button> and{' '}
            <button onClick={() => setPolicy('payments')}>Refund & Cancellation</button> rules.
          </p>
        </div>
      </section>
      {policy && <PolicyReader initial={policy} backLabel="Back to Sign Up" onClose={() => setPolicy(null)} />}
    </div>
  )
}
