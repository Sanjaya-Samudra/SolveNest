import { getAccountView } from './accountStore.js'
import { readTaskStore } from './taskStore.js'
import { listStudentSupportTickets } from './supportStore.js'

const select = (record, fields) => Object.fromEntries(fields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]))

export async function exportStudentAccount(student) {
  const state = await readTaskStore()
  const owned = (collection) => (state[collection] || []).filter((record) => record.studentId === student.studentId)
  const account = await getAccountView({ student })
  // Whitelist public fields: storage keys, signed URLs, staff notes and provider secrets stay private.
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    account: { identity: account.identity, profile: account.profile, preferences: account.preferences, policyConsents: account.policyConsents },
    tasks: owned('tasks').map((item) => select(item, ['id', 'title', 'type', 'subject', 'deadline', 'status', 'createdAt', 'updatedAt'])),
    files: owned('files').map((item) => select(item, ['id', 'taskId', 'originalName', 'role', 'mimeType', 'size', 'createdAt'])),
    payments: owned('payments').map((item) => select(item, ['id', 'taskId', 'amount', 'currency', 'status', 'milestoneName', 'createdAt'])),
    plans: owned('plans').map((item) => select(item, ['id', 'taskId', 'reference', 'status', 'amount', 'currency', 'scope', 'delivery', 'createdAt', 'acceptedAt'])),
    conversations: owned('conversations').map((item) => select(item, ['id', 'taskId', 'taskTitle', 'createdAt', 'updatedAt'])),
    messages: owned('messages').map((item) => select(item, ['id', 'conversationId', 'body', 'from', 'author', 'role', 'createdAt'])),
    supportRequests: (await listStudentSupportTickets(student.studentId)).map((item) => select(item, ['id', 'status', 'categoryLabel', 'issueLabel', 'taskId', 'message', 'createdAt', 'updatedAt', 'studentUpdates'])),
    note: 'This export contains account and workspace records. Download original files and delivery files separately from Files.',
  }
}
