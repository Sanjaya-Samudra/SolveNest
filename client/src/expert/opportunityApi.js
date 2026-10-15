import { apiFetch } from './expertApi.js'
import { toExpertOpportunity } from './opportunityState.js'

export async function fetchAvailableOpportunities({ limit = 100, offset = 0, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const payload = await apiFetch(`/api/expert/available-tasks?${query}`, { signal })
  return (payload.tasks || []).map(toExpertOpportunity).filter(Boolean)
}

export async function fetchOpportunityBriefing(opportunityId, { signal } = {}) {
  const payload = await apiFetch(`/api/expert/available-tasks/${encodeURIComponent(opportunityId)}`, { signal })
  const found = payload.task ? toExpertOpportunity(payload.task) : null
  if (!found) {
    const error = new Error('OPPORTUNITY_NOT_FOUND')
    error.code = 'OPPORTUNITY_NOT_FOUND'
    throw error
  }
  return found
}

export async function sendOpportunityInterest(opportunityId) {
  try {
    const payload = await apiFetch(`/api/expert/available-tasks/${encodeURIComponent(opportunityId)}/interest`, {
      method: 'POST',
    })
    return { ok: true, interestState: payload.interestState || 'sent', duplicate: false }
  } catch (error) {
    if (error?.code === 'INTEREST_ALREADY_SENT') {
      return { ok: true, interestState: 'sent', duplicate: true }
    }
    if (error?.code === 'TASK_NOT_FOUND') {
      const closed = new Error('OPPORTUNITY_CLOSED')
      closed.code = 'OPPORTUNITY_CLOSED'
      throw closed
    }
    throw error
  }
}
