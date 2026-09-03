import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, ChevronUp, Lock, ShieldCheck, FileText, Timer } from 'lucide-react'

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }

/* ─── date helpers ─── */
function addDays(days) { const d = new Date(); d.setDate(d.getDate() + days); return d }
function fmt(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }
function fmtShort(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
const TODAY = new Date()
const DELIVERY_DATE = addDays(5)
const QUOTE_EXPIRY = addDays(1)

/* ─── scroll reveal helper ─── */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const v = useInView(ref, { once: true, margin: '-80px' })
  return (
    <div ref={ref} className={`pn-reveal ${v ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ─── 01 ESTIMATE HERO ─── */
function EstimateHero() {
  return (
    <section className="pn-hero">
      <div className="pn-wrap">
        <span className="pn-eyebrow">PLANS & ESTIMATES</span>
        <h1>See the estimated cost of your task <em>before you commit.</em></h1>
        <p>Solvy provides an initial price range from your brief. The official SolveNest plan is confirmed after human review.</p>
        <div className="pn-hero-actions">
          <button className="pn-cta-primary" onClick={() => nav('/analyze')}>Analyze My Task <ArrowRight size={13} /></button>
          <button className="pn-cta-ghost" onClick={() => document.getElementById('pn-relationship')?.scrollIntoView({ behavior: 'smooth' })}>How pricing works</button>
        </div>
      </div>
    </section>
  )
}

/* ─── 02 DOES THE COST NARROW? ─── */
function Narrow() {
  const [hover, setHover] = useState(null)
  const steps = [
    { k: 'Feasibility', h: 'price' },
    { k: 'Scope', h: 'price' },
    { k: 'Deadline', h: 'delivery' },
    { k: 'Expert availability', h: 'delivery' },
    { k: 'Commercial review', h: 'price' },
  ]
  return (
    <section className="pn-section pn-narrow" id="pn-relationship">
      <div className="pn-wrap">
        <div className="pn-section-head">
          <Reveal><span className="pn-label">01 / COST NARROWING</span></Reveal>
          <Reveal delay={60}><h2>Will the estimated cost change<br /><em>after you submit?</em></h2></Reveal>
          <Reveal delay={120}><p>Sometimes. The initial range narrows into a confirmed figure once our team completes human review of your requirements.</p></Reveal>
        </div>
        <div className="pn-narrow-grid">
          <Reveal className="pn-narrow-col">
            <div className={`pn-narrow-card ${hover === 'price' ? 'is-highlight' : ''}`}>
              <div className="pn-narrow-head"><span className="pn-card-label">SOLVY ESTIMATE</span><span className="pn-pill pn-pill--muted">PROVISIONAL</span></div>
              <div className="pn-narrow-range"><strong>LKR 8,000 – 10,000</strong><small>Approximate range</small></div>
              <div className="pn-narrow-fields">
                <div className="pn-narrow-field"><span>Complexity</span><b>Medium</b></div>
                <div className="pn-narrow-field"><span>Suggested delivery</span><b>{fmtShort(DELIVERY_DATE)}</b></div>
                <div className="pn-narrow-field"><span>Revision estimate</span><b>~ 2</b></div>
                <div className="pn-narrow-field"><span>Scope confidence</span><b>88% · estimated</b></div>
              </div>
              <span className="pn-note">Example only</span>
            </div>
          </Reveal>
          <Reveal delay={80} className="pn-narrow-col">
            <div className="pn-narrow-center">
              <span className="pn-card-label">HUMAN REVIEW</span>
              <div className="pn-narrow-steps">{steps.map(({ k, h }, i) => (
                <button key={k} className={`pn-narrow-step ${hover === h ? 'is-hovered' : ''}`} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(h)} onBlur={() => setHover(null)}>
                  <span className="pn-narrow-step-num">{i + 1}</span><span className="pn-narrow-step-label">{k}</span>
                </button>
              ))}</div>
            </div>
          </Reveal>
          <Reveal delay={160} className="pn-narrow-col">
            <div className={`pn-narrow-card pn-narrow-card--official ${hover ? 'is-highlight' : ''}`}>
              <div className="pn-narrow-head"><span className="pn-card-label">OFFICIAL PLAN</span><span className="pn-pill pn-pill--success">CONFIRMED</span></div>
              <div className="pn-narrow-range"><strong>LKR 8,750</strong><small>Confirmed after review</small></div>
              <div className="pn-narrow-fields">
                <div className="pn-narrow-field"><span>Delivery</span><b>{fmt(DELIVERY_DATE)}</b></div>
                <div className="pn-narrow-field"><span>Revisions</span><b>2 included</b></div>
                <div className="pn-narrow-field"><span>Scope</span><b>Confirmed</b></div>
                <div className="pn-narrow-field"><span>Status</span><b>Ready for acceptance</b></div>
              </div>
            </div>
          </Reveal>
        </div>
        <p className="pn-note">The narrowing above is a visual metaphor — final values are set by human confirmation, not automatic math.</p>
      </div>
    </section>
  )
}

/* ─── 03 WHAT SHAPES THE PRICE ─── */
function Anatomy() {
  const [scope, setScope] = useState('standard')
  const [deadline, setDeadline] = useState('normal')
  const [complexity, setComplexity] = useState(50)
  const lo = 7000 + complexity * 25 + (deadline === 'urgent' ? 3000 : deadline === 'priority' ? 1500 : 0) + (scope === 'extensive' ? 4000 : scope === 'focused' ? -1500 : 0)
  const hi = lo + 2500
  const lv = complexity < 33 ? 'LOW' : complexity < 66 ? 'MEDIUM' : 'HIGH'
  const ctrl = [
    { label: 'Scope', values: [['focused', 'Focused'], ['standard', 'Standard'], ['extensive', 'Extensive']], state: scope, set: setScope },
    { label: 'Deadline', values: [['normal', 'Normal'], ['priority', 'Priority'], ['urgent', 'Urgent']], state: deadline, set: setDeadline },
  ]
  return (
    <section className="pn-section pn-anatomy" id="pn-anatomy">
      <div className="pn-wrap">
        <div className="pn-section-head pn-section-head--split">
          <div>
            <span className="pn-label">02 / PRICING ANATOMY</span>
            <h2>What shapes<br /><em>the price?</em></h2>
          </div>
          <p>Adjust the controls to see how each factor moves the estimate. This is an interactive example only.</p>
        </div>
        <div className="pn-anatomy-grid">
          <div className="pn-anatomy-control">
            {ctrl.map(({ label, values, state, set }) => (
              <div className="pn-anatomy-group" key={label}>
                <span className="pn-card-label">{label}</span>
                <div className="pn-seg" role="group" aria-label={label}>
                  {values.map(([k, l]) => <button key={k} className={state === k ? 'is-active' : ''} onClick={() => set(k)} aria-pressed={state === k}>{l}</button>)}
                </div>
              </div>
            ))}
            <div className="pn-anatomy-group">
              <span className="pn-card-label">Complexity · {lv}</span>
              <input type="range" min={0} max={99} value={complexity} onChange={(e) => setComplexity(Number(e.target.value))} className="pn-range-sli" aria-label="Complexity" />
              <div className="pn-range-labels"><span>Simple</span><span>Complex</span></div>
            </div>
            <div className="pn-anatomy-result"><small>ESTIMATED RANGE</small><motion.strong key={`${lo}-${hi}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }} transition={{ duration: .3 }}>LKR {lo.toLocaleString()} – {hi.toLocaleString()}</motion.strong></div>
          </div>
          <div className="pn-anatomy-list">
            <div className="pn-anatomy-factor"><div className="pn-anatomy-factor-name"><span className="pn-anatomy-letter">A</span><b>Scope</b></div><div className="pn-anatomy-factor-body"><span className={`pn-anatomy-tag ${scope !== 'focused' ? 'is-active' : ''}`}>Research</span><span className={`pn-anatomy-tag ${scope !== 'focused' ? 'is-active' : ''}`}>Structure</span><span className={`pn-anatomy-tag ${scope === 'extensive' ? 'is-active' : ''}`}>Citation</span><span className={`pn-anatomy-tag ${scope === 'extensive' ? 'is-active' : ''}`}>Review</span></div></div>
            <div className="pn-anatomy-factor"><div className="pn-anatomy-factor-name"><span className="pn-anatomy-letter">B</span><b>Deadline</b></div><div className="pn-anatomy-factor-body">{['Normal', 'Priority', 'Urgent'].map((d) => <span key={d} className={`pn-anatomy-tag ${deadline === d.toLowerCase() ? 'is-active' : ''}`}>{d}</span>)}</div></div>
            <div className="pn-anatomy-factor"><div className="pn-anatomy-factor-name"><span className="pn-anatomy-letter">C</span><b>Complexity</b></div><div className="pn-anatomy-factor-bar"><div className="pn-anatomy-fill" style={{ width: `${30 + complexity * .52}%` }} /></div></div>
            <div className="pn-anatomy-factor"><div className="pn-anatomy-factor-name"><span className="pn-anatomy-letter">D</span><b>Delivery estimate</b></div><div className="pn-anatomy-factor-body"><span className="pn-anatomy-tag">{deadline === 'normal' ? fmtShort(addDays(5)) : deadline === 'priority' ? fmtShort(addDays(3)) : fmtShort(addDays(1))}</span><span className="pn-anatomy-tag">~ {deadline === 'normal' ? '5 days' : deadline === 'priority' ? '3 days' : '24 hrs'}</span></div></div>
          </div>
        </div>
        <p className="pn-note">Disclaimer: This is a simplified illustration. Real Solvy estimates are derived from human analysis, not these controls.</p>
      </div>
    </section>
  )
}

/* ─── 04 THE OFFICIAL PLAN ─── */
function OfficialPlan() {
  const [open, setOpen] = useState(null)
  const rows = [
    { lb: 'PRICE', v: 'LKR 8,750', b: 'Confirmed after human review of scope, deadline, complexity and requirements. Guest estimates are non-binding.' },
    { lb: 'DELIVERY', v: fmt(DELIVERY_DATE), b: `Confirmed on feasibility, expert availability and current workload as of ${fmt(TODAY)} — not the Solvy suggestion.` },
    { lb: 'INCLUDED SCOPE', v: '5 items', it: ['Requirement interpretation', 'Research guidance', 'Structure review', 'Citation review', 'Quality review'] },
    { lb: 'EXCLUDED SCOPE', v: '3 items', it: ['New research direction after approval', 'Additional unrelated deliverables', 'New functionality outside agreed brief'] },
    { lb: 'REVISIONS', v: '2 within agreed scope', b: 'Revisions correct or improve work within the accepted scope. New requirements may require a scope-change quote.' },
    { lb: 'QUOTE EXPIRY', v: fmt(QUOTE_EXPIRY), b: 'Expired quotes may require review if deadlines, capacity or scope have changed.' },
    { lb: 'PAYMENT', v: '100% upfront', b: 'Standard tasks require full upfront payment before work begins. Larger projects may use prepaid milestones.' },
  ]
  return (
    <section className="pn-section pn-official" id="pn-official">
      <div className="pn-wrap">
        <div className="pn-section-head">
          <Reveal><span className="pn-label">03 / THE OFFICIAL PLAN</span></Reveal>
          <Reveal delay={60}><h2>A clear commercial agreement.<br /><em>No surprise terms.</em></h2></Reveal>
          <Reveal delay={120}><p>After human review, you receive this official plan. Tap any row for an explanation.</p></Reveal>
        </div>
        <Reveal className="pn-doc">
          <div className="pn-doc-top">
            <div className="pn-doc-intro"><span className="pn-card-label">SOLVENEST OFFICIAL PLAN</span><div className="pn-doc-intro-meta"><span><small>TASK</small><b>Research Report</b></span><span><small>REF</small><b>SN-2048</b></span><span><small>STUDENT</small><b>Hidden / Sample</b></span></div></div>
            <span className="pn-pill pn-pill--success">READY FOR ACCEPTANCE</span>
          </div>
          <div className="pn-doc-body">{rows.map(({ lb, v, b, it }) => <div key={lb} className={`pn-doc-row ${open === lb ? 'is-open' : ''}`}>
            <button className="pn-doc-row-head" onClick={() => setOpen(open === lb ? null : lb)} aria-expanded={open === lb}><span className="pn-doc-row-label">{lb}</span><span className="pn-doc-row-val"><b>{v}</b>{open === lb ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span></button>
            <AnimatePresence initial={false}>{open === lb && <motion.div className="pn-doc-row-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }}>{it ? <ul>{it.map((t) => <li key={t}>{t}</li>)}</ul> : <p>{b}</p>}</motion.div>}</AnimatePresence>
          </div>)}</div>
          <div className="pn-doc-foot"><ShieldCheck size={11} /> Generated after Human Review · No payment until you approve</div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── 05 PAYMENT & MILESTONES ─── */
function Payment() {
  const [std, setStd] = useState(0)
  const [ms, setMs] = useState(0)
  const stdS = ['Official Quote', 'Payment', 'Funded', 'Work Begins']
  const msData = [
    { l: 'MILESTONE 1', p: '40%', a: 'LKR 12,000', d: 'Requirements + initial work' },
    { l: 'MILESTONE 2', p: '35%', a: 'LKR 10,500', d: 'Core progress' },
    { l: 'MILESTONE 3', p: '25%', a: 'LKR 7,500', d: 'Final stage + QA' },
  ]
  return (
    <section className="pn-section pn-payment" id="pn-payment">
      <div className="pn-wrap">
        <div className="pn-section-head">
          <span className="pn-label">04 / PAYMENT</span>
          <h2>Every stage funded<br /><em>before work begins.</em></h2>
          <p>No stage starts until its payment is confirmed. A student never provides unpaid work first.</p>
        </div>
        <div className="pn-pay-grid">
          <div className="pn-pay-card">
            <span className="pn-card-label">STANDARD TASK</span>
            <div className="pn-pay-amount"><small>TOTAL</small><strong>LKR 8,750</strong><span>100% funding · quote expires {fmtShort(QUOTE_EXPIRY)}</span></div>
            <div className="pn-pay-steps">{stdS.map((s, i) => <button key={s} className={`pn-pay-step ${i < std ? 'is-done' : ''} ${i === std ? 'is-current' : ''}`} onClick={() => setStd(i)} disabled={i > std}><span className="pn-pay-dot">{i < std ? <Check size={8} /> : i === std ? <span className="pn-pay-dot-pulse" /> : null}</span><span>{s}</span></button>)}</div>
            <div className={`pn-gate ${std >= 3 ? 'is-open' : ''}`}><Lock size={12} /> {std >= 3 ? 'Work gate open — Funded' : 'Gate locked'}</div>
            <button className="pn-cta-primary pn-demo-btn" onClick={() => setStd(std >= 4 ? 0 : std + 1)} disabled={std >= 4}>{std >= 4 ? 'Reset' : std === 0 ? 'Fund task' : std === 3 ? 'Open work gate' : 'Advance step'}</button>
            <span className="pn-note">100% prepaid after acceptance</span>
          </div>
          <div className="pn-pay-card pn-pay-card--dark">
            <span className="pn-card-label">LARGER PROJECT · EXAMPLE</span>
            <div className="pn-pay-amount"><small>TOTAL</small><strong>LKR 30,000</strong><span>40 / 35 / 25 — example only</span></div>
            <div className="pn-ms-flow">{msData.map((m, i) => <button key={m.l} className={`pn-ms-chip ${i <= ms ? 'is-funded' : ''} ${i === ms + 1 && ms < 2 ? 'is-next' : ''}`} onClick={() => (i === ms || i === ms - 1) && setMs(i)} disabled={i > ms + 1}><span className="pn-ms-chip-dot">{i < ms ? <Check size={8} /> : i === ms && ms < 3 ? <span className="pn-pay-dot-pulse" /> : i === ms + 1 ? <span className="pn-ms-chip-ring" /> : <Lock size={8} />}</span><b>{m.p}</b><small>{m.a}</small><i>{m.d}</i><em>{i < ms ? 'Complete' : i === ms && ms < 3 ? 'Funded' : i === ms + 1 && ms < 2 ? 'Click to fund' : 'Locked'}</em></button>)}</div>
            <div className={`pn-gate ${ms >= 2 ? 'is-open' : ''}`}><Lock size={12} /> {ms >= 2 ? 'All stages complete — prepaid' : 'Stage 2 locked until funded'}</div>
            <button className="pn-cta-primary pn-demo-btn" onClick={() => setMs(ms >= 2 ? 0 : ms + 1)}>{ms >= 2 ? 'Reset' : ms === 0 ? 'Fund Stage 1' : `Fund Stage ${ms + 1}`}</button>
            <span className="pn-note">Prepaid milestones — not pay-after-work</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── 06 SCOPE CHANGES ─── */
function Scope() {
  const [added, setAdded] = useState(false)
  const orig = ['Frontend', 'API', 'Database']
  const add = ['Google Login', 'Stripe', 'Admin Dashboard']
  return (
    <section className="pn-section pn-scope" id="pn-scope">
      <div className="pn-wrap">
        <div className="pn-section-head">
          <span className="pn-label">05 / SCOPE CHANGES</span>
          <h2>What happens if<br /><em>the task changes?</em></h2>
          <p>New work outside the locked scope is not a free revision. This is a commercial agreement, not small print.</p>
        </div>
        <div className="pn-scope-grid">
          <div className="pn-scope-col"><div className="pn-scope-col-head"><span className="pn-card-label">ORIGINAL SCOPE</span><span className="pn-pill"><Lock size={9} /> LOCKED</span></div><b className="pn-scope-title">React Web Application</b><div className="pn-scope-tags">{orig.map((t) => <span key={t} className="pn-tag pn-tag--in"><Check size={10} /> {t}</span>)}</div></div>
          <div className="pn-scope-vs"><span>VS</span></div>
          <div className="pn-scope-col pn-scope-col--add"><div className="pn-scope-col-head"><span className="pn-card-label">STUDENT REQUEST</span><span className="pn-pill pn-pill--violet">ADD</span></div><b className="pn-scope-title">Add</b><div className="pn-scope-tags">{add.map((t) => <span key={t} className={`pn-tag pn-tag--add ${added ? 'pn-tag--in' : ''}`}>{added ? <Check size={10} /> : <span className="pn-tag-plus">+</span>} {t}</span>)}</div>{!added && <small className="pn-scope-note">Outside locked boundary → not included</small>}</div>
        </div>
        <div className={`pn-scope-rev ${added ? 'is-populated' : ''}`}>
          <div className="pn-scope-rev-head"><span className="pn-card-label">REVISED PLAN</span><span className="pn-pill">SCOPE CHANGE</span></div>
          {added ? <div className="pn-scope-rev-body"><div className="pn-scope-rev-row"><span>Additional Price</span><b>LKR 8,500</b></div><div className="pn-scope-rev-row"><span>Additional Time</span><b>3 days</b></div><div className="pn-tag-row">{[...orig, ...add].map((t) => <span key={t} className="pn-tag pn-tag--in"><Check size={10} /> {t}</span>)}</div></div> : <p className="pn-scope-empty">Accept additional scope to see the revised plan.</p>}
        </div>
        <div className="pn-scope-toggle" role="group" aria-label="Scope choice">
          <button className={!added ? 'is-active' : ''} onClick={() => setAdded(false)} aria-pressed={!added}>Keep Original Scope</button>
          <button className={added ? 'is-active' : ''} onClick={() => setAdded(true)} aria-pressed={added}>Accept Additional Scope</button>
        </div>
      </div>
    </section>
  )
}

/* ─── 07 CLARITY ─── */
function Clarity() {
  const [active, setActive] = useState(0)
  const phases = [
    { icon: <FileText size={16} />, title: 'BEFORE WORK', points: ['Scope confirmed', 'Price confirmed', 'Delivery confirmed'] },
    { icon: <Timer size={16} />, title: 'DURING WORK', points: ['Funded stage only', 'Progress visible', 'Scope protected'] },
    { icon: <ShieldCheck size={16} />, title: 'AFTER DELIVERY', points: ['Quality reviewed', 'Revisions tracked', 'History recorded'] },
  ]
  return (
    <section className="pn-section pn-clarity" id="pn-clarity">
      <div className="pn-wrap">
        <div className="pn-section-head pn-section-head--center">
          <span className="pn-label">06 / COMMERCIAL CLARITY</span>
          <h2>Clear terms protect<br /><em>both sides.</em></h2>
        </div>
        <div className="pn-clarity-grid">{phases.map(({ icon, title, points }, i) => <button key={title} className={`pn-clarity-card ${active === i ? 'is-active' : ''}`} onClick={() => setActive(i)} aria-pressed={active === i}><span className="pn-clarity-num">{String(i + 1).padStart(2, '0')}</span><span className="pn-clarity-icon">{icon}</span><span className="pn-card-label">{title}</span><div className="pn-clarity-points">{points.map((p) => <span key={p}><Check size={10} /> {p}</span>)}</div></button>)}</div>
        <p className="pn-note pn-note--center">Applicable consumer rights and SolveNest policies always apply.</p>
      </div>
    </section>
  )
}

/* ─── 08 FINAL CTA ─── */
function FinalCta() {
  return (
    <section className="pn-section pn-final" id="pn-final">
      <div className="pn-wrap pn-final-grid">
        <div>
          <h2>Ready to see the estimated cost<br /><em>of your task?</em></h2>
          <p>Upload your brief and receive an initial Solvy estimate before creating an account.</p>
          <div className="pn-hero-actions">
            <button className="pn-cta-primary" onClick={() => nav('/analyze')}>Analyze My Task <ArrowRight size={13} /></button>
            <button className="pn-cta-ghost is-dark" onClick={() => nav('/method')}>See The SolveNest Method</button>
          </div>
          <small className="pn-final-note">Initial Solvy estimate. Official quote confirmed after review.</small>
        </div>
        <div className="pn-final-sheet"><span className="pn-card-label">SAMPLE ESTIMATE</span><b className="pn-final-sheet-title">Research Report</b><div className="pn-final-sheet-row"><small>Estimated</small><b>LKR 8,000 – 10,000</b></div><div className="pn-final-sheet-row"><small>Status</small><b>Ready for review</b></div></div>
      </div>
    </section>
  )
}

export function PlansPage() {
  return (
    <div className="pn-page">
      <EstimateHero />
      <Narrow />
      <Anatomy />
      <OfficialPlan />
      <Payment />
      <Scope />
      <Clarity />
      <FinalCta />
    </div>
  )
}