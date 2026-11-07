const circuit = { failures: 0, openedAt: 0 }
const FAILURE_LIMIT = 5
const RESET_MS = 60_000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function configuration() {
  if (process.env.GEMINI_API_KEY) return { provider: 'gemini', key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite' }
  const url = process.env.SOLVY_API_URL
  if (!url) throw Object.assign(new Error('SOLVY_NOT_CONFIGURED'), { code: 'SOLVY_NOT_CONFIGURED' })
  return { provider: 'http', url, key: process.env.SOLVY_API_KEY || null }
}

const analysisSchema = {
  type: 'OBJECT',
  properties: {
    taskType: { type: 'STRING' }, title: { type: 'STRING' }, subject: { type: 'STRING', nullable: true }, deadline: { type: 'STRING', nullable: true }, citationStyle: { type: 'STRING', nullable: true },
    requiredSections: { type: 'ARRAY', items: { type: 'STRING' } }, deliverables: { type: 'ARRAY', items: { type: 'STRING' } }, missingInformation: { type: 'ARRAY', items: { type: 'STRING' } },
    rubric: { type: 'OBJECT', nullable: true, properties: { criteria: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, label: { type: 'STRING' }, description: { type: 'STRING' } } } } } },
    estimate: { type: 'OBJECT', nullable: true, properties: { complexity: { type: 'STRING' }, suggestedDays: { type: 'NUMBER' }, notes: { type: 'STRING' } } },
  },
  required: ['taskType', 'title', 'requiredSections', 'deliverables', 'missingInformation'],
}

function geminiPrompt(operation, payload) {
  if (operation === 'analyze') return `You are Solvy, an academic task-intake assistant. Analyze only the supplied assignment materials. Extract the task type, concise title, subject, explicit deadline, citation style, required sections, deliverables, rubric criteria, missing information, and a non-binding complexity estimate. Do not invent requirements. Use null or an empty list when the material does not provide a value. File metadata: ${JSON.stringify((payload.files || []).map(({ id, role, name, mimeType, size }) => ({ id, role, name, mimeType, size })))}`
  return `You are Solvy Explain & Defend, a learning assistant. Respond to the student's request in clear language grounded in the supplied context. Never claim to have inspected an artifact when its content was not supplied. Return JSON with grounding set to "general", plainExplanation containing paragraphs and bullets, whyItMatters containing paragraphs and bullets, and trySayingIt as a short practice sentence. Request: ${JSON.stringify(payload)}`
}

async function geminiParts(operation, payload, signal) {
  const parts = [{ text: geminiPrompt(operation, payload) }]
  if (operation !== 'analyze') return parts
  const supported = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
  for (const file of (payload.files || []).slice(0, 6)) {
    if (!file.url || !supported.has(file.mimeType)) { parts.push({ text: `File ${file.name} (${file.mimeType}) was supplied, but this beta analyzer can only read PDF and image content directly.` }); continue }
    const response = await fetch(file.url, { signal })
    if (!response.ok) throw Object.assign(new Error('SOLVY_FILE_FETCH_FAILED'), { code: 'SOLVY_PROVIDER_ERROR', retryable: response.status >= 500 })
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 4 * 1024 * 1024) throw Object.assign(new Error('SOLVY_FILE_TOO_LARGE'), { code: 'SOLVY_PROVIDER_ERROR', retryable: false })
    parts.push({ inlineData: { mimeType: file.mimeType, data: bytes.toString('base64') } })
  }
  return parts
}

async function callGemini(operation, payload, config, signal) {
  const parts = await geminiParts(operation, payload, signal)
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-goog-api-key': config.key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: operation === 'analyze' ? 0.1 : 0.3, responseMimeType: 'application/json', ...(operation === 'analyze' ? { responseSchema: analysisSchema } : {}) } }),
  })
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500
    throw Object.assign(new Error(`GEMINI_${response.status}`), { code: 'SOLVY_PROVIDER_ERROR', retryable })
  }
  const body = await response.json()
  const raw = (body.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim()
  if (!raw) throw Object.assign(new Error('SOLVY_INVALID_RESPONSE'), { code: 'SOLVY_INVALID_RESPONSE', retryable: false })
  try { return { ...(JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''))), version: config.model } }
  catch { throw Object.assign(new Error('SOLVY_INVALID_RESPONSE'), { code: 'SOLVY_INVALID_RESPONSE', retryable: false }) }
}

export async function callSolvy(operation, payload, { timeoutMs = process.env.VERCEL ? 20_000 : 30_000 } = {}) {
  const config = configuration()
  if (circuit.openedAt && Date.now() - circuit.openedAt < RESET_MS) throw Object.assign(new Error('SOLVY_CIRCUIT_OPEN'), { code: 'SOLVY_PROVIDER_UNAVAILABLE' })
  if (circuit.openedAt) Object.assign(circuit, { failures: 0, openedAt: 0 })
  let lastError
  const maxAttempts = process.env.VERCEL ? 2 : 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      if (config.provider === 'gemini') {
        const result = await callGemini(operation, payload, config, controller.signal)
        circuit.failures = 0
        return result
      }
      const response = await fetch(config.url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Solvy-Operation': operation, ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}) }, body: JSON.stringify({ operation, ...payload }) })
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
    if (attempt < maxAttempts - 1) await wait(250 * (2 ** attempt) + Math.floor(Math.random() * 100))
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
  return { ...result, provider: process.env.GEMINI_API_KEY ? 'gemini' : 'solvy', providerVersion: text(payload.version || source.providerVersion, 80), analyzedAt: new Date().toISOString(), provisional: true }
}
