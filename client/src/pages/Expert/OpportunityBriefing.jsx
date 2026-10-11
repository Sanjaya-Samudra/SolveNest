import { CalendarClock, Compass, Lock, Sparkles, X } from 'lucide-react'
import { resolveFitTrace, resolveOpportunityDeadline, resolveOpportunityState } from '../../expert/opportunityState.js'
import { OpportunityInterest } from './OpportunityInterest.jsx'

function formatPublished(value) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function OpportunityBriefing({ opportunity, phase, error, onExpress, onClear, hideInterest = false }) {
  if (!opportunity) return null
  const state = resolveOpportunityState(opportunity, phase)
  const deadline = resolveOpportunityDeadline(opportunity)
  const fit = resolveFitTrace(opportunity)
  const published = opportunity.publishedAt ? formatPublished(opportunity.publishedAt) : null

  return (
    <div className="exp-o-briefing" data-phase={state.phase}>
      <div className="exp-o-briefing-top">
        <p className="exp-overline">OPPORTUNITY BRIEFING</p>
        <div className="exp-o-briefing-tools">
          <span className="exp-o-chip" data-tone={state.tone}>{state.label}</span>
          {onClear && (
            <button type="button" className="exp-o-icon-btn" onClick={onClear} aria-label="Close briefing">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <p className="exp-o-meta">
        {[opportunity.domain, opportunity.type, opportunity.complexity].filter(Boolean).join(' · ')}
      </p>
      <h2 className="exp-o-title">{opportunity.title}</h2>

      <div className="exp-o-facts">
        {deadline.label && (
          <span className="exp-o-deadline" data-tone={deadline.tone}>
            <CalendarClock size={13} aria-hidden="true" />
            {deadline.label}
          </span>
        )}
        {published && <span className="exp-o-published">Added {published}</span>}
      </div>

      <section className="exp-o-block" aria-label="Why this opportunity reaches you">
        <p className="exp-overline">WHY THIS REACHES YOU</p>
        {fit.hasSignals ? (
          <ul className="exp-o-fit">
            {fit.signals.map((signal) => (
              <li key={signal.key}>
                <Sparkles size={13} aria-hidden="true" />
                {signal.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="exp-o-muted">SolveNest has not published match signals for this opportunity yet.</p>
        )}
      </section>

      {opportunity.requirements.length > 0 && (
        <section className="exp-o-block" aria-label="Requirements">
          <p className="exp-overline">REQUIREMENTS</p>
          <ol className="exp-o-reqs">
            {opportunity.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      )}

      {opportunity.skills.length > 0 && (
        <section className="exp-o-block" aria-label="Skills this task calls for">
          <p className="exp-overline">SKILLS THIS CALLS FOR</p>
          <div className="exp-o-skills">
            {opportunity.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </section>
      )}

      {!hideInterest && (
        <OpportunityInterest
          opportunity={opportunity}
          phase={phase}
          error={error}
          onExpress={onExpress}
          variant="lens"
        />
      )}
    </div>
  )
}

export function OpportunityBriefingEmpty({ kind = 'none', onClear }) {
  if (kind === 'missing') {
    return (
      <div className="exp-o-briefing-empty">
        <div className="exp-empty">
          <span className="exp-empty-icon" aria-hidden="true"><Lock size={22} /></span>
          <p className="exp-empty-title">NO LONGER AVAILABLE</p>
          <p className="exp-empty-body">
            This opportunity is no longer listed. It may have been closed or confirmed for another expert.
          </p>
          <button type="button" className="exp-button exp-button--secondary" onClick={onClear}>
            Back to the stream
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="exp-o-briefing-empty">
      <div className="exp-empty">
        <span className="exp-empty-icon" aria-hidden="true"><Compass size={22} /></span>
        <p className="exp-empty-title">Select an opportunity</p>
        <p className="exp-empty-body">
          Choose an opportunity from the stream to review its briefing, fit signals, and express interest.
        </p>
      </div>
    </div>
  )
}
