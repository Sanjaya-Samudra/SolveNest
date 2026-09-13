import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { POLICIES, POLICY_LABEL } from './policyData.js'

/* SolveNest Policy Reader — document modal used by Sign In and Sign Up.
   Focus-trapped, Esc/outside closable, returns focus to the opener. */
export function PolicyReader({ initial = 'terms', backLabel = 'Back', onClose }) {
  const [sec, setSec] = useState(() => (POLICIES.some((p) => p.id === initial) ? initial : 'terms'))
  const [progress, setProgress] = useState(0)
  const root = useRef(null)
  const pane = useRef(null)
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = root.current?.querySelector('[data-autofocus]')
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') {
        const els = [...(root.current?.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])') || [])]
          .filter((el) => !el.disabled && el.offsetParent !== null)
        if (!els.length) return
        const firstEl = els[0]
        const lastEl = els[els.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      if (opener.current && opener.current.focus) opener.current.focus()
    }
  }, [onClose])

  useEffect(() => {
    pane.current?.scrollTo({ top: 0 })
    setProgress(0)
  }, [sec])
  const onScroll = () => {
    const el = pane.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1)
  }

  const cur = POLICIES.find((p) => p.id === sec) || POLICIES[0]
  return (
    <div className="sn-pol-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={root} className="sn-pol" role="dialog" aria-modal="true" aria-label={`SolveNest ${POLICY_LABEL}`}>
        <div className="sn-pol-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
        <button className="sn-pol-close" data-autofocus onClick={onClose} aria-label="Close policy reader"><X size={16} /></button>
        <nav className="sn-pol-nav" aria-label="Policy sections">
          <span className="sn-pol-kicker">{POLICY_LABEL}</span>
          {POLICIES.map((p) => (
            <button key={p.id} aria-current={p.id === sec ? 'true' : undefined}
              className={p.id === sec ? 'is-on' : ''} onClick={() => setSec(p.id)}>
              <span>{p.num}</span>{p.nav}
            </button>
          ))}
        </nav>
        <div className="sn-pol-read">
          <div className="sn-pol-tabs" role="tablist" aria-label="Policy sections">
            {POLICIES.map((p) => (
              <button key={p.id} role="tab" aria-selected={p.id === sec} className={p.id === sec ? 'is-on' : ''} onClick={() => setSec(p.id)}>{p.nav}</button>
            ))}
          </div>
          <div ref={pane} className="sn-pol-pane" onScroll={onScroll} tabIndex={0} aria-label={`${cur.title} text`}>
            <span className="sn-pol-eyebrow">{cur.num} · {POLICY_LABEL}</span>
            <h2>{cur.title}</h2>
            {cur.body.map((para, i) => <p key={i}>{para}</p>)}
            <button className="sn-pol-back" onClick={onClose}>{backLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
