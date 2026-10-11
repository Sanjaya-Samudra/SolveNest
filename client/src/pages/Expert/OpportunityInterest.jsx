import { ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { resolveOpportunityState } from '../../expert/opportunityState.js'
import { goExpert } from './ExpertAppShell.jsx'

export function OpportunityInterest({ opportunity, phase, error, onExpress, variant = 'lens', showNote = variant !== 'row' }) {
  if (!opportunity) return null
  const state = resolveOpportunityState(opportunity, phase)

  return (
    <div className={`exp-o-interest exp-o-interest--${variant}`}>
      {error && state.phase === 'open' && (
        <p className="exp-inline-error" role="alert">{error}</p>
      )}
      {state.phase === 'sent' || state.phase === 'under_review' ? (
        <div className="exp-o-state" data-tone={state.tone} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>{state.label}</strong>
            {variant !== 'row' && (
              <small>SolveNest reviews fit and confirms assignments directly — no assignment is created by expressing interest.</small>
            )}
          </div>
        </div>
      ) : state.phase === 'closed' ? (
        <div className="exp-o-state" data-tone="neutral" role="status">
          <Lock size={16} aria-hidden="true" />
          <div>
            <strong>{state.label}</strong>
            {variant !== 'row' && <small>This opportunity closed before your interest could be recorded.</small>}
          </div>
        </div>
      ) : state.phase === 'assigned' ? (
        <button type="button" className="exp-button" onClick={() => goExpert('/expert/assignments')}>
          Open assignments
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          className="exp-button exp-o-cta"
          disabled={state.disabled}
          onClick={() => onExpress?.(opportunity)}
        >
          {state.phase === 'sending' ? (
            <Loader2 size={15} className="exp-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}
          {state.buttonLabel}
        </button>
      )}
      {showNote && (
        <p className="exp-o-note">
          <ShieldCheck size={14} aria-hidden="true" />
          Expressing interest never assigns work. SolveNest reviews fit and confirms assignments directly — no bidding.
        </p>
      )}
    </div>
  )
}
