import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { hasSupabase, supabaseReadStudentAccount, supabaseWriteStudentAccount } from './supabase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'account.json')
const accountsDir = path.join(dataDir, 'accounts')

const DEFAULT_PREFERENCES = {
  inApp: true,
  email: false,
  tasks: true,
  messages: true,
  payments: false,
}

const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES)

function emptyAccount(studentId) {
  return {
    studentId,
    createdAt: new Date().toISOString(),
    profile: {
      fullName: '',
      preferredName: '',
      institution: '',
      program: '',
    },
    security: {
      passwordChangedAt: null,
      twoStepEnabled: false,
      emailVerified: false,
      passwordChangeSupported: false,
    },
    preferences: { ...DEFAULT_PREFERENCES },
    privacyControls: {
      dataExport: false,
      accountClosure: false,
      activeTaskBlock: false,
    },
    policyConsents: [],
  }
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir, { recursive: true })
}

function accountPath(studentId) {
  return path.join(accountsDir, `${crypto.createHash('sha256').update(String(studentId)).digest('hex')}.json`)
}

async function readAccount(studentId) {
  const remote = hasSupabase()
  if (remote) {
    const parsed = await supabaseReadStudentAccount(studentId)
    if (!parsed) return emptyAccount(studentId)
    if (parsed.studentId !== studentId) throw new Error('ACCOUNT_OWNER_MISMATCH')
    return mergeAccount(studentId, parsed)
  }
  ensureStore()
  const target = accountPath(studentId)
  try {
    // Only the original demo account may inherit the legacy single-account file.
    const source = !fs.existsSync(target) && studentId === 'demo-student' && fs.existsSync(storePath) ? storePath : target
    const parsed = JSON.parse(fs.readFileSync(source, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || (source === target && parsed.studentId !== studentId)) throw new Error('invalid')
    return mergeAccount(studentId, parsed)
  } catch {
    return emptyAccount(studentId)
  }
}

function mergeAccount(studentId, parsed) {
  const base = emptyAccount(studentId)
  return {
    ...base,
    ...parsed,
    studentId,
    profile: { ...base.profile, ...(parsed.profile || {}) },
    security: { ...base.security, ...(parsed.security || {}) },
    preferences: { ...base.preferences, ...(parsed.preferences || {}) },
    privacyControls: { ...base.privacyControls, ...(parsed.privacyControls || {}) },
    policyConsents: Array.isArray(parsed.policyConsents) ? parsed.policyConsents : [],
  }
}

async function writeAccount(account) {
  if (hasSupabase()) return supabaseWriteStudentAccount(account.studentId, account)
  ensureStore()
  const target = accountPath(account.studentId)
  const temporary = `${target}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(account, null, 2))
  fs.renameSync(temporary, target)
}

function cleanString(value, max = 160) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (!text) return ''
  return text.slice(0, max)
}

function formatWhen(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export async function getAccountView({ student, sessions = [], activeSessionId = null, activeTasks = 0, sessionRevoke = true }) {
  const account = await readAccount(student?.studentId || 'demo-student')
  const name = account.profile.fullName || student?.name || ''
  const memberSince = formatWhen(student?.createdAt || account.createdAt)

  return {
    identity: {
      studentId: student?.studentId || account.studentId || null,
      name,
      email: student?.email || null,
      emailVerified: Boolean(student?.emailVerified ?? account.security.emailVerified),
      memberSince,
      avatarUrl: student?.avatarUrl || null,
    },
    profile: {
      fullName: account.profile.fullName || '',
      preferredName: account.profile.preferredName || '',
      institution: account.profile.institution || '',
      program: account.profile.program || '',
    },
    security: {
      passwordChangedAt: formatWhen(account.security.passwordChangedAt),
      twoStepEnabled: Boolean(account.security.twoStepEnabled),
      emailVerified: Boolean(student?.emailVerified ?? account.security.emailVerified),
      passwordChangeSupported: Boolean(account.security.passwordChangeSupported),
      twoStepSupported: false,
    },
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...account.preferences,
    },
    privacyControls: {
      dataExport: true,
      accountClosure: true,
      activeTaskBlock: activeTasks > 0,
      policyNoticeRoute: null,
    },
    policyConsents: account.policyConsents.map((item) => ({
      id: item.id,
      title: item.title,
      version: item.version || null,
      acceptedAt: formatWhen(item.acceptedAt),
    })),
    activeSessions: sessions.map((session) => ({
      id: session.id,
      device: session.device || 'This device',
      lastActiveAt: formatWhen(session.lastActiveAt || session.createdAt),
      current: session.id === activeSessionId,
    })),
    capabilities: {
      profileEdit: true,
      preferencesEdit: true,
      passwordChange: Boolean(account.security.passwordChangeSupported),
      twoStepSetup: false,
      dataExport: true,
      accountClosure: true,
      sessionRevoke,
      logout: true,
    },
  }
}

export async function updateProfile(studentId, patch = {}) {
  const account = await readAccount(studentId)
  if ('fullName' in patch) account.profile.fullName = cleanString(patch.fullName) ?? account.profile.fullName
  if ('preferredName' in patch) account.profile.preferredName = cleanString(patch.preferredName) ?? account.profile.preferredName
  if ('institution' in patch) account.profile.institution = cleanString(patch.institution) ?? account.profile.institution
  if ('program' in patch) account.profile.program = cleanString(patch.program) ?? account.profile.program
  await writeAccount(account)
  return account
}

export async function updatePreferences(studentId, patch = {}) {
  const account = await readAccount(studentId)
  for (const key of PREFERENCE_KEYS) {
    if (key in patch && typeof patch[key] === 'boolean') {
      account.preferences[key] = patch[key]
    }
  }
  await writeAccount(account)
  return account
}

export async function recordAccountRegistration(studentId, { name = '', emailVerified = false, createdAt = null, policyConsents = [] } = {}) {
  const account = await readAccount(studentId)
  if (createdAt) account.createdAt = createdAt
  if (name && !account.profile.fullName) account.profile.fullName = cleanString(name) || ''
  account.security.emailVerified = Boolean(emailVerified)
  account.policyConsents = (Array.isArray(policyConsents) ? policyConsents : []).map((item) => ({ id: String(item.id || ''), title: String(item.title || item.id || ''), version: String(item.version || ''), acceptedAt: item.acceptedAt || new Date().toISOString() })).filter((item) => item.id && item.version)
  await writeAccount(account)
  return account
}
