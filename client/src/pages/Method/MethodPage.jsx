import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Check, ShieldCheck, LockKeyhole, Sparkles, Users, FileText, FileCheck2, Clock3, CalendarDays, Layers, Search, Award, MessageCircle, Shield, Star, ChevronDown, ChevronUp, Download, History, Lightbulb, ChevronLeft } from 'lucide-react'

const navigate = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }

const taskMeta = {
  assessment: 'ASSESSMENT',
  title: 'Research Report',
  course: 'Information Systems',
  level: 'Undergraduate',
  words: '2,500 words',
  referencing: 'APA 7',
  due: '28 September',
  rubric: '6 criteria',
  code: 'SN-2048',
}

const formatDeliveryDate = (plusDays = 5) => {
  const d = new Date()
  d.setDate(d.getDate() + plusDays)
  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[d.getMonth()]}`
}

const phases = [
  { id: 'understand', label: 'UNDERSTAND', short: '01', desc: 'Guest Scan / Full Analysis' },
  { id: 'confirm', label: 'CONFIRM', short: '02', desc: 'Human Review' },
  { id: 'fund', label: 'FUND', short: '03', desc: 'Official Plan' },
  { id: 'match', label: 'MATCH', short: '04', desc: 'Expert Assignment' },
  { id: 'progress', label: 'PROGRESS', short: '05', desc: 'Task Room' },
  { id: 'verify', label: 'VERIFY', short: '06', desc: 'Review & Delivery' },
  { id: 'learn', label: 'LEARN', short: '07', desc: 'Explain & Defend' },
]

function TaskPassport({ status = 'NOT YET ANALYSED', variant = 'light', compact = false, highlightStatus = false }) {
  const isDark = variant === 'dark'
  return (
    <div className={`mp-passport ${isDark ? 'is-dark' : ''} ${compact ? 'is-compact' : ''} ${highlightStatus ? 'is-highlight' : ''}`}>
      <div className="mp-passport-top">
        <span className="mp-passport-kicker">TASK PASSPORT</span>
        <span className={`mp-passport-status ${status === 'NOT YET ANALYSED' ? 'is-muted' : status === 'READY FOR YOUR TASK' ? 'is-ready' : 'is-active'}`}>{status}</span>
      </div>
      <div className="mp-passport-title">
        <span className="mp-passport-assessment">{taskMeta.assessment}</span>
        <h3>{taskMeta.title}</h3>
        <small>{taskMeta.course}</small>
      </div>
      <div className="mp-passport-grid">
        <div><small>LEVEL</small><b>{taskMeta.level}</b></div>
        <div><small>LENGTH</small><b>{taskMeta.words}</b></div>
        <div><small>STYLE</small><b>{taskMeta.referencing}</b></div>
        <div><small>RUBRIC</small><b>{taskMeta.rubric}</b></div>
        <div className="mp-passport-due"><small>DUE</small><b>{taskMeta.due}</b></div>
        <div className="mp-passport-id"><small>ID</small><b>{taskMeta.code}</b></div>
      </div>
      {!compact && <div className="mp-passport-foot"><span>SOLVENEST / ACADEMIC RECORD</span><span>SN • 2024</span></div>}
    </div>
  )
}

function AssignmentDocument({ activeField = null, onHoverField = () => {}, scanning = false }) {
  return (
    <div className="mp-doc">
      <div className="mp-doc-bar"><span>INFORMATION SYSTEMS • ASSESSMENT</span><span>BRIEF</span></div>
      <div className="mp-doc-title">
        <span className="mp-doc-kicker">RESEARCH REPORT</span>
        <h3>Urban resilience <em>in changing cities</em></h3>
        <p>Evaluate how cities can adapt to climate pressure using current research. Compare two urban approaches and support the discussion with evidence and critical analysis.</p>
      </div>
      <div className="mp-doc-meta">
        <div className={`mp-doc-field ${activeField === 'words' ? 'is-active' : ''}`} onMouseEnter={() => onHoverField('words')} onMouseLeave={() => onHoverField(null)}>
          <small>WORD COUNT</small><b>2,500 words</b>
        </div>
        <div className={`mp-doc-field ${activeField === 'citation' ? 'is-active' : ''}`} onMouseEnter={() => onHoverField('citation')} onMouseLeave={() => onHoverField(null)}>
          <small>REFERENCING</small><b>APA 7</b>
        </div>
        <div className={`mp-doc-field ${activeField === 'deadline' ? 'is-active' : ''}`} onMouseEnter={() => onHoverField('deadline')} onMouseLeave={() => onHoverField(null)}>
          <small>DUE</small><b>28 September</b>
        </div>
      </div>
      <div className="mp-doc-copy">
        <b>Overview</b>
        <p>Students will examine resilience strategies and evaluate effectiveness with reference to recent literature (2019–2024). Use peer-reviewed sources and city case studies.</p>
        <b>Requirements</b>
        <p>Compare two approaches, discuss trade-offs, and support argument with evidence. Structure must include introduction, comparative analysis, recommendation, and conclusion.</p>
      </div>
      <div className={`mp-doc-rubric ${activeField === 'rubric' ? 'is-active' : ''}`} onMouseEnter={() => onHoverField('rubric')} onMouseLeave={() => onHoverField(null)}>
        <div className="mp-doc-rubric-head"><b>Rubric / 6 criteria</b><span>30% weighting</span></div>
        <div className="mp-doc-rubric-grid">{Array.from({ length: 6 }, (_, i) => <span key={i}><i />Criterion {i + 1}</span>)}</div>
      </div>
      <div className="mp-doc-foot"><span>Assessment weighting: 30%</span><span>Page 1 / 4</span></div>
      {scanning && <motion.span className="mp-doc-scanner" initial={{ top: 0 }} animate={{ top: '88%' }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />}
    </div>
  )
}

export function MethodPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [hoveredField, setHoveredField] = useState(null)
  const [scanField, setScanField] = useState(null)
  const [expandedQuote, setExpandedQuote] = useState(null)
  const [selectedExpert, setSelectedExpert] = useState(0)
  const [expertAssigned, setExpertAssigned] = useState(false)
  const [explainChoice, setExplainChoice] = useState(null)
  const [showRubric, setShowRubric] = useState(false)
  const [humanProgress, setHumanProgress] = useState(0)
  const [qualityStep, setQualityStep] = useState(0)
  const [decision, setDecision] = useState(0)
  const deliveryDate = formatDeliveryDate(5)

  useEffect(() => {
    const order = ['type', 'words', 'citation', 'deadline', 'rubric']
    let idx = 0
    const t = setInterval(() => { setScanField(order[idx % order.length]); idx++ }, 1600)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setHumanProgress(p => (p < 4 ? p + 1 : 0)), 2200)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setQualityStep(s => (s + 1) % 6), 1800)
    return () => clearInterval(t)
  }, [])

  const goPrev = () => setActiveTab(p => Math.max(0, p - 1))
  const goNext = () => setActiveTab(p => Math.min(phases.length - 1, p + 1))

  const extractedFields = [
    { k: 'type', label: 'TASK TYPE', value: 'Research Report' },
    { k: 'level', label: 'LEVEL', value: 'Undergraduate' },
    { k: 'length', label: 'LENGTH', value: '2,500 words' },
    { k: 'style', label: 'STYLE', value: 'APA 7' },
    { k: 'rubric', label: 'RUBRIC', value: '6 criteria' },
    { k: 'deadline', label: 'DEADLINE', value: '5 days remaining' },
    { k: 'complexity', label: 'COMPLEXITY', value: 'Medium' },
  ]

  return (
    <div className="method-page">
      {/* HERO */}
      <section className="mp-hero">
        <div className="mp-container mp-hero-grid">
          <motion.div className="mp-hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <span className="mp-eyebrow">THE SOLVENEST METHOD</span>
            <h1>
              <span>From academic brief</span>
              <em>to confident progress.</em>
            </h1>
            <p>Follow one task through SolveNest — from the first Solvy analysis to human review, expert support, quality assurance and post-delivery understanding.</p>
            <div className="mp-hero-actions">
              <button className="mp-cta mp-cta-primary" onClick={() => navigate('/analyze')}>Start With My Task <ArrowRight size={16} /></button>
              <button className="mp-cta mp-cta-ghost" onClick={() => setActiveTab(0)}>View the journey <span>↓</span></button>
            </div>
            <div className="mp-hero-trust">
              <span><ShieldCheck size={13} /> Solvy estimates before signup</span>
              <span><Users size={13} /> Humans confirm scope</span>
              <span><LockKeyhole size={13} /> Private processing</span>
            </div>
          </motion.div>

          <motion.div className="mp-hero-visual" initial={{ opacity: 0, y: 22, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mp-hero-stack">
              <div className="mp-hero-brief-layer" aria-hidden="true">
                <AssignmentDocument />
              </div>
              <motion.div className="mp-hero-passport-layer" initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.35 }}>
                <TaskPassport status={['NOT YET ANALYSED','GUEST ANALYSIS COMPLETE','SAVED ANALYSIS','PAID','ASSIGNED','IN PROGRESS','QA APPROVED','READY FOR YOUR TASK'][activeTab + 1] || 'NOT YET ANALYSED'} />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TABBED NAVIGATOR — pages inside Method */}
      <nav className="mp-navigator is-tabs" aria-label="Method journey">
        <div className="mp-container mp-nav-inner">
          <div className="mp-nav-progress"><motion.i animate={{ width: `${((activeTab + 1) / phases.length) * 100}%` }} transition={{ duration: 0.45 }} /></div>
          <div className="mp-nav-phases" role="tablist">
            {phases.map((p, i) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={activeTab === i}
                className={activeTab === i ? 'is-active' : activeTab > i ? 'is-past' : ''}
                onClick={() => setActiveTab(i)}
              >
                <span className="mp-nav-num">{p.short}</span>
                <span className="mp-nav-label">{p.label}</span>
                <small className="mp-nav-desc">{p.desc}</small>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* TAB PAGES — content moves like pages, no long vertical scroll */}
      <div className="mp-tab-viewport">
        <div className="mp-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -28, filter: 'blur(6px)' }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mp-tab-panel"
            >
              {/* TAB 0 — UNDERSTAND */}
              {activeTab === 0 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">01 / UNDERSTAND</span>
                    <h2>Start with the brief.<br /><em>No account required.</em></h2>
                    <p>Solvy reads the assessment like a human would — but faster. Upload your brief and see structure, requirements, and an initial range before you decide to continue.</p>
                  </div>

                  <div className="mp-scan-grid">
                    <div className="mp-scan-doc">
                      <span className="mp-card-label">SOURCE DOCUMENT</span>
                      <AssignmentDocument activeField={hoveredField || scanField} onHoverField={setHoveredField} scanning={true} />
                      <div className="mp-scan-legend"><span><i className="dot" /> Live scan</span><span>Hover any field ↔ highlight source</span></div>
                    </div>
                    <div className="mp-scan-analysis">
                      <div className="mp-analysis-head"><span><i /> SOLVY / QUICK SCAN</span><small>GUEST • NO ACCOUNT</small></div>
                      <div className="mp-extracted">
                        {extractedFields.map(f => (
                          <div key={f.k} className={`mp-extract-row ${hoveredField === f.k || scanField === f.k ? 'is-active' : ''}`} onMouseEnter={() => setHoveredField(f.k)} onMouseLeave={() => setHoveredField(null)}>
                            <small>{f.label}</small><b>{f.value}</b>
                            <span className="mp-extract-check"><Check size={12} /></span>
                          </div>
                        ))}
                      </div>
                      <div className="mp-estimate">
                        <small>ESTIMATED SOLVENEST RANGE</small>
                        <strong>LKR 8,000 – 10,000</strong>
                        <span>This is an initial Solvy estimate, not the official final quote.</span>
                      </div>
                      <div className="mp-analysis-foot"><ShieldCheck size={14} /> Human-confirmed final quotes • No account needed to begin</div>
                    </div>
                  </div>

                  <div className="mp-divider" />
                  <div className="mp-section-head is-compact">
                    <span className="mp-label">01 / UNDERSTAND — CONTINUED</span>
                    <h3>Interested? <em>Save the analysis and go deeper.</em></h3>
                    <p>Create a Student account after seeing the estimate. Your files and guest analysis carry over — no re-upload needed.</p>
                  </div>
                  <div className="mp-transform">
                    <div className="mp-transform-card">
                      <span className="mp-card-label">GUEST</span>
                      <TaskPassport status="GUEST ANALYSIS COMPLETE" />
                      <div className="mp-transform-pills">
                        <span>Temporary analysis</span>
                        <span>Files held for session</span>
                        <span>Estimate visible</span>
                      </div>
                    </div>
                    <div className="mp-transform-flow">
                      <span>Create Account</span><i /><span>Verify</span><i /><span>Continue</span>
                      <small>You do not need to upload the same brief again.</small>
                    </div>
                    <div className="mp-transform-card is-verified">
                      <span className="mp-card-label">VERIFIED STUDENT TASK</span>
                      <TaskPassport status="SAVED ANALYSIS" variant="dark" />
                      <div className="mp-transform-pills">
                        <span>Saved analysis</span>
                        <span>Persistent files</span>
                        <span>Full Solvy Review</span>
                      </div>
                    </div>
                  </div>
                  <div className="mp-deep-analysis">
                    <div className="mp-deep-head"><Search size={16} /> Full Solvy Review — deeper signals appear after saving</div>
                    <div className="mp-deep-grid">
                      {[
                        ['Missing information', 'Data source clarification'],
                        ['Required expertise', 'Research Writing'],
                        ['Deadline risk', 'Low — 5 days buffer'],
                        ['Scope complexity', 'Medium'],
                        ['Rubric weighting', 'Critical analysis 35%'],
                        ['Recommended support', 'Guidance + review'],
                      ].map(([k, v]) => (
                        <div key={k} className="mp-deep-item"><small>{k}</small><b>{v}</b></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1 — CONFIRM */}
              {activeTab === 1 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">02 / CONFIRM</span>
                    <h2>Solvy recommends.<br /><em>People make the important decisions.</em></h2>
                    <p>Every AI suggestion is reviewed by an authorized human before it becomes a commitment.</p>
                  </div>
                  <div className="mp-human-grid">
                    <div className="mp-human-col mp-human-ai">
                      <span className="mp-card-label"><Sparkles size={12} /> SOLVY ANALYSIS</span>
                      {[
                        ['Estimated range', 'LKR 8,000 – 10,000'],
                        ['Complexity', 'Medium'],
                        ['Suggested delivery', '5 days'],
                        ['Recommended expertise', 'Academic Writing / Research'],
                        ['Missing information', 'Data source clarification'],
                      ].map(([label, value], idx) => (
                        <motion.div key={label} className={`mp-human-row ${humanProgress > idx ? 'is-sent' : ''}`} animate={{ opacity: humanProgress >= idx ? 1 : 0.45 }}>
                          <small>{label}</small><b>{value}</b>
                          {humanProgress > idx && <motion.span initial={{ x: 8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="mp-human-sent">→ Review</motion.span>}
                        </motion.div>
                      ))}
                    </div>
                    <div className="mp-human-arrow" aria-hidden="true">
                      <div className="mp-human-line"><motion.i animate={{ height: `${(humanProgress / 4) * 100}%` }} /></div>
                      <span>AI → Human</span>
                    </div>
                    <div className="mp-human-col mp-human-human">
                      <span className="mp-card-label"><Shield size={12} /> HUMAN REVIEW</span>
                      {[
                        ['Official pricing decision', humanProgress > 0 ? 'LKR 8,750 • Under approval' : 'Pending'],
                        ['Delivery feasibility', humanProgress > 1 ? `Feasible • ${deliveryDate} confirmed` : 'Under review'],
                        ['Expertise confirmed', humanProgress > 2 ? 'Research Specialist' : 'Pending'],
                        ['Scope boundary', humanProgress > 3 ? 'Academic guidance • In scope' : 'Checking integrity'],
                        ['Feasibility decision', humanProgress > 4 ? (decision === 0 ? 'SUPPORTED' : decision === 1 ? 'SUPPORTED WITH CLARIFICATION' : 'NOT SUPPORTED') : 'Awaiting decision'],
                      ].map(([label, value], idx) => (
                        <div key={label} className={`mp-human-row ${humanProgress > idx ? 'is-confirmed' : 'is-pending'}`}>
                          <small>{label}</small><b>{value}</b>
                          {humanProgress > idx && <Check size={14} />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mp-decision-rail">
                    <button className={decision === 0 ? 'is-active' : ''} onClick={() => setDecision(0)}><b>SUPPORTED</b><small>Requirements and deadline are feasible.</small></button>
                    <button className={decision === 1 ? 'is-active' : ''} onClick={() => setDecision(1)}><b>SUPPORTED WITH CLARIFICATION</b><small>Feasible after student confirms details.</small></button>
                    <button className={decision === 2 ? 'is-active' : ''} onClick={() => setDecision(2)}><b>NOT SUPPORTED</b><small>Request outside current support scope.</small></button>
                  </div>
                  <p className="mp-human-note">For this Research Report: <b>{decision === 0 ? 'SUPPORTED' : decision === 1 ? 'SUPPORTED WITH CLARIFICATION' : 'NOT SUPPORTED'}</b> — {decision === 0 ? 'rubric and deadline are feasible for Research Specialist assignment.' : decision === 1 ? 'feasible once data-source clarification is confirmed.' : 'outside current support scope — admin will advise alternatives.'}</p>
                </div>
              )}

              {/* TAB 2 — FUND */}
              {activeTab === 2 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">03 / FUND</span>
                    <h2>Nothing starts until<br /><em>the scope is clear.</em></h2>
                    <p>A premium official plan — not a pricing card. Scope, price, delivery, and revisions are written before any payment.</p>
                  </div>

                  <div className="mp-fund">
                    {/* left: official plan */}
                    <div className="mp-fund-plan">
                      <div className="mp-fund-plan-head">
                        <div className="mp-fund-plan-badge"><ShieldCheck size={12} /> OFFICIAL PLAN</div>
                        <div className="mp-fund-plan-id">{taskMeta.code}</div>
                      </div>
                      <div className="mp-fund-plan-title">
                        <span>SOLVENEST OFFICIAL PLAN</span>
                        <small>Task • Research Report • {taskMeta.code}</small>
                      </div>
                      <div className="mp-fund-plan-price">
                        <small>Official Price</small>
                        <strong>LKR 8,750</strong>
                        <span className="mp-fund-plan-note"><LockKeyhole size={11} /> Official plan generated after Human Review • No payment taken until you approve</span>
                      </div>

                      <div className="mp-fund-plan-stats">
                        {[
                          { icon: <CalendarDays size={14} />, label: 'Delivery', value: '28 September', accent: false },
                          { icon: <Clock3 size={14} />, label: 'Valid until', value: '24 hours', accent: true },
                          { icon: <FileCheck2 size={14} />, label: 'Revisions', value: '2 included', accent: false },
                        ].map(({ icon, label, value, accent }) => (
                          <div key={label} className={`mp-fund-stat ${accent ? 'is-accent' : ''}`}>
                            <div className="mp-fund-stat-icon">{icon}</div>
                            <div><small>{label}</small><b>{value}</b></div>
                          </div>
                        ))}
                      </div>

                      <div className="mp-fund-plan-sections">
                        {[
                          { key: 'scope', icon: <Layers size={14} />, label: 'Included Scope', badge: '5 items', items: ['Requirement interpretation', 'Research guidance', 'Structure support', 'Citation review (APA 7)', 'Quality review before delivery'] },
                          { key: 'delivery', icon: <CalendarDays size={14} />, label: 'Delivery', badge: '28 September', text: 'Delivery date is confirmed during Human Review based on feasibility, not the Solvy suggestion.' },
                          { key: 'revisions', icon: <History size={14} />, label: 'Revisions', badge: '2 included', text: 'Revisions apply to the accepted scope. New requirements may require a scope-change quote.' },
                          { key: 'price', icon: <Award size={14} />, label: 'Price', badge: 'LKR 8,750', text: 'Official price is fixed after Human Review. Guest estimate (LKR 8,000–10,000) is non-binding.' },
                        ].map(({ key, icon, label, badge, items, text }) => (
                          <div key={key} className={`mp-fund-section ${expandedQuote === key ? 'is-open' : ''}`}>
                            <button className="mp-fund-section-head" onClick={() => setExpandedQuote(expandedQuote === key ? null : key)}>
                              <span>{icon} {label}</span>
                              <span className="mp-fund-section-right">
                                <span className="mp-fund-section-badge">{badge}</span>
                                {expandedQuote === key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </button>
                            <AnimatePresence>{expandedQuote === key && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mp-fund-section-body">
                                {items ? (
                                  <ul>{items.map(it => <li key={it}>{it}</li>)}</ul>
                                ) : (
                                  <p>{text}</p>
                                )}
                              </motion.div>
                            )}</AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* right: payment + passport + assessment */}
                    <div className="mp-fund-right">
                      {/* payment card */}
                      <div className="mp-fund-payment">
                        <div className="mp-fund-payment-head"><small>PAYMENT</small></div>
                        <div className="mp-fund-payment-body">
                          <span className="mp-fund-payment-type">STANDARD TASK</span>
                          <strong>LKR 8,750</strong>
                          <span className="mp-fund-payment-funded">100% funded before work begins.</span>
                          <div className="mp-fund-payment-badge"><Check size={14} /> Payment Confirmed</div>
                        </div>
                      </div>

                      {/* task passport */}
                      <div className="mp-fund-passport">
                        <div className="mp-fund-passport-head"><small>TASK PASSPORT</small><span className="mp-fund-passport-status">PAID</span></div>
                        <div className="mp-fund-passport-body">
                          <p>Task Passport updates from <b>QUOTE APPROVED → PAID</b>. Work does not begin until funding is confirmed.</p>
                          <small>Larger projects may use prepaid milestones. <button onClick={() => navigate('/plans')}>See Plans & Estimates →</button></small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3 — MATCH */}
              {activeTab === 3 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">04 / MATCH</span>
                    <h2>The task goes to the right expertise —<br /><em>not the first available person.</em></h2>
                    <p>SolveNest owns the assignment decision. Students never browse experts. Internal matching + admin approval ensures fit.</p>
                  </div>

                  <div className="mp-match">
                    {/* flow steps */}
                    <div className="mp-match-flow">
                      {[
                        { step: '01', label: 'Opportunity published', icon: <FileText size={14} /> },
                        { step: '02', label: 'Interested experts respond', icon: <Users size={14} /> },
                        { step: '03', label: 'Admin reviews expertise, availability, workload, quality, performance', icon: <Search size={14} /> },
                        { step: '04', label: 'Admin assigns', icon: <Check size={14} />, final: true },
                      ].map((s, i) => (
                        <div key={s.step} className={`mp-match-step ${s.final ? 'is-final' : ''}`}>
                          <div className="mp-match-step-num"><span>{s.step}</span><div className="mp-match-step-icon">{s.icon}</div></div>
                          <div className="mp-match-step-line" />
                          <small>{s.label}</small>
                        </div>
                      ))}
                    </div>

                    <div className="mp-match-body">
                      {/* expert cards — direct grid children */}
                      {[
                        { id: 'A', title: 'Research Writing', score: 94, avail: 'Available', perf: '4.8 / 5', match: ['Research Specialist', 'Undergraduate focus', 'APA 7 expert'], bio: 'Specializes in academic research reports with strong analytical frameworks and evidence-based arguments.' },
                        { id: 'B', title: 'Business Research', score: 89, avail: 'Limited', perf: '4.7 / 5', match: ['Case study strength', 'Quantitative'], bio: 'Expert in business case studies with quantitative analysis and industry benchmarking methods.' },
                        { id: 'C', title: 'Academic Editing', score: 81, avail: 'Available', perf: '4.9 / 5', match: ['Citation focus', 'Structure'], bio: 'Top-rated editor focused on citation accuracy, document structure, and academic tone consistency.' },
                      ].map((ex, idx) => (
                        <div key={ex.id} className={`mp-match-card ${selectedExpert === idx ? 'is-selected' : ''} ${expertAssigned && selectedExpert !== idx ? 'is-dimmed' : ''}`} onClick={() => setSelectedExpert(idx)}>
                          <div className="mp-match-card-head">
                            <div className="mp-match-card-avatar"><span>{ex.id}</span></div>
                            <div className="mp-match-card-info"><small>EXPERT {ex.id}</small><b>{ex.title}</b></div>
                          </div>
                          <p className="mp-match-card-bio">{ex.bio}</p>
                          <div className="mp-match-score">
                            <div className="mp-match-score-bar"><div className="mp-match-score-fill" style={{ width: `${ex.score}%` }} /></div>
                            <span>{ex.score}% match</span>
                          </div>
                          <div className="mp-match-card-meta">
                            <div><small>AVAILABILITY</small><b className={ex.avail === 'Available' ? 'is-green' : 'is-amber'}>{ex.avail}</b></div>
                            <div><small>PERFORMANCE</small><b>{ex.perf}</b></div>
                          </div>
                          <div className="mp-match-tags">
                            {ex.match.map(m => <span key={m}>{m}</span>)}
                          </div>
                          {selectedExpert === idx && !expertAssigned && <div className="mp-match-selected-hint"><Check size={12} /> Selected — Admin evaluates fit</div>}
                        </div>
                      ))}

                      {/* right: passport */}
                      <div className="mp-match-sidebar">
                        <div className="mp-match-passport">
                          <div className="mp-match-passport-head"><small>TASK PASSPORT</small><span className="mp-match-passport-badge">{expertAssigned ? 'ASSIGNED' : 'PAID'}</span></div>
                          <div className="mp-match-passport-body">
                            {[
                              ['Research Report', 'TYPE'],
                              ['Information Systems', 'SUBJECT'],
                              ['Undergraduate', 'LEVEL'],
                              ['2,500 words', 'LENGTH'],
                              ['APA 7', 'STYLE'],
                              ['6 criteria', 'RUBRIC'],
                              ['28 September', 'DUE'],
                              [taskMeta.code, 'ID'],
                            ].map(([val, lbl]) => (
                              <div key={lbl} className="mp-match-passport-row"><small>{lbl}</small><b>{val}</b></div>
                            ))}
                          </div>
                        </div>

                        {!expertAssigned ? (
                          <button className="mp-match-assign" onClick={() => setExpertAssigned(true)}>
                            Assign selected expert <ArrowRight size={15} />
                          </button>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mp-match-assigned">
                            <div className="mp-match-assigned-icon"><ShieldCheck size={16} /></div>
                            <div>
                              <small>ASSIGNED SOLVENEST EXPERT</small>
                              <b>Research Specialist</b>
                              <span><Star size={11} /> 4.8 rating • Verified • Internal network</span>
                            </div>
                            <button className="mp-match-reset" onClick={() => setExpertAssigned(false)}>Reset demo</button>
                          </motion.div>
                        )}

                        <div className="mp-match-privacy"><LockKeyhole size={12} /> Student and Expert communication remains inside SolveNest. Direct contact details are not shared.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4 — PROGRESS */}
              {activeTab === 4 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">05 / PROGRESS</span>
                    <h2>One workspace.<br /><em>Every important update.</em></h2>
                    <p>A single Task Room replaces scattered chats and emails. Progress, files, and next steps are always visible.</p>
                  </div>

                  {/* ── TASK ROOM ── */}
                  <div className="mp-room">
                    {/* top bar */}
                    <div className="mp-room-top">
                      <div className="mp-room-top-left">
                        <span className="mp-room-id">{taskMeta.code}</span>
                        <span className="mp-room-divider">•</span>
                        <span className="mp-room-type">Research Report</span>
                      </div>
                      <div className="mp-room-top-right">
                        <span className="mp-room-status is-active"><i /> IN PROGRESS</span>
                        <span className="mp-room-deadline"><CalendarDays size={12} /> {taskMeta.due}</span>
                      </div>
                    </div>

                    {/* sidebar + main */}
                    <div className="mp-room-body">
                      {/* sidebar */}
                      <aside className="mp-room-sidebar">
                        <div className="mp-room-expert">
                          <div className="mp-room-expert-avatar"><ShieldCheck size={18} /></div>
                          <div className="mp-room-expert-info">
                            <small>ASSIGNED EXPERT</small>
                            <b>Research Specialist</b>
                            <span><Star size={10} /> 4.8 • Verified</span>
                          </div>
                        </div>

                        <nav className="mp-room-nav">
                          {['Overview', 'Requirements', 'Files', 'Timeline', 'Messages', 'Payments', 'Quality', 'Revisions'].map((t, i) => (
                            <button key={t} className={i === 0 ? 'is-active' : ''}>{t}</button>
                          ))}
                        </nav>

                        <div className="mp-room-meta-list">
                          <div><small>DEADLINE</small><b>{taskMeta.due}</b></div>
                          <div><small>WORDS</small><b>{taskMeta.words}</b></div>
                          <div><small>STYLE</small><b>{taskMeta.referencing}</b></div>
                        </div>
                      </aside>

                      {/* main content */}
                      <div className="mp-room-main">
                        {/* timeline */}
                        <div className="mp-room-timeline">
                          <div className="mp-room-timeline-head">
                            <small>PROGRESS TIMELINE</small>
                          </div>
                          <div className="mp-room-timeline-track">
                            {['Submitted', 'Analyzed', 'Approved', 'Paid', 'Assigned', 'In Progress', 'Quality Review', 'Delivered'].map((s, i) => (
                              <div key={s} className={`mp-room-step ${i <= 5 ? 'is-done' : i === 6 ? 'is-next' : ''}`}>
                                <div className="mp-room-step-dot"><i>{i <= 5 ? <Check size={9} /> : i === 6 ? <Clock3 size={9} /> : ''}</i></div>
                                <span className="mp-room-step-label">{s}</span>
                                {i < 7 && <div className="mp-room-step-line" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* info cards */}
                        <div className="mp-room-cards">
                          <div className="mp-room-card is-activity">
                            <div className="mp-room-card-icon"><Layers size={15} /></div>
                            <div className="mp-room-card-body">
                              <small>CURRENT ACTIVITY</small>
                              <b>Research structure and evidence review</b>
                            </div>
                          </div>
                          <div className="mp-room-card is-update">
                            <div className="mp-room-card-icon"><FileCheck2 size={15} /></div>
                            <div className="mp-room-card-body">
                              <small>RECENT UPDATE</small>
                              <span>Requirements confirmed • Reference requirements reviewed</span>
                            </div>
                          </div>
                          <div className="mp-room-card is-next">
                            <div className="mp-room-card-icon"><ArrowRight size={15} /></div>
                            <div className="mp-room-card-body">
                              <small>NEXT STEP</small>
                              <b>Internal quality review</b>
                              <span className="mp-room-card-note">No action required right now</span>
                            </div>
                          </div>
                        </div>

                        {/* chat */}
                        <div className="mp-room-chat">
                          <div className="mp-room-chat-head">
                            <span><MessageCircle size={13} /> PROTECTED COMMUNICATION</span>
                            <span className="mp-room-chat-badge"><Shield size={10} /> Solvy Shield</span>
                          </div>
                          <div className="mp-room-chat-body">
                            <div className="mp-chat-msg is-student">
                              <div className="mp-chat-avatar">S</div>
                              <div className="mp-chat-content">
                                <small>Student</small>
                                <p>Can you explain whether this section needs more sources?</p>
                              </div>
                            </div>
                            <div className="mp-chat-msg is-expert">
                              <div className="mp-chat-avatar is-expert"><ShieldCheck size={12} /></div>
                              <div className="mp-chat-content">
                                <small>Verified Expert</small>
                                <p>Yes. Criterion 3 requires stronger evidence. I've marked the relevant requirement.</p>
                              </div>
                            </div>
                          </div>
                          <div className="mp-room-chat-foot">
                            <LockKeyhole size={11} /> Protected communication • No direct contact sharing
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5 — VERIFY */}
              {activeTab === 5 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">06 / VERIFY</span>
                    <h2>Expert completion is not<br /><em>the same as delivery.</em></h2>
                    <p>Every deliverable passes a separate human quality gate before it reaches you. Delivery arrives with context — not just a download button.</p>
                  </div>

                  {/* ── QA DASHBOARD ── */}
                  <div className="mp-qa">
                    {/* top row — ring + checks */}
                    <div className="mp-qa-top">
                      {/* progress ring */}
                      <div className="mp-qa-ring-wrap">
                        <div className="mp-qa-ring">
                          <svg viewBox="0 0 120 120" style={{ transform: 'rotate(90deg)' }}>
                            <circle cx="60" cy="60" r="52" className="mp-qa-ring-bg" />
                            <motion.circle cx="60" cy="60" r="52" className="mp-qa-ring-fill" initial={{ strokeDashoffset: 327 }} animate={{ strokeDashoffset: qualityStep >= 5 ? 0 : 327 - (qualityStep + 1) * 54.5 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
                          </svg>
                          <div className="mp-qa-ring-center">
                            {qualityStep >= 5 ? <Check size={10} strokeWidth={2} className="mp-qa-approved-mark" /> : <span className="mp-qa-ring-count">{qualityStep + 1}<small>/6</small></span>}
                            <span className="mp-qa-ring-status">{qualityStep >= 5 ? 'APPROVED' : 'CHECKING'}</span>
                          </div>
                        </div>
                        <div className="mp-qa-ring-label">
                          <small>QUALITY ASSURANCE</small>
                          <b>Research Report • {taskMeta.code}</b>
                        </div>
                      </div>

                      {/* checklist */}
                      <div className="mp-qa-checks">
                        <div className="mp-qa-checks-head">
                          <small>QA CHECKLIST</small>
                          <span>{Math.min(qualityStep + 1, 6)} of 6 passed</span>
                        </div>
                        {[
                          ['Requirements Coverage', '10 / 10 criteria matched', qualityStep >= 0],
                          ['Citation Review', 'APA 7 formatting verified', qualityStep >= 1],
                          ['Formatting', 'Structure & layout passed', qualityStep >= 2],
                          ['Scope Check', 'Deliverable within scope', qualityStep >= 3],
                          ['File Verification', '3 files • integrity checked', qualityStep >= 4],
                          ['QA Decision', 'Approved for delivery', qualityStep >= 5],
                        ].map(([title, detail, done], idx) => (
                          <div key={title} className={`mp-qa-check ${done ? 'is-done' : ''}`}>
                            <div className="mp-qa-check-icon">{done ? <Check size={12} /> : <span className="mp-qa-check-num">{idx + 1}</span>}</div>
                            <div className="mp-qa-check-body">
                              <b>{title}</b>
                              <small>{detail}</small>
                            </div>
                            {done && <span className="mp-qa-check-badge">PASSED</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* stage rail */}
                    <div className="mp-qa-stage">
                      {['In Progress', 'Quality Review', 'Delivered'].map((s, i) => (
                        <div key={s} className={`mp-qa-stage-step ${i === 0 ? 'is-done' : i === 1 && qualityStep >= 5 ? 'is-done' : i === 2 && qualityStep >= 5 ? 'is-active' : i === 1 ? 'is-current' : ''}`}>
                          <div className="mp-qa-stage-dot"><i>{i === 0 || (i === 1 && qualityStep >= 5) ? <Check size={10} /> : i === 1 ? <Clock3 size={10} /> : ''}</i></div>
                          <span>{s}</span>
                        </div>
                      ))}
                      {qualityStep >= 5 && <div className="mp-qa-stage-badge"><ShieldCheck size={12} /> QA APPROVED</div>}
                    </div>
                  </div>

                  {/* ── DELIVERY PANEL ── */}
                  <div className="mp-verify-delivery">
                    <div className="mp-verify-delivery-main">
                      <div className="mp-verify-delivery-head">
                        <div className="mp-verify-delivery-title">
                          <span className="mp-verify-delivery-tag">DELIVERY</span>
                          <h4>Research Report • {taskMeta.code}</h4>
                          <small>Delivered {taskMeta.due} • 3 files ready</small>
                        </div>
                        <div className="mp-verify-delivery-status">
                          <span className="mp-verify-status-dot" />
                          <b>Delivered</b>
                        </div>
                      </div>

                      <div className="mp-verify-files-row">
                        {[
                          { name: 'Report', ext: 'DOCX', size: '2.4 MB' },
                          { name: 'References', ext: 'PDF', size: '340 KB' },
                          { name: 'Dataset', ext: 'XLSX', size: '1.1 MB' },
                        ].map(f => (
                          <div key={f.name} className="mp-verify-file-chip">
                            <FileText size={14} />
                            <span>{f.name}</span>
                            <small>{f.ext} • {f.size}</small>
                            <Download size={12} />
                          </div>
                        ))}
                      </div>



                      <div className="mp-verify-actions">
                        <button className="mp-verify-btn-primary"><Download size={14} /> Download All Files</button>
                        <button className="mp-verify-btn-secondary">Request Revision</button>
                        <button className="mp-verify-btn-success"><Check size={14} /> Approve & Close</button>
                      </div>
                    </div>

                    {/* evidence sidebar */}
                    <div className="mp-verify-evidence">
                      <div className="mp-verify-evidence-head">
                        <ShieldCheck size={14} />
                        <small>QUALITY EVIDENCE</small>
                      </div>
                      {[
                        ['Requirements', 'Complete', true],
                        ['QA Gate', 'Approved', true],
                        ['Files', 'Verified', true],
                        ['Revision', '2 remaining', false],
                      ].map(([label, value, green]) => (
                        <div key={label} className="mp-verify-evidence-row">
                          <span>{label}</span>
                          <b className={green ? 'is-green' : ''}>{value}</b>
                        </div>
                      ))}
                      <div className="mp-verify-evidence-footer">
                        <LockKeyhole size={11} />
                        <span>All checks completed before delivery</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6 — LEARN */}
              {activeTab === 6 && (
                <div className="mp-tab-content">
                  <div className="mp-section-head">
                    <span className="mp-label">07 / LEARN</span>
                    <h2>Delivery is not the end.<br /><em>Understanding matters too.</em></h2>
                    <p>Solvy Explain & Defend turns a delivered file into genuine understanding — with rubric-linked guidance.</p>
                  </div>

                  <div className="mp-learn-row">
                    {/* doc info — compact left */}
                    <div className="mp-learn-doc-compact">
                      <div className="mp-learn-doc-badge"><FileText size={14} /> DELIVERED</div>
                      <h4>Urban resilience: Comparative analysis</h4>
                      <p>Critical evaluation of City A and City B approaches, weighted toward evidence quality and comparative depth.</p>
                      <div className={`mp-learn-rubric-mini ${showRubric ? 'is-active' : ''}`} onClick={() => setShowRubric(!showRubric)}>
                        <Award size={12} />
                        <span>Criterion 3 — Critical Analysis (35%)</span>
                        <ChevronDown size={12} className={showRubric ? 'is-open' : ''} />
                      </div>
                      <AnimatePresence>
                        {showRubric && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mp-learn-rubric-mini-expand">
                            {['Evidence Quality 25%', 'Comparative Depth 25%', 'Critical Analysis 35%', 'Structure & Flow 10%', 'Referencing 5%'].map((r, i) => (
                              <div key={r} className={i === 2 ? 'is-active' : ''}><small>{i + 1}.</small> {r}</div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="mp-learn-doc-status"><ShieldCheck size={12} /> <b>COMPLETED</b> <span>• {taskMeta.code}</span></div>
                    </div>

                    {/* explain & defend — center main */}
                    <div className="mp-learn-defend-compact">
                      <div className="mp-learn-defend-top">
                        <div className="mp-learn-defend-icon"><Lightbulb size={15} /></div>
                        <div><small>SOLVY EXPLAIN & DEFEND</small><b>Ask anything about your delivery</b></div>
                      </div>
                      <div className="mp-learn-q-grid">
                        {[
                          { q: 'Explain this section simply', icon: '💡' },
                          { q: 'Why was this approach used?', icon: '🎯' },
                          { q: 'Quiz me on this topic', icon: '📝' },
                          { q: 'What might my lecturer ask?', icon: '🎓' },
                          { q: 'Help me improve this section', icon: '✨' },
                        ].map(({ q, icon }) => (
                          <button key={q} className={explainChoice === q ? 'is-active' : ''} onClick={() => { setExplainChoice(q); setShowRubric(false) }}>
                            <span>{icon}</span> {q}
                          </button>
                        ))}
                      </div>
                      <AnimatePresence mode="wait">
                        {explainChoice && (
                          <motion.div key={explainChoice} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mp-learn-answer-compact">
                            <div className="mp-learn-answer-q"><Sparkles size={12} /> {explainChoice}</div>
                            <p>{explainChoice === 'Why was this approach used?' ? 'This structure was chosen because the rubric places the highest weighting on critical analysis. The argument moves from evidence to comparison before reaching the recommendation.' : explainChoice === 'Explain this section simply' ? 'This section compares how two cities handle climate pressure. It shows what each city does, what works, and what trade-offs each approach creates.' : explainChoice === 'Quiz me on this topic' ? 'What is the key difference between City A and City B\'s approach to climate resilience? Think about the trade-offs each city makes.' : explainChoice === 'What might my lecturer ask?' ? 'Your lecturer may ask: "How does the evidence support your recommendation?" or "What are the limitations of comparing these two cities?"' : 'Consider strengthening the evidence in Criterion 3 by adding a recent source (2023–2024) that supports the comparison.'}</p>
                            <div className="mp-learn-answer-btns">
                              <button onClick={() => setExplainChoice(null)}>Ask follow-up</button>
                              <button className={showRubric ? 'is-active' : ''} onClick={() => setShowRubric(!showRubric)}>Rubric link</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {!explainChoice && <p className="mp-learn-empty-msg">Select a question to see a contextual Solvy response.</p>}
                    </div>

                    {/* timeline — compact right */}
                    <div className="mp-learn-tl-compact">
                      <div className="mp-learn-tl-head"><b>HISTORY</b><span>{taskMeta.code}</span></div>
                      {[
                        ['Submitted', '09:12'],
                        ['Analyzed', '09:13'],
                        ['Quote Approved', '10:04'],
                        ['Payment', '10:11'],
                        ['Assigned', '10:34'],
                        ['Work Started', '11:02'],
                        ['QA Approved', '14:10'],
                        ['Delivered', '14:18'],
                      ].map(([s, t], i) => (
                        <div key={s} className="mp-learn-tl-item">
                          <div className="mp-learn-tl-dot" />
                          <span className="mp-learn-tl-name">{s}</span>
                          <span className="mp-learn-tl-time">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Tab paging controls */}
      <div className="mp-tab-controls">
        <div className="mp-container mp-tab-controls-inner">
          <button className="mp-tab-arrow" onClick={goPrev} disabled={activeTab === 0}><ChevronLeft size={16} /> Previous</button>
          <div className="mp-tab-dots">
            {phases.map((_, i) => (
              <button key={i} className={`mp-tab-dot ${activeTab === i ? 'is-active' : ''}`} onClick={() => setActiveTab(i)} aria-label={`Go to ${phases[i].label}`} />
            ))}
            <span>{String(activeTab + 1).padStart(2, '0')} / {String(phases.length).padStart(2, '0')} — {phases[activeTab].label}</span>
          </div>
          <button className="mp-tab-arrow is-next" onClick={goNext} disabled={activeTab === phases.length - 1}>Next <ArrowRight size={16} /></button>
        </div>
      </div>

      {/* METHOD SUMMARY — at a glance (outside tabs, compact) */}
      <section className="mp-section mp-section-soft mp-summary is-compact-summary">
        <div className="mp-container">
          <h2>The method, <em>at a glance.</em></h2>
          <div className="mp-summary-rail">
            {[
              ['UNDERSTAND', 'Solvy structures the brief.'],
              ['CONFIRM', 'Humans approve feasibility.'],
              ['FUND', 'Work begins after funding.'],
              ['MATCH', 'SolveNest assigns expertise.'],
              ['PROGRESS', 'Task visible in one workspace.'],
              ['VERIFY', 'Quality review before delivery.'],
              ['LEARN', 'Solvy turns delivery into learning.'],
            ].map(([phase, text], idx) => (
              <div key={phase} className="mp-summary-step">
                <span className="mp-summary-num">{String(idx + 1).padStart(2, '0')}</span>
                <b>{phase}</b><small>{text}</small>
                {idx < 6 && <ArrowRight size={14} className="mp-summary-arrow" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mp-final">
        <div className="mp-container mp-final-grid">
          <div className="mp-final-copy">
            <span className="mp-label is-light">START WITH CLARITY</span>
            <h2>Now see what Solvy finds<br /><em>inside your task.</em></h2>
            <p>Upload your academic brief and receive your first structured estimate before creating an account.</p>
            <button className="mp-cta mp-cta-primary is-large" onClick={() => navigate('/analyze')}>Analyze My Task <ArrowUpRight size={16} /></button>
            <small>No account required to begin.</small>
          </div>
          <div className="mp-final-visual">
            <TaskPassport status="READY FOR YOUR TASK" variant="dark" highlightStatus />
            <small>FROM NOT YET ANALYSED → READY FOR YOUR TASK — the passport closes the story.</small>
          </div>
        </div>
      </section>
    </div>
  )
}

export default MethodPage
