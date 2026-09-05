import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Search } from 'lucide-react'
import { CATEGORIES, RESOLVER, catById, searchHelp } from './helpData.js'

const nav = (p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }
const scrollTo = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

const QUICK_LINKS = [
  { t: 'How does my estimate work?', cat: 'estimates', art: 1 },
  { t: 'When does work begin?', cat: 'payments', art: 2 },
  { t: 'How do revisions work?', cat: 'revisions', art: 0 },
  { t: 'How is an Expert assigned?', cat: 'experts', art: 0 },
]

/* ─── environment ─── */
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
  return <div ref={ref} className={`hp-reveal ${v ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

/* ─── answer helpers ─── */
function AnswerBody({ text, terms = [] }) {
  const [open, setOpen] = useState(false)
  if (!terms.includes('scope change')) return <p>{text}</p>
  const parts = text.split(/(scope[-\s]?change)/i)
  return (
    <p>
      {parts.map((p, i) => /scope[-\s]?change/i.test(p) ? (
        <span key={i} className="hp-term-wrap">
          <button className="hp-term" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{p}</button>
          {open && <span className="hp-term-def">SCOPE CHANGE — “A request that changes the previously accepted work, price or delivery requirements.”</span>}
        </span>
      ) : <span key={i}>{p}</span>)}
    </p>
  )
}
function MilestoneVisual() {
  const [tap, setTap] = useState(false)
  return (
    <div className="hp-ms">
      <div className="hp-ms-stage is-funded"><b>MILESTONE 01</b><span>FUNDED · WORK ACTIVE</span></div>
      <span className="hp-ms-arrow">↓</span>
      <button className="hp-ms-stage" aria-expanded={tap} onClick={() => setTap((t) => !t)}>
        <b>MILESTONE 02</b><span>NOT FUNDED · WORK LOCKED</span>
        {tap && <em>“This stage does not begin until funding is confirmed.”</em>}
      </button>
      <span className="hp-ms-arrow">↓</span>
      <div className="hp-ms-stage is-next"><b>MILESTONE 03</b><span>UPCOMING</span></div>
      <p className="hp-note">Work for a milestone begins only after that milestone has been funded.</p>
    </div>
  )
}
function EstimateVisual() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); o.disconnect() } }, { threshold: 0.4 })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return (
    <div className="hp-flow" ref={ref} aria-label="Estimate to official quote flow">
      <div className="hp-flow-step"><small>SOLVY ESTIMATE</small><b>LKR 8,000 – 10,000</b></div>
      <span className={`hp-flow-line ${on ? 'is-drawn' : ''}`} aria-hidden="true" />
      <div className="hp-flow-step is-mid"><small>HUMAN REVIEW</small></div>
      <span className={`hp-flow-line ${on ? 'is-drawn' : ''}`} aria-hidden="true" />
      <div className="hp-flow-step is-end"><small>OFFICIAL QUOTE</small><b>LKR 8,750</b></div>
    </div>
  )
}
function ExpertVisual() {
  const [i, setI] = useState(null)
  const steps = ['TASK REQUIREMENTS', 'MATCHED EXPERTISE', 'INTERESTED EXPERTS', 'ADMIN REVIEW', 'ASSIGNED EXPERT']
  return (
    <div className="hp-process" role="group" aria-label="Expert assignment steps">
      {steps.map((s, si) => (
        <div key={s} className="hp-process-row">
          <button className={i === si ? 'is-on' : ''} aria-expanded={i === si} onClick={() => setI(i === si ? null : si)}>
            <span>{String(si + 1).padStart(2, '0')}</span><b>{s}</b>
          </button>
          {si < steps.length - 1 && <span className={`hp-process-line ${i != null && si < i ? 'is-lit' : ''}`} aria-hidden="true" />}
          {i === si && <p className="hp-note">{si === 0 ? 'Your brief defines the expertise needed.' : si === 4 ? 'One expert connects. SolveNest manages the assignment.' : 'Reviewed inside the SolveNest operation.'}</p>}
        </div>
      ))}
    </div>
  )
}
function AnswerVisual({ visual }) {
  if (visual === 'milestones') return <MilestoneVisual />
  if (visual === 'estimate') return <EstimateVisual />
  if (visual === 'expert') return <ExpertVisual />
  return null
}

/* ═══ PAGE ═══ */
export function HelpCentrePage() {
  const reduced = useReducedMotion()
  const D = reduced ? 0 : 1
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [resIdx, setResIdx] = useState(0)
  const [activeCategory, setActiveCategory] = useState('estimates')
  const [previewCat, setPreviewCat] = useState(null)
  const [openQ, setOpenQ] = useState(null)
  const [fullArt, setFullArt] = useState(null)
  const [intent, setIntent] = useState('General')
  const INTENT_INFO = {
    General: 'General questions about SolveNest and how it works.',
    Task: 'Questions about your brief, analysis, or an active task.',
    Payment: 'Quotes, payments, milestones, and funding status.',
    Technical: 'Uploads, pages, logins, and browser trouble.',
  }
  const [rPath, setRPath] = useState([])
  const [rNode, setRNode] = useState(RESOLVER)
  const searchRef = useRef(null)

  /* URL state: read once, write on change (replaceState never fires popstate) */
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const t = p.get('topic')
      const qi = p.get('q')
      if (t && catById(t)) {
        setActiveCategory(t)
        if (qi != null && /^\d+$/.test(qi)) {
          const c = catById(t)
          const ai = Number(qi)
          if (c.articles[ai]) {
            setFullArt({ cat: t, art: ai })
            setOpenQ(`${t}:${ai}`)
            setTimeout(() => scrollTo('hp-explore'), 120)
          } else setTimeout(() => scrollTo('hp-explore'), 120)
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      p.set('topic', activeCategory)
      if (fullArt) p.set('q', String(fullArt.art))
      else p.delete('q')
      window.history.replaceState({}, '', `${window.location.pathname}?${p.toString()}`)
    } catch {}
  }, [activeCategory, fullArt])

  /* ⌘K focuses search */
  useEffect(() => {
    const on = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const res = useMemo(() => searchHelp(query), [query])
  const resultRows = useMemo(() => {
    if (!res.best) return []
    const rows = [{ cat: res.best.cat, art: res.best.art, best: true }]
    res.related.forEach((r) => rows.push({ cat: r.cat, art: r.art, best: false }))
    return rows
  }, [res])
  useEffect(() => setResIdx(0), [query])

  /* navigator ordering: matches first, rest dimmed */
  const navOrder = useMemo(() => {
    if (!query.trim() || !res.catHits.length) return CATEGORIES.map((c) => ({ c, hot: false }))
    const hot = new Set(res.catHits)
    return [...CATEGORIES.filter((c) => hot.has(c.id)).sort((a, b) => res.catHits.indexOf(a.id) - res.catHits.indexOf(b.id)),
      ...CATEGORIES.filter((c) => !hot.has(c.id))].map((c) => ({ c, hot: hot.has(c.id) }))
  }, [query, res])

  const openQuestion = (catId, artIdx, toFull) => {
    setActiveCategory(catId)
    setOpenQ(`${catId}:${artIdx}`)
    setFullArt(toFull ? { cat: catId, art: artIdx } : null)
    setTimeout(() => scrollTo('hp-explore'), 60)
  }
  const readFull = (catId, artIdx) => {
    setActiveCategory(catId)
    setOpenQ(`${catId}:${artIdx}`)
    setFullArt({ cat: catId, art: artIdx })
  }
  const onSearchKey = (e) => {
    if (!resultRows.length) { if (e.key === 'Escape') setQuery(''); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setResIdx((i) => (i + 1) % resultRows.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResIdx((i) => (i - 1 + resultRows.length) % resultRows.length) }
    else if (e.key === 'Enter') { const r = resultRows[resIdx]; if (r) openQuestion(r.cat, r.art, true) }
    else if (e.key === 'Escape') setQuery('')
  }

  const cat = catById(activeCategory) || CATEGORIES[0]
  const fullCat = fullArt ? catById(fullArt.cat) : null
  const fullQ = fullCat && fullArt ? fullCat.articles[fullArt.art] : null
  const hotSet = new Set(res.catHits)
  const rLeaf = rNode.leaf || null
  const rLeafCat = rLeaf ? catById(rLeaf.cat) : null
  const rLeafArt = rLeafCat && rLeaf ? rLeafCat.articles[rLeaf.art] : null

  return (
    <div className="hp-page">
      {/* ── 01 HERO + SEARCH ── */}
      <section className="hp-hero" id="hp-hero" aria-label="Help centre">
        <div className="hp-wrap hp-hero-center">
          <span className="hp-eyebrow hp-anim-1">SOLVENEST HELP CENTRE</span>
          <h1 className="hp-anim-2">Find the answer<br /><em>without searching everywhere.</em></h1>
          <p className="hp-anim-3">Search SolveNest help, browse a topic, or follow a guided path to the right answer.</p>
          <div className="hp-search-line hp-anim-4" role="search">
            <Search size={20} />
            <label className="hp-sr" htmlFor="hp-search">Search help centre</label>
            <input ref={searchRef} id="hp-search" value={query} onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={onSearchKey}
              placeholder="Ask about estimates, payments, experts, revisions…" autoComplete="off" />
              {query && <button className="hp-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
          </div>
          <div className="hp-chips hp-anim-5" aria-label="Example questions">
            {QUICK_LINKS.map(({ t, cat: c, art }) => (
              <button key={t} onClick={() => openQuestion(c, art, true)}><span>{t}</span><ArrowRight size={12} /></button>
            ))}
          </div>
          <div className="hp-results" aria-live="polite">
            {query.trim() && res.best && (
              <>
                <span className="hp-card-label">BEST MATCH</span>
                {resultRows.map((r, i) => {
                  const c = catById(r.cat)
                  const a = c.articles[r.art]
                  return (
                    <button key={`${r.cat}-${r.art}`} className={`hp-result ${i === resIdx ? 'is-focus' : ''} ${r.best ? 'is-best' : ''}`}
                      onMouseEnter={() => setResIdx(i)} onClick={() => openQuestion(r.cat, r.art, true)}>
                      <span className="hp-result-cat">{r.best ? 'BEST MATCH · ' : ''}{c.num} · {c.title}</span>
                      <b>{a.q}</b>
                      {r.best && <span className="hp-note">Preview: “{a.a.slice(0, 110)}{a.a.length > 110 ? '…' : ''}”</span>}
                    </button>
                  )
                })}
                <span className="hp-card-label">RELATED QUESTIONS</span>
                <span className="hp-note">{res.related.map((r) => catById(r.cat).articles[r.art].q).join(' · ') || '—'}</span>
              </>
            )}
            {query.trim() && !res.best && (
              <div className="hp-empty">
                <b>We couldn’t confidently match that question.</b>
                <div className="hp-empty-actions">
                  <button className="hp-cta-primary" onClick={() => nav('/analyze')}>Analyze My Task <ArrowRight size={13} /></button>
                  <button className="hp-cta-ghost" onClick={() => scrollTo('hp-support')}>Contact SolveNest <ArrowRight size={13} /></button>
                  <button className="hp-cta-ghost" onClick={() => scrollTo('hp-explore')}>Browse All Help Topics ↓</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 02 EXPLORER ── */}
      <section className={`hp-section hp-explore ${focused || query.trim() ? 'is-live' : ''}`} id="hp-explore" aria-label="Help explorer">
        <div className="hp-wrap">
          <div className="hp-head">
            <Reveal><span className="hp-label">01 / EXPLORE</span></Reveal>
            <Reveal delay={60}><h2>Start with what<br /><em>you’re trying to do.</em></h2></Reveal>
          </div>
          <div className="hp-exp-grid">
            <nav className="hp-topics" aria-label="Help topics">
              {navOrder.map(({ c, hot }) => {
                const on = activeCategory === c.id
                const showDesc = on || previewCat === c.id
                return (
                  <button key={c.id} aria-current={on ? 'true' : undefined}
                    className={`hp-topic ${on ? 'is-on' : ''} ${hot ? 'is-hot' : ''} ${query.trim() && !hot ? 'is-dim' : ''}`}
                    onClick={() => { setActiveCategory(c.id); setOpenQ(null); setFullArt(null) }}
                    onMouseEnter={() => setPreviewCat(c.id)} onMouseLeave={() => setPreviewCat(null)}
                    onFocus={() => setPreviewCat(c.id)} onBlur={() => setPreviewCat(null)}>
                    {on && <motion.span layoutId="hp-topic-accent" className="hp-topic-accent" transition={{ duration: 0.25 * D }} />}
                    <span className="hp-topic-num">{c.num}</span>
                    <span className="hp-topic-main"><b>{c.title}</b>{showDesc && <small>{c.desc}</small>}</span>
                    <ArrowRight size={13} className="hp-topic-arrow" />
                  </button>
                )
              })}
            </nav>
            <div className="hp-workspace">
              <AnimatePresence mode="wait">
                {fullArt && fullCat && fullQ ? (
                  <motion.article key={`art-${fullArt.cat}-${fullArt.art}`} className="hp-article"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 * D || 0.01, ease: [0.22, 1, 0.36, 1] }}>
                    <button className="hp-back" onClick={() => setFullArt(null)}>← Back to questions</button>
                    <span className="hp-card-label">{fullCat.num} · {fullCat.title}</span>
                    <h3>{fullQ.q}</h3>
                    {fullQ.a.split('. ').map((s, i) => s.trim() ? <p key={i}>{`${s.trim().replace(/\.*$/, '')}.`}</p> : null)}
                    <AnswerVisual visual={fullQ.visual} />
                    <span className="hp-card-label">RELATED QUESTIONS</span>
                    <div className="hp-rel">
                      {fullCat.articles.map((a, i) => i !== fullArt.art && (
                        <button key={a.q} onClick={() => { setOpenQ(`${fullCat.id}:${i}`); setFullArt({ cat: fullCat.id, art: i }) }}>{a.q} <ArrowRight size={12} /></button>
                      )).filter(Boolean).slice(0, 2)}
                      {fullCat.related.slice(0, 1).map((id) => { const rc = catById(id); return rc ? <button key={id} onClick={() => readFull(id, 0)}>{rc.articles[0].q} <ArrowRight size={12} /></button> : null })}
                    </div>
                  </motion.article>
                ) : (
                  <motion.div key={`ws-${cat.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 * D || 0.01 }}>
                    <div className="hp-ws-head">
                      <div><span className="hp-card-label">{cat.num} · TOPIC</span><h3>{cat.title}</h3><p>{cat.desc}</p></div>
                      {(cat.links || []).length > 0 && (
                        <div className="hp-rail">
                          <span className="hp-card-label">RELATED TO</span>
                          {cat.links.map((l) => <button key={l.to} onClick={() => nav(l.to)}>{l.t} <ArrowRight size={12} /></button>)}
                        </div>
                      )}
                    </div>
                    <div className="hp-qlist">
                      {cat.articles.map((a, i) => {
                        const key = `${cat.id}:${i}`
                        const open = openQ === key
                        return (
                          <div key={key} className={`hp-q ${open ? 'is-open' : ''}`}>
                            <button className="hp-q-head" aria-expanded={open} onClick={() => setOpenQ(open ? null : key)}>
                              <span className="hp-q-num">{String(i + 1).padStart(2, '0')}</span>
                              <b>{a.q}</b>
                              <ArrowRight size={14} className="hp-q-arrow" />
                            </button>
                            <AnimatePresence initial={false}>
                              {open && (
                                <motion.div className="hp-q-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 * D || 0.01, ease: [0.22, 1, 0.36, 1] }}>
                                  <AnswerBody text={a.a} terms={a.terms} />
                                  <AnswerVisual visual={a.visual} />
                                  <span className="hp-card-label">RELATED</span>
                                  <div className="hp-rel">
                                    {cat.articles.map((ra, ri) => ri !== i && (
                                      <button key={ra.q} onClick={() => setOpenQ(`${cat.id}:${ri}`)}>{ra.q} <ArrowRight size={12} /></button>
                                    )).filter(Boolean).slice(0, 1)}
                                    {cat.related.slice(0, 1).map((id) => { const rc = catById(id); return rc ? <button key={id} onClick={() => readFull(id, 0)}>{rc.articles[0].q} <ArrowRight size={12} /></button> : null })}
                                  </div>
                                  <button className="hp-readmore" onClick={() => setFullArt({ cat: cat.id, art: i })}>Read full answer →</button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 RESOLVER ── */}
      <section className="hp-section hp-resolver" id="hp-resolver" aria-label="Guided problem resolver">
        <div className="hp-wrap hp-resolver-narrow">
          <div className="hp-head">
            <Reveal><span className="hp-label">02 / FIND MY ANSWER</span></Reveal>
            <Reveal delay={60}><h2>Not sure what category<br /><em>your problem belongs to?</em></h2></Reveal>
          </div>
          <div className="hp-crumbs" aria-live="polite">
            {rPath.length === 0 && <span className="hp-card-label">START</span>}
            {rPath.map((label, i) => (
              <span key={`${label}-${i}`} className="hp-crumb"><b>{label}</b>{i < rPath.length - 1 || rLeaf ? <i>→</i> : null}</span>
            ))}
          </div>
          <motion.span key={rPath.length} className="hp-pathline" initial={{ scaleY: 0.3 }} animate={{ scaleY: 1 }} transition={{ duration: 0.3 * D || 0.01 }} aria-hidden="true" />
          <AnimatePresence mode="wait">
            {!rLeaf ? (
              <motion.div key={`n-${rPath.join('|')}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 * D || 0.01 }}>
                <p className="hp-rq">{rNode.q}</p>
                <div className="hp-ropts">
                  {rNode.options.map((o) => (
                    <button key={o.t} onClick={() => { setRPath((p) => [...p, o.t]); if (o.leaf) setRNode({ leaf: o.leaf }); else if (o.next) setRNode(o.next) }}>
                      <span>{o.t}</span><ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="leaf" className="hp-rleaf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 * D || 0.01 }}>
                <span className="hp-card-label">RECOMMENDED ANSWER</span>
                <p>“{rLeafArt ? rLeafArt.a : ''}”</p>
                <div className="hp-rleaf-links">
                  <button className="hp-cta-primary" onClick={() => { setActiveCategory(rLeaf.cat); setFullArt({ cat: rLeaf.cat, art: rLeaf.art }); setOpenQ(`${rLeaf.cat}:${rLeaf.art}`); scrollTo('hp-explore') }}>Read full answer →</button>
                  {(rLeaf.links || []).map((l) => <button key={l.to} className="hp-cta-ghost" onClick={() => nav(l.to)}>{l.t}</button>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hp-rnav">
            <button className="hp-mini" onClick={() => {
              if (!rPath.length) return
              let node = RESOLVER
              const np = rPath.slice(0, -1)
              np.forEach((label) => { const o = node.options.find((x) => x.t === label); node = o && o.next ? o.next : node })
              setRPath(np); setRNode(np.length ? node : RESOLVER)
            }} disabled={!rPath.length}>← Back</button>
            <button className="hp-mini" onClick={() => { setRPath([]); setRNode(RESOLVER) }} disabled={!rPath.length}>Start Over</button>
          </div>
        </div>
      </section>

      {/* ── 04 SUPPORT ── */}
      <section className="hp-section hp-support" id="hp-support" aria-label="Human support">
        <div className="hp-wrap hp-support-grid">
          <div>
            <Reveal><span className="hp-label">HUMAN SUPPORT</span></Reveal>
            <Reveal delay={60}><h2>Still need<br /><em>a person?</em></h2></Reveal>
            <Reveal delay={120}><p>If the Help Centre doesn’t resolve your question, send it to the SolveNest team and we’ll direct it to the right place.</p></Reveal>
            <div className="hp-support-actions">
              <button className="hp-cta-primary" onClick={() => nav('/connect')}>Contact SolveNest <ArrowRight size={13} /></button>
              <button className="hp-cta-ghost is-dark" onClick={() => nav('/connect?intent=technical')}>Report Technical Issue →</button>
            </div>
          </div>
          <div className="hp-words" role="group" aria-label="Choose support topic">
            {['General', 'Task', 'Payment', 'Technical'].map((w) => (
              <button key={w} className={`word ${intent === w ? 'is-on' : ''}`} aria-pressed={intent === w} onClick={() => setIntent(w)}>{w}</button>
            ))}
            <span className="hp-words-line" aria-hidden="true"><i /></span>
            <p className="hp-words-info" aria-live="polite">{INTENT_INFO[intent]}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
