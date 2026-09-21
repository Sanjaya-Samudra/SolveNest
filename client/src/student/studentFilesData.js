import { resolveStudentTaskState, getTaskJourney, formatDate, formatRelativeTime } from './studentDashboardData.js'

export const FILE_VIEWS = [
  ['all', 'All'],
  ['my-uploads', 'My Uploads'],
  ['deliveries', 'Deliveries'],
]

export const FILE_SORT_OPTIONS = [
  ['recently-updated', 'Recently Updated'],
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['name', 'Name A–Z'],
  ['task', 'Task'],
]

export const FILE_TYPE_ICONS = {
  pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', svg: 'img', webp: 'img',
  zip: 'zip', rar: 'zip', '7z': 'zip',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio',
  csv: 'data', json: 'data', xml: 'data',
  py: 'code', js: 'code', ts: 'code', java: 'code', cpp: 'code', c: 'code',
  txt: 'text', md: 'text', rtf: 'text',
}

export function mapDossierFile(raw) {
  return {
    id: raw?.id || raw?.uuid || null,
    name: raw?.name || raw?.filename || raw?.title || 'Untitled',
    type: raw?.type || raw?.mime || raw?.fileType || null,
    size: raw?.size || raw?.fileSize || 0,
    role: raw?.role || raw?.fileRole || null,
    origin: raw?.origin || raw?.uploadedBy || raw?.author || null,
    uploadedAt: raw?.uploadedAt || raw?.uploaded_at || raw?.createdAt || raw?.created_at || null,
    uploadedBy: raw?.uploadedByName || raw?.uploaderName || raw?.uploadedBy || null,
    taskTitle: raw?.taskTitle || raw?.task_title || null,
    taskId: raw?.taskId || raw?.task_id || null,
    version: raw?.version || null,
    previewUrl: raw?.previewUrl || raw?.preview_url || null,
    downloadUrl: raw?.downloadUrl || raw?.download_url || null,
    signedUrl: raw?.signedUrl || raw?.signed_url || null,
    status: raw?.status || null,
    conversationId: raw?.conversationId || raw?.conversation_id || null,
    canReplace: raw?.canReplace ?? false,
    canRemove: raw?.canRemove ?? false,
    locked: raw?.locked ?? false,
    lockReason: raw?.lockReason || null,
  }
}

export function mapDeliveryFile(raw) {
  return {
    id: raw?.id || raw?.uuid || null,
    name: raw?.name || raw?.filename || 'Untitled',
    type: raw?.type || raw?.mime || null,
    size: raw?.size || 0,
    role: raw?.role || 'deliverable',
    version: raw?.version || null,
    uploadedAt: raw?.uploadedAt || raw?.uploaded_at || raw?.deliveredAt || null,
    previewUrl: raw?.previewUrl || null,
    downloadUrl: raw?.downloadUrl || null,
    signedUrl: raw?.signedUrl || null,
  }
}

export function mapDossier(raw) {
  const task = {
    id: raw?.id || raw?.taskId || raw?.task_id,
    title: raw?.title || raw?.taskTitle || raw?.task_title || 'Untitled task',
    reference: raw?.reference || raw?.ref || null,
    subject: raw?.subject || raw?.domain || null,
    status: raw?.status || 'DRAFT',
    deadline: raw?.deadline || null,
    expert: raw?.expert || null,
  }
  const display = resolveStudentTaskState(task)
  return {
    taskId: task.id,
    task,
    display,
    sourceFiles: Array.isArray(raw?.sourceFiles) ? raw.sourceFiles.map(mapDossierFile) : [],
    exchangeFiles: Array.isArray(raw?.exchangeFiles) ? raw.exchangeFiles.map(mapDossierFile) : [],
    deliveryVersions: Array.isArray(raw?.deliveryVersions) ? raw.deliveryVersions.map(mapDeliveryVersion) : [],
    fileCount: (raw?.fileCount || 0),
    hasNewDelivery: Boolean(raw?.hasNewDelivery || raw?.has_new_delivery),
    lastActivityAt: raw?.lastActivityAt || raw?.last_activity_at || null,
  }
}

export function mapDeliveryVersion(raw) {
  return {
    id: raw?.id || raw?.version || null,
    version: raw?.version || 1,
    deliveredAt: raw?.deliveredAt || raw?.delivered_at || null,
    status: raw?.status || 'ready_to_review',
    files: Array.isArray(raw?.files) ? raw.files.map(mapDeliveryFile) : [],
    qa: raw?.qa || null,
    note: raw?.note || raw?.deliveryNote || null,
    revision: raw?.revision || null,
    explainAndDefend: raw?.explainAndDefend || raw?.explain_and_defend || null,
  }
}

export function resolveDossierSections(dossier) {
  const sections = []
  if (dossier.sourceFiles.length > 0) sections.push({ key: 'source', label: 'SOURCE MATERIALS', count: dossier.sourceFiles.length })
  if (dossier.exchangeFiles.length > 0) sections.push({ key: 'exchanges', label: 'TASK EXCHANGES', count: dossier.exchangeFiles.length })
  if (dossier.deliveryVersions.length > 0) {
    const latest = dossier.deliveryVersions[dossier.deliveryVersions.length - 1]
    sections.push({ key: 'delivery', label: 'DELIVERY PACKAGE', count: latest.files.length, version: latest.version })
  }
  return sections
}

export function resolveDeliveryPackage(dossier, version) {
  if (!dossier.deliveryVersions.length) return null
  if (version) {
    return dossier.deliveryVersions.find((v) => v.version === version) || dossier.deliveryVersions[dossier.deliveryVersions.length - 1]
  }
  return dossier.deliveryVersions[dossier.deliveryVersions.length - 1]
}

export function resolveRevisionState(delivery) {
  if (!delivery) return { status: null, remaining: null, copy: null }
  const rev = delivery.revision
  if (!rev) return { status: null, remaining: null, copy: null }
  const status = rev.status || null
  const remaining = rev.remaining != null ? rev.remaining : null
  let copy = null
  if (status === 'available') copy = remaining != null ? `${remaining} revision${remaining === 1 ? '' : 's'} remaining.` : 'Your delivery can still be reviewed for an in-scope revision.'
  else if (status === 'requested') copy = 'A revision request has been submitted.'
  else if (status === 'under_review') copy = 'Your revision request is being reviewed.'
  else if (status === 'approved') copy = 'Revision approved — work is starting soon.'
  else if (status === 'in_progress') copy = 'A revision is being prepared.'
  else if (status === 'completed') copy = 'Revision completed.'
  else if (status === 'limit_reached') copy = 'Revision limit reached.'
  return { status, remaining, copy }
}

export function taskHasNewDelivery(dossier) {
  return dossier.hasNewDelivery
}

export function buildDossierRoute({ taskId, section, version } = {}) {
  const params = new URLSearchParams()
  if (taskId) params.set('task', taskId)
  if (section) params.set('section', section)
  if (version && version !== 'latest') params.set('v', String(version))
  const qs = params.toString()
  return `/student/files${qs ? `?${qs}` : ''}`
}

export function parseDossierUrlState() {
  const params = new URLSearchParams(window.location.search)
  return {
    taskId: params.get('task') || null,
    section: params.get('section') || null,
    version: params.get('v') ? Number(params.get('v')) : null,
    view: params.get('view') || 'all',
    search: params.get('q') || '',
  }
}

export function syncDossierUrlState(state) {
  const params = new URLSearchParams()
  if (state.taskId) params.set('task', state.taskId)
  if (state.section) params.set('section', state.section)
  if (state.version) params.set('v', String(state.version))
  if (state.view && state.view !== 'all') params.set('view', state.view)
  if (state.search) params.set('q', state.search)
  const qs = params.toString()
  const url = `/student/files${qs ? `?${qs}` : ''}`
  window.history.replaceState({}, '', url)
}

/* ── Mock Data ──────────────────────────────────────────────────────────── */

const MOCK_DOSSIERS = [
  {
    id: 'task-1', taskId: 'task-1', title: 'Research Report — Information Systems', reference: 'SN-2042',
    subject: 'Information Systems', status: 'DELIVERED', fileCount: 8,
    hasNewDelivery: true, lastActivityAt: '2026-09-19T18:42:00Z',
    expert: { name: 'Amara P.' },
    sourceFiles: [
      { id: 'sf-1', name: 'assessment-2-brief.pdf', type: 'application/pdf', size: 1843200, role: 'brief', origin: 'student', uploadedAt: '2026-09-14T09:44:00Z', uploadedByName: 'You', canReplace: true, canRemove: false, locked: true, lockReason: 'Locked to confirmed scope' },
      { id: 'sf-2', name: 'rubric-marking-scheme.pdf', type: 'application/pdf', size: 524288, role: 'rubric', origin: 'student', uploadedAt: '2026-09-14T09:45:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: true },
      { id: 'sf-3', name: 'lecture-notes-ch4.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 4194304, role: 'reference', origin: 'student', uploadedAt: '2026-09-14T09:46:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: false },
      { id: 'sf-4', name: 'sample-dataset.csv', type: 'text/csv', size: 104857, role: 'supporting', origin: 'student', uploadedAt: '2026-09-14T10:02:00Z', uploadedByName: 'You', canReplace: true, canRemove: true, locked: false },
    ],
    exchangeFiles: [
      { id: 'ef-1', name: 'dataset-cleaned.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 524288, role: 'supporting', origin: 'expert', uploadedAt: '2026-09-15T14:42:00Z', conversationId: 'conv-1' },
      { id: 'ef-2', name: 'methodology-outline.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 209715, role: 'supporting', origin: 'expert', uploadedAt: '2026-09-16T11:05:00Z', conversationId: 'conv-1' },
      { id: 'ef-3', name: 'additional-references.pdf', type: 'application/pdf', size: 734003, role: 'reference', origin: 'expert', uploadedAt: '2026-09-17T09:20:00Z', conversationId: null },
    ],
    deliveryVersions: [
      {
        id: 'dv-1', version: 1, deliveredAt: '2026-09-12T18:00:00Z', status: 'accepted',
        files: [
          { id: 'df-1', name: 'Report_V1.pdf', type: 'application/pdf', size: 2097152 },
          { id: 'df-2', name: 'Appendix_V1.pdf', type: 'application/pdf', size: 524288 },
        ],
        qa: { complete: true, checks: [{ label: 'Requirements reviewed', pass: true }, { label: 'Citation checked', pass: true }] },
        note: 'Initial delivery covering all required sections.',
        revision: { status: 'completed', remaining: 1 },
        explainAndDefend: null,
      },
      {
        id: 'dv-2', version: 2, deliveredAt: '2026-09-19T18:42:00Z', status: 'ready_to_review',
        files: [
          { id: 'df-3', name: 'Final_Report.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 3145728 },
          { id: 'df-4', name: 'Final_Report.pdf', type: 'application/pdf', size: 2621440 },
          { id: 'df-5', name: 'Reference_List.pdf', type: 'application/pdf', size: 104857 },
          { id: 'df-6', name: 'Code_Source.zip', type: 'application/zip', size: 1572864 },
        ],
        qa: { complete: true, checks: [{ label: 'Requirements reviewed', pass: true }, { label: 'Citation checked', pass: true }, { label: 'Files verified', pass: true }] },
        note: 'Revised per feedback — added methodology section and cleaned dataset analysis.',
        revision: { status: 'available', remaining: 1 },
        explainAndDefend: { eligible: true, route: '/student/explain' },
      },
    ],
  },
  {
    id: 'task-2', taskId: 'task-2', title: 'Marketing Strategy Proposal', reference: 'SN-2051',
    subject: 'Business Administration', status: 'IN_PROGRESS', fileCount: 3,
    hasNewDelivery: false, lastActivityAt: '2026-09-18T10:30:00Z',
    expert: { name: 'Jordan K.' },
    sourceFiles: [
      { id: 'sf-5', name: 'assignment-brief.pdf', type: 'application/pdf', size: 921600, role: 'brief', origin: 'student', uploadedAt: '2026-09-16T08:15:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: true },
      { id: 'sf-6', name: 'brand-guidelines-v3.pdf', type: 'application/pdf', size: 3145728, role: 'reference', origin: 'student', uploadedAt: '2026-09-16T08:17:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: false },
    ],
    exchangeFiles: [
      { id: 'ef-4', name: 'competitor-analysis.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 262144, role: 'supporting', origin: 'expert', uploadedAt: '2026-09-18T10:30:00Z', conversationId: 'conv-2' },
    ],
    deliveryVersions: [],
  },
  {
    id: 'task-3', taskId: 'task-3', title: 'Data Structures & Algorithms', reference: 'SN-2038',
    subject: 'Computer Science', status: 'COMPLETED', fileCount: 5,
    hasNewDelivery: false, lastActivityAt: '2026-09-10T16:00:00Z',
    expert: { name: 'Priya S.' },
    sourceFiles: [
      { id: 'sf-7', name: 'problem-set.pdf', type: 'application/pdf', size: 655360, role: 'brief', origin: 'student', uploadedAt: '2026-09-05T12:00:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: true },
      { id: 'sf-8', name: 'grading-rubric.pdf', type: 'application/pdf', size: 204800, role: 'rubric', origin: 'student', uploadedAt: '2026-09-05T12:01:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: true },
    ],
    exchangeFiles: [],
    deliveryVersions: [
      {
        id: 'dv-3', version: 1, deliveredAt: '2026-09-10T16:00:00Z', status: 'accepted',
        files: [
          { id: 'df-7', name: 'Solution_Implementation.py', type: 'text/x-python', size: 15360 },
          { id: 'df-8', name: 'Test_Cases.py', type: 'text/x-python', size: 8192 },
          { id: 'df-9', name: 'Report.pdf', type: 'application/pdf', size: 1572864 },
        ],
        qa: { complete: true, checks: [{ label: 'Code compiles', pass: true }, { label: 'Tests passing', pass: true }, { label: 'Report complete', pass: true }] },
        note: null,
        revision: { status: null, remaining: null },
        explainAndDefend: { eligible: true, route: '/student/explain' },
      },
    ],
  },
  {
    id: 'task-4', taskId: 'task-4', title: 'Nursing Reflective Essay', reference: 'SN-2055',
    subject: 'Nursing', status: 'QUOTE_READY', fileCount: 1,
    hasNewDelivery: false, lastActivityAt: '2026-09-20T09:00:00Z',
    expert: null,
    sourceFiles: [
      { id: 'sf-9', name: 'essay-prompt.pdf', type: 'application/pdf', size: 307200, role: 'brief', origin: 'student', uploadedAt: '2026-09-20T08:45:00Z', uploadedByName: 'You', canReplace: true, canRemove: true, locked: false },
    ],
    exchangeFiles: [],
    deliveryVersions: [],
  },
  {
    id: 'task-5', taskId: 'task-5', title: 'Environmental Impact Assessment', reference: 'SN-2060',
    subject: 'Environmental Science', status: 'REVISION_REQUESTED', fileCount: 7,
    hasNewDelivery: false, lastActivityAt: '2026-09-21T07:30:00Z',
    expert: { name: 'Dr. Chen W.' },
    sourceFiles: [
      { id: 'sf-10', name: 'project-brief.pdf', type: 'application/pdf', size: 1228800, role: 'brief', origin: 'student', uploadedAt: '2026-09-11T10:00:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: true },
      { id: 'sf-11', name: 'site-photos.zip', type: 'application/zip', size: 8388608, role: 'supporting', origin: 'student', uploadedAt: '2026-09-11T10:03:00Z', uploadedByName: 'You', canReplace: false, canRemove: false, locked: false },
    ],
    exchangeFiles: [
      { id: 'ef-5', name: 'preliminary-data.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 409600, role: 'supporting', origin: 'expert', uploadedAt: '2026-09-14T15:00:00Z', conversationId: 'conv-3' },
    ],
    deliveryVersions: [
      {
        id: 'dv-4', version: 1, deliveredAt: '2026-09-18T14:00:00Z', status: 'revision_in_progress',
        files: [
          { id: 'df-10', name: 'Assessment_Draft.pdf', type: 'application/pdf', size: 4194304 },
        ],
        qa: { complete: true, checks: [{ label: 'Structure reviewed', pass: true }, { label: 'Data validated', pass: false }] },
        note: 'Good structure but data analysis needs strengthening in Section 4.',
        revision: { status: 'in_progress', remaining: 0 },
        explainAndDefend: null,
      },
    ],
  },
]

function delay(ms) { return new Promise((r) => setTimeout(r, ms)) }

/* ── API Functions ──────────────────────────────────────────────────────── */

export async function fetchTaskDossiers({ page = 1, perPage = 20, view = 'all', search = '', filters = {}, sort = 'recently-updated', signal } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage), view, sort })
  if (search) params.set('search', search)
  if (filters.task) params.set('task', filters.task)
  if (filters.fileType) params.set('file_type', filters.fileType)
  if (filters.fileRole) params.set('file_role', filters.fileRole)
  if (filters.deliveryVersion) params.set('delivery_version', String(filters.deliveryVersion))
  if (filters.date) params.set('date', filters.date)
  try {
    const response = await fetch(`/api/student/dossiers?${params}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
    if (response.status === 401 || response.status === 403) {
      const error = new Error('STUDENT_ACCESS_REQUIRED')
      error.code = response.status
      throw error
    }
    if (!response.ok) throw new Error(`STUDENT_DOSSIERS_${response.status}`)
    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : payload.dossiers || payload.data || []
    return { dossiers: rows.map(mapDossier), meta: payload.meta || null, facets: payload.facets || null }
  } catch (err) {
    if (err.code === 401 || err.code === 403) throw err
    if (err.name === 'AbortError') throw err
    await delay(400)
    let result = MOCK_DOSSIERS.map(mapDossier)
    if (view === 'my-uploads') result = result.filter((d) => d.sourceFiles.some((f) => f.origin === 'you' || f.origin === 'student'))
    if (view === 'deliveries') result = result.filter((d) => d.deliveryVersions.length > 0)
    if (search) {
      const term = search.toLowerCase()
      result = result.filter((d) => [d.task.title, d.task.reference, d.task.subject, ...d.sourceFiles.map((f) => f.name), ...d.exchangeFiles.map((f) => f.name)].filter(Boolean).join(' ').toLowerCase().includes(term))
    }
    return { dossiers: result, meta: { total: result.length, current_page: 1, last_page: 1 }, facets: null }
  }
}

export async function fetchTaskDossierDetail(taskId, { signal } = {}) {
  try {
    const response = await fetch(`/api/student/dossiers/${encodeURIComponent(taskId)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
    if (response.status === 401 || response.status === 403) {
      const error = new Error('STUDENT_ACCESS_REQUIRED')
      error.code = response.status
      throw error
    }
    if (!response.ok) throw new Error(`STUDENT_DOSSIER_DETAIL_${response.status}`)
    const payload = await response.json()
    return mapDossier(payload.dossier || payload.data || payload)
  } catch (err) {
    if (err.code === 401 || err.code === 403) throw err
    if (err.name === 'AbortError') throw err
    await delay(300)
    const found = MOCK_DOSSIERS.find((d) => d.taskId === taskId || d.id === taskId)
    if (!found) throw new Error('NOT_FOUND')
    return mapDossier(found)
  }
}

export async function fetchDeliveryPackage(taskId, version, { signal } = {}) {
  const params = version ? `?version=${version}` : ''
  const response = await fetch(`/api/student/dossiers/${encodeURIComponent(taskId)}/delivery${params}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_DELIVERY_${response.status}`)
  const payload = await response.json()
  return mapDeliveryVersion(payload.delivery || payload.data || payload)
}

export async function requestFileAccess(fileId, { signal } = {}) {
  try {
    const response = await fetch(`/api/student/files/${encodeURIComponent(fileId)}/access`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
    if (response.status === 401 || response.status === 403) {
      const error = new Error('STUDENT_ACCESS_REQUIRED')
      error.code = response.status
      throw error
    }
    if (!response.ok) throw new Error(`STUDENT_FILE_ACCESS_${response.status}`)
    const payload = await response.json()
    return payload.signedUrl || payload.url || payload.signed_url || null
  } catch (err) {
    if (err.code === 401 || err.code === 403) throw err
    if (err.name === 'AbortError') throw err
    return null
  }
}

export async function uploadTaskFile(taskId, file, { section = 'source', onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('section', section)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/student/dossiers/${encodeURIComponent(taskId)}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) })
    }
    xhr.onload = () => {
      if (xhr.status === 401 || xhr.status === 403) {
        const error = new Error('STUDENT_ACCESS_REQUIRED')
        error.code = xhr.status
        reject(error)
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`STUDENT_UPLOAD_${xhr.status}`))
        return
      }
      try {
        const payload = JSON.parse(xhr.responseText)
        resolve(mapDossierFile(payload.file || payload.data || payload))
      } catch { reject(new Error('STUDENT_UPLOAD_PARSE')) }
    }
    xhr.onerror = () => reject(new Error('STUDENT_UPLOAD_NETWORK'))
    if (signal) signal.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')) })
    xhr.send(formData)
  })
}

export async function removeTaskFile(fileId, { signal } = {}) {
  try {
    const response = await fetch(`/api/student/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' }, signal })
    if (response.status === 401 || response.status === 403) {
      const error = new Error('STUDENT_ACCESS_REQUIRED')
      error.code = response.status
      throw error
    }
    if (!response.ok) throw new Error(`STUDENT_FILE_REMOVE_${response.status}`)
    return true
  } catch (err) {
    if (err.code === 401 || err.code === 403) throw err
    if (err.name === 'AbortError') throw err
    await delay(200)
    return true
  }
}

export async function replaceTaskFile(fileId, file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `/api/student/files/${encodeURIComponent(fileId)}/replace`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) })
    }
    xhr.onload = () => {
      if (xhr.status === 401 || xhr.status === 403) {
        reject(Object.assign(new Error('STUDENT_ACCESS_REQUIRED'), { code: xhr.status }))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`STUDENT_FILE_REPLACE_${xhr.status}`))
        return
      }
      try {
        const payload = JSON.parse(xhr.responseText)
        resolve(mapDossierFile(payload.file || payload.data || payload))
      } catch { reject(new Error('STUDENT_FILE_REPLACE_PARSE')) }
    }
    xhr.onerror = () => reject(new Error('STUDENT_FILE_REPLACE_NETWORK'))
    if (signal) signal.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')) })
    xhr.send(formData)
  })
}

export async function requestRevision(taskId, { note, signal } = {}) {
  try {
    const response = await fetch(`/api/student/dossiers/${encodeURIComponent(taskId)}/revision`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || '' }),
      signal,
    })
    if (response.status === 401 || response.status === 403) {
      const error = new Error('STUDENT_ACCESS_REQUIRED')
      error.code = response.status
      throw error
    }
    if (!response.ok) throw new Error(`STUDENT_REVISION_${response.status}`)
    const payload = await response.json()
    return payload.revision || payload.data || payload
  } catch (err) {
    if (err.code === 401 || err.code === 403) throw err
    if (err.name === 'AbortError') throw err
    await delay(300)
    return { status: 'requested', remaining: 0 }
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function filterDossiers(dossiers, { search, view }) {
  const term = search.trim().toLowerCase()
  return dossiers.filter((d) => {
    if (view === 'my-uploads') {
      const hasUploads = d.sourceFiles.some((f) => f.origin === 'you' || f.origin === 'student') || d.exchangeFiles.some((f) => f.origin === 'you' || f.origin === 'student')
      if (!hasUploads) return false
    }
    if (view === 'deliveries' && d.deliveryVersions.length === 0) return false
    if (!term) return true
    return [d.task.title, d.task.reference, d.task.subject, ...d.sourceFiles.map((f) => f.name), ...d.exchangeFiles.map((f) => f.name)].filter(Boolean).join(' ').toLowerCase().includes(term)
  })
}

export function sortDossiers(dossiers, sort) {
  return [...dossiers].sort((a, b) => {
    if (sort === 'task') return (a.task.title || '').localeCompare(b.task.title || '')
    if (sort === 'name') return (a.task.title || '').localeCompare(b.task.title || '')
    if (sort === 'oldest') return dateValue(a.lastActivityAt) - dateValue(b.lastActivityAt)
    if (sort === 'newest') return dateValue(b.lastActivityAt) - dateValue(a.lastActivityAt)
    return dateValue(b.lastActivityAt) - dateValue(a.lastActivityAt)
  })
}

function dateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function getFileIcon(filename) {
  if (!filename) return 'file'
  const ext = filename.split('.').pop()?.toLowerCase()
  return FILE_TYPE_ICONS[ext] || 'file'
}

export function canPreviewFile(filename) {
  if (!filename) return false
  const ext = filename.split('.').pop()?.toLowerCase()
  return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'txt', 'md', 'json', 'csv'].includes(ext)
}

export { formatDate, formatRelativeTime, getTaskJourney }
