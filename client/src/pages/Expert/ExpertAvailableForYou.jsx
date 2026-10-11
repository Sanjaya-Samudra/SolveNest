import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Search,
  X,
} from 'lucide-react'
import {
  buildOpportunityRoute,
  EXPERT_OPPORTUNITY_SORTS,
  parseOpportunityRoute,
  resolveOpportunityDeadline,
  resolveOpportunityState,
} from '../../expert/opportunityState.js'
import { useInterestFlow, useOpportunities, useOpportunityRealtime } from '../../expert/opportunityData.js'
import { OpportunityBriefing, OpportunityBriefingEmpty } from './OpportunityBriefing.jsx'
import { OpportunityDetailSheet } from './OpportunityMobileSheet.jsx'
import { OpportunityInterest } from './OpportunityInterest.jsx'
import { goExpert } from './ExpertAppShell.jsx'
import './expert-available.css'

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    media.addEventListener('change', onChange)
    setMatches(media.matches)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function OpportunityRow({ opportunity, phase, error, selected, onSelect, onExpress }) {
  const state = resolveOpportunityState(opportunity, phase)
  const deadline = resolveOpportunityDeadline(opportunity)
  const hints = opportunity.matchHints.slice(0, 2)

  return (
    <div className="exp-o-row" data-selected={selected ? 'true' : 'false'} data-phase={state.phase}>
      <button
        type="button"
        className="exp-o-row-hit"
        onClick={onSelect}
        aria-label={`Review ${opportunity.title}`}
        aria-pressed={selected}
      />
      <div className="exp-o-row-main">
        <div className="exp-o-row-head">
          <p className="exp-o-row-meta">
            {[opportunity.domain, opportunity.type].filter(Boolean).join(' · ') || 'Opportunity'}
            {opportunity.complexity ? ` · ${opportunity.complexity}` : ''}
          </p>
          {deadline.label && (
            <span className="exp-o-due" data-tone={deadline.tone}>{deadline.label}</span>
          )}
        </div>
        <strong className="exp-o-row-title">{opportunity.title}</strong>
        {hints.length > 0 && (
          <div className="exp-o-row-hints">
            {hints.map((hint) => (
              <span className="exp-o-hint" key={hint}>{hint}</span>
            ))}
          </div>
        )}
        {error && <p className="exp-inline-error" role="alert">{error}</p>}
      </div>
      <div className="exp-o-row-action">
        <OpportunityInterest
          opportunity={opportunity}
          phase={phase}
          onExpress={onExpress}
          variant="row"
          showNote={false}
        />
      </div>
    </div>
  )
}

function OpportunitySkeletons({ rows = 4 }) {
  return (
    <div className="exp-o-rows" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="exp-o-row exp-o-row--skeleton" key={index}>
          <div className="exp-skeleton-row">
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  )
}

function OpportunityEmptyStates({ kind, search, onClear }) {
  if (kind === 'error') {
    return (
      <div className="exp-empty">
        <span className="exp-empty-icon" aria-hidden="true"><AlertTriangle size={22} /></span>
        <p className="exp-empty-title">Opportunities could not be loaded</p>
        <p className="exp-empty-body">Check your connection and try again.</p>
      </div>
    )
  }
  if (kind === 'search' || kind === 'filter') {
    return (
      <div className="exp-empty">
        <span className="exp-empty-icon" aria-hidden="true"><Search size={22} /></span>
        <p className="exp-empty-title">{kind === 'search' ? 'No opportunities match your search' : 'No opportunities in this filter'}</p>
        <p className="exp-empty-body">
          {kind === 'search' ? `Nothing matched “${search}”. Try a broader term.` : 'No open opportunities are listed for this domain right now.'}
        </p>
        <button type="button" className="exp-button exp-button--secondary" onClick={onClear}>
          Clear {kind === 'search' ? 'search' : 'filter'}
        </button>
      </div>
    )
  }
  return (
    <div className="exp-empty">
      <span className="exp-empty-icon" aria-hidden="true"><Compass size={22} /></span>
      <p className="exp-empty-title">No open opportunities yet</p>
      <p className="exp-empty-body">
        New work that matches your expertise appears here. Expressing interest never assigns work — SolveNest confirms assignments directly.
      </p>
      <button type="button" className="exp-button exp-button--secondary" onClick={onClear}>
        Reset view
      </button>
    </div>
  )
}

export function ExpertAvailableForYou({ path = '/expert/available', search = '' }) {
  const list = useOpportunities()
  const [toast, setToast] = useState(null)
  const compact = useMediaQuery('(max-width: 1099px)')
  const mobile = useMediaQuery('(max-width: 860px)')
  const flow = useInterestFlow({ onToast: setToast })

  const { opportunityId: selectedId } = useMemo(
    () => parseOpportunityRoute(path, search),
    [path, search],
  )
  const selected = useMemo(
    () => (selectedId ? list.all.find((item) => item.id === selectedId) || null : null),
    [list.all, selectedId],
  )
  const selectedMissing = Boolean(selectedId) && list.loaded && !list.loading && !selected

  const reload = list.reload
  useOpportunityRealtime({
    onOpportunityUpdated: useCallback(() => reload(), [reload]),
    onAssigned: useCallback(() => reload(), [reload]),
    onFailure: useCallback(() => {}, []),
  })

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selectOpportunity = (opportunity) => goExpert(buildOpportunityRoute({ opportunityId: opportunity.id }))
  const clearSelection = useCallback(() => goExpert(buildOpportunityRoute({})), [])

  const phaseOf = flow.phaseFor
  const total = list.total
  const errorKind = list.error && !list.all.length ? 'error' : null
  const emptyKind = list.search ? 'search' : list.domain !== 'all' ? 'filter' : 'empty'

  return (
    <div className="exp-section exp-o-page" data-mobile={mobile ? 'true' : 'false'}>
      <header className="exp-section-head">
        <p className="exp-overline">AVAILABLE FOR YOU</p>
        <h1>Open opportunities</h1>
        <p>
          Express interest in work that matches your expertise. SolveNest reviews fit and confirms assignments — there is no bidding.
        </p>
      </header>

      <div className="exp-o-toolbar">
        <label className="exp-o-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Search title, skill, domain…"
            aria-label="Search opportunities"
          />
        </label>
        <div className="exp-o-filters" role="group" aria-label="Filter by domain">
          <button
            type="button"
            className={`exp-o-chip-btn ${list.domain === 'all' ? 'is-active' : ''}`}
            onClick={() => list.setDomain('all')}
          >
            All
          </button>
          {list.domains.map((domain) => (
            <button
              type="button"
              key={domain}
              className={`exp-o-chip-btn ${list.domain === domain ? 'is-active' : ''}`}
              onClick={() => list.setDomain(domain)}
            >
              {domain}
            </button>
          ))}
        </div>
        <label className="exp-o-sort">
          <select
            value={list.sort}
            onChange={(event) => list.setSort(event.target.value)}
            aria-label="Sort opportunities"
          >
            {EXPERT_OPPORTUNITY_SORTS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <span className="exp-o-count" aria-live="polite">
          {!list.loaded ? 'Loading…' : `${total} ${total === 1 ? 'opportunity' : 'opportunities'}`}
        </span>
      </div>

      <div className="exp-o-split">
        <section className="exp-panel exp-o-stream">
          <div className="exp-panel-head">
            <div>
              <p className="exp-overline">OPPORTUNITY STREAM</p>
              <h3>{list.loaded ? `${total} open ${total === 1 ? 'opportunity' : 'opportunities'}` : 'Loading opportunities'}</h3>
            </div>
            <Compass size={17} aria-hidden="true" />
          </div>

          {errorKind ? (
            <div>
              <OpportunityEmptyStates kind="error" onClear={list.reload} />
              <div className="exp-o-empty-cta">
                <button type="button" className="exp-button" onClick={list.reload}>Try again</button>
              </div>
            </div>
          ) : !list.loaded ? (
            <OpportunitySkeletons />
          ) : list.all.length === 0 ? (
            <OpportunityEmptyStates kind="empty" onClear={list.reload} />
          ) : total === 0 ? (
            <OpportunityEmptyStates
              kind={emptyKind === 'search' ? 'search' : 'filter'}
              search={list.search}
              onClear={() => (list.search ? list.setSearch('') : list.setDomain('all'))}
            />
          ) : (
            <>
              <div className="exp-o-rows">
                {list.opportunities.map((opportunity) => (
                  <OpportunityRow
                    key={opportunity.id}
                    opportunity={opportunity}
                    phase={phaseOf(opportunity)}
                    error={flow.errorFor(opportunity)}
                    selected={selectedId === opportunity.id}
                    onSelect={() => selectOpportunity(opportunity)}
                    onExpress={flow.send}
                  />
                ))}
              </div>
              {list.pageCount > 1 && (
                <nav className="exp-o-pager" aria-label="Opportunity pages">
                  <button
                    type="button"
                    disabled={list.page <= 1}
                    onClick={() => list.setPage(list.page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>Page {list.page} of {list.pageCount}</span>
                  <button
                    type="button"
                    disabled={list.page >= list.pageCount}
                    onClick={() => list.setPage(list.page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>

        {!compact && (
          <aside className="exp-panel exp-o-lens" aria-label="Opportunity briefing">
            {selected ? (
              <OpportunityBriefing
                opportunity={selected}
                phase={phaseOf(selected)}
                error={flow.errorFor(selected)}
                onExpress={flow.send}
                onClear={clearSelection}
              />
            ) : selectedMissing ? (
              <OpportunityBriefingEmpty kind="missing" onClear={clearSelection} />
            ) : (
              <OpportunityBriefingEmpty kind="none" />
            )}
          </aside>
        )}
      </div>

      <AnimatePresence>
        {compact && selected && (
          <OpportunityDetailSheet
            opportunity={selected}
            phase={phaseOf(selected)}
            error={flow.errorFor(selected)}
            onExpress={flow.send}
            onClose={clearSelection}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="exp-toast"
            data-kind={toast.kind || 'success'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
          >
            {toast.kind === 'error' ? (
              <AlertTriangle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <div>
              <strong>{toast.title}</strong>
              <small>{toast.body}</small>
            </div>
            <button type="button" className="exp-o-toast-close" onClick={() => setToast(null)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
