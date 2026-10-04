import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchExpertAccountState,
  fetchAssignmentDetail,
  fetchExpertAvailability,
  fetchExpertDashboard,
  updateExpertAvailability,
} from './expertApi.js'
import { resolveExpertDashboardFocus, resolveExpertAssignmentJourney, resolveExpertNextAction, resolveExpertTaskState } from './expertState.js'

export function useExpertAccountGate() {
  const [state, setState] = useState({ loading: true, error: null, accountState: null, expert: null, availability: null })

  const load = useCallback((signal) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    return fetchExpertAccountState({ signal })
      .then((payload) => {
        setState({ loading: false, error: null, accountState: payload.accountState, expert: payload.expert, availability: payload.availability })
        return payload
      })
      .catch((error) => {
        if (error.name === 'AbortError') return null
        setState({ loading: false, error, accountState: null, expert: null, availability: null })
        return null
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

export function useExpertDashboard() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    workspace: null,
    loaded: false,
  })
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback((options = {}) => {
    const force = Boolean(options.force)
    setState((prev) => {
      if (prev.loaded && prev.workspace && !force) return prev
      return { ...prev, loading: true, error: null }
    })
    const controller = options.signal ? null : new AbortController()
    const signal = options.signal || controller?.signal
    return fetchExpertDashboard({ signal })
      .then((workspace) => {
        setState({ loading: false, error: null, workspace, loaded: true })
        return workspace
      })
      .catch((error) => {
        if (error.name === 'AbortError') return null
        setState((prev) => ({ ...prev, loading: false, error, loaded: true }))
        return null
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (!state.loaded) load({ signal: controller.signal })
    return () => controller.abort()
  }, [load, state.loaded])

  const workspace = state.workspace
  const assignments = useMemo(() => {
    if (!workspace?.assignments) return []
    return workspace.assignments.map((assignment) => ({
      ...assignment,
      display: resolveExpertTaskState(assignment),
      next: resolveExpertNextAction(assignment),
      journey: resolveExpertAssignmentJourney(assignment),
    }))
  }, [workspace])

  const availableTaskPreview = useMemo(() => workspace?.availableTaskPreview || [], [workspace])
  const focus = useMemo(() => resolveExpertDashboardFocus(assignments, availableTaskPreview), [assignments, availableTaskPreview])
  const selectedAssignment = useMemo(() => {
    if (!assignments.length) return null
    return assignments.find((item) => item.id === selectedId) || assignments.find((item) => item.id === focus.assignment?.id) || assignments[0]
  }, [assignments, selectedId, focus.assignment])

  const deadlines = useMemo(() => {
    return assignments
      .filter((item) => item.deadline)
      .slice()
      .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
  }, [assignments])

  return {
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    workspace,
    expert: workspace?.expert || null,
    accountState: workspace?.accountState || null,
    availability: workspace?.availability || null,
    assignments,
    focus,
    availableTaskPreview,
    deadlines,
    movement: workspace?.recentMovement || [],
    unreadNotifications: workspace?.unreadNotifications || 0,
    unreadMessages: workspace?.unreadMessages || 0,
    selectedAssignment,
    selectAssignment: setSelectedId,
    reload: () => load({ force: true }),
  }
}

export function useExpertCommandFocus(assignments) {
  const available = useMemo(() => {
    return Array.isArray(assignments) && assignments.__available ? assignments.__available : []
  }, [assignments])
  return useMemo(() => resolveExpertDashboardFocus(assignments || [], available), [assignments, available])
}

export function useExpertAssignmentPulse(assignmentId) {
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!assignmentId) {
      setAssignment(null)
      setError(null)
      return undefined
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchAssignmentDetail(assignmentId, { signal: controller.signal })
      .then((value) => {
        setAssignment(value)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err)
        setLoading(false)
      })
    return () => controller.abort()
  }, [assignmentId])

  return { assignment, loading, error }
}

export function useExpertAvailabilityControl(initial) {
  const [availability, setAvailability] = useState(initial || 'available')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (initial) setAvailability(initial)
  }, [initial])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const set = useCallback(async (status) => {
    if (saving || status === availability) return
    setSaving(true)
    setError(null)
    try {
      const payload = await updateExpertAvailability(status)
      setAvailability(payload.availability)
      setToast({ title: 'AVAILABILITY UPDATED', body: `You're now marked as ${labelForAvailability(payload.availability)}.` })
    } catch (err) {
      if (err?.message === 'EXPERT_ACCESS_REQUIRED') setError('Sign in to change availability.')
      else setError('We could not update availability. Try again.')
    } finally {
      setSaving(false)
    }
  }, [availability, saving])

  const refresh = useCallback(() => {
    fetchExpertAvailability({})
      .then((payload) => setAvailability(payload.availability))
      .catch(() => {})
  }, [])

  return { availability, set, saving, error, toast, refresh }
}

function labelForAvailability(value) {
  if (value === 'limited') return 'Limited'
  if (value === 'unavailable') return 'Unavailable'
  return 'Available'
}

export function useExpertRealtime({ onAssignmentChanged, onMessage, onQaUpdate, onFailure } = {}) {
  const handlers = useRef({ onAssignmentChanged, onMessage, onQaUpdate, onFailure })
  handlers.current = { onAssignmentChanged, onMessage, onQaUpdate, onFailure }

  useEffect(() => {
    let source
    try {
      source = new EventSource('/api/expert/events', { withCredentials: true })
    } catch {
      handlers.current.onFailure?.()
      return undefined
    }
    const bind = (type, key) => {
      source.addEventListener(type, () => handlers.current[key]?.())
    }
    bind('ready', 'onAssignmentChanged')
    bind('AssignmentChanged', 'onAssignmentChanged')
    bind('MessageCreated', 'onMessage')
    bind('QaUpdated', 'onQaUpdate')
    source.onerror = () => handlers.current.onFailure?.()
    return () => source.close()
  }, [])
}
