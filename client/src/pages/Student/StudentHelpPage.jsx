import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  MessageCircle,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react'
import {
  fetchGuidance,
  findTaskById,
  loadHelpCatalog,
  searchHelpQuery,
  submitHelpTicket,
  subscribeHelp,
  topicToCategory,
} from '../../student/studentHelpData.js'

const go = (path) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const CATEGORY_ICON = {
  task: ClipboardList,
  payment: CreditCard,
  files: FolderOpen,
  messages: MessageCircle,
  explain: BookOpen,
  account: User,
  technical: Wrench,
}

const ISSUE_ICON = {
  processing: RefreshCw,
  failed: AlertTriangle,
  receipt: CreditCard,
  'cant-open': FolderOpen,
  'cant-upload': FolderOpen,
  password: Shield,
  unavailable: Sparkles,
}

function CategoryIcon({ categoryKey, size = 18 }) {
  const Icon = CATEGORY_ICON[categoryKey] || HelpCircle
  return <Icon size={size} aria-hidden="true" />
}

function IssueIcon({ issueKey, size = 15 }) {
  const Icon = ISSUE_ICON[issueKey] || HelpCircle
  return <Icon size={size} aria-hidden="true" />
}

function EmptyNote({ children }) {
  return (
    <div className="sn-hlp__empty" role="status">
      {children}
    </div>
  )
}

export default function StudentHelpPage() {
  const searchId = useId()
  const messageId = useId()
  const resultsRef = useRef(null)
  const [snapshot, setSnapshot] = useState({
    catalog: null,
    loading: true,
    error: null,
    loaded: false,
    tickets: [],
    categories: [],
    issues: {},
    quickHelp: [],
    articles: [],
    policies: [],
    workspace: [],
    tasks: [],
  })
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [category, setCategory] = useState(null)
  const [taskId, setTaskId] = useState(null)
  const [issue, setIssue] = useState(null)
  const [guidance, setGuidance] = useState(null)
  const [guidanceLoading, setGuidanceLoading] = useState(false)
  const [article, setArticle] = useState(null)
  const [showSupportForm, setShowSupportForm] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [formError, setFormError] = useState('')
  const [openPolicy, setOpenPolicy] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribeHelp(setSnapshot)
    loadHelpCatalog({ force: true }).catch(() => {})
    return unsubscribe
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const topic = params.get('topic') || params.get('category')
    const presetCategory = topicToCategory(topic)
    const presetTask = params.get('task')
    if (presetCategory) {
      setCategory(presetCategory)
      if (presetTask) setTaskId(presetTask)
      setIssue(null)
      setGuidance(null)
      setArticle(null)
      setShowSupportForm(false)
      setTicket(null)
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null)
      setSearching(false)
      return undefined
    }
    setSearching(true)
    const timer = window.setTimeout(() => {
      searchHelpQuery(query)
        .then((results) => {
          setSearchResults(results)
          setSearching(false)
        })
        .catch(() => {
          setSearchResults([])
          setSearching(false)
        })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!category || !issue) {
      setGuidance(null)
      return undefined
    }
    const controller = new AbortController()
    setGuidanceLoading(true)
    fetchGuidance({ category, issue, taskId }, { signal: controller.signal })
      .then((result) => {
        setGuidance(result)
        setGuidanceLoading(false)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setGuidance(null)
          setGuidanceLoading(false)
        }
      })
    return () => controller.abort()
  }, [category, issue, taskId])

  useEffect(() => {
    if (!query.trim()) return undefined
    function onDocClick(e) {
      if (resultsRef.current && !resultsRef.current.contains(e.target) && e.target !== resultsRef.current) {
        const shell = resultsRef.current.closest('.sn-hlp__search-wrap')
        if (shell && !shell.contains(e.target)) {
          setQuery('')
          setSearchResults(null)
        }
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [query])

  const categoryDef = useMemo(
    () => snapshot.categories.find((c) => c.key === category) || null,
    [snapshot.categories, category],
  )
  const task = useMemo(() => findTaskById(snapshot.tasks, taskId), [snapshot.tasks, taskId])
  const issueList = category ? snapshot.issues[category] || [] : []
  const issueLabel = issueList.find((i) => i.key === issue)?.label || issue

  function pickCategory(key, nextTaskId = null) {
    const def = snapshot.categories.find((c) => c.key === key)
    setCategory(key)
    setTaskId(def?.needsTask === false ? null : nextTaskId)
    setIssue(null)
    setGuidance(null)
    setArticle(null)
    setShowSupportForm(false)
    setTicket(null)
    setFormError('')
    setQuery('')
    setSearchResults(null)
  }

  function reset(level) {
    if (level === 'category') {
      setCategory(null)
      setTaskId(null)
      setIssue(null)
      if (window.location.search) go('/student/help')
    }
    if (level === 'task') {
      setTaskId(null)
      setIssue(null)
    }
    if (level === 'issue') setIssue(null)
    setGuidance(null)
    setArticle(null)
    setShowSupportForm(false)
    setTicket(null)
    setFormError('')
  }

  function openArticle(articleId) {
    const found = snapshot.articles.find((a) => a.id === articleId)
    if (!found) return
    setArticle(found)
    setShowSupportForm(false)
  }

  async function submitTicket() {
    const trimmed = message.trim()
    if (!trimmed) {
      setFormError('Tell us what happened before sending.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const created = await submitHelpTicket({
        category: category || 'general',
        issue,
        taskId,
        message: trimmed,
      })
      setTicket(created)
      setMessage('')
      setShowSupportForm(false)
    } catch (error) {
      if (error.message === 'STUDENT_ACCESS_REQUIRED') setFormError('Sign in to send a support request.')
      else setFormError('We could not send that request. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (snapshot.error?.message === 'STUDENT_ACCESS_REQUIRED') {
    return (
      <div className="sn-hlp sn-hlp-page">
        <div className="sn-hlp__access" role="alert">
          <span className="sn-hlp__access-icon" aria-hidden="true"><Shield size={22} /></span>
          <p className="student-overline">ACCESS REQUIRED</p>
          <h1>Sign in to open Help</h1>
          <p>Your student session is missing or has expired.</p>
          <button type="button" className="student-button" onClick={() => go('/login')}>
            Sign in
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  if (snapshot.loading && !snapshot.catalog) {
    return (
      <div className="sn-hlp sn-hlp-page">
        <div className="sn-hlp__skeleton" role="status" aria-live="polite" aria-label="Loading help">
          <span className="sn-hlp__skeleton-head" />
          <span />
          <div className="sn-hlp__skeleton-split">
            <span />
            <span />
          </div>
        </div>
      </div>
    )
  }

  if (snapshot.error && !snapshot.catalog) {
    return (
      <div className="sn-hlp sn-hlp-page">
        <div className="sn-hlp__access" role="alert">
          <span className="sn-hlp__access-icon sn-hlp__access-icon--warn" aria-hidden="true"><AlertTriangle size={22} /></span>
          <p className="student-overline">COULD NOT LOAD</p>
          <h1>We could not load Help</h1>
          <p>Check your connection and try again.</p>
          <button type="button" className="student-button" onClick={() => loadHelpCatalog({ force: true }).catch(() => {})}>
            Try again
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  const showHome = !category
  const showTaskPicker = Boolean(category && categoryDef?.needsTask && !task)
  const showIssuePicker = Boolean(category && (!categoryDef?.needsTask || task) && !issue)
  const showGuidance = Boolean(guidance || guidanceLoading) && !showSupportForm && !ticket
  const showSearch = query.trim().length > 0
  const showCrumbs = Boolean(category || ticket || article || showSupportForm)

  const stepIndex = showTaskPicker ? 2 : showIssuePicker ? (task ? 3 : 2) : 3

  return (
    <div className="sn-hlp sn-hlp-page">
      <a className="sn-hlp__skip" href="#sn-hlp-main">
        Skip to help content
      </a>

      <header className="sn-hlp__header">
        <div className="sn-hlp__header-text">
          <p className="student-overline sn-hlp__eyebrow">Help centre</p>
          <h1 className="sn-hlp__title">How can we help?</h1>
          <p className="sn-hlp__subtitle">
            Search an answer, follow a guided fix, or contact SolveNest with task context attached.
          </p>
        </div>
        <div className="sn-hlp__header-actions">
          {ticket && (
            <button
              type="button"
              className="student-button student-button--secondary student-button--sm"
              onClick={() => setTicket(null)}
            >
              Request {ticket.id}
            </button>
          )}
          <button
            type="button"
            className="student-button student-button--sm"
            onClick={() => {
              setShowSupportForm(true)
              setTicket(null)
              setArticle(null)
            }}
          >
            <LifeBuoy size={15} aria-hidden="true" />
            Contact support
          </button>
        </div>
      </header>

      <div className="sn-hlp__control">
        <div className="sn-hlp__search-wrap">
          <label className="sn-hlp__search" htmlFor={searchId}>
            <Search size={16} aria-hidden="true" />
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — payment processing, can't open delivery, under review…"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSearch}
              aria-controls="sn-hlp-search-results"
              aria-autocomplete="list"
            />
            {query ? (
              <button
                type="button"
                className="sn-hlp__search-clear"
                onClick={() => {
                  setQuery('')
                  setSearchResults(null)
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="sn-hlp__kbd" aria-hidden="true">/</kbd>
            )}
          </label>

          {showSearch && (
            <div
              id="sn-hlp-search-results"
              ref={resultsRef}
              className="sn-hlp__search-results"
              role="listbox"
              aria-label="Search results"
              aria-live="polite"
            >
              {searching && (
                <div className="sn-hlp__search-status" role="status">
                  <RefreshCw size={13} className="sn-hlp__spin" aria-hidden="true" />
                  Searching guides…
                </div>
              )}
              {!searching && searchResults && searchResults.length === 0 && (
                <div className="sn-hlp__no-result">
                  <div className="sn-hlp__no-result-title">No match for “{query}”</div>
                  <div className="sn-hlp__inline-actions">
                    <button
                      type="button"
                      className="sn-hlp__link-btn"
                      onClick={() => {
                        setQuery('')
                        setSearchResults(null)
                      }}
                    >
                      Browse topics →
                    </button>
                    <button
                      type="button"
                      className="sn-hlp__link-btn"
                      onClick={() => {
                        setQuery('')
                        setSearchResults(null)
                        setShowSupportForm(true)
                        setCategory((c) => c || 'technical')
                      }}
                    >
                      Contact SolveNest →
                    </button>
                  </div>
                </div>
              )}
              {!searching &&
                searchResults?.map((result, index) => (
                  <button
                    key={`${result.title}-${index}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="sn-hlp__search-row"
                    onClick={() => {
                      if (result.presetCategory) {
                        pickCategory(result.presetCategory)
                        setQuery('')
                        setSearchResults(null)
                      } else if (result.articleId) {
                        setQuery('')
                        setSearchResults(null)
                        openArticle(result.articleId)
                        if (result.category && !category) {
                          setCategory(result.category)
                          setIssue(result.issue || null)
                        }
                      }
                    }}
                  >
                    <span className={`sn-hlp__chip sn-hlp__chip--${result.type === 'guide' ? 'guide' : 'action'}`}>
                      {result.type === 'guide' ? 'Guide' : 'Action'}
                    </span>
                    <span className="sn-hlp__search-body">
                      <span className="sn-hlp__search-title">{result.title}</span>
                      {result.desc && <span className="sn-hlp__search-desc">{result.desc}</span>}
                    </span>
                    <ArrowRight size={14} className="sn-hlp__row-arrow" aria-hidden="true" />
                  </button>
                ))}
            </div>
          )}
        </div>

        {showHome && snapshot.quickHelp.length > 0 && (
          <div className="sn-hlp__filters" aria-label="Popular help">
            {snapshot.quickHelp.map((item) => (
              <button
                key={item.id}
                type="button"
                className="sn-hlp__filter"
                onClick={() => {
                  pickCategory(item.category)
                  if (item.issue) window.setTimeout(() => setIssue(item.issue), 0)
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}

        {showCrumbs && (
          <nav className="sn-hlp__crumbs" aria-label="Help path">
            <button type="button" className="sn-hlp__crumb" onClick={() => reset('category')}>
              Help
            </button>
            {categoryDef && (
              <>
                <ChevronRight size={12} className="sn-hlp__crumb-sep" aria-hidden="true" />
                <button type="button" className="sn-hlp__crumb" onClick={() => reset('task')}>
                  {categoryDef.label}
                </button>
              </>
            )}
            {task && (
              <>
                <ChevronRight size={12} className="sn-hlp__crumb-sep" aria-hidden="true" />
                <button type="button" className="sn-hlp__crumb" onClick={() => reset('issue')}>
                  {task.title}
                </button>
              </>
            )}
            {issue && (
              <>
                <ChevronRight size={12} className="sn-hlp__crumb-sep" aria-hidden="true" />
                <span className="sn-hlp__crumb sn-hlp__crumb--current" aria-current="step">
                  {issueLabel}
                </span>
              </>
            )}
            {showSupportForm && (
              <>
                <ChevronRight size={12} className="sn-hlp__crumb-sep" aria-hidden="true" />
                <span className="sn-hlp__crumb sn-hlp__crumb--current" aria-current="step">
                  Contact
                </span>
              </>
            )}
            {ticket && (
              <>
                <ChevronRight size={12} className="sn-hlp__crumb-sep" aria-hidden="true" />
                <span className="sn-hlp__crumb sn-hlp__crumb--current" aria-current="step">
                  {ticket.id}
                </span>
              </>
            )}
            <button type="button" className="sn-hlp__crumb sn-hlp__crumb--reset" onClick={() => reset('category')}>
              Start over
            </button>
          </nav>
        )}
      </div>

      <div id="sn-hlp-main" className="sn-hlp__workspace">
        <div className="sn-hlp__stream">
          {showHome && (
            <>
              <section className="sn-hlp__section" aria-labelledby="sn-hlp-topics">
                <div className="sn-hlp__section-head">
                  <div>
                    <p className="student-overline sn-hlp__section-overline">Topics</p>
                    <h2 id="sn-hlp-topics" className="sn-hlp__section-title">
                      What do you need help with?
                    </h2>
                  </div>
                </div>
                <div className="sn-hlp__cat-grid">
                  {snapshot.categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className="sn-hlp__cat-card"
                      onClick={() => pickCategory(c.key)}
                    >
                      <span className="sn-hlp__cat-icon" aria-hidden="true">
                        <CategoryIcon categoryKey={c.key} />
                      </span>
                      <span className="sn-hlp__cat-body">
                        <span className="sn-hlp__cat-title">{c.label}</span>
                        <span className="sn-hlp__cat-blurb">{c.blurb}</span>
                      </span>
                      <ArrowRight size={14} className="sn-hlp__cat-arrow" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              {snapshot.articles.length > 0 && (
                <section className="sn-hlp__section" aria-labelledby="sn-hlp-guides">
                  <div className="sn-hlp__section-head">
                    <div>
                      <p className="student-overline sn-hlp__section-overline">Guides</p>
                      <h2 id="sn-hlp-guides" className="sn-hlp__section-title">
                        Popular answers
                      </h2>
                    </div>
                  </div>
                  <div className="sn-hlp__guide-grid">
                    {snapshot.articles.map((a) => (
                      <button key={a.id} type="button" className="sn-hlp__guide-card" onClick={() => openArticle(a.id)}>
                        <span className="sn-hlp__guide-icon" aria-hidden="true">
                          <BookOpen size={15} />
                        </span>
                        <span className="sn-hlp__guide-body">
                          <span className="sn-hlp__guide-title">{a.title}</span>
                          <span className="sn-hlp__guide-desc">{(a.body.split('. ')[0] || '') + '.'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {showTaskPicker && (
            <section className="sn-hlp__section sn-hlp__reveal" aria-labelledby="sn-hlp-task-step">
              <div className="sn-hlp__section-head">
                <div>
                  <p className="student-overline sn-hlp__section-overline">Step 2 of 3</p>
                  <h2 id="sn-hlp-task-step" className="sn-hlp__section-title">
                    Which task is this about?
                  </h2>
                </div>
              </div>
              <div className="sn-hlp__task-list">
                {snapshot.tasks.map((t) => (
                  <button key={t.id} type="button" className="sn-hlp__task-card" onClick={() => setTaskId(t.id)}>
                    <span className="sn-hlp__task-main">
                      <span className="sn-hlp__task-title">{t.title}</span>
                      <span className="sn-hlp__task-meta">
                        <span className="sn-hlp__status-pill">
                          {t.paymentState ? `Payment ${t.paymentState}` : t.statusLabel}
                        </span>
                        <span className="sn-hlp__ref">{t.id}</span>
                        {t.subject && <span className="sn-hlp__subject">{t.subject}</span>}
                      </span>
                    </span>
                    <ArrowRight size={14} className="sn-hlp__row-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
              {snapshot.tasks.length === 0 && <EmptyNote>No tasks yet. Pick another topic or contact support.</EmptyNote>}
            </section>
          )}

          {showIssuePicker && (
            <section className="sn-hlp__section sn-hlp__reveal" aria-labelledby="sn-hlp-issue-step">
              {task && (
                <div className="sn-hlp__state-bar" aria-label="Current task state">
                  <span className="sn-hlp__state-icon" aria-hidden="true">
                    <CategoryIcon categoryKey={category} size={16} />
                  </span>
                  <div className="sn-hlp__state-copy">
                    <p className="sn-hlp__state-val">
                      {task.paymentState ? `Payment ${task.paymentState}` : task.statusLabel}
                    </p>
                    <p className="sn-hlp__state-sub">
                      {task.title} · <span className="sn-hlp__ref">{task.id}</span>
                    </p>
                  </div>
                </div>
              )}
              <div className="sn-hlp__section-head">
                <div>
                  <p className="student-overline sn-hlp__section-overline">
                    {task ? 'Step 3 of 3' : 'Step 2 of 2'}
                  </p>
                  <h2 id="sn-hlp-issue-step" className="sn-hlp__section-title">
                    What is happening?
                  </h2>
                </div>
              </div>
              <div className="sn-hlp__issue-list" role="list">
                {issueList.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="sn-hlp__issue-row"
                    role="listitem"
                    onClick={() => setIssue(item.key)}
                  >
                    <span className="sn-hlp__issue-icon" aria-hidden="true">
                      <IssueIcon issueKey={item.key} />
                    </span>
                    <span className="sn-hlp__issue-label">{item.label}</span>
                    <ArrowRight size={14} className="sn-hlp__row-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
              {issueList.length === 0 && <EmptyNote>No listed issues for this topic. Contact support and we will help.</EmptyNote>}
            </section>
          )}

          {guidanceLoading && (
            <div className="sn-hlp__status-card" role="status" aria-live="polite">
              <RefreshCw size={14} className="sn-hlp__spin" aria-hidden="true" />
              Checking your workspace…
            </div>
          )}

          {showGuidance && guidance && (
            <section
              className={`sn-hlp__result sn-hlp__result--${guidance.kind} sn-hlp__reveal`}
              role="status"
              aria-live="polite"
              aria-labelledby="sn-hlp-result-title"
            >
              <div className="sn-hlp__result-top">
                <span className={`sn-hlp__result-badge sn-hlp__result-badge--${guidance.kind}`}>
                  {guidance.kind === 'support' ? (
                    <><LifeBuoy size={13} aria-hidden="true" /> Needs support</>
                  ) : guidance.kind === 'action' ? (
                    <><ArrowRight size={13} aria-hidden="true" /> Next step</>
                  ) : (
                    <><CheckCircle2 size={13} aria-hidden="true" /> What we found</>
                  )}
                </span>
              </div>
              <p id="sn-hlp-result-title" className="sn-hlp__result-found">
                {guidance.found}
              </p>
              <p className="sn-hlp__result-body">{guidance.body}</p>
              <div className="sn-hlp__actions">
                {guidance.actions?.map((action) =>
                  action.route ? (
                    <button
                      key={action.label}
                      type="button"
                      className={action.kind === 'primary' ? 'student-button student-button--sm' : 'student-button student-button--secondary student-button--sm'}
                      onClick={() => go(action.route)}
                    >
                      {action.label}
                      {action.kind === 'primary' ? <ArrowRight size={14} aria-hidden="true" /> : null}
                    </button>
                  ) : (
                    <button
                      key={action.label}
                      type="button"
                      className="sn-hlp__link-btn"
                      onClick={() => action.articleId && openArticle(action.articleId)}
                    >
                      {action.label} →
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className={guidance.kind === 'support' ? 'student-button student-button--secondary student-button--sm' : 'sn-hlp__link-btn sn-hlp__link-btn--quiet'}
                  onClick={() => {
                    setShowSupportForm(true)
                    setArticle(null)
                  }}
                >
                  {guidance.kind === 'support' ? (
                    <>
                      Contact SolveNest
                      <ArrowRight size={14} aria-hidden="true" />
                    </>
                  ) : (
                    'Still stuck? Contact SolveNest →'
                  )}
                </button>
              </div>
            </section>
          )}

          {article && (
            <article className="sn-hlp__article sn-hlp__reveal" aria-labelledby="sn-hlp-article-title">
              <div className="sn-hlp__article-head">
                <span className="sn-hlp__chip sn-hlp__chip--guide">Guide</span>
                <button type="button" className="sn-hlp__link-btn" onClick={() => setArticle(null)}>
                  Close guide
                </button>
              </div>
              <h2 id="sn-hlp-article-title" className="sn-hlp__article-title">
                {article.title}
              </h2>
              <p className="sn-hlp__article-body">{article.body}</p>
              {article.category && (
                <div className="sn-hlp__actions">
                  <button
                    type="button"
                    className="student-button student-button--secondary student-button--sm"
                    onClick={() => {
                      setArticle(null)
                      pickCategory(article.category)
                      if (article.issue) setIssue(article.issue)
                    }}
                  >
                    Start guided help for this topic
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </article>
          )}

          {showSupportForm && !ticket && (
            <section className="sn-hlp__form sn-hlp__reveal" aria-labelledby="sn-hlp-contact-title">
              <div className="sn-hlp__form-head">
                <span className="sn-hlp__cat-icon sn-hlp__cat-icon--form" aria-hidden="true">
                  <LifeBuoy size={18} />
                </span>
                <div>
                  <p className="student-overline sn-hlp__section-overline">Support request</p>
                  <h2 id="sn-hlp-contact-title" className="sn-hlp__section-title">
                    Contact SolveNest
                  </h2>
                </div>
              </div>

              <div className="sn-hlp__form-meta">
                <div className="sn-hlp__form-row">
                  <span className="sn-hlp__form-label">Category</span>
                  <span className="sn-hlp__form-value">{categoryDef ? categoryDef.label : 'General'}</span>
                </div>
                {issueLabel && issue && (
                  <div className="sn-hlp__form-row">
                    <span className="sn-hlp__form-label">Issue</span>
                    <span className="sn-hlp__form-value">{issueLabel}</span>
                  </div>
                )}
                {task && (
                  <div className="sn-hlp__form-row">
                    <span className="sn-hlp__form-label">Task</span>
                    <span className="sn-hlp__form-value">
                      {task.title} <span className="sn-hlp__ref">· {task.id}</span>
                    </span>
                  </div>
                )}
                <div className="sn-hlp__form-row">
                  <span className="sn-hlp__form-label">Context</span>
                  <span className="sn-hlp__form-value">
                    {task ? `State: ${task.statusLabel}` : 'Category & issue attached'}
                  </span>
                </div>
              </div>

              <div className="sn-hlp__field">
                <label className="sn-hlp__field-label" htmlFor={messageId}>
                  Tell us what happened
                </label>
                <textarea
                  id={messageId}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what you expected and what happened instead…"
                  rows={4}
                  className="sn-hlp__textarea"
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? `${messageId}-error` : undefined}
                />
              </div>

              {formError && (
                <p className="sn-hlp__form-error" id={`${messageId}-error`} role="alert">
                  {formError}
                </p>
              )}

              <div className="sn-hlp__actions">
                <button
                  type="button"
                  className="student-button student-button--sm"
                  onClick={submitTicket}
                  disabled={submitting || !message.trim()}
                >
                  {submitting ? 'Sending…' : 'Send to SolveNest'}
                  {submitting ? null : <ArrowRight size={14} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="student-button student-button--secondary student-button--sm"
                  onClick={() => {
                    setShowSupportForm(false)
                    setFormError('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {ticket && (
            <section className="sn-hlp__result sn-hlp__result--guidance sn-hlp__reveal" role="status" aria-live="polite">
              <div className="sn-hlp__result-top">
                <span className="sn-hlp__result-badge sn-hlp__result-badge--guidance">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  Request received
                </span>
              </div>
              <p className="sn-hlp__result-found">Support request {ticket.id}</p>
              <p className="sn-hlp__result-body">
                Status: {ticket.status === 'received' ? 'Received' : ticket.status}. Track updates here and in notifications.
              </p>
              <div className="sn-hlp__actions">
                <button
                  type="button"
                  className="student-button student-button--secondary student-button--sm"
                  onClick={() => setTicket(null)}
                >
                  Back to Help
                </button>
                <button type="button" className="sn-hlp__link-btn" onClick={() => go('/student/notifications')}>
                  Open notifications →
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="sn-hlp__rail" aria-label="Help sidebar">
          {showHome && snapshot.workspace.length > 0 && (
            <section className="sn-hlp__panel sn-hlp__panel--attention">
              <div className="sn-hlp__panel-head">
                <p className="student-overline sn-hlp__section-overline">Your workspace</p>
                <h2 className="sn-hlp__panel-title">Needs attention</h2>
              </div>
              <div className="sn-hlp__ws-list">
                {snapshot.workspace.map((t) => (
                  <div key={t.id} className="sn-hlp__ws-card">
                    <div className="sn-hlp__ws-body">
                      <span className="sn-hlp__task-title">{t.title}</span>
                      <span className="sn-hlp__task-meta">
                        <span className="sn-hlp__status-pill">
                          {t.paymentState ? `Payment ${t.paymentState}` : t.statusLabel}
                        </span>
                        <span className="sn-hlp__ref">{t.id}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="sn-hlp__ws-action"
                      onClick={() =>
                        pickCategory(
                          t.helpCategory || (t.deliveryVersion ? 'files' : 'payment'),
                          t.id,
                        )
                      }
                    >
                      {t.deliveryVersion
                        ? 'Delivery help'
                        : t.helpCategory === 'explain'
                          ? 'Explain help'
                          : t.helpCategory === 'task'
                            ? 'Task help'
                            : 'Payment help'}
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!showHome && (
            <section className="sn-hlp__panel sn-hlp__panel--journey" aria-label="Help journey">
              <div className="sn-hlp__panel-head">
                <p className="student-overline sn-hlp__section-overline">Guided help</p>
                <h2 className="sn-hlp__panel-title">Your path</h2>
              </div>
              <ol className="sn-hlp__steps">
                <li className={`sn-hlp__step ${category ? 'is-done' : 'is-current'}`}>
                  <span className="sn-hlp__step-dot" aria-hidden="true">
                    {category ? <CheckCircle2 size={13} /> : '1'}
                  </span>
                  <div className="sn-hlp__step-copy">
                    <span className="sn-hlp__step-label">Topic</span>
                    <span className="sn-hlp__step-val">{categoryDef?.label || 'Choose a topic'}</span>
                  </div>
                  {category && (
                    <button type="button" className="sn-hlp__step-change" onClick={() => reset('category')}>
                      Change
                    </button>
                  )}
                </li>
                <li
                  className={`sn-hlp__step ${
                    categoryDef?.needsTask === false
                      ? 'is-skipped'
                      : task
                        ? 'is-done'
                        : category
                          ? 'is-current'
                          : ''
                  }`}
                >
                  <span className="sn-hlp__step-dot" aria-hidden="true">
                    {task ? <CheckCircle2 size={13} /> : '2'}
                  </span>
                  <div className="sn-hlp__step-copy">
                    <span className="sn-hlp__step-label">Task</span>
                    <span className="sn-hlp__step-val">
                      {categoryDef?.needsTask === false
                        ? 'Not needed'
                        : task
                          ? `${task.title} · ${task.id}`
                          : category
                            ? 'Pick your task'
                            : '—'}
                    </span>
                  </div>
                  {task && (
                    <button type="button" className="sn-hlp__step-change" onClick={() => reset('task')}>
                      Change
                    </button>
                  )}
                </li>
                <li className={`sn-hlp__step ${issue ? 'is-done' : stepIndex >= 3 || showIssuePicker ? 'is-current' : ''}`}>
                  <span className="sn-hlp__step-dot" aria-hidden="true">
                    {issue ? <CheckCircle2 size={13} /> : '3'}
                  </span>
                  <div className="sn-hlp__step-copy">
                    <span className="sn-hlp__step-label">Issue</span>
                    <span className="sn-hlp__step-val">{issueLabel || (showIssuePicker ? 'What is happening?' : '—')}</span>
                  </div>
                  {issue && (
                    <button type="button" className="sn-hlp__step-change" onClick={() => reset('issue')}>
                      Change
                    </button>
                  )}
                </li>
              </ol>
              {task && (
                <div className="sn-hlp__context">
                  <p className="student-overline sn-hlp__state-label">Task context</p>
                  <p className="sn-hlp__context-line">
                    State: {task.paymentState ? `Payment ${task.paymentState}` : task.statusLabel}
                  </p>
                  {task.subject && <p className="sn-hlp__context-line">{task.subject}</p>}
                  <p className="sn-hlp__context-line">Travels with any support request.</p>
                </div>
              )}
            </section>
          )}

          <section className="sn-hlp__panel sn-hlp__panel--contact">
            <div className="sn-hlp__panel-head">
              <p className="student-overline sn-hlp__section-overline">Still stuck?</p>
              <h2 className="sn-hlp__panel-title">Talk to SolveNest</h2>
            </div>
            <p className="sn-hlp__panel-copy">
              Send a request with category, issue, and task reference already attached.
            </p>
            <button
              type="button"
              className="student-button student-button--sm sn-hlp__panel-cta"
              onClick={() => {
                setShowSupportForm(true)
                setTicket(null)
                setArticle(null)
              }}
            >
              <LifeBuoy size={14} aria-hidden="true" />
              Open support form
            </button>
            <button type="button" className="sn-hlp__link-btn sn-hlp__panel-link" onClick={() => go('/student/messages')}>
              Or message your Expert →
            </button>
          </section>

          <section className="sn-hlp__panel sn-hlp__panel--policies">
            <div className="sn-hlp__panel-head">
              <p className="student-overline sn-hlp__section-overline">Policies</p>
              <h2 className="sn-hlp__panel-title">Guidance</h2>
            </div>
            <div className="sn-hlp__policy-list">
              {snapshot.policies.map((policy) => {
                const open = openPolicy === policy.id
                return (
                  <div key={policy.id} className={`sn-hlp__policy ${open ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="sn-hlp__policy-trigger"
                      aria-expanded={open}
                      aria-controls={`policy-${policy.id}`}
                      onClick={() => setOpenPolicy(open ? null : policy.id)}
                    >
                      <span>{policy.title}</span>
                      <ChevronRight size={14} className="sn-hlp__policy-chevron" aria-hidden="true" />
                    </button>
                    {open && (
                      <p className="sn-hlp__policy-body" id={`policy-${policy.id}`}>
                        {policy.summary}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
