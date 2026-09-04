import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, FileText, Lock, ShieldCheck, Sparkles } from 'lucide-react'

const WhyHeroCanvas = lazy(() => import('./WhyHeroCanvas.jsx').then((m) => ({ default: m.WhyHeroCanvas })))

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }
const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

/* ─── environment hooks ─── */
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
function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 800px)')
    setM(q.matches)
    const on = (e) => setM(e.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return m
}
function useWebGL() {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      setOk(!!(c.getContext('webgl2') || c.getContext('webgl')))
    } catch { setOk(false) }
  }, [])
  return ok
}

/* ─── scroll reveal ─── */
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
  return <div ref={ref} className={`wy-reveal ${v ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

/* ─── CSS Knowledge Document (shared object, all sections) ─── */
function KnowledgeDoc({ state = 'raw', activeLayer = null, className = '' }) {
  const layers = ['BRIEF', 'REQUIREMENTS', 'RUBRIC', 'DEADLINE', 'CITATION', 'COMPLEXITY']
  return (
    <div className={`wy-doc wy-doc--${state} ${className}`} aria-hidden="true">
      {state === 'layers' && layers.map((l, i) => (
        <span key={l} className={`wy-doc-layer ${activeLayer === l ? 'is-front' : ''}`} style={{ '--i': i }}>{l}</span>
      ))}
      <div className="wy-doc-paper">
        <small>ASSESSMENT 2</small>
        <b>Research Report</b>
        <span>2,500 words · APA 7</span>
        <span>Rubric · Due 28 September</span>
      </div>
      {state === 'approved' && <span className="wy-doc-approval">HUMAN APPROVED</span>}
      {state === 'verified' && <span className="wy-doc-frame" />}
      {state === 'open' && <span className="wy-doc-nodes"><i /><i /><i /></span>}
      {state === 'standard' && <span className="wy-doc-seal">THE SOLVENEST STANDARD</span>}
    </div>
  )
}

/* ─── section head ─── */
function Head({ label, title, sub }) {
  return (
    <div className="wy-head">
      <Reveal><span className="wy-label">{label}</span></Reveal>
      <Reveal delay={60}><h2>{title}</h2></Reveal>
      {sub && <Reveal delay={120}><p>{sub}</p></Reveal>}
    </div>
  )
}

/* ═══ 01 HERO ═══ */
const ANCHORS = [
  { k: 'clarity', label: 'CLARITY', hint: 'Document layers separate' },
  { k: 'accountability', label: 'ACCOUNTABILITY', hint: 'Human approval layer appears' },
  { k: 'quality', label: 'QUALITY', hint: 'Verification structure appears' },
  { k: 'understanding', label: 'UNDERSTANDING', hint: 'Learning annotations appear' },
]
function Hero({ concept, setConcept, reduced, mobile, webgl, heroVisible, exitT, pointer }) {
  const wrap = useRef(null)
  const fallbackRef = useRef(null)
  const useCanvas = !reduced && !mobile && webgl
  const tiltFallback = (x, y) => {
    const el = fallbackRef.current
    if (!el || useCanvas) return
    el.style.transform = `perspective(800px) rotateY(${(x * 6).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`
  }
  const resetFallback = () => {
    const el = fallbackRef.current
    if (el) el.style.transform = ''
  }
  const onMove = (e) => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
    pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1
  }
  const onTouch = (e) => {
    const t = e.touches[0]
    const r = wrap.current?.getBoundingClientRect()
    if (!t || !r) return
    const x = Math.max(-1, Math.min(1, (((t.clientX - r.left) / r.width) * 2 - 1)))
    const y = Math.max(-1, Math.min(1, (((t.clientY - r.top) / r.height) * 2 - 1)))
    pointer.current.x = x
    pointer.current.y = y
    tiltFallback(x, y)
  }
  return (
    <section className="wy-hero" id="wy-hero" aria-label="Why SolveNest">
      <div className="wy-wrap wy-hero-grid">
        <div className="wy-hero-copy">
          <span className="wy-eyebrow">WHY SOLVENEST</span>
          <h1>
            <span className="wy-hline">Academic support</span>
            <span className="wy-hline">should give you</span>
            <span className="wy-hline">more <em>than an answer.<span className="wy-sheen" aria-hidden="true" /></em></span>
          </h1>
          <p className="wy-lede">“Clarity before commitment. Human accountability around AI. Controlled expertise. Visible quality. And support designed to help you understand what happens next.”</p>
          <div className="wy-hero-actions">
            <button className="wy-cta-primary" onClick={() => scrollTo('wy-clarity')}>See the Difference ↓</button>
            <button className="wy-cta-ghost is-dark" onClick={() => nav('/analyze')}>Analyze My Task <ArrowRight size={13} /></button>
          </div>
        </div>
        <div className="wy-hero-visual" ref={wrap} onPointerMove={onMove} onTouchMove={onTouch} onTouchEnd={resetFallback}>
          <ul className="wy-sr" aria-label="Document contents">
            <li>Assessment 2, Research Report, 2,500 words, APA 7, Rubric, Due 28 September</li>
          </ul>
          {useCanvas ? (
            <Suspense fallback={<KnowledgeDoc state={concept === 'raw' ? 'raw' : concept === 'clarity' ? 'layers' : concept === 'accountability' ? 'approved' : concept === 'quality' ? 'verified' : 'open'} />}>
              <WhyHeroCanvas concept={concept} exitT={exitT} pointer={pointer} reduced={reduced} visible={heroVisible} />
            </Suspense>
          ) : (
            <div ref={fallbackRef} className="wy-fallback-tilt">
              <KnowledgeDoc state={concept === 'raw' ? 'raw' : concept === 'clarity' ? 'layers' : concept === 'accountability' ? 'approved' : concept === 'quality' ? 'verified' : 'open'} />
            </div>
          )}
          <div className="wy-anchors" role="group" aria-label="Document concepts">
            {ANCHORS.map(({ k, label, hint }) => (
              <button key={k} className={`wy-anchor ${concept === k ? 'is-active' : ''}`} aria-pressed={concept === k} title={hint}
                onMouseEnter={() => setConcept(k)} onFocus={() => setConcept(k)} onClick={() => setConcept(concept === k ? 'raw' : k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ 02 CLARITY ═══ */
const CLARITY_LAYERS = [
  { k: 'BRIEF', t: 'Assignment brief parsed', d: 'Type, length and format identified before anything else.' },
  { k: 'REQUIREMENTS', t: 'Requirements detected', d: 'Individual requirements listed before any estimate is discussed.' },
  { k: 'RUBRIC', t: 'Rubric detected', d: '6 assessment criteria. Highest weighting: Critical Analysis.' },
  { k: 'DEADLINE', t: 'Deadline detected', d: 'Due 28 September. Turnaround checked against real workload.' },
  { k: 'CITATION', t: 'Citation style detected', d: 'APA 7. Consistency is checked again before delivery.' },
  { k: 'COMPLEXITY', t: 'Complexity assessed', d: 'Medium. Shapes the estimated range — never the final price.' },
]
function Clarity() {
  const [layer, setLayer] = useState('RUBRIC')
  const cur = CLARITY_LAYERS.find((l) => l.k === layer)
  return (
    <section className="wy-section wy-clarity" id="wy-clarity" aria-label="Clarity before commitment">
      <div className="wy-wrap">
        <Head label="01 / CLARITY" title={<>Know what you’re stepping into <em>before you commit.</em></>} />
        <Reveal className="wy-statement wy-statement--strip"><p>“Most services ask you to commit first. <em>SolveNest starts by helping you understand the task.</em>”</p></Reveal>
        <div className="wy-clarity-trio">
          <Reveal className="wy-trio-card wy-clarity-doc">
            <KnowledgeDoc state="layers" activeLayer={layer} />
          </Reveal>
          <div className="wy-trio-card">
            <span className="wy-card-label">DOCUMENT LAYERS · TAP TO INSPECT</span>
            <div className="wy-layer-row" role="tablist" aria-label="Document layers">
              {CLARITY_LAYERS.map(({ k }) => (
                <button key={k} role="tab" aria-selected={layer === k} className={`wy-layer ${layer === k ? 'is-front' : ''}`} onClick={() => setLayer(k)}>{k}</button>
              ))}
            </div>
            <div className="wy-layer-detail-stack">
            <AnimatePresence initial={false}>
              <motion.div key={layer} className="wy-layer-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
                <span className="wy-layer-detail-k">{String(CLARITY_LAYERS.findIndex((l) => l.k === layer) + 1).padStart(2, '0')} · {layer}</span>
                <b>{cur.t}</b><p>{cur.d}</p>
              </motion.div>
            </AnimatePresence>
            </div>
          </div>
          <div className="wy-trio-card">
            <span className="wy-card-label">WHY IT MATTERS</span>
            <div className="wy-mini-compare">
              <span className="wy-card-label">TRADITIONAL</span>
              <div className="wy-mini-flow"><span>Submit</span><ArrowRight size={11} /><span>Wait</span><ArrowRight size={11} /><span>Ask for price</span></div>
            </div>
            <div className="wy-mini-compare is-us">
              <span className="wy-card-label">SOLVENEST</span>
              <div className="wy-mini-flow"><span>Upload</span><ArrowRight size={11} /><span>Understand</span><ArrowRight size={11} /><span>Estimate</span><ArrowRight size={11} /><span>Decide</span></div>
            </div>
            <button className="wy-cta-primary" onClick={() => nav('/analyze')}>Analyze Before Signup <ArrowRight size={13} /></button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ 03 ACCOUNTABILITY ═══ */
const SOLVY_ROWS = [['Estimated range', 'LKR 8,000–10,000'], ['Complexity', 'Medium'], ['Suggested deadline', '5 days'], ['Recommended expertise', 'Research Support']]
const HUMAN_ROWS = [
  { k: 'Final price', v: 'LKR 8,750', orig: 'Solvy estimate: LKR 8,000–10,000' },
  { k: 'Delivery', v: '28 September', orig: 'Suggested: 5 days' },
  { k: 'Scope', v: 'Confirmed', orig: 'Detected requirements reviewed' },
  { k: 'Expert category', v: 'Confirmed', orig: 'Recommended: Research Support' },
]
function Accountability() {
  const [reveal, setReveal] = useState(null)
  const [run, setRun] = useState(0)
  return (
    <section className="wy-section wy-account" id="wy-accountability" aria-label="AI plus human accountability">
      <div className="wy-wrap">
        <Head label="02 / ACCOUNTABILITY" title={<>Fast intelligence. <em>Human responsibility.</em></>} />
        <div className="wy-acc-grid">
          <Reveal className="wy-acc-col">
            <div className="wy-acc-card">
              <div className="wy-acc-head"><span className="wy-card-label">SOLVY · RECOMMENDS</span><Sparkles size={13} /></div>
              {SOLVY_ROWS.map(([k, v]) => <div key={k} className="wy-acc-row"><span>{k}</span><b>{v}</b></div>)}
            </div>
          </Reveal>
          <div className="wy-acc-plane" aria-hidden="true">
            <span className="wy-card-label">HUMAN REVIEW</span>
            <div className="wy-acc-track">
              <AnimatePresence mode="wait">
                <motion.span key={run} className="wy-acc-chip" initial={{ x: '-130%', opacity: 0 }} animate={{ x: ['-130%', '0%', '0%', '130%'], opacity: [0, 1, 1, 0] }} transition={{ duration: 3.4, times: [0, .22, .72, 1], ease: 'easeInOut' }}>
                  <small>SOLVY ESTIMATE</small><b>LKR 8,000–10,000</b>
                </motion.span>
              </AnimatePresence>
            </div>
            <button className="wy-mini" onClick={() => setRun((r) => r + 1)}>Replay review ↓</button>
          </div>
          <Reveal delay={100} className="wy-acc-col">
            <div className="wy-acc-card is-official">
              <div className="wy-acc-head"><span className="wy-card-label">HUMAN · DECIDES</span><ShieldCheck size={13} /></div>
              {HUMAN_ROWS.map(({ k, v, orig }) => (
                <button key={k} className="wy-acc-row is-btn" onMouseEnter={() => setReveal(k)} onMouseLeave={() => setReveal(null)} onFocus={() => setReveal(k)} onBlur={() => setReveal(null)} onClick={() => setReveal(reveal === k ? null : k)} aria-expanded={reveal === k}>
                  <span>{k}</span><b>{reveal === k ? orig : v}</b>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
        <Reveal className="wy-statement"><p>“Solvy recommends. <em>Authorized people decide.</em>”</p></Reveal>
      </div>
    </section>
  )
}

/* ═══ 04 EXPERTS ═══ */
const EXPERTS = [
  { role: 'RESEARCH SPECIALIST', skills: ['Academic Writing', 'Research Structure', 'Citation Review'], avail: 'Available', rating: '4.8', match: '94%', reasons: ['Research expertise', 'Strong QA record', 'Available for deadline', 'Relevant task history'] },
  { role: 'ACADEMIC EDITOR', skills: ['Structure & Clarity', 'Grammar Review', 'Formatting'], avail: 'Available', rating: '4.9', match: '91%', reasons: ['Editing expertise', 'Formatting record', 'Available for deadline', 'Relevant task history'] },
  { role: 'BUSINESS RESEARCH', skills: ['Case Analysis', 'Strategy Structure', 'Data Review'], avail: 'Limited', rating: '4.7', match: '88%', reasons: ['Domain expertise', 'Strong QA record', 'Relevant task history', 'Capacity-checked workload'] },
]
const REVIEW_CRITERIA = ['Expertise', 'Availability', 'Performance', 'Workload', 'Reliability']
function Experts() {
  const [sel, setSel] = useState(0)
  const [phase, setPhase] = useState('idle')
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const runAssign = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase('interested')
    timers.current.push(setTimeout(() => setPhase('review'), 1100))
    timers.current.push(setTimeout(() => setPhase('assigned'), 2400))
  }
  return (
    <section className="wy-section wy-experts" id="wy-expertise" aria-label="Controlled expert network">
      <div className="wy-wrap">
        <Head label="03 / EXPERTISE" title={<>Expert support — <em>without a marketplace.</em></>} sub="Students never browse or negotiate with freelancers. SolveNest manages the assignment." />
        <div className="wy-exp-task"><FileText size={13} /><span>APPROVED TASK · Research Report</span></div>
        <div className={`wy-exp-grid is-${phase}`}>
          {EXPERTS.map((e, i) => (
            <button key={e.role} aria-pressed={sel === i} onClick={() => setSel(i)}
              className={`wy-exp ${sel === i ? 'is-sel' : ''} ${phase === 'assigned' && sel === i ? 'is-assigned' : ''} ${phase === 'assigned' && sel !== i ? 'is-back' : ''}`}>
              <span className="wy-card-label">{e.role}</span>
              <span className="wy-exp-skills">{e.skills.join(' · ')}</span>
              <span className="wy-exp-meta">Availability: <b>{e.avail}</b> · Rating: <b>{e.rating}</b> · Match: <b>{e.match}</b></span>
              {(phase === 'assigned' && sel === i) && <span className="wy-exp-badge"><Check size={10} /> ASSIGNED</span>}
              {sel === i && (
                <span className="wy-exp-reasons"><span className="wy-card-label">MATCH REASONS</span>{e.reasons.map((r) => <span key={r} className="wy-exp-reason"><Check size={9} /> {r}</span>)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="wy-exp-review" aria-live="polite">
          <span className="wy-card-label">ADMIN REVIEW CONSIDERS</span>
          <div className="wy-exp-criteria">{REVIEW_CRITERIA.map((c) => <span key={c} className={phase === 'review' ? 'is-on' : ''}>{c}</span>)}</div>
          <button className="wy-cta-primary" onClick={runAssign}>Run Assignment Demo <ArrowRight size={13} /></button>
        </div>
        <Reveal className="wy-statement wy-statement--light"><p>“Students do not browse and negotiate with random freelancers. <em>SolveNest manages the assignment.</em>”</p></Reveal>
      </div>
    </section>
  )
}

/* ═══ 05 PROTECTED CHAT ═══ */
function Protected() {
  const [demo, setDemo] = useState('idle')
  const [why, setWhy] = useState(false)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const run = (kind) => {
    timers.current.forEach(clearTimeout)
    setDemo(`${kind}-send`)
    timers.current.push(setTimeout(() => setDemo(kind === 'safe' ? 'safe-done' : 'shield'), 900))
    if (kind === 'protected') timers.current.push(setTimeout(() => setDemo('returned'), 2200))
    else timers.current.push(setTimeout(() => setDemo('idle'), 2400))
  }
  return (
    <section className="wy-section wy-protected" id="wy-protected" aria-label="Protected collaboration">
      <div className="wy-wrap">
        <Head label="04 / PROTECTED COMMUNICATION" title={<>Work together <em>without leaving the platform.</em></>} />
        <div className="wy-chat-grid">
          <div className="wy-chat" role="log" aria-label="Task room conversation demo" aria-live="polite">
            <div className="wy-chat-head"><Lock size={11} /><span> TASK ROOM · SECURE CHANNEL</span></div>
            <div className="wy-msg is-student"><b>Student</b><p>“Could you explain what needs more evidence in Criterion 3?”</p></div>
            <div className="wy-msg is-expert"><b>Expert</b><p>“Yes. The analysis needs stronger research support. I’ve marked the requirement.”</p></div>
            {(demo === 'safe-send' || demo === 'safe-done') && <div className={`wy-msg is-student is-travel ${demo === 'safe-done' ? 'is-arrived' : ''}`}><b>Student</b><p>“Thanks — I’ve added the extra source to section 2.”</p></div>}
            {(demo === 'protected-send' || demo === 'shield' || demo === 'returned') && (
              <div className={`wy-msg is-student is-travel ${demo === 'shield' ? 'is-stopped' : ''} ${demo === 'returned' ? 'is-back' : ''}`}>
                <b>Student</b><p>“Message me on <mark>WhatsApp at…</mark>”</p>
              </div>
            )}
            {demo === 'shield' && (
              <div className="wy-shield"><ShieldCheck size={14} /><div><b>CONTACT INFORMATION DETECTED</b><span>“Keep communication inside SolveNest.”</span></div></div>
            )}
            {demo === 'returned' && (
              <div className="wy-chat-actions">
                <button className="wy-mini" onClick={() => { setDemo('idle') }}>Edit Message</button>
                <button className="wy-mini" onClick={() => setWhy((w) => !w)} aria-expanded={why}>Learn Why</button>
              </div>
            )}
            {why && demo === 'returned' && <p className="wy-note">Contact details are blocked so your work history stays connected to the task and your private information stays private.</p>}
          </div>
          <div className="wy-chat-side">
            <button className="wy-cta-primary" onClick={() => run('safe')} disabled={demo !== 'idle' && demo !== 'safe-done' && demo !== 'returned'}>Try Safe Message</button>
            <button className="wy-cta-ghost" onClick={() => run('protected')} disabled={demo !== 'idle' && demo !== 'safe-done' && demo !== 'returned'}>Try Protected Message</button>
            <p className="wy-note">“Your work history stays connected to the task. Your private contact information stays private.”</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ 06 QUALITY ═══ */
const CHECKS = [
  { k: 'REQUIREMENTS', v: '10 / 10', d: 'Every detected requirement verified present.' },
  { k: 'SCOPE', v: 'Confirmed', d: 'Work matches the accepted scope — nothing added, nothing missing.' },
  { k: 'CITATION', v: 'Reviewed', d: 'Citation Review — Style: APA 7. Consistency: checked. References: reviewed.' },
  { k: 'FORMATTING', v: 'Passed', d: 'Word count, headings and layout checked against the brief.' },
  { k: 'FILES', v: 'Complete', d: 'All deliverable files present and open correctly.' },
  { k: 'QA', v: 'Approved', d: 'Final human QA sign-off before delivery.' },
]
function Quality() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(null)
  const ref = useRef(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        CHECKS.forEach((_, i) => setTimeout(() => setCount(i + 1), 400 + i * 380))
      }
    }, { threshold: 0.3 })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const replay = () => { setCount(0); CHECKS.forEach((_, i) => setTimeout(() => setCount(i + 1), 300 + i * 380)) }
  return (
    <section className="wy-section wy-quality" id="wy-quality" aria-label="Quality before delivery" ref={ref}>
      <div className="wy-wrap">
        <Head label="05 / QUALITY" title={<>Finished doesn’t automatically <em>mean delivered.</em></>} />
        <div className="wy-q-grid">
          <KnowledgeDoc state={count >= 6 ? 'verified' : 'approved'} className="wy-q-doc" />
          <div className="wy-q-list">
            {CHECKS.map(({ k, v, d }, i) => (
              <button key={k} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}
                className={`wy-q ${i < count ? 'is-on' : ''} ${open === k ? 'is-open' : ''}`}>
                <span className="wy-q-dot">{i < count ? <Check size={10} /> : i + 1}</span>
                <span className="wy-q-k">{k}</span><b className="wy-q-v">{i < count ? v : '···'}</b>
                <ChevronDown size={12} />
                {open === k && <span className="wy-q-d">{d}</span>}
              </button>
            ))}
            {count >= 6 && <div className="wy-q-ready"><span className="wy-q-pulse" /> READY FOR DELIVERY</div>}
            <button className="wy-mini" onClick={replay}>Replay verification ↓</button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ 07 UNDERSTANDING ═══ */
const NODES = [
  { k: 'CRITICAL ANALYSIS', d: 'Arguments weighed against evidence, not asserted.' },
  { k: 'RESEARCH EVIDENCE', d: 'Claims traced back to reviewed sources.' },
  { k: 'METHODOLOGY', d: 'Approach chosen to fit the rubric criteria.' },
  { k: 'CONCLUSION', d: 'Findings tied back to the research question.' },
  { k: 'REFERENCING', d: 'APA 7 applied consistently throughout.' },
]
const MODES = [
  { k: 'Explain this simply', d: 'Solvy restates the section in plain language, linked to the rubric line it satisfies.' },
  { k: 'Why was this approach used?', d: 'The approach is traced to the methodology requirement and the highest-weighted criterion.' },
  { k: 'Quiz me', d: 'Short questions generated from the document’s own claims — answers stay inside the brief.' },
  { k: 'What could my lecturer ask?', d: null },
  { k: 'Show the rubric connection', d: 'The rubric layer moves forward and the highest-weighted criterion highlights.' },
  { k: 'Help me explain this section', d: 'A talk-track built from the section’s key sentences, ready to rehearse.' },
]
const LECTURER_QS = [
  { q: 'Why did you choose this research approach?', a: 'Point to the methodology section and the rubric criterion it addresses, then state the trade-off in one sentence.' },
  { q: 'How does the evidence support your conclusion?', a: 'Walk from one cited source to the claim it supports, then to the concluding sentence.' },
  { q: 'Which rubric criterion influenced this structure?', a: 'Critical Analysis — the highest-weighted criterion. The rubric layer highlights to show the link.', rubric: true },
]
function Understanding() {
  const [node, setNode] = useState('CRITICAL ANALYSIS')
  const [mode, setMode] = useState('What could my lecturer ask?')
  const [answer, setAnswer] = useState(null)
  const [rubricFlash, setRubricFlash] = useState(false)
  const cur = NODES.find((n) => n.k === node)
  return (
    <section className="wy-section wy-understand" id="wy-understanding" aria-label="Understanding after delivery">
      <div className="wy-wrap">
        <Head label="06 / UNDERSTANDING" title={<>Delivery isn’t where <em>learning should stop.</em></>} />
        <div className="wy-u-grid">
          <div className="wy-u-doc">
            <KnowledgeDoc state="open" className={rubricFlash ? 'is-rubric' : ''} />
            <div className="wy-u-nodes" role="group" aria-label="Learning nodes">
              {NODES.map(({ k }) => (
                <button key={k} aria-pressed={node === k} className={node === k ? 'is-on' : ''} onClick={() => setNode(k)}>{k}</button>
              ))}
            </div>
            <p className="wy-note"><b>{cur.k}:</b> {cur.d}</p>
          </div>
          <div className="wy-u-side">
            <span className="wy-card-label">EXPLAIN & DEFEND</span>
            <div className="wy-u-modes" role="group" aria-label="Explain and defend options">
              {MODES.map(({ k, d }) => (
                <button key={k} aria-pressed={mode === k} className={mode === k ? 'is-on' : ''} onClick={() => { setMode(k); setAnswer(null); setRubricFlash(k === 'Show the rubric connection') }}>{k}</button>
              ))}
            </div>
            <div className="wy-u-panel" aria-live="polite">
              {mode !== 'What could my lecturer ask?' && <p>{MODES.find((m) => m.k === mode)?.d}</p>}
              {mode === 'What could my lecturer ask?' && (
                <div className="wy-u-qs">
                  {LECTURER_QS.map(({ q, a, rubric }, i) => (
                    <div key={q} className="wy-u-q">
                      <span><b>{i + 1}.</b> {q}</span>
                      <button className="wy-mini" aria-expanded={answer === q} onClick={() => { setAnswer(answer === q ? null : q); setRubricFlash(!!rubric && answer !== q) }}>Practice Answer →</button>
                      {answer === q && <p className="wy-note">{a}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <Reveal className="wy-statement"><p>“We don’t want the work <em>to become a black box.</em>”</p></Reveal>
      </div>
    </section>
  )
}

/* ═══ 08 STANDARD ═══ */
const PLATES = [
  { k: 'CLARITY', d: 'Understand the likely scope and cost before committing.' },
  { k: 'ACCOUNTABILITY', d: 'AI assists. Authorized humans make the important decisions.' },
  { k: 'CONTROLLED EXPERTISE', d: 'Experts enter SolveNest through review and approval.' },
  { k: 'PRIVACY', d: 'Student and Expert communication remains inside the platform.' },
  { k: 'TRANSPARENCY', d: 'Progress, payments and decisions remain visible.' },
  { k: 'QUALITY', d: 'Internal review happens before delivery.' },
  { k: 'UNDERSTANDING', d: 'Solvy helps turn the outcome into something the student can explain.' },
]
function Standard() {
  const [sel, setSel] = useState(0)
  const [aligned, setAligned] = useState(false)
  return (
    <section className="wy-section wy-standard" id="wy-standard" aria-label="The SolveNest standard">
      <div className="wy-wrap">
        <Head label="07 / THE STANDARD" title={<>Seven principles. <em>One standard.</em></>} />
        <div className="wy-stack">
          <AnimatePresence mode="wait">
            {!aligned ? (
              <motion.div key={sel} className="wy-plate is-out" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
                <span>{String(sel + 1).padStart(2, '0')}</span><b>{PLATES[sel].k}</b>
              </motion.div>
            ) : (
              <motion.div key="seal" className="wy-stack-seal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
                THE SOLVENEST STANDARD<span className="wy-seal-cur">{String(sel + 1).padStart(2, '0')} · {PLATES[sel].k}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          {!aligned ? (
            <motion.div key={sel} className="wy-plate-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>
              <b>{PLATES[sel].k}</b><p>“{PLATES[sel].d}”</p>
            </motion.div>
          ) : (
            <motion.div key="seal" className="wy-plate-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>
              <b>THE SOLVENEST STANDARD</b><p>“All seven principles, aligned into one document.”</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="wy-standard-nav" role="group" aria-label="Browse principles">
          <button className="wy-mini" onClick={() => setSel((sel + PLATES.length - 1) % PLATES.length)} aria-label="Previous principle">← Prev</button>
          <span className="wy-standard-count" aria-live="polite">{String(sel + 1).padStart(2, '0')} / 07</span>
          <button className="wy-mini" onClick={() => setSel((sel + 1) % PLATES.length)} aria-label="Next principle">Next →</button>
        </div>
        <button className="wy-cta-primary" onClick={() => setAligned((a) => !a)}>{aligned ? 'Expand the Stack' : 'Align Into One Standard'}</button>
      </div>
    </section>
  )
}

/* ═══ 09 FINAL CTA ═══ */
function FinalCta() {
  const [near, setNear] = useState(false)
  const [closing, setClosing] = useState(false)
  const go = (p) => {
    if (p !== '/analyze' || closing) { if (p !== '/analyze') nav(p); return }
    setClosing(true)
    setTimeout(() => nav('/analyze'), 480)
  }
  return (
    <section className="wy-section wy-final" id="wy-cta" aria-label="Start with clarity">
      <div className="wy-wrap wy-final-grid">
        <div>
          <Head label="START" title={<>Start with clarity. <em>Continue with confidence.</em></>} sub="Upload your academic brief and see what Solvy understands before creating an account." />
          <div className="wy-hero-actions" onMouseEnter={() => setNear(true)} onMouseLeave={() => setNear(false)}>
            <button className="wy-cta-primary" onClick={() => go('/analyze')}>Analyze My Task <ArrowRight size={13} /></button>
            <button className="wy-cta-ghost is-dark" onClick={() => go('/method')}>Explore The SolveNest Method <ArrowRight size={13} /></button>
          </div>
        </div>
        <div className="wy-final-doc">
          <KnowledgeDoc state={closing ? 'raw' : 'verified'} className={`${near && !closing ? 'is-near' : ''} ${closing ? 'is-closing' : ''}`} />
        </div>
      </div>
    </section>
  )
}

/* ═══ PAGE ═══ */
const SECTIONS = [
  ['wy-hero', 'Difference'], ['wy-clarity', 'Clarity'], ['wy-accountability', 'Accountability'],
  ['wy-expertise', 'Expertise'], ['wy-protected', 'Protected'], ['wy-quality', 'Quality'],
  ['wy-understanding', 'Understanding'], ['wy-standard', 'Standard'],
]
export function WhySolveNestPage() {
  const [concept, setConcept] = useState('raw')
  const [active, setActive] = useState('wy-hero')
  const reduced = useReducedMotion()
  const mobile = useIsMobile()
  const webgl = useWebGL()
  const pointer = useRef({ x: 0, y: 0 })
  const [heroVisible, setHeroVisible] = useState(true)
  const [exitT, setExitT] = useState(0)
  const heroRef = useRef(null)

  useEffect(() => {
    const o = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) })
    }, { rootMargin: '-40% 0px -55% 0px' })
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) o.observe(el) })
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const el = heroRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setHeroVisible(r.bottom > 0 && r.top < window.innerHeight)
      const next = Math.max(0, Math.min(1, -r.top / (r.height || 1)))
      setExitT((prev) => (Math.abs(next - prev) > 0.02 ? next : prev))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="wy-page">
      <nav className="wy-rail" aria-label="Page sections">
        {SECTIONS.map(([id, label]) => (
          <button key={id} aria-current={active === id ? 'true' : undefined} aria-label={label}
            className={active === id ? 'is-on' : ''} onClick={() => scrollTo(id)}><i /><span>{label}</span></button>
        ))}
      </nav>
      <div ref={heroRef}>
        <Hero concept={concept} setConcept={setConcept} reduced={reduced} mobile={mobile} webgl={webgl} heroVisible={heroVisible} exitT={exitT} pointer={pointer} />
      </div>
      <Clarity />
      <Accountability />
      <Experts />
      <Protected />
      <Quality />
      <Understanding />
      <Standard />
      <FinalCta />
    </div>
  )
}
