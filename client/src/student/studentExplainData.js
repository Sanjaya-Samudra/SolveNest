import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveStudentTaskState, formatDate, formatRelativeTime } from './studentDashboardData.js'
import {
  fetchTaskDossiers, fetchTaskDossierDetail, resolveDeliveryPackage,
  requestFileAccess, canPreviewFile, formatFileSize, getFileIcon,
} from './studentFilesData.js'

export const LEARNING_MODES = [
  {
    key: 'explain',
    label: 'Explain',
    short: 'Explain',
    purpose: 'Break a section into plain language you can repeat.',
    header: 'EXPLAIN',
    tagline: 'Turn dense delivery content into language you can confidently repeat.',
    placeholder: 'Ask me to explain a section or concept…',
    step: 'Understand',
    icon: 'book',
  },
  {
    key: 'why',
    label: 'Why This Approach',
    short: 'Why',
    purpose: 'See the reasoning behind a method, structure, or choice.',
    header: 'WHY THIS APPROACH?',
    tagline: 'Learn why a method, structure, or decision was chosen — and what was traded away.',
    placeholder: 'Ask why a method, structure or decision was used…',
    step: 'Reason',
    icon: 'lightbulb',
  },
  {
    key: 'quiz',
    label: 'Quiz Me',
    short: 'Quiz',
    purpose: 'Test what you actually understand before you are asked.',
    header: 'QUIZ ME',
    tagline: 'Check your understanding with questions grounded in this delivery.',
    placeholder: 'Choose what you want to be tested on…',
    step: 'Check',
    icon: 'brain',
  },
  {
    key: 'lecturer',
    label: 'Lecturer Questions',
    short: 'Viva',
    purpose: 'Practise the questions someone might ask about this work.',
    header: 'LECTURER QUESTIONS',
    tagline: 'Rehearse likely viva or seminar questions — and get coaching on your answers.',
    placeholder: 'Ask about a question you expect on this work…',
    step: 'Practise',
    icon: 'graduation',
  },
  {
    key: 'defend',
    label: 'Defend',
    short: 'Defend',
    purpose: 'Justify the decisions behind your delivery out loud.',
    header: 'DEFEND YOUR WORK',
    tagline: 'Practise explaining and justifying the decisions behind your delivery.',
    placeholder: 'Ask how to justify a decision…',
    step: 'Defend',
    icon: 'scale',
  },
]

export const LEARNING_MODE = {
  EXPLAIN: 'explain',
  WHY: 'why',
  QUIZ: 'quiz',
  LECTURER: 'lecturer',
  DEFEND: 'defend',
}

export const SOURCE_GROUNDING = {
  DELIVERY_SOURCE: 'delivery_source',
  TASK_REQUIREMENTS: 'task_requirements',
  RUBRIC: 'rubric',
  GENERAL: 'general',
}

export const SOURCE_GROUNDING_LABELS = {
  delivery_source: 'DELIVERY SOURCE',
  task_requirements: 'TASK REQUIREMENTS',
  rubric: 'RUBRIC',
  general: 'GENERAL EXPLANATION',
}

export const ARTIFACT_KIND_LABELS = {
  report: 'Report',
  code: 'Code',
  presentation: 'Presentation',
  dataset: 'Dataset',
  image: 'Image',
  other: 'File',
}

const CODE_EXTENSIONS = new Set(['py', 'js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'rs', 'php', 'r', 'sql', 'ipynb', 'swift', 'kt', 'scala', 'sh', 'm'])
const DATASET_EXTENSIONS = new Set(['csv', 'xlsx', 'xls', 'tsv', 'parquet'])
const PRESENTATION_EXTENSIONS = new Set(['ppt', 'pptx', 'odp', 'key'])
const REPORT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'rtf', 'txt', 'md', 'tex'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'])

const AUTH_ERROR = () => {
  const error = new Error('STUDENT_ACCESS_REQUIRED')
  error.code = 401
  return error
}

const integrityError = (payload) => {
  const error = new Error('EXPLAIN_INTEGRITY')
  error.code = 'INTEGRITY'
  error.integrity = payload || {}
  return error
}

async function apiFetch(url, { signal, headers = {}, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (response.status === 401 || response.status === 403) throw AUTH_ERROR()
  return response
}

async function readJson(response) {
  try { return await response.json() } catch { return {} }
}

function extensionOf(name) {
  return String(name || '').split('.').pop()?.toLowerCase() || ''
}

export function classifyArtifactKind(file) {
  const role = String(file?.role || '').toLowerCase()
  if (role.includes('code') || role.includes('source')) return 'code'
  if (role.includes('presentation') || role.includes('slides')) return 'presentation'
  if (role.includes('dataset') || role.includes('data')) return 'dataset'
  const ext = extensionOf(file?.name)
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (DATASET_EXTENSIONS.has(ext)) return 'dataset'
  if (PRESENTATION_EXTENSIONS.has(ext)) return 'presentation'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (REPORT_EXTENSIONS.has(ext)) return 'report'
  return 'other'
}

const KIND_ORDER = { report: 0, code: 1, presentation: 2, dataset: 3, image: 4, other: 5 }

export function buildExplainRoute({ taskId, artifactId, mode, anchor } = {}) {
  const params = new URLSearchParams()
  if (taskId) params.set('task', String(taskId))
  if (artifactId) params.set('artifact', String(artifactId))
  if (mode && mode !== LEARNING_MODE.EXPLAIN) params.set('mode', String(mode))
  if (anchor) {
    const ref = typeof anchor === 'string' ? anchor : anchor.ref
    if (ref != null && ref !== '') params.set('anchor', String(ref))
  }
  const qs = params.toString()
  return `/student/explain${qs ? `?${qs}` : ''}`
}

export function parseExplainRoute() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  return {
    taskId: params.get('task') || null,
    artifactId: params.get('artifact') || null,
    mode: LEARNING_MODES.some((m) => m.key === mode) ? mode : LEARNING_MODE.EXPLAIN,
    anchor: params.get('anchor') || null,
  }
}

export function syncExplainRoute(state) {
  const url = buildExplainRoute(state)
  window.history.replaceState({}, '', url)
}

export function resolveEligibleTasks(dossiers) {
  return (dossiers || []).map((dossier) => {
    const delivery = resolveDeliveryPackage(dossier, null)
    const flag = delivery?.explainAndDefend || null
    const display = dossier.display || resolveStudentTaskState(dossier.task)
    let eligible = false
    let availability = 'ineligible'
    let reason = null
    if (flag && flag.eligible === true) {
      eligible = true
      availability = 'eligible'
    } else if (flag && String(flag.status || '').toLowerCase() === 'processing') {
      availability = 'processing'
      reason = flag.reason || null
    } else if (flag && flag.eligible === false) {
      reason = flag.reason || 'Explain & Defend is not available for this delivery.'
    } else if (!delivery) {
      reason = 'No eligible SolveNest delivery is ready yet.'
    } else {
      reason = 'Explain & Defend is not available for this delivery yet.'
    }
    return {
      id: dossier.taskId,
      title: dossier.task?.title || 'Untitled task',
      subject: dossier.task?.subject || null,
      domain: dossier.task?.domain || null,
      reference: dossier.task?.reference || null,
      status: dossier.task?.status || null,
      display,
      deliveredAt: delivery?.deliveredAt || null,
      deliveryVersion: delivery?.version || null,
      eligible,
      availability,
      reason,
      dossier,
    }
  })
}

export async function fetchEligibleTasks({ signal } = {}) {
  const { dossiers } = await fetchTaskDossiers({ view: 'all', perPage: 50, signal })
  const tasks = resolveEligibleTasks(dossiers)
  const eligibleFirst = [...tasks].sort((a, b) => Number(b.eligible) - Number(a.eligible))
  return eligibleFirst
}

export function resolveArtifactsForTask(task) {
  const dossier = task?.dossier || null
  if (!dossier) return []
  const delivery = resolveDeliveryPackage(dossier, null)
  if (!delivery || !Array.isArray(delivery.files)) return []
  return delivery.files
    .map((file) => {
      const kind = classifyArtifactKind(file)
      return {
        ...file,
        kind,
        kindLabel: ARTIFACT_KIND_LABELS[kind] || 'File',
        ext: extensionOf(file.name),
        icon: getFileIcon(file.name),
        previewable: canPreviewFile(file.name),
        version: delivery.version,
        deliveredAt: delivery.deliveredAt,
        deliveryStatus: delivery.status,
      }
    })
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9))
}

export async function fetchTaskArtifacts(taskId, { signal } = {}) {
  const dossier = await fetchTaskDossierDetail(taskId, { signal })
  const artifacts = resolveArtifactsForTask({ dossier })
  return { artifacts, dossier }
}

export function resolveSourceAnchor(response) {
  const raw = response?.anchor ?? response?.sourceAnchor ?? response?.source?.anchor ?? null
  if (!raw || typeof raw !== 'object') return null
  const kindRaw = String(raw.kind || raw.type || '').toLowerCase()
  const kind = kindRaw === 'doc' ? 'document' : kindRaw
  if (!['code', 'document', 'slide'].includes(kind)) return null
  const ref = raw.ref ?? raw.sectionId ?? raw.blockId ?? raw.page ?? raw.lines ?? raw.line ?? raw.slide ?? raw.id ?? null
  if (ref == null || ref === '') return null
  const file = raw.file || raw.filename || raw.path || null
  const page = raw.page != null ? Number(raw.page) : null
  const lines = normalizeLines(raw.lines ?? raw.line)
  let label = raw.label || null
  if (!label) {
    if (kind === 'document' && page && raw.section) label = `${raw.section} • Page ${page}`
    else if (kind === 'document' && page) label = `Page ${page}`
    else if (kind === 'document' && raw.section) label = String(raw.section)
    else if (kind === 'code' && file && lines) label = `${file}, Lines ${formatLines(lines)}`
    else if (kind === 'code' && file) label = String(file)
    else if (kind === 'code' && lines) label = `Lines ${formatLines(lines)}`
    else if (kind === 'slide' && (raw.slide || page)) label = `Slide ${raw.slide || page}`
  }
  if (!label) label = String(ref)
  const section = raw.section || raw.heading || null
  const index = typeof raw.index === 'number' ? raw.index : typeof raw.n === 'number' ? raw.n : null
  return { kind, ref, label, file, page, lines, section, index }
}

function normalizeLines(value) {
  if (Array.isArray(value) && value.length >= 2) return [Number(value[0]), Number(value[1])]
  if (typeof value === 'number') return [value, value]
  if (typeof value === 'string') {
    const match = value.match(/(\d+)\s*[–\-—to]+\s*(\d+)/)
    if (match) return [Number(match[1]), Number(match[2])]
    const single = value.match(/\d+/)
    if (single) return [Number(single[0]), Number(single[0])]
  }
  return null
}

export function formatLines(lines) {
  if (!lines) return ''
  return lines[0] === lines[1] ? String(lines[0]) : `${lines[0]}–${lines[1]}`
}

export function anchorDisplayId(anchor) {
  if (!anchor) return null
  const n = anchor.uiId ?? anchor.index ?? null
  if (n == null) return null
  return `SOURCE ${String(n).padStart(2, '0')}`
}

export function resolveRubricLink(response, rubric) {
  const criterionId = response?.rubricCriterionId ?? response?.rubric_criterion_id ?? null
  if (!criterionId || !rubric?.criteria?.length) return null
  const criterion = rubric.criteria.find((c) => String(c.id) === String(criterionId)) || null
  if (!criterion) return null
  return { criterion, matched: true }
}

function toStringArray(value) {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : item?.text || item?.label || item?.body || '')).filter(Boolean)
  if (typeof value === 'string') return value ? [value] : []
  return []
}

function normExplanation(value) {
  if (!value) return null
  if (typeof value === 'string') return { paragraphs: [value], bullets: [], formula: null, example: null }
  if (Array.isArray(value)) return { paragraphs: value.filter((v) => typeof v === 'string'), bullets: [], formula: null, example: null }
  const paragraphs = toStringArray(value.paragraphs || value.body || value.text || value.plain)
  const bullets = toStringArray(value.bullets || value.points || value.list)
  if (!paragraphs.length && !bullets.length && !value.formula && !value.example) return null
  return {
    paragraphs,
    bullets,
    formula: value.formula || value.code || null,
    example: value.example || null,
  }
}

function normSource(value, anchor) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    return value.label || value.text || value.description || null
  }
  if (anchor) return anchor.label
  return null
}

function normQuestion(raw, position = 0) {
  if (!raw) return null
  if (typeof raw === 'string') return { id: null, prompt: raw, type: 'short', choices: [], total: null, sourceTag: null, context: null }
  const choicesRaw = raw.choices || raw.options || []
  return {
    id: raw.id ?? null,
    prompt: raw.prompt || raw.question || raw.text || '',
    type: raw.type || (choicesRaw.length ? 'choice' : 'short'),
    choices: choicesRaw.map((c, i) => (typeof c === 'string' ? { id: String(i), label: c } : { id: c.id ?? String(i), label: c.label || c.text || '' })),
    total: raw.total ?? raw.count ?? null,
    sourceTag: raw.sourceTag || raw.source_tag || raw.section || raw.tag || null,
    context: raw.context || raw.hint || null,
    index: typeof raw.index === 'number' ? raw.index : position + 1,
  }
}

function normReveal(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return { yourAnswer: null, strong: [], improve: [], model: raw, source: null, scoreLabel: null }
  return {
    yourAnswer: raw.yourAnswer || raw.your_answer || raw.answer || null,
    strong: toStringArray(raw.strong || raw.whatWasStrong || raw.strengths),
    improve: toStringArray(raw.improve || raw.whatToImprove || raw.improvements),
    model: raw.model || raw.modelExplanation || raw.explanation || null,
    source: normSource(raw.source, null),
    scoreLabel: raw.scoreLabel || raw.score_label || raw.understanding || raw.feedbackLabel || null,
  }
}

function normCoaching(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return { covered: [], missing: [], stronger: raw, source: null }
  return {
    covered: toStringArray(raw.covered || raw.whatYouCovered),
    missing: toStringArray(raw.missing || raw.whatIsMissing || raw.gaps),
    stronger: raw.stronger || raw.strongerWay || raw.strongerWayToExplain || null,
    source: normSource(raw.source, null),
  }
}

function normFeedback(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return { clear: raw, missing: [], strengthen: [], source: null }
  return {
    clear: toStringArray(raw.clear || raw.clearPoints)[0] || raw.clear || null,
    clearAll: toStringArray(raw.clear || raw.clearPoints),
    missing: toStringArray(raw.missing || raw.missingPoints),
    strengthen: toStringArray(raw.strengthen || raw.strengthenPoints),
    source: normSource(raw.source, null),
  }
}

export function normalizeExplainResponse(payload, mode) {
  if (!payload || typeof payload !== 'object') return null
  const anchor = resolveSourceAnchor(payload)
  const grounding = SOURCE_GROUNDING_LABELS[payload.grounding] || (payload.grounding ? String(payload.grounding).toUpperCase() : null)
  const base = {
    sessionId: payload.sessionId || payload.session_id || null,
    grounding: payload.grounding || null,
    groundingLabel: grounding,
    anchor,
    integrity: payload.integrity || null,
    usage: payload.usage && typeof payload.usage.remaining === 'number' ? payload.usage : null,
    rubricCriterionId: payload.rubricCriterionId ?? payload.rubric_criterion_id ?? null,
    source: normSource(payload.source, anchor),
    uncertainty: payload.uncertainty || payload.sourceUncertainty || null,
    mode,
  }
  if (mode === LEARNING_MODE.EXPLAIN) {
    const plain = normExplanation(payload.plainExplanation || payload.plain || payload.explanation)
    const whyItMatters = normExplanation(payload.whyItMatters || payload.matters)
    const trySayingIt = payload.trySayingIt || payload.try_saying_it || payload.practice || payload.tryIt || null
    return { ...base, plain, whyItMatters, source: normSource(payload.source, anchor), trySayingIt: typeof trySayingIt === 'string' ? trySayingIt : trySayingIt?.prompt || null }
  }
  if (mode === LEARNING_MODE.WHY) {
    return {
      ...base,
      decision: payload.decision || payload.title || null,
      reason: normExplanation(payload.reason || payload.reasoning),
      alternative: normExplanation(payload.alternative || payload.alternatives),
      tradeOff: normExplanation(payload.tradeOff || payload.trade_off || payload.tradeoffs || payload.tradeoffs),
      source: normSource(payload.source, anchor),
    }
  }
  if (mode === LEARNING_MODE.QUIZ) {
    return {
      ...base,
      setup: payload.setup || null,
      question: normQuestion(payload.question, 0),
      reveal: normReveal(payload.reveal || payload.feedback || payload.result),
      completion: payload.completion
        ? {
            strongAreas: toStringArray(payload.completion.strongAreas || payload.completion.strong),
            reviewAgain: toStringArray(payload.completion.reviewAgain || payload.completion.review),
            nextMode: payload.completion.nextMode
              ? { mode: payload.completion.nextMode.mode || null, label: payload.completion.nextMode.label || payload.completion.nextMode.mode || 'Continue' }
              : null,
          }
        : null,
      total: payload.total ?? payload.question?.total ?? null,
      index: payload.index ?? payload.question?.index ?? null,
    }
  }
  if (mode === LEARNING_MODE.LECTURER) {
    return {
      ...base,
      question: normQuestion(payload.question, 0),
      coaching: normCoaching(payload.coaching || payload.feedback),
      followUp: normQuestion(payload.followUp || payload.follow_up, 1),
      complete: Boolean(payload.complete || payload.done),
      total: payload.total ?? null,
      index: payload.index ?? null,
    }
  }
  if (mode === LEARNING_MODE.DEFEND) {
    return {
      ...base,
      decision: payload.decision || payload.title || payload.target || null,
      question: normQuestion(payload.question, 0),
      feedback: normFeedback(payload.feedback),
      complete: Boolean(payload.complete || payload.done),
      total: payload.total ?? null,
      index: payload.index ?? null,
    }
  }
  return base
}

function mergeStreamingPayload(acc, chunk) {
  if (!chunk || typeof chunk !== 'object') return acc
  const merged = { ...acc }
  for (const [key, value] of Object.entries(chunk)) {
    if (value == null) continue
    if (Array.isArray(value)) merged[key] = value
    else if (typeof value === 'object' && !Array.isArray(value) && acc[key] && typeof acc[key] === 'object' && !Array.isArray(acc[key])) merged[key] = { ...acc[key], ...value }
    else merged[key] = value
  }
  return merged
}

export async function requestExplanation({ taskId, artifactId, mode, selection, question, signal, prompt, answers, scope, round } = {}) {
  const response = await apiFetch(`/api/student/explain/tasks/${encodeURIComponent(taskId)}/explain`, {
    method: 'POST',
    signal,
    body: {
      artifactId: artifactId || null,
      mode,
      selection: selection || null,
      question: question || null,
      prompt: prompt || null,
      answers: answers || null,
      scope: scope || null,
      round: round || null,
    },
  })
  if (!response.ok) {
    if (response.status === 404 || response.status === 501) {
      const error = new Error('EXPLAIN_UNSUPPORTED')
      error.code = 'UNSUPPORTED'
      throw error
    }
    if (response.status === 422) {
      const payload = await readJson(response)
      if (payload.integrity || payload.code === 'INTEGRITY') throw integrityError(payload)
    }
    throw new Error(`EXPLAIN_REQUEST_${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (response.body && (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson') || contentType.includes('ndjson'))) {
    return { stream: response.body, contentType, payload: null }
  }
  const payload = await readJson(response)
  if (payload.integrity) throw integrityError(payload)
  return { stream: null, contentType, payload }
}

export async function fetchRubric(taskId, { signal } = {}) {
  try {
    const response = await apiFetch(`/api/student/explain/tasks/${encodeURIComponent(taskId)}/rubric`, { signal })
    if (response.status === 404 || response.status === 501) return null
    if (!response.ok) return null
    const payload = await readJson(response)
    const criteria = Array.isArray(payload) ? payload : payload.criteria || payload.rubric || []
    if (!criteria.length) return null
    return {
      criteria: criteria.map((c, i) => ({
        id: c.id ?? String(i),
        label: c.label || c.name || c.criterion || 'Criterion',
        weight: c.weight ?? c.percentage ?? null,
        description: c.description || c.guidance || null,
      })),
      source: payload.source || null,
    }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return null
  }
}

export async function fetchSessionHistory(taskId, { signal } = {}) {
  try {
    const response = await apiFetch(`/api/student/explain/tasks/${encodeURIComponent(taskId)}/sessions`, { signal })
    if (response.status === 404 || response.status === 501) return null
    if (!response.ok) return null
    const payload = await readJson(response)
    const rows = Array.isArray(payload) ? payload : payload.sessions || []
    return rows.map((s) => ({
      id: s.id,
      title: s.title || s.name || 'Session',
      mode: s.mode || null,
      updatedAt: s.updatedAt || s.updated_at || s.createdAt || null,
    }))
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return null
  }
}

export async function resumeSession(sessionId, { signal } = {}) {
  const response = await apiFetch(`/api/student/explain/sessions/${encodeURIComponent(sessionId)}`, { signal })
  if (!response.ok) throw new Error(`EXPLAIN_SESSION_${response.status}`)
  const payload = await readJson(response)
  const session = payload.session || payload.data || payload
  return {
    sessionId: session.id || sessionId,
    mode: LEARNING_MODES.some((m) => m.key === session.mode) ? session.mode : LEARNING_MODE.EXPLAIN,
    artifactId: session.artifactId || null,
    anchor: resolveSourceAnchor({ anchor: session.anchor }) || null,
    trail: Array.isArray(session.trail) ? session.trail.map((t) => ({ key: t.key || t.id, label: t.label || t.key, status: t.status || 'complete' })) : [],
    title: session.title || null,
  }
}

export async function persistSessionState(sessionId, patch, { signal } = {}) {
  const response = await apiFetch(`/api/student/explain/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    signal,
    body: patch,
  })
  if (!response.ok) throw new Error(`EXPLAIN_SESSION_SAVE_${response.status}`)
  return true
}

export async function fetchUsageLimits({ signal } = {}) {
  try {
    const response = await apiFetch('/api/student/explain/usage', { signal })
    if (!response.status || response.status === 404 || response.status === 501) return null
    if (!response.ok) return null
    const payload = await readJson(response)
    const remaining = payload.remaining ?? payload.left ?? null
    if (typeof remaining !== 'number') return null
    return {
      remaining,
      limit: typeof payload.limit === 'number' ? payload.limit : null,
      periodLabel: payload.periodLabel || payload.period || null,
    }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    return null
  }
}

export async function fetchArtifactContent(artifactId, { signal } = {}) {
  let response
  try {
    response = await apiFetch(`/api/student/explain/artifacts/${encodeURIComponent(artifactId)}/content`, { signal })
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 401 || error.code === 403) throw error
    const unsupported = new Error('ARTIFACT_CONTENT_UNAVAILABLE')
    unsupported.code = 'UNSUPPORTED'
    throw unsupported
  }
  if (response.status === 404 || response.status === 415 || response.status === 501) {
    const unsupported = new Error('ARTIFACT_UNSUPPORTED')
    unsupported.code = 'UNSUPPORTED'
    throw unsupported
  }
  if (!response.ok) throw new Error(`ARTIFACT_CONTENT_${response.status}`)
  const payload = await readJson(response)
  const content = normalizeArtifactContent(payload)
  if (!content) {
    const unsupported = new Error('ARTIFACT_UNSUPPORTED')
    unsupported.code = 'UNSUPPORTED'
    throw unsupported
  }
  return content
}

export function normalizeArtifactContent(payload) {
  if (!payload || typeof payload !== 'object') return null
  const kindRaw = String(payload.kind || payload.type || '').toLowerCase()
  let kind = kindRaw
  if (['document', 'doc', 'docx', 'pdf'].includes(kindRaw)) kind = 'document'
  else if (['code', 'source'].includes(kindRaw)) kind = 'code'
  else if (['slides', 'slide', 'presentation', 'pptx'].includes(kindRaw)) kind = 'slides'
  else if (['dataset', 'table', 'csv'].includes(kindRaw)) kind = 'dataset'
  else if (['text', 'markdown', 'md'].includes(kindRaw)) kind = 'text'
  if (!kind) {
    if (payload.pages || payload.sections || payload.blocks) kind = 'document'
    else if (payload.files || payload.lines || payload.content) kind = 'code'
    else if (payload.slides) kind = 'slides'
    else if (payload.columns || payload.rows) kind = 'dataset'
    else if (payload.text) kind = 'text'
    else return null
  }
  const title = payload.title || payload.name || null
  if (kind === 'document') {
    const pages = normalizePages(payload)
    if (!pages.length) return null
    return { kind, title, pages }
  }
  if (kind === 'code') {
    const files = normalizeCodeFiles(payload)
    if (!files.length) return null
    return { kind, title, files }
  }
  if (kind === 'slides') {
    const slides = (payload.slides || []).map((s, i) => ({
      n: s.n ?? s.index ?? s.slide ?? i + 1,
      title: s.title || s.heading || `Slide ${i + 1}`,
      bullets: toStringArray(s.bullets || s.points || s.body || s.text),
    }))
    if (!slides.length) return null
    return { kind, title, slides }
  }
  if (kind === 'dataset') {
    const columns = (payload.columns || []).map((c) => (typeof c === 'string' ? c : c.label || c.name || ''))
    const allRows = payload.rows || []
    const rows = allRows.slice(0, 100)
    if (!columns.length && !rows.length) return null
    return { kind, title, columns, rows, totalRows: payload.totalRows ?? allRows.length, truncated: allRows.length > rows.length || Boolean(payload.truncated) }
  }
  const text = typeof payload.text === 'string' ? payload.text : null
  if (!text) return null
  return { kind: 'text', title, pages: [{ n: 1, blocks: text.split(/\n{2,}/).map((t, i) => ({ id: `t-${i}`, type: 'paragraph', text: t, page: 1 })).filter((b) => b.text.trim()) }] }
}

function normalizePages(payload) {
  if (Array.isArray(payload.pages) && payload.pages.length) {
    return payload.pages.map((page, pi) => {
      const n = page.n ?? page.page ?? pi + 1
      const blocksSource = page.blocks || page.paragraphs || page.content || []
      const blocks = blocksSource.map((b, i) => normalizeBlock(b, i, n))
      return { n, blocks: blocks.filter((b) => b.text) }
    }).filter((p) => p.blocks.length)
  }
  if (Array.isArray(payload.sections) && payload.sections.length) {
    const byPage = new Map()
    payload.sections.forEach((section, i) => {
      const pageN = section.page ?? section.pageNumber ?? i + 1
      if (!byPage.has(pageN)) byPage.set(pageN, [])
      const heading = section.label || section.title || section.heading
      if (heading) byPage.get(pageN).push({ id: section.id || `s-${i}`, type: 'heading', text: heading, page: pageN })
      const body = section.blocks || section.paragraphs || (section.text ? [section.text] : [])
      body.forEach((b, j) => byPage.get(pageN).push(normalizeBlock(b, j, pageN, section.id)))
    })
    return [...byPage.entries()].map(([n, blocks]) => ({ n, blocks })).sort((a, b) => a.n - b.n)
  }
  const blocksSource = payload.blocks || payload.paragraphs || []
  if (blocksSource.length) {
    const blocks = blocksSource.map((b, i) => normalizeBlock(b, i, 1))
    return [{ n: 1, blocks: blocks.filter((b) => b.text) }]
  }
  return []
}

function normalizeBlock(b, i, page, sectionId) {
  if (typeof b === 'string') return { id: `b-${page}-${i}`, type: 'paragraph', text: b, page, sectionId: sectionId || null }
  return {
    id: b.id || `b-${page}-${i}`,
    type: b.type || b.tag || (b.heading || b.title ? 'heading' : 'paragraph'),
    text: b.text || b.content || b.heading || b.title || '',
    page: b.page ?? page,
    sectionId: b.sectionId || sectionId || null,
    anchorLabel: b.anchorLabel || b.label || null,
  }
}

function normalizeCodeFiles(payload) {
  const source = Array.isArray(payload.files) && payload.files.length ? payload.files : payload.file ? [payload.file] : [{ path: payload.path || 'file', content: payload.content, lines: payload.lines }]
  return source.map((f, i) => {
    if (typeof f === 'string') return null
    const path = f.path || f.name || `file-${i + 1}`
    let lines = []
    if (Array.isArray(f.lines)) {
      lines = f.lines.map((line, j) => (typeof line === 'string' ? { n: j + 1, text: line } : { n: line.n ?? line.number ?? j + 1, text: line.text ?? line.content ?? '' }))
    } else if (typeof f.content === 'string') {
      lines = f.content.replace(/\r\n/g, '\n').split('\n').map((text, j) => ({ n: j + 1, text }))
    }
    if (!lines.length) return null
    return { path, language: f.language || null, lines }
  }).filter(Boolean)
}

export function useEligibleTasks() {
  const [state, setState] = useState({ tasks: [], loading: true, error: null })
  const load = useCallback(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: null }))
    fetchEligibleTasks({ signal: controller.signal })
      .then((tasks) => setState({ tasks, loading: false, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ tasks: [], loading: false, error }) })
    return () => controller.abort()
  }, [])
  useEffect(() => load(), [load])
  return { ...state, reload: load }
}

export function useTaskArtifacts(taskId) {
  const [state, setState] = useState({ artifacts: [], dossier: null, loading: false, error: null })
  useEffect(() => {
    if (!taskId) { setState({ artifacts: [], dossier: null, loading: false, error: null }); return undefined }
    const controller = new AbortController()
    setState({ artifacts: [], dossier: null, loading: true, error: null })
    fetchTaskArtifacts(taskId, { signal: controller.signal })
      .then(({ artifacts, dossier }) => setState({ artifacts, dossier, loading: false, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ artifacts: [], dossier: null, loading: false, error }) })
    return () => controller.abort()
  }, [taskId])
  return { ...state }
}

export function useArtifactViewer(artifactId) {
  const [state, setState] = useState({
    status: 'idle',
    mode: null,
    content: null,
    signedUrl: null,
    previewType: null,
    error: null,
    page: 1,
    zoom: 1,
    query: '',
    matches: [],
    matchIndex: 0,
    activeAnchor: null,
    activePath: null,
  })
  const containerRef = useRef(null)
  const scrollRef = useRef(null)

  const load = useCallback(() => {
    if (!artifactId) { setState((s) => ({ ...s, status: 'idle', content: null, signedUrl: null, error: null })); return () => {} }
    const controller = new AbortController()
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading', content: null, signedUrl: null, error: null, activeAnchor: null, page: 1, query: '', matches: [], matchIndex: 0 }))
    fetchArtifactContent(artifactId, { signal: controller.signal })
      .then((content) => { if (!cancelled) setState((s) => ({ ...s, status: 'ready', mode: 'parsed', content, activePath: content.files?.[0]?.path || null, error: null })) })
      .catch((error) => {
        if (cancelled || error.name === 'AbortError' || error.code === 401 || error.code === 403) { if (!cancelled && error.name !== 'AbortError') setState((s) => ({ ...s, status: 'error', error })); return }
        requestFileAccess(artifactId, { signal: controller.signal })
          .then((url) => {
            if (cancelled) return
            if (url) setState((s) => ({ ...s, status: 'ready', mode: 'embedded', signedUrl: url, error: null }))
            else setState((s) => ({ ...s, status: 'unsupported', error: null }))
          })
          .catch(() => { if (!cancelled) setState((s) => ({ ...s, status: error.code === 'UNSUPPORTED' ? 'unsupported' : 'error', error })) })
      })
    return () => { cancelled = true; controller.abort() }
  }, [artifactId])

  useEffect(() => load(), [load])

  useEffect(() => {
    if (!state.signedUrl) return
    const ext = state.signedUrl.split('?')[0].split('.').pop()?.toLowerCase()
    const type = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext) ? 'image' : ext === 'pdf' ? 'pdf' : 'text'
    setState((s) => ({ ...s, previewType: type }))
  }, [state.signedUrl])

  const computeMatches = useCallback((content, query) => {
    if (!content || !query.trim()) return []
    const term = query.trim().toLowerCase()
    const out = []
    if (content.kind === 'code') {
      const file = content.files.find((f) => f.path === state.activePath) || content.files[0]
      file?.lines.forEach((line) => { if (line.text.toLowerCase().includes(term)) out.push({ type: 'line', n: line.n }) })
    } else if (content.kind === 'slides') {
      content.slides.forEach((slide) => { if (slide.title.toLowerCase().includes(term) || slide.bullets.some((b) => b.toLowerCase().includes(term))) out.push({ type: 'slide', n: slide.n }) })
    } else if (content.pages) {
      content.pages.forEach((page) => page.blocks.forEach((block) => { if (block.text.toLowerCase().includes(term)) out.push({ type: 'block', id: block.id, page: page.n }) }))
    } else if (content.kind === 'dataset') {
      content.rows.forEach((row, i) => { if (row.some((cell) => String(cell).toLowerCase().includes(term))) out.push({ type: 'row', n: i }) })
    }
    return out
  }, [state.activePath])

  const setQuery = useCallback((query) => {
    setState((s) => {
      const matches = computeMatches(s.content, query)
      return { ...s, query, matches, matchIndex: 0 }
    })
  }, [computeMatches])

  const jumpToMatch = useCallback((index) => {
    setState((s) => {
      if (!s.matches.length) return s
      const next = ((index % s.matches.length) + s.matches.length) % s.matches.length
      const match = s.matches[next]
      const page = match.page || (match.type === 'slide' ? match.n : s.page)
      queueMicrotask(() => {
        const root = scrollRef.current
        if (!root) return
        const selector = match.type === 'block' ? `[data-block-id="${CSS.escape(match.id)}"]`
          : match.type === 'line' ? `[data-line="${match.n}"]`
            : match.type === 'slide' ? `[data-slide="${match.n}"]`
              : `[data-row="${match.n}"]`
        const el = root.querySelector(selector)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return { ...s, matchIndex: next, page: page || s.page }
    })
  }, [])

  const focusAnchor = useCallback((anchor) => {
    if (!anchor) return false
    const root = scrollRef.current
    const content = state.content
    if (content && root) {
      if (content.kind === 'code' && (anchor.kind === 'code' || !anchor.kind)) {
        const file = content.files.find((f) => !anchor.file || f.path === anchor.file) || content.files[0]
        if (file && state.activePath !== file.path) setState((s) => ({ ...s, activePath: file.path }))
        const start = anchor.lines ? anchor.lines[0] : Number(anchor.ref)
        const end = anchor.lines ? anchor.lines[1] : start
        queueMicrotask(() => {
          const el = root.querySelector(`[data-line="${start}"]`)
          if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        })
        setState((s) => ({ ...s, activeAnchor: { ...anchor, lines: anchor.lines || [start, end] } }))
        return true
      }
      if (content.pages && (anchor.kind === 'document' || !anchor.kind)) {
        let target = null
        if (anchor.ref != null) target = root.querySelector(`[data-block-id="${CSS.escape(String(anchor.ref))}"]`)
        if (!target && anchor.page) target = root.querySelector(`[data-page="${anchor.page}"]`)
        if (!target && anchor.section) {
          target = [...root.querySelectorAll('[data-block-id]')].find((el) => el.textContent?.toLowerCase().includes(String(anchor.section).toLowerCase()))
        }
        if (target) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' })
          const page = Number(target.getAttribute('data-page') || anchor.page || state.page)
          setState((s) => ({ ...s, activeAnchor: anchor, page: page || s.page }))
          return true
        }
      }
      if (content.kind === 'slides' && (anchor.kind === 'slide' || !anchor.kind)) {
        const n = Number(anchor.page || anchor.ref)
        const el = root.querySelector(`[data-slide="${n}"]`)
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setState((s) => ({ ...s, activeAnchor: anchor })); return true }
      }
    }
    if (state.mode === 'embedded' && state.signedUrl && state.previewType === 'pdf') {
      const page = anchor.page || Number(String(anchor.ref).match(/\d+/)?.[0])
      if (page) {
        const base = state.signedUrl.split('#')[0]
        setState((s) => ({ ...s, signedUrl: `${base}#page=${page}`, activeAnchor: anchor, page }))
        return true
      }
    }
    if (state.mode === 'embedded') { setState((s) => ({ ...s, activeAnchor: anchor })); return false }
    return false
  }, [state.content, state.mode, state.signedUrl, state.previewType, state.page, state.activePath])

  const setActiveAnchor = useCallback((anchor) => setState((s) => ({ ...s, activeAnchor: anchor })), [])
  const setPage = useCallback((page) => setState((s) => ({ ...s, page })), [])
  const setActivePath = useCallback((activePath) => setState((s) => ({ ...s, activePath, matches: computeMatches(s.content, s.query), matchIndex: 0 })), [computeMatches])
  const setZoom = useCallback((zoom) => setState((s) => ({ ...s, zoom: Math.min(1.8, Math.max(0.75, Number(zoom.toFixed(2)))) })), [])
  const zoomIn = useCallback(() => setState((s) => ({ ...s, zoom: Math.min(1.8, s.zoom + 0.15) })), [])
  const zoomOut = useCallback(() => setState((s) => ({ ...s, zoom: Math.max(0.75, s.zoom - 0.15) })), [])

  const download = useCallback(async (artifact) => {
    if (!artifact) return
    try {
      const url = await requestFileAccess(artifact.id)
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.name
      a.click()
    } catch { /* handled by caller notice */ }
  }, [])

  return {
    ...state,
    containerRef,
    scrollRef,
    reload: load,
    setQuery,
    setPage,
    setActivePath,
    setActiveAnchor,
    setZoom,
    zoomIn,
    zoomOut,
    nextMatch: () => jumpToMatch(state.matchIndex + 1),
    prevMatch: () => jumpToMatch(state.matchIndex - 1),
    focusAnchor,
    download,
    pageCount: state.content?.pages?.length || 0,
    canRenderSelection: state.mode === 'parsed',
  }
}

export function useSourceSelection(containerRef, enabled) {
  const [selection, setSelection] = useState(null)
  const rangeRef = useRef(null)

  useEffect(() => {
    if (!enabled) { setSelection(null); return undefined }
    let frame = null
    const evaluate = () => {
      frame = null
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelection(null); rangeRef.current = null; return }
      const range = sel.getRangeAt(0)
      const text = sel.toString().trim()
      const container = containerRef?.current
      if (!container || text.length < 3 || !container.contains(range.commonAncestorContainer)) { setSelection(null); rangeRef.current = null; return }
      const rect = range.getBoundingClientRect()
      rangeRef.current = range
      setSelection({ text: text.slice(0, 600), rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height } })
    }
    const onChange = () => { if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(evaluate) }
    const onScroll = () => { if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(evaluate) }
    document.addEventListener('selectionchange', onChange)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('selectionchange', onChange)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [enabled, containerRef])

  const clear = useCallback(() => {
    setSelection(null)
    rangeRef.current = null
    const sel = window.getSelection()
    if (sel) sel.removeAllRanges()
  }, [])

  return { selection, clear }
}

export function useStreamingResponse(request) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null, streaming: false })
  const abortRef = useRef(null)
  const requestId = request?.id ?? null

  useEffect(() => {
    if (!request || !requestId) return undefined
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'loading', data: null, error: null, streaming: false })
    ;(async () => {
      try {
        const result = await requestExplanation({ ...request, signal: controller.signal })
        if (result.stream) {
          setState((s) => ({ ...s, status: 'streaming', streaming: true }))
          const reader = result.stream.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let acc = {}
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith(':')) continue
              const jsonStr = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                acc = mergeStreamingPayload(acc, JSON.parse(jsonStr))
                const normalized = normalizeExplainResponse(acc, request.mode)
                setState((s) => (abortRef.current === controller ? { ...s, status: 'streaming', streaming: true, data: normalized } : s))
              } catch { /* skip malformed chunk */ }
            }
          }
          if (abortRef.current === controller) setState((s) => ({ ...s, status: 'done', streaming: false, data: normalizeExplainResponse(acc, request.mode) || s.data }))
        } else {
          setState({ status: 'done', data: normalizeExplainResponse(result.payload, request.mode), error: null, streaming: false })
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          if (abortRef.current === controller) setState((s) => ({ ...s, status: s.data ? 'done' : 'stopped', streaming: false }))
          return
        }
        if (abortRef.current !== controller) return
        if (error.code === 'INTEGRITY') {
          setState({ status: 'integrity', data: { integrity: error.integrity || {} }, error: null, streaming: false })
          return
        }
        if (error.code === 'UNSUPPORTED') {
          setState((s) => ({ ...s, status: 'error', error, streaming: false }))
          return
        }
        setState({ status: 'error', data: null, error, streaming: false })
      }
    })()
    return () => controller.abort()
  }, [requestId])

  const stop = useCallback(() => { abortRef.current?.abort() }, [])
  return { ...state, stop, canStop: state.status === 'streaming' || state.status === 'loading' }
}

function defaultTrailLabel(mode, focusLabel) {
  const focus = focusLabel || 'Delivery'
  if (mode === LEARNING_MODE.EXPLAIN) return `${focus} explained`
  if (mode === LEARNING_MODE.WHY) return `${focus} — approach reviewed`
  if (mode === LEARNING_MODE.QUIZ) return `${focus} quiz`
  if (mode === LEARNING_MODE.LECTURER) return 'Lecturer questions practised'
  if (mode === LEARNING_MODE.DEFEND) return `${focus} defended`
  return focus
}

export function useLearningTrail(sessionId, onNotice) {
  const [trail, setTrail] = useState([])
  const saveTimerRef = useRef(null)

  const mark = useCallback((entry) => {
    if (!entry?.key) return
    setTrail((current) => {
      const existing = current.find((t) => t.key === entry.key)
      if (existing) return current.map((t) => (t.key === entry.key ? { ...t, ...entry, status: entry.status === 'progress' && t.status === 'complete' ? 'complete' : entry.status } : t))
      return [...current, { key: entry.key, label: entry.label, status: entry.status || 'progress' }]
    })
  }, [])

  const reset = useCallback((items) => setTrail(Array.isArray(items) ? items : []), [])

  useEffect(() => {
    if (!sessionId || !trail.length) return undefined
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      persistSessionState(sessionId, { trail })
        .catch(() => onNotice?.('session-save', 'This session could not be saved.'))
    }, 900)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [trail, sessionId, onNotice])

  return { trail, mark, reset }
}

export function useExplainSession(taskId) {
  const initial = useMemo(() => parseExplainRoute(), [])
  const [mode, setModeState] = useState(initial.mode)
  const [artifactId, setArtifactIdState] = useState(initial.artifactId)
  const [anchor, setAnchorState] = useState(null)
  const [composer, setComposer] = useState('')
  const [request, setRequest] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [notice, setNotice] = useState(null)
  const ordinalRef = useRef(0)
  const askRef = useRef(0)

  const notify = useCallback((kind, message) => {
    setNotice({ kind, message, id: Date.now() })
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const { trail, mark: markTrail, reset: resetTrail } = useLearningTrail(sessionId, notify)

  const stream = useStreamingResponse(request)

  const setMode = useCallback((nextMode) => {
    setModeState(nextMode)
    setRequest(null)
  }, [])

  const setArtifactId = useCallback((nextId) => {
    setArtifactIdState(nextId)
    setAnchorState(null)
    setRequest(null)
  }, [])

  const setAnchor = useCallback((nextAnchor) => {
    if (!nextAnchor) { setAnchorState(null); return }
    ordinalRef.current += 1
    setAnchorState({ ...nextAnchor, uiId: nextAnchor.uiId ?? ordinalRef.current })
  }, [])

  const clearAnchor = useCallback(() => setAnchorState(null), [])

  const ask = useCallback(({ question = null, selection = null, scope = null, answers = null, prompt = null, round = null, mode: modeOverride = null } = {}) => {
    askRef.current += 1
    setRequest({
      id: `r-${Date.now()}-${askRef.current}`,
      taskId,
      artifactId,
      mode: modeOverride || mode,
      selection,
      question,
      prompt,
      answers,
      scope,
      round,
    })
  }, [taskId, artifactId, mode])

  const retry = useCallback(() => {
    if (!request) return
    askRef.current += 1
    setRequest({ ...request, id: `r-${Date.now()}-${askRef.current}` })
  }, [request])

  const stop = stream.stop

  const focusKey = anchor?.ref ?? artifactId ?? taskId ?? 'task'
  const focusLabel = anchor?.label || null

  useEffect(() => {
    if (stream.status !== 'done' || !stream.data) return
    if (stream.data.sessionId) setSessionId(stream.data.sessionId)
    if (stream.data.anchor && (!anchor || anchor.ref !== stream.data.anchor.ref)) {
      ordinalRef.current += 1
      setAnchorState({ ...stream.data.anchor, uiId: ordinalRef.current })
    }
    const isQuizComplete = mode === LEARNING_MODE.QUIZ && stream.data.completion
    const isDefendComplete = mode === LEARNING_MODE.DEFEND && stream.data.complete
    const isLecturerComplete = mode === LEARNING_MODE.LECTURER && stream.data.complete
    const inProgress = (mode === LEARNING_MODE.QUIZ && stream.data.question && !stream.data.completion)
      || (mode === LEARNING_MODE.DEFEND && stream.data.question && !stream.data.complete)
    const status = isQuizComplete || isDefendComplete || isLecturerComplete ? 'complete' : inProgress ? 'progress' : 'complete'
    markTrail({
      key: `${mode}:${focusKey}`,
      label: defaultTrailLabel(mode, focusLabel),
      status,
    })
  }, [stream.status, stream.data])

  const applyResumedSession = useCallback((session) => {
    setModeState(session.mode || LEARNING_MODE.EXPLAIN)
    if (session.artifactId) setArtifactIdState(session.artifactId)
    if (session.anchor) {
      ordinalRef.current += 1
      setAnchorState({ ...session.anchor, uiId: ordinalRef.current })
    }
    resetTrail(session.trail)
    setSessionId(session.sessionId)
    setRequest(null)
  }, [resetTrail])

  return {
    mode,
    setMode,
    artifactId,
    setArtifactId,
    anchor,
    setAnchor,
    clearAnchor,
    composer,
    setComposer,
    request,
    ask,
    retry,
    stream,
    sessionId,
    trail,
    markTrail,
    stop,
    applyResumedSession,
    notice,
    notify,
    dismissNotice,
    focusLabel,
    initialRoute: initial,
  }
}

export { formatDate, formatRelativeTime, formatFileSize, getFileIcon, canPreviewFile, requestFileAccess }
