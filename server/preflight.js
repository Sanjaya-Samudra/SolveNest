import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(directory, '.env.production'), quiet: true })
const issues = []
const required = ['PUBLIC_APP_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'FILE_SIGNING_SECRET', 'SOLVY_API_URL', 'SOLVY_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_FROM', 'CONTACT_EMAIL', 'CLAMD_HOST']
for (const name of required) {
  if (!process.env[name] || /replace-(?:me|with)|your-domain|your-project|\.example(?:[\/>]|$)/i.test(process.env[name])) issues.push(`${name}: missing or placeholder`)
}
for (const name of ['PUBLIC_APP_URL', 'SUPABASE_URL', 'SOLVY_API_URL']) {
  try { const url = new URL(process.env[name]); if (url.protocol !== 'https:' || url.username || url.password) throw new Error() } catch { issues.push(`${name}: must be an HTTPS URL without embedded credentials`) }
}
if ((process.env.FILE_SIGNING_SECRET || '').length < 32) issues.push('FILE_SIGNING_SECRET: must contain at least 32 characters')
if ((process.env.STRIPE_CURRENCY || 'lkr').toLowerCase() !== 'lkr') issues.push('STRIPE_CURRENCY: current quotes use LKR')
if (process.env.NODE_ENV !== 'production') issues.push('NODE_ENV: must be production')
const hops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (!Number.isInteger(hops) || hops < 0 || hops > 3) issues.push('TRUST_PROXY_HOPS: must be an integer from 0 to 3')
if (!fs.existsSync(path.resolve(directory, '../client/dist/index.html'))) issues.push('Client build is missing: run npm run build')
if (issues.length) {
  console.error('Production configuration needs attention:\n' + issues.map((issue) => `- ${issue}`).join('\n'))
  process.exitCode = 1
} else console.log('Configuration format is valid. Provider connectivity and launch verification are still required.')
