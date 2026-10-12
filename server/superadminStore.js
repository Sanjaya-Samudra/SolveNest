import { getAdminOverview } from './adminStore.js'
import { readTaskStore } from './taskStore.js'
import { readExpertStore } from './expertStore.js'
import { listSupportTickets } from './supportStore.js'
import { supabaseRoleEvents } from './supabase.js'

export async function getSuperadminOverview(services) {
  const [operations, store, tickets, expert] = await Promise.all([getAdminOverview(), readTaskStore(), listSupportTickets(), readExpertStore()])
  return {
    metrics: {
      totalTasks: operations.tasks.length,
      needsReview: operations.metrics.queued,
      inReview: operations.metrics.inReview,
      supportOpen: operations.metrics.supportOpen,
      qaWaiting: operations.metrics.qaWaiting,
    },
    recentTasks: operations.tasks.slice(0, 6),
    recentDecisions: (store.adminAudit || []).slice(0, 6),
    recentSupport: tickets.filter((item) => item.status !== 'resolved').slice(0, 4).map(({ id, categoryLabel, status, createdAt }) => ({ id, categoryLabel, status, createdAt })),
    recentQa: (expert.staffQaAudit || []).slice(0, 4).map(({ id, assignmentId, outcome, at }) => ({ id, assignmentId, outcome, at })),
    services,
  }
}

export async function getSuperadminActivity(includeRoles) {
  const [store, expert, tickets] = await Promise.all([readTaskStore(), readExpertStore(), listSupportTickets()])
  const reviews = (store.adminAudit || []).map((item) => ({ id: item.id, kind: 'review', action: item.action, actor: item.actorId, subject: item.taskId, note: item.note, at: item.at }))
  const quality = (expert.staffQaAudit || []).map((item) => ({ id: item.id, kind: 'quality', action: item.outcome, actor: item.actorId, subject: item.assignmentId, note: item.note, at: item.at }))
  const support = tickets.flatMap((ticket) => (ticket.history || []).map((item) => ({ id: item.id, kind: 'support', action: item.status, actor: item.actorId, subject: ticket.id, note: item.note, at: item.at })))
  const roles = includeRoles ? (await supabaseRoleEvents()).map((item) => ({ id: item.id, kind: 'role', action: `${item.previous_role} → ${item.new_role}`, actor: item.actor_email, subject: item.target_email, note: item.note, at: item.created_at })) : []
  return [...reviews, ...quality, ...support, ...roles].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 50)
}
