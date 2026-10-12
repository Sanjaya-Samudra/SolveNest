import crypto from 'node:crypto'
import { getCatalog, listTickets as listLegacyTickets } from './helpStore.js'
import { hasSupabase } from './supabase.js'
import { readTaskStore, withTaskStore } from './taskStore.js'

function allTickets(store) {
  const current = Array.isArray(store.supportTickets) ? store.supportTickets : []
  if (hasSupabase()) return current
  const known = new Set(current.map((ticket) => String(ticket.id)))
  return [...current, ...listLegacyTickets().filter((ticket) => !known.has(String(ticket.id)))]
}

const byNewest = (a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
const studentView = ({ history, internalNotes, ...ticket }) => ticket

export async function listSupportTickets() {
  return allTickets(await readTaskStore()).sort(byNewest)
}

export async function getSupportTicket(id) {
  return allTickets(await readTaskStore()).find((ticket) => String(ticket.id) === String(id)) || null
}

export async function listStudentSupportTickets(studentId) {
  return (await listSupportTickets()).filter((ticket) => ticket.context?.studentId === studentId).map(studentView)
}

export async function getStudentSupportTicket(studentId, id) {
  const ticket = await getSupportTicket(id)
  return ticket?.context?.studentId === studentId ? studentView(ticket) : null
}

export async function createSupportTicket({ student, category, issue, taskId, message }) {
  const catalog = getCatalog()
  const categoryDef = catalog.categories.find((item) => item.key === category)
  const issueDef = (catalog.issues[category] || []).find((item) => item.key === issue)
  return withTaskStore((store) => {
    const task = store.tasks.find((item) => item.id === taskId && item.studentId === student.studentId)
    const stamp = new Date().toISOString()
    const ticket = {
      id: `SN-SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      status: 'received',
      category: category || 'general',
      categoryLabel: categoryDef?.label || 'General',
      issue: issue || null,
      issueLabel: issueDef?.label || null,
      taskId: task?.id || null,
      taskTitle: task?.title || null,
      message: String(message).trim(),
      context: { studentId: student.studentId, studentName: student.name || null, taskState: task?.status || null },
      createdAt: stamp,
      updatedAt: stamp,
      history: [],
      studentUpdates: [],
    }
    store.supportTickets = Array.isArray(store.supportTickets) ? store.supportTickets : []
    store.supportTickets.unshift(ticket)
    return studentView(ticket)
  })
}

export async function updateSupportTicket(id, actorId, status, note, studentMessage = '') {
  const allowed = new Set(['received', 'in_progress', 'waiting_on_student', 'resolved'])
  const cleanNote = String(note || '').trim().slice(0, 2000)
  const cleanStudentMessage = String(studentMessage || '').trim().slice(0, 2000)
  if (!allowed.has(status)) return { error: 'INVALID_STATUS' }
  if (cleanNote.length < 10) return { error: 'NOTE_REQUIRED' }
  if (status === 'waiting_on_student' && cleanStudentMessage.length < 10) return { error: 'STUDENT_MESSAGE_REQUIRED' }
  return withTaskStore((store) => {
    store.supportTickets = Array.isArray(store.supportTickets) ? store.supportTickets : []
    let ticket = store.supportTickets.find((item) => String(item.id) === String(id))
    if (!ticket && !hasSupabase()) {
      const legacy = listLegacyTickets().find((item) => String(item.id) === String(id))
      if (legacy) {
        ticket = { ...legacy, history: [] }
        store.supportTickets.unshift(ticket)
      }
    }
    if (!ticket) return { error: 'TICKET_NOT_FOUND' }
    if (ticket.status === status) return { error: 'STATUS_UNCHANGED' }
    const stamp = new Date().toISOString()
    ticket.status = status
    ticket.updatedAt = stamp
    ticket.history = Array.isArray(ticket.history) ? ticket.history : []
    ticket.history.unshift({ id: crypto.randomUUID(), actorId, status, note: cleanNote, at: stamp })
    ticket.studentUpdates = Array.isArray(ticket.studentUpdates) ? ticket.studentUpdates : []
    if (cleanStudentMessage) ticket.studentUpdates.unshift({ id: crypto.randomUUID(), status, message: cleanStudentMessage, at: stamp })
    return { ok: true, ticket }
  })
}
