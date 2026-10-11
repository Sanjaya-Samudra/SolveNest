import { getAdminOverview } from './adminStore.js'
import { readTaskStore } from './taskStore.js'
import { supabaseRoleEvents } from './supabase.js'

export async function getSuperadminOverview(services) {
  const [operations, store] = await Promise.all([getAdminOverview(), readTaskStore()])
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
    services,
  }
}

export async function getSuperadminActivity(includeRoles) {
  const store = await readTaskStore()
  const reviews = (store.adminAudit || []).map((item) => ({ id: item.id, kind: 'review', action: item.action, actor: item.actorId, subject: item.taskId, note: item.note, at: item.at }))
  const roles = includeRoles ? (await supabaseRoleEvents()).map((item) => ({ id: item.id, kind: 'role', action: `${item.previous_role} → ${item.new_role}`, actor: item.actor_email, subject: item.target_email, note: item.note, at: item.created_at })) : []
  return [...reviews, ...roles].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 50)
}
