import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { resolveOpportunityState } from '../../expert/opportunityState.js'
import { OpportunityBriefing } from './OpportunityBriefing.jsx'
import { OpportunityInterest } from './OpportunityInterest.jsx'

export function OpportunityDetailSheet({ opportunity, phase, error, onExpress, onClose }) {
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!opportunity) return null
  const state = resolveOpportunityState(opportunity, phase)

  return (
    <div className="exp-o-scrim" onClick={() => onCloseRef.current?.()}>
      <motion.div
        className="exp-o-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Opportunity briefing: ${opportunity.title}`}
      >
        <div className="exp-o-sheet-handle" aria-hidden="true" />
        <header className="exp-o-sheet-head">
          <div className="exp-o-sheet-meta">
            <p className="exp-overline">OPPORTUNITY BRIEFING</p>
            <span className="exp-o-chip" data-tone={state.tone}>{state.label}</span>
          </div>
          <button
            type="button"
            className="exp-o-sheet-close"
            onClick={() => onCloseRef.current?.()}
            aria-label="Close briefing"
            ref={closeRef}
          >
            <X size={18} />
          </button>
        </header>
        <div className="exp-o-sheet-body">
          <OpportunityBriefing
            opportunity={opportunity}
            phase={phase}
            error={error}
            onExpress={onExpress}
            hideInterest
          />
        </div>
        <footer className="exp-o-sheet-foot">
          <OpportunityInterest
            opportunity={opportunity}
            phase={phase}
            error={error}
            onExpress={onExpress}
            variant="sheet"
            showNote={false}
          />
        </footer>
      </motion.div>
    </div>
  )
}
