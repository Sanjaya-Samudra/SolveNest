import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'account.json')

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
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(emptyAccount('demo-student'), null, 2))
  }
}

function readAccount(studentId) {
  ensureStore()
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid')
    const base = emptyAccount(studentId)
    return {
      ...base,
      ...parsed,
      studentId: parsed.studentId || studentId,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      security: { ...base.security, ...(parsed.security || {}) },
      preferences: { ...base.preferences, ...(parsed.preferences || {}) },
      privacyControls: { ...base.privacyControls, ...(parsed.privacyControls || {}) },
      policyConsents: Array.isArray(parsed.policyConsents) ? parsed.policyConsents : [],
    }
  } catch {
    const fresh = emptyAccount(studentId)
    fs.writeFileSync(storePath, JSON.stringify(fresh, null, 2))
    return fresh
  }
}

function writeAccount(account) {
  ensureStore()
  fs.writeFileSync(storePath, JSON.stringify(account, null, 2))
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

export function getAccountView({ student, sessions = [], activeSessionId = null, activeTasks = 0 }) {
  const account = readAccount(student?.studentId || 'demo-student')
  const name = student?.name || account.profile.fullName || ''
  const memberSince = formatWhen(account.createdAt)

  return {
    identity: {
      studentId: student?.studentId || account.studentId || null,
      name,
      email: student?.email || null,
      emailVerified: Boolean(account.security.emailVerified),
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
      emailVerified: Boolean(account.security.emailVerified),
      passwordChangeSupported: Boolean(account.security.passwordChangeSupported),
      twoStepSupported: false,
    },
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...account.preferences,
    },
    privacyControls: {
      dataExport: Boolean(account.privacyControls.dataExport),
      accountClosure: Boolean(account.privacyControls.accountClosure),
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
      dataExport: Boolean(account.privacyControls.dataExport),
      accountClosure: Boolean(account.privacyControls.accountClosure),
      sessionRevoke: true,
      logout: true,
    },
  }
}

export function updateProfile(studentId, patch = {}) {
  const account = readAccount(studentId)
  if ('fullName' in patch) account.profile.fullName = cleanString(patch.fullName) ?? account.profile.fullName
  if ('preferredName' in patch) account.profile.preferredName = cleanString(patch.preferredName) ?? account.profile.preferredName
  if ('institution' in patch) account.profile.institution = cleanString(patch.institution) ?? account.profile.institution
  if ('program' in patch) account.profile.program = cleanString(patch.program) ?? account.profile.program
  writeAccount(account)
  return account
}

export function updatePreferences(studentId, patch = {}) {
  const account = readAccount(studentId)
  for (const key of PREFERENCE_KEYS) {
    if (key in patch && typeof patch[key] === 'boolean') {
      account.preferences[key] = patch[key]
    }
  }
  writeAccount(account)
  return account
}
