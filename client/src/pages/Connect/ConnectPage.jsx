import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Paperclip, X } from 'lucide-react'
import { INTENTS, INTENT_ORDER, intentFromParam, validateField } from './connectData.js'

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }
const SENT_NOUN = { general: 'message', task: 'task question', payment: 'payment enquiry', technical: 'technical report', business: 'business enquiry' }

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
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, { rootMargin: '0px 0px -60px 0px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return <div ref={ref} className={`cn-reveal ${v ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}
function fmtSize(n) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function Drop({ id, value, opts, errId, error, onChange }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const wrap = useRef(null)
  useEffect(() => {
    if (!open) return
    setHi(value ? opts.indexOf(value) : 0)
    const out = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', out)
    return () => document.removeEventListener('pointerdown', out)
  }, [open])
  const pick = (o) => { onChange(o); setOpen(false) }
  const onKey = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % opts.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + opts.length) % opts.length) }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0) }
    else if (e.key === 'End') { e.preventDefault(); setHi(opts.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (hi >= 0) pick(opts[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }
  return (
    <span className={`cn-drop ${open ? 'is-open' : ''} ${!value ? 'is-empty' : ''}`} ref={wrap}>
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open} aria-describedby={errId}
        className={error ? 'is-err' : ''} onClick={() => setOpen((o) => !o)} onKeyDown={onKey}>
        <span>{value || 'Select…'}</span>
        <svg className="cn-drop-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="cn-drop-list" role="listbox" aria-labelledby={id}>
          {opts.map((o, i) => (
            <li key={o} role="option" aria-selected={value === o} id={`${id}-opt-${i}`}
              className={value === o ? 'is-sel' : ''} data-hi={hi === i} style={{ animationDelay: `${Math.min(i, 5) * 15}ms` }}
              onMouseEnter={() => setHi(i)} onClick={() => pick(o)}>
              <span>{o}</span>{value === o && <Check size={13} />}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

function Field({ f, value, error, onChange, fileRef }) {
  const id = `cn-${f.k}`
  const errId = `${id}-err`
  if (f.type === 'checkbox') {
    return (
      <div className="cn-field is-check">
        <label><input type="checkbox" checked={!!value} onChange={(e) => onChange(f.k, e.target.checked)} />{f.box}</label>
      </div>
    )
  }
  if (f.type === 'file') {
    return (
      <div className="cn-field">
        <span className="cn-label" id={id}>{f.label}</span>
        <input ref={fileRef} type="file" className="cn-sr" aria-labelledby={id} aria-describedby={errId} aria-invalid={!!error}
          onChange={(e) => { const fl = e.target.files[0]; onChange(f.k, fl ? { name: fl.name, size: fl.size } : null) }} />
        {!value ? (
          <button type="button" className="cn-attach" onClick={() => fileRef.current?.click()}>
            <Paperclip size={13} /><span><b>Attach a file</b><small>{f.hint}</small></span>
          </button>
        ) : (
          <div className="cn-file">
            <Paperclip size={13} /><span><b>{value.name}</b><small>{fmtSize(value.size)}</small></span>
            <button type="button" aria-label="Remove attachment" onClick={(e) => { e.stopPropagation(); if (fileRef.current) fileRef.current.value = ''; onChange(f.k, null) }}><X size={13} /></button>
          </div>
        )}
        <span className="cn-err" id={errId} role={error ? 'alert' : undefined}>{error || ''}</span>
      </div>
    )
  }
  if (f.type === 'select') {
    return (
      <div className="cn-field">
        <span className="cn-label" id={`${id}-lb`}>{f.label}{f.req ? '' : ' (optional)'}</span>
        <span className="cn-control">
          <Drop id={id} value={value} opts={f.opts} errId={errId} error={error} onChange={(v) => onChange(f.k, v)} />
        </span>
        <span className="cn-err" id={errId} role={error ? 'alert' : undefined}>{error || ''}</span>
      </div>
    )
  }
  const Cmp = f.type === 'textarea' ? 'textarea' : 'input'
  return (
    <label className="cn-field" htmlFor={id}>
      <span className="cn-label">{f.label}{f.req ? '' : ' (optional)'}</span>
      <span className="cn-control">
        <Cmp id={id} type={f.type === 'textarea' ? undefined : f.type} value={value || ''} placeholder={f.ph}
          rows={f.type === 'textarea' ? 4 : undefined} aria-describedby={errId} aria-invalid={!!error}
          onChange={(e) => onChange(f.k, e.target.value)} />
      </span>
      <span className="cn-err" id={errId} role={error ? 'alert' : undefined}>{error || ''}</span>
    </label>
  )
}

export function ConnectPage() {
  const reduced = useReducedMotion()
  const D = reduced ? 0.01 : 1
  const [intent, setIntent] = useState('general')
  const [hovered, setHovered] = useState(null)
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const fileRef = useRef(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('intent')
      if (v) setIntent(intentFromParam(v))
    } catch {}
  }, [])

  const cfg = INTENTS[intent]
  const visibleFields = useMemo(() => cfg.fields.filter((f) => !(f.hideWhen && f.hideWhen(data))), [cfg, data])

  const pickIntent = (id) => {
    if (id === intent) return
    const next = INTENTS[id]
    const keep = {}
    next.fields.forEach((f) => { if (f.k in data && !(f.hideWhen && f.hideWhen(data))) keep[f.k] = data[f.k] })
    setData(keep)
    setErrors({})
    setStatus('idle')
    setIntent(id)
  }
  const set = (k, v) => {
    setData((d) => ({ ...d, [k]: v }))
    setErrors((e) => ({ ...e, [k]: null }))
  }
  const submit = () => {
    const errs = {}
    visibleFields.forEach((f) => { const m = validateField(f, data[f.k], data); if (m) errs[f.k] = m })
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = visibleFields.find((f) => errs[f.k])
      if (first) document.getElementById(`cn-${first.k}`)?.focus({ preventScroll: false })
      return
    }
    setStatus('sending')
    timers.current.push(setTimeout(() => setStatus('sent'), 1400))
  }
  const resetAll = () => {
    setData({})
    setErrors({})
    setStatus('idle')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="cn-page">
      {/* ── 01 HERO + INTENT ── */}
      <section className="cn-hero" aria-label="Contact SolveNest">
        <div className="cn-wrap">
          <span className="cn-eyebrow cn-anim-1">CONNECT WITH SOLVENEST</span>
          <h1 className="cn-anim-2">What would you like<br /><em>to talk about?</em></h1>
          <p className="cn-anim-3">Choose the reason for your message and we’ll guide you to the right place.</p>
          <div className="cn-rail cn-anim-4" role="group" aria-label="Message reason">
            <span className="cn-rail-line" aria-hidden="true" />
            {INTENT_ORDER.map((id) => {
              const c = INTENTS[id]
              const on = intent === id
              const show = on || hovered === id
              return (
                <button key={id} aria-pressed={on}
                  className={`cn-stop ${on ? 'is-on' : ''}`}
                  onClick={() => pickIntent(id)}
                  onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(id)} onBlur={() => setHovered(null)}>
                  {on && <motion.span layoutId="cn-rail-dot" className="cn-dot" transition={{ duration: 0.3 * D }} />}
                  {!on && <span className="cn-dot is-idle" aria-hidden="true" />}
                  <span className="cn-stop-num">{c.num}</span>
                  <span className="cn-stop-main"><b>{c.tab}</b>{show && <small>{railDesc(id)}</small>}</span>
                  <ArrowRight size={13} className="cn-stop-arrow" />
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 02 WORKSPACE ── */}
      <section className="cn-section cn-work" id="cn-work" aria-label="Contact workspace">
        <div className="cn-wrap cn-work-grid">
          <Reveal className="cn-context">
            <span className="cn-card-label">{cfg.num} · {cfg.dest}</span>
            <h2>{cfg.heading}</h2>
            <p>{cfg.desc}</p>
            {cfg.include.length > 0 && (
              <>
                <span className="cn-card-label">HELPFUL TO INCLUDE</span>
                <ul className="cn-include">
                  {cfg.include.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </>
            )}
            <div className="cn-path" aria-hidden="true">
              <span>YOUR MESSAGE</span><i className={status !== 'idle' ? 'is-live' : ''} /><span>ROUTING</span><i className={status === 'sent' ? 'is-live' : ''} />
              <AnimatePresence mode="wait">
                <motion.b key={cfg.dest} initial={{ opacity: 0, x: reduced ? 0 : 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -6 }} transition={{ duration: 0.22 * D }}>
                  {cfg.dest}
                </motion.b>
              </AnimatePresence>
            </div>
            <span className="cn-sr">Messages route to {cfg.dest}</span>
          </Reveal>
          <div className="cn-formcol">
            <div className="cn-route" aria-hidden="true">
              <span>YOU</span><i /><i /><i />
              <AnimatePresence mode="wait">
                <motion.b key={cfg.dest} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 * D }}>{cfg.dest}</motion.b>
              </AnimatePresence>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {status === 'sent' ? (
                <motion.div key="done" className="cn-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 * D }} aria-live="polite">
                  <span className="cn-done-check"><Check size={16} /></span>
                  <span className="cn-card-label">MESSAGE RECEIVED</span>
                  <p>Your {SENT_NOUN[intent]} has been sent to SolveNest.</p>
                  <div className="cn-done-actions">
                    <button className="cn-cta-ghost" onClick={() => nav('/')}>Return Home →</button>
                    <button className="cn-cta-ghost" onClick={() => nav('/help')}>Visit Help Centre →</button>
                    <button className="cn-cta-primary" onClick={resetAll}>Send Another Message</button>
                  </div>
                </motion.div>
              ) : (
                <motion.form key={intent} className={`cn-form ${status === 'sending' ? 'is-dim' : ''}`}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 * D }} aria-live="polite"
                  onSubmit={(e) => { e.preventDefault(); if (status === 'idle') submit() }}>
                  {visibleFields.map((f) => (
                    <motion.div key={f.k} layoutId={['name', 'email', 'message'].includes(f.k) ? `cn-f-${f.k}` : undefined} layout="position" transition={{ duration: 0.22 * D }}>
                      <Field f={f} value={data[f.k]} error={errors[f.k]} onChange={set} fileRef={fileRef} />
                    </motion.div>
                  ))}
                  {intent === 'task' && data.noTaskRef && (
                    <p className="cn-note">No task yet? <button type="button" className="cn-link" onClick={() => nav('/analyze')}>Analyze My Task →</button></p>
                  )}
                  <button className="cn-cta-primary" type="submit" disabled={status !== 'idle'}>
                    {status === 'sending' ? 'Sending…' : 'Send Message →'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ── 03 CONTEXT ── */}
      <section className="cn-section cn-contextline" aria-label="Helpful context">
        <div className="cn-wrap">
          <AnimatePresence mode="wait">
            <motion.div key={intent} className="cn-contextline-in" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: 0.25 * D }}>
              <p>{cfg.linkNote}</p>
              {cfg.link && <button className="cn-link" onClick={() => nav(cfg.link.to)}>{cfg.link.t}</button>}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  )
}

function railDesc(id) {
  return {
    general: 'Questions about SolveNest and how it works.',
    task: 'Questions about a brief, analysis or task.',
    payment: 'Questions about quotes, funding, payments or payment-related issues.',
    technical: 'Uploads, pages, logins and browser trouble.',
    business: 'Organisations and partnership enquiries.',
  }[id]
}
