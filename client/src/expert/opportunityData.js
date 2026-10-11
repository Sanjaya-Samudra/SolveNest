import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAvailableOpportunities, sendOpportunityInterest } from './opportunityApi.js'
import { filterOpportunities, resolveOpportunityDomains, sortOpportunities } from './opportunityState.js'

const PAGE_SIZE = 6

export function useOpportunities() {
  const [state, setState] = useState({ loading: true, error: null, loaded: false, opportunities: [] })
  const [search, setSearchRaw] = useState('')
  const [domain, setDomainRaw] = useState('all')
  const [sort, setSortRaw] = useState('newest')
  const [page, setPageRaw] = useState(1)

  const load = useCallback((options = {}) => {
    const controller = options.signal ? null : new AbortController()
    const signal = options.signal || controller?.signal
    setState((prev) => ({ ...prev, loading: true, error: null }))
    return fetchAvailableOpportunities({ limit: 12, signal })
      .then((list) => {
        setState({ loading: false, error: null, loaded: true, opportunities: list })
        return list
      })
      .catch((error) => {
        if (error.name === 'AbortError') return null
        setState((prev) => ({ ...prev, loading: false, error, loaded: true }))
        return null
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
  }, [load])

  const setSearch = useCallback((value) => {
    setSearchRaw(value)
    setPageRaw(1)
  }, [])
  const setDomain = useCallback((value) => {
    setDomainRaw(value)
    setPageRaw(1)
  }, [])
  const setSort = useCallback((value) => {
    setSortRaw(value)
    setPageRaw(1)
  }, [])

  const domains = useMemo(() => resolveOpportunityDomains(state.opportunities), [state.opportunities])
  const filtered = useMemo(
    () => filterOpportunities(state.opportunities, { search, domain }),
    [state.opportunities, search, domain],
  )
  const sorted = useMemo(() => sortOpportunities(filtered, sort), [filtered, sort])
  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return {
    loading: state.loading,
    loaded: state.loaded,
    error: state.error,
    opportunities: visible,
    all: state.opportunities,
    total,
    page: currentPage,
    pageCount,
    setPage: setPageRaw,
    search,
    setSearch,
    domain,
    setDomain,
    sort,
    setSort,
    domains,
    reload: () => load({}),
  }
}

export function useInterestFlow({ onToast } = {}) {
  const [flow, setFlow] = useState({})
  const toastRef = useRef(onToast)
  const inFlight = useRef(new Set())
  toastRef.current = onToast

  const send = useCallback(async (opportunity) => {
    if (!opportunity?.id) return
    if (inFlight.current.has(opportunity.id)) return
    if (flow[opportunity.id]?.phase === 'sent') return
    inFlight.current.add(opportunity.id)
    setFlow((prev) => ({ ...prev, [opportunity.id]: { phase: 'sending', error: null } }))
    try {
      const result = await sendOpportunityInterest(opportunity.id)
      setFlow((prev) => ({
        ...prev,
        [opportunity.id]: { phase: 'sent', error: null, duplicate: Boolean(result.duplicate) },
      }))
      toastRef.current?.({
        kind: 'success',
        title: result.duplicate ? 'INTEREST ALREADY RECORDED' : 'INTEREST SENT',
        body: result.duplicate
          ? `Your interest in "${opportunity.title}" is already recorded. SolveNest will review fit.`
          : `Your interest in "${opportunity.title}" is recorded. SolveNest reviews fit and confirms assignments — no bidding.`,
      })
    } catch (error) {
      if (error?.code === 'OPPORTUNITY_CLOSED') {
        setFlow((prev) => ({
          ...prev,
          [opportunity.id]: { phase: 'closed', error: 'This opportunity is no longer available.' },
        }))
        toastRef.current?.({
          kind: 'error',
          title: 'NO LONGER AVAILABLE',
          body: `This opportunity closed before your interest could be recorded.`,
        })
      } else if (error?.message === 'EXPERT_ACCESS_REQUIRED') {
        setFlow((prev) => ({ ...prev, [opportunity.id]: { phase: null, error: 'Sign in to express interest.' } }))
      } else if (error?.name === 'AbortError') {
        setFlow((prev) => ({ ...prev, [opportunity.id]: { phase: null, error: null } }))
      } else {
        setFlow((prev) => ({
          ...prev,
          [opportunity.id]: { phase: null, error: 'Interest could not be recorded. Try again.' },
        }))
        toastRef.current?.({
          kind: 'error',
          title: 'INTEREST NOT SENT',
          body: 'Interest could not be recorded. Try again.',
        })
      }
    } finally {
      inFlight.current.delete(opportunity.id)
    }
  }, [flow])

  const phaseFor = useCallback(
    (opportunity) => {
      const local = flow[opportunity?.id]
      if (local?.phase === 'sending') return 'sending'
      if (local?.phase === 'sent') return 'sent'
      if (local?.phase === 'closed') return 'closed'
      if (opportunity?.interestState === 'sent') return 'sent'
      if (opportunity?.interestState === 'declined') return 'closed'
      return undefined
    },
    [flow],
  )

  const errorFor = useCallback((opportunity) => flow[opportunity?.id]?.error || null, [flow])

  const sending = useCallback(
    (opportunity) => flow[opportunity?.id]?.phase === 'sending',
    [flow],
  )

  return { send, phaseFor, errorFor, sending }
}

export function useOpportunityRealtime({ onOpportunityUpdated, onOpportunityClosed, onAssigned, onFailure } = {}) {
  const handlers = useRef({ onOpportunityUpdated, onOpportunityClosed, onAssigned, onFailure })
  handlers.current = { onOpportunityUpdated, onOpportunityClosed, onAssigned, onFailure }
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let source
    try {
      source = new EventSource('/api/expert/events', { withCredentials: true })
    } catch {
      handlers.current.onFailure?.()
      return undefined
    }
    const parse = (event) => {
      try {
        return JSON.parse(event.data)
      } catch {
        return null
      }
    }
    source.addEventListener('ready', (event) => {
      setConnected(true)
      handlers.current.onOpportunityUpdated?.(parse(event))
    })
    source.addEventListener('InterestChanged', (event) => {
      handlers.current.onOpportunityUpdated?.(parse(event))
    })
    source.addEventListener('OpportunityClosed', (event) => {
      handlers.current.onOpportunityClosed?.(parse(event))
    })
    source.addEventListener('AssignmentChanged', (event) => {
      const payload = parse(event)
      handlers.current.onAssigned?.(payload)
      handlers.current.onOpportunityUpdated?.(payload)
    })
    source.onerror = () => {
      setConnected(false)
      handlers.current.onFailure?.()
    }
    return () => {
      source.close()
      setConnected(false)
    }
  }, [])

  return { connected }
}
