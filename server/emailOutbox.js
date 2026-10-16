import { sendEmail } from './email.js'
import { hasSupabase, supabaseClaimEmailOutbox, supabaseCompleteEmailOutbox } from './supabase.js'

let draining = false

export async function drainEmailOutbox() {
  if (draining || !hasSupabase()) return
  draining = true
  try {
    const messages = await supabaseClaimEmailOutbox(10)
    for (const message of messages) {
      try {
        const result = await sendEmail({ to: message.to_email, subject: message.subject, text: message.body_text, replyTo: message.reply_to || undefined })
        await supabaseCompleteEmailOutbox(message.id, Boolean(result.delivered), result.delivered ? null : 'EMAIL_NOT_DELIVERED')
      } catch (error) {
        await supabaseCompleteEmailOutbox(message.id, false, error.message).catch(() => {})
      }
    }
  } finally { draining = false }
}
