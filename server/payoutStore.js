import crypto from 'node:crypto'
import { readTaskStore, withTaskStore } from './taskStore.js'

const commissionRate = () => Math.min(0.9, Math.max(0, Number(process.env.PLATFORM_COMMISSION_RATE || 0.2)))

export async function expertEarnings(expertId, assignments) {
  const state = await readTaskStore()
  const delivered = assignments.filter((item) => item.workState === 'delivered')
  const requests = (state.payoutRequests || []).filter((item) => item.expertId === expertId)
  const requestedTaskIds = new Set(requests.flatMap((item) => item.taskIds || []))
  const rows = delivered.map((assignment) => {
    const payments = state.payments.filter((item) => item.taskId === assignment.taskId && ['succeeded', 'partially_refunded', 'refunded'].includes(item.status))
    const gross = payments.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0) - Number(item.refundedAmount || 0)), 0)
    const fee = Math.round(gross * commissionRate())
    return { assignmentId: assignment.id, taskId: assignment.taskId, title: assignment.title, deliveredAt: assignment.workspace?.delivery?.deliveredAt || assignment.updatedAt, currency: payments[0]?.currency || 'lkr', gross, platformFee: fee, net: gross - fee, payoutState: requestedTaskIds.has(assignment.taskId) ? 'requested' : gross > 0 ? 'available' : 'unfunded' }
  })
  const totals = rows.reduce((value, row) => ({ gross: value.gross + row.gross, fees: value.fees + row.platformFee, net: value.net + row.net, available: value.available + (row.payoutState === 'available' ? row.net : 0) }), { gross: 0, fees: 0, net: 0, available: 0 })
  return { rows, requests: requests.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), totals, commissionRate: commissionRate() }
}

export async function requestExpertPayout(expert, assignments, input = {}) {
  const snapshot = await expertEarnings(expert.id, assignments)
  const selected = new Set(Array.isArray(input.taskIds) ? input.taskIds.map(String) : snapshot.rows.filter((row) => row.payoutState === 'available').map((row) => row.taskId))
  const rows = snapshot.rows.filter((row) => selected.has(row.taskId) && row.payoutState === 'available')
  if (!rows.length) return { error: 'NO_EARNINGS_AVAILABLE' }
  const currencies = new Set(rows.map((row) => row.currency))
  if (currencies.size !== 1) return { error: 'PAYOUT_CURRENCY_MISMATCH' }
  return withTaskStore((store) => {
    store.payoutRequests ||= []
    if (store.payoutRequests.some((item) => !['rejected', 'paid', 'cancelled'].includes(item.status) && item.taskIds.some((id) => selected.has(id)))) return { error: 'PAYOUT_ALREADY_REQUESTED' }
    const stamp = new Date().toISOString()
    const request = { id: `SN-PAY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, expertId: expert.id, expertName: expert.name, taskIds: rows.map((row) => row.taskId), assignmentIds: rows.map((row) => row.assignmentId), amount: rows.reduce((sum, row) => sum + row.net, 0), gross: rows.reduce((sum, row) => sum + row.gross, 0), platformFee: rows.reduce((sum, row) => sum + row.platformFee, 0), currency: rows[0].currency, status: 'pending', createdAt: stamp, updatedAt: stamp, history: [{ id: crypto.randomUUID(), action: 'requested', actorId: expert.id, at: stamp }] }
    store.payoutRequests.unshift(request)
    return { request }
  })
}

export async function listPayoutRequests() { return (await readTaskStore()).payoutRequests || [] }

export async function decidePayout(id, actor, input = {}) {
  const status = String(input.status || '')
  const note = String(input.note || '').trim().slice(0, 2000)
  const reference = String(input.reference || '').trim().slice(0, 200)
  if (!['approved', 'rejected', 'paid'].includes(status) || note.length < 10 || (status === 'paid' && reference.length < 4)) return { error: 'PAYOUT_DECISION_INVALID' }
  return withTaskStore((store) => {
    const request = (store.payoutRequests || []).find((item) => item.id === id)
    if (!request) return { error: 'PAYOUT_NOT_FOUND' }
    const allowed = request.status === 'pending' ? ['approved', 'rejected'] : request.status === 'approved' ? ['paid', 'rejected'] : []
    if (!allowed.includes(status)) return { error: 'PAYOUT_STATE_CHANGED' }
    const stamp = new Date().toISOString()
    request.status = status; request.updatedAt = stamp; request.paymentReference = status === 'paid' ? reference : request.paymentReference
    request.history.unshift({ id: crypto.randomUUID(), action: status, actorId: actor.id, actorName: actor.name, note, reference: reference || null, at: stamp })
    return { request: structuredClone(request) }
  })
}
