const circuit = { failures: 0, openedAt: 0 }
const FAILURE_LIMIT = 5
const RESET_MS = 60_000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function configuration() {
  const url = process.env.SOLVY_API_URL
  if (!url) throw Object.assign(new Error('SOLVY_NOT_CONFIGURED'), { code: 'SOLVY_NOT_CONFIGURED' })
  return { url, key: process.env.SOLVY_API_KEY || null }
}

export async function callSolvy(operation, payload, { timeoutMs = 30_000 } = {}) {
  const { url, key } = configuration()
  if (circuit.openedAt && Date.now() - circuit.openedAt < RESET_MS) throw Object.assign(new Error('SOLVY_CIRCUIT_OPEN'), { code: 'SOLVY_PROVIDER_UNAVAILABLE' })
  if (circuit.openedAt) Object.assign(circuit, { failures: 0, openedAt: 0 })
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Solvy-Operation': operation, ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ operation, ...payload }) })
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        const error = Object.assign(new Error(`SOLVY_${response.status}`), { code: 'SOLVY_PROVIDER_ERROR', retryable })
        if (!retryable) throw error
        lastError = error
      } else {
        const result = await response.json()
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw Object.assign(new Error('SOLVY_INVALID_RESPONSE'), { code: 'SOLVY_INVALID_RESPONSE' })
        circuit.failures = 0
        return result
      }
    } catch (error) {
      lastError = error
      if (error.code === 'SOLVY_INVALID_RESPONSE' || error.retryable === false) break
    } finally { clearTimeout(timeout) }
    if (attempt < 2) await wait(250 * (2 ** attempt) + Math.floor(Math.random() * 100))
  }
  circuit.failures += 1
  if (circuit.failures >= FAILURE_LIMIT) circuit.openedAt = Date.now()
  throw Object.assign(lastError || new Error('SOLVY_PROVIDER_ERROR'), { code: lastError?.code || 'SOLVY_PROVIDER_ERROR' })
}

export function normalizeSolvyAnalysis(payload) {
  const source = payload.analysis || payload.result || payload
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw Object.assign(new Error('SOLVY_INVALID_RESPONSE'), { code: 'SOLVY_INVALID_RESPONSE' })
  const text = (value, max = 500) => value == null ? null : String(value).trim().slice(0, max) || null
  const list = (value, max = 20) => Array.isArray(value) ? value.slice(0, max).map((item) => typeof item === 'string' ? item.slice(0, 500) : item).filter(Boolean) : []
  const result = {
    taskType: text(source.taskType, 100) || 'Academic task', title: text(source.title, 200) || 'New academic task', subject: text(source.subject, 120), deadline: text(source.deadline, 40), citationStyle: text(source.citationStyle, 80),
    requiredSections: list(source.requiredSections), deliverables: list(source.deliverables), missingInformation: list(source.missingInformation), rubric: source.rubric && typeof source.rubric === 'object' && !Array.isArray(source.rubric) ? source.rubric : null, estimate: source.estimate && typeof source.estimate === 'object' && !Array.isArray(source.estimate) ? source.estimate : null,
  }
  return { ...result, provider: 'solvy', providerVersion: text(payload.version || source.providerVersion, 80), analyzedAt: new Date().toISOString(), provisional: true }
}
