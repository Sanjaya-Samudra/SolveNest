import 'dotenv/config'
import nodemailer from 'nodemailer'

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === '1', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined }) : null
export function hasEmail() { return Boolean(transporter && process.env.SMTP_FROM) }
export async function sendEmail({ to, subject, text, html }) {
  if (!hasEmail()) return { delivered: false, reason: 'SMTP_NOT_CONFIGURED' }
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html })
  return { delivered: true }
}
