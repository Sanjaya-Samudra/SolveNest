import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addProgressUpdate,
  beginRevision,
  fetchAssignmentFiles,
  fetchAssignmentMessages,
  fetchAssignmentOverview,
  fetchAssignmentRequirements,
  fetchAssignmentWork,
  fetchExpertAssignments,
  fetchQaDeliveryState,
  markAssignmentMessagesRead,
  removeAssignmentFile,
  resolveQaFeedbackItem,
  resubmitForQa,
  sendAssignmentMessage,
  submitDeliveryPackage,
  submitForQa,
  updateAssignmentWorkState,
  uploadAssignmentFile,
} from './expertApi.js'
import {
  resolveExpertAssignmentStage,
  resolveExpertDeadlineState,
  resolveExpertNextAction,
  resolveExpertTaskState,
  resolveNeedsExpertAttention,
  toExpertSafeAssignment,
} from './assignmentState.js'

export function decorateAssignment(raw) {
  const safe = toExpertSafeAssignment(raw)
  if (!safe) return null
  return {
    ...safe,
    display: resolveExpertTaskState(safe),
    next: resolveExpertNextAction(safe),
    deadlineState: resolveExpertDeadlineState(safe),
    attention: resolveNeedsExpertAttention(safe),
    stage: resolveExpertAssignmentStage(safe),
  }
}

function decorateAll(rows) {
  return (Array.isArray(rows) ? rows : []).map(decorateAssignment).filter(Boolean)
}

const BLANK_PANELS = { overview: null, requirements: null, work: null, messages: null, files: null }

export function useExpertAssignments(initial = {}) {
  const [query, setQuery] = useState({
    search: initial.search || '',
    filter: initial.filter || 'all',
    sort: initial.sort || 'deadline',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    rows: [],
    meta: { total: 0, filtered: 0 },
    loaded: false,
  })
  const queryRef = useRef(query)
  queryRef.current = query

  const load = useCallback((signal) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    return fetchExpertAssignments({ ...queryRef.current, signal })
      .then(({ assignments, meta }) => {
        setState({ loading: false, error: null, rows: assignments, meta, loaded: true })
        return assignments
      })
      .catch((error) => {
        if (error.name === 'AbortError') return null
        setState((prev) => ({ ...prev, loading: false, error, loaded: true }))
        return null
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => load(controller.signal), query.search ? 260 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load, query])

  const setSearch = useCallback((search) => setQuery((prev) => ({ ...prev, search })), [])
  const setFilter = useCallback((filter) => setQuery((prev) => ({ ...prev, filter })), [])
  const setSort = useCallback((sort) => setQuery((prev) => ({ ...prev, sort })), [])

  const assignments = useMemo(() => decorateAll(state.rows), [state.rows])

  return {
    assignments,
    loading: state.loading,
    error: state.error,
    loaded: state.loaded,
    meta: state.meta,
    query,
    setSearch,
    setFilter,
    setSort,
    reload: () => load(),
  }
}

export function useAssignmentInspector(assignmentId) {
  const [state, setState] = useState({
    loading: Boolean(assignmentId),
    error: null,
    assignment: null,
  })

  const load = useCallback(
    (signal) => {
      if (!assignmentId) {
        setState({ loading: false, error: null, assignment: null })
        return Promise.resolve(null)
      }
      setState((prev) => ({ ...prev, loading: true, error: null }))
      return fetchAssignmentOverview(assignmentId, { signal })
        .then((assignment) => {
          setState({ loading: false, error: null, assignment: decorateAssignment(assignment) })
          return assignment
        })
        .catch((error) => {
          if (error.name === 'AbortError') return null
          setState({ loading: false, error, assignment: null })
          return null
        })
    },
    [assignmentId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

export function useAssignmentRealtime({ onAssignmentChanged, onMessage, onQaUpdate } = {}) {
  const handlers = useRef({ onAssignmentChanged, onMessage, onQaUpdate })
  handlers.current = { onAssignmentChanged, onMessage, onQaUpdate }
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let source
    try {
      source = new EventSource('/api/expert/events', { withCredentials: true })
    } catch {
      return undefined
    }
    const parse = (event) => {
      try {
        return JSON.parse(event.data)
      } catch {
        return null
      }
    }
    source.addEventListener('ready', () => setConnected(true))
    source.addEventListener('AssignmentChanged', (event) => handlers.current.onAssignmentChanged?.(parse(event)))
    source.addEventListener('MessageCreated', (event) => handlers.current.onMessage?.(parse(event)))
    source.addEventListener('QaUpdated', (event) => handlers.current.onQaUpdate?.(parse(event)))
    source.onerror = () => setConnected(false)
    return () => {
      source.close()
      setConnected(false)
    }
  }, [])

  return { connected }
}

export function useAssignmentWorkspace(assignmentId, initialTab = 'overview') {
  const [tab, setTab] = useState(initialTab || 'overview')
  const [data, setData] = useState(BLANK_PANELS)
  const [loading, setLoading] = useState(Boolean(assignmentId))
  const [error, setError] = useState(null)
  const [action, setAction] = useState({ kind: null, busy: false, error: null })

  const load = useCallback(
    (signal, { reset = true } = {}) => {
      if (!assignmentId) {
        setData(BLANK_PANELS)
        setLoading(false)
        setError(null)
        return Promise.resolve(null)
      }
      if (reset) {
        setData(BLANK_PANELS)
        setLoading(true)
      }
      setError(null)
      return Promise.all([
        fetchAssignmentOverview(assignmentId, { signal }),
        fetchAssignmentRequirements(assignmentId, { signal }),
        fetchAssignmentWork(assignmentId, { signal }),
        fetchAssignmentMessages(assignmentId, { signal }),
        fetchAssignmentFiles(assignmentId, { signal }),
      ])
        .then(([overview, requirements, work, messages, files]) => {
          setData({
            overview: decorateAssignment(overview),
            requirements,
            work,
            messages,
            files,
          })
          setLoading(false)
          return overview
        })
        .catch((err) => {
          if (err.name === 'AbortError') return null
          setLoading(false)
          setError(err)
          return null
        })
    },
    [assignmentId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refresh = useCallback(() => load(null, { reset: false }), [load])

  const run = useCallback(
    (kind, fn) => {
      setAction({ kind, busy: true, error: null })
      return Promise.resolve()
        .then(fn)
        .then((result) => refresh()
          .then(() => {
            setAction({ kind: null, busy: false, error: null })
            return { ok: true, result }
          }))
        .catch((err) => {
          if (err.name === 'AbortError') return { ok: false, error: null }
          setAction({ kind, busy: false, error: err })
          return { ok: false, error: err }
        })
    },
    [refresh],
  )

  const actions = useMemo(
    () => ({
      addUpdate: (body) => run('update', () => addProgressUpdate(assignmentId, body)),
      setWorkState: (state) => run('state', () => updateAssignmentWorkState(assignmentId, state)),
      sendMessage: (body) => run('message', () => sendAssignmentMessage(assignmentId, body)),
      markMessagesRead: () => run('read', () => markAssignmentMessagesRead(assignmentId)),
      uploadFile: (file, section, onProgress) =>
        run('upload', () => uploadAssignmentFile(assignmentId, file, section, { onProgress })),
      removeFile: (fileId) => run('remove', () => removeAssignmentFile(assignmentId, fileId)),
    }),
    [assignmentId, run],
  )

  return {
    tab,
    setTab,
    data,
    loading,
    error,
    action,
    actions,
    reload: refresh,
    retry: () => load(null),
  }
}

export function useQaDeliveryWorkflow(assignmentId, { onChanged } = {}) {
  const [state, setState] = useState({
    loading: Boolean(assignmentId),
    error: null,
    qa: null,
    delivery: null,
    revision: null,
    workState: null,
    submissionFiles: [],
  })
  const [action, setAction] = useState({ kind: null, busy: false, error: null })
  const changedRef = useRef(onChanged)
  changedRef.current = onChanged

  const load = useCallback(
    (signal) => {
      if (!assignmentId) {
        setState({ loading: false, error: null, qa: null, delivery: null, revision: null, workState: null, submissionFiles: [] })
        return Promise.resolve(null)
      }
      setState((prev) => ({ ...prev, loading: !prev.qa, error: null }))
      return fetchQaDeliveryState(assignmentId, { signal })
        .then((payload) => {
          setState({
            loading: false,
            error: null,
            qa: payload.qa,
            delivery: payload.delivery,
            revision: payload.revision,
            workState: payload.workState,
            submissionFiles: payload.submissionFiles || [],
          })
          return payload
        })
        .catch((err) => {
          if (err.name === 'AbortError') return null
          setState((prev) => ({ ...prev, loading: false, error: err }))
          return null
        })
    },
    [assignmentId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const run = useCallback(
    (kind, fn) => {
      setAction({ kind, busy: true, error: null })
      return Promise.resolve()
        .then(fn)
        .then((result) =>
          load(null).then(() => {
            setAction({ kind: null, busy: false, error: null })
            changedRef.current?.({ kind, result })
            return { ok: true, result }
          }),
        )
        .catch((err) => {
          if (err.name === 'AbortError') return { ok: false, error: null }
          setAction({ kind, busy: false, error: err })
          return { ok: false, error: err }
        })
    },
    [load],
  )

  const actions = useMemo(
    () => ({
      submit: (note) => run('submit', () => submitForQa(assignmentId, { note })),
      resolveFeedback: (feedbackId) => run('resolve', () => resolveQaFeedbackItem(assignmentId, feedbackId)),
      resubmit: (note) => run('resubmit', () => resubmitForQa(assignmentId, { note })),
      deliver: (note) => run('deliver', () => submitDeliveryPackage(assignmentId, { note })),
      beginRevision: () => run('revision', () => beginRevision(assignmentId)),
    }),
    [assignmentId, run],
  )

  const feedback = state.qa?.feedback || []
  const allResolved = feedback.length > 0 && feedback.every((item) => item.state === 'resolved')

  return {
    ...state,
    action,
    actions,
    feedback,
    allResolved,
    openFeedbackCount: feedback.filter((item) => item.state !== 'resolved').length,
    reload: () => load(),
  }
}
