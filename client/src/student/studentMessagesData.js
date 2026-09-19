import { formatDate, formatRelativeTime, getTaskJourney } from './studentDashboardData.js'

export const STAGES = ['Requested', 'Assigned', 'In Progress', 'Quality Review', 'Delivered']

export const STAGE_MAP = {
  REQUESTED: 0, ASSIGNED: 1, IN_PROGRESS: 2, QUALITY_REVIEW: 3, DELIVERED: 4,
  DRAFT: 0, SUBMITTED: 0, VALIDATING: 0, AI_ANALYZED: 1, NEEDS_INFORMATION: 0,
  FEASIBILITY_REVIEW: 1, QUOTE_READY: 1, AWAITING_ACCEPTANCE: 1,
  PAYMENT_PENDING: 2, PAID: 2, ASSIGNMENT_PENDING: 2,
  REVISION_REQUESTED: 3, REVISION_IN_PROGRESS: 2,
  COMPLETED: 4, DECLINED: 4, CANCELLED: 4, DISPUTED: 3,
}

function mapConversation(raw) {
  const stageIndex = STAGE_MAP[String(raw?.status || raw?.taskStatus || '').toUpperCase()] ?? 0
  const lastMessage = raw?.lastMessage || raw?.latestMessage || null
  const lastAt = lastMessage?.createdAt || lastMessage?.at || raw?.lastActivityAt || raw?.updatedAt
  return {
    id: raw?.id || raw?.uuid,
    taskId: raw?.taskId || raw?.task_id,
    taskTitle: raw?.taskTitle || raw?.task_title || raw?.title || 'Untitled task',
    taskRef: raw?.taskRef || raw?.task_ref || raw?.reference || '',
    subject: raw?.subject || raw?.domain || '',
    stageIndex,
    state: raw?.state || raw?.conversationState || 'active',
    needsStudent: Boolean(raw?.needsStudent || raw?.needs_student),
    needsReason: raw?.needsReason || raw?.needs_student_reason || '',
    unread: Number(raw?.unread || raw?.unreadCount || 0),
    participant: {
      name: raw?.participant?.name || raw?.expertName || 'SolveNest',
      role: raw?.participant?.role || raw?.expertRole || 'Support',
      initials: raw?.participant?.initials || raw?.expertInitials || 'SN',
      avatar: raw?.participant?.avatar || raw?.expertAvatar || null,
      expertise: raw?.participant?.expertise || raw?.expertise || null,
    },
    lastAt: lastAt ? new Date(lastAt) : new Date(),
    lastPreview: lastMessage?.body || lastMessage?.text || raw?.lastPreview || '',
    lastIsSystem: Boolean(lastMessage?.from === 'system' || lastMessage?.from === 'system_person'),
    deadline: raw?.deadline || raw?.taskDeadline || null,
    plan: raw?.plan || raw?.taskPlan || '',
    fileCount: Number(raw?.fileCount || raw?.file_count || 0),
    files: Array.isArray(raw?.files) ? raw.files.map(mapFile) : [],
  }
}

function mapFile(raw) {
  return {
    id: raw?.id || raw?.uuid,
    name: raw?.name || raw?.filename || 'file',
    type: raw?.type || raw?.fileType || 'File',
    size: raw?.size || raw?.formattedSize || '',
    uploadedBy: raw?.uploadedBy || raw?.uploaded_by || '',
    uploadedAt: raw?.uploadedAt || raw?.uploaded_at ? new Date(raw.uploadedAt || raw.uploaded_at) : null,
  }
}

function mapMessage(raw) {
  const from = raw?.from || raw?.senderRole || 'system_person'
  return {
    id: raw?.id || raw?.uuid,
    kind: raw?.kind || 'message',
    from,
    author: raw?.author || raw?.senderName || 'SolveNest',
    role: raw?.role || raw?.senderRole || 'Support',
    initials: raw?.initials || raw?.senderInitials || 'SN',
    at: raw?.at || raw?.createdAt ? new Date(raw.at || raw.createdAt) : new Date(),
    body: raw?.body || raw?.text || '',
    status: raw?.status || null,
    event: raw?.event || null,
    title: raw?.title || null,
    action: raw?.action || null,
    label: raw?.label || null,
    needsResponse: Boolean(raw?.needsResponse || raw?.needs_response),
    attachments: Array.isArray(raw?.attachments) ? raw.attachments.map(mapFile) : [],
  }
}

export async function fetchStudentConversations({ signal } = {}) {
  const response = await fetch('/api/student/conversations', { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_CONVERSATIONS_${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : payload.conversations || payload.data || []
  return rows.map(mapConversation)
}

export async function fetchStudentMessages(conversationId, { page = 1, perPage = 50, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  const response = await fetch(`/api/student/conversations/${encodeURIComponent(conversationId)}/messages?${params}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_MESSAGES_${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : payload.messages || payload.data || []
  return { messages: rows.map(mapMessage), meta: payload.meta || null }
}

export async function sendStudentMessage(conversationId, { text, fileId } = {}) {
  const body = { body: text }
  if (fileId) body.fileId = fileId
  const response = await fetch(`/api/student/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) {
    let message = 'Could not send message.'
    try { message = (await response.json()).message || message } catch {}
    throw new Error(message)
  }
  const payload = await response.json()
  return mapMessage(payload.message || payload.data || payload)
}

export async function markConversationRead(conversationId) {
  const response = await fetch(`/api/student/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 401 || response.status === 403) {
    const error = new Error('STUDENT_ACCESS_REQUIRED')
    error.code = response.status
    throw error
  }
  if (!response.ok) throw new Error(`STUDENT_MARK_READ_${response.status}`)
  return true
}

export async function uploadConversationFile(conversationId, file, onProgress) {
  const body = new FormData()
  body.append('file', file)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/student/conversations/${encodeURIComponent(conversationId)}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) }
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(mapFile(JSON.parse(xhr.responseText))) } catch { reject(new Error('Invalid upload response.')) }
      } else { reject(new Error('Upload failed.')) }
    }
    xhr.onerror = () => reject(new Error('Upload failed.'))
    xhr.send(body)
  })
}

export { formatDate, formatRelativeTime, getTaskJourney }
