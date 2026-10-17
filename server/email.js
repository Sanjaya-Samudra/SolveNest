import 'dotenv/config'
import nodemailer from 'nodemailer'
import { readTaskStore } from './taskStore.js'

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === '1', requireTLS: process.env.NODE_ENV === 'production', connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined }) : null
export function hasEmail() { return Boolean(transporter && process.env.SMTP_FROM) }
export async function sendEmail({ to, subject, text, html, replyTo, attachments }) {
  if (!hasEmail()) return { delivered: false, reason: 'SMTP_NOT_CONFIGURED' }
  const suppressed = (await readTaskStore()).emailSuppressions?.some((item) => item.email === String(to || '').trim().toLowerCase() && item.active !== false)
  if (suppressed) return { delivered: false, reason: 'EMAIL_SUPPRESSED' }
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html, replyTo, attachments })
  return { delivered: true }
}
