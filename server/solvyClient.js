import mammoth from 'mammoth'

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
    estimate: { type: 'OBJECT', nullable: true, properties: { complexity: { type: 'STRING' }, estimatedEffortHours: { type: 'NUMBER' }, suggestedDays: { type: 'NUMBER' }, scope: { type: 'STRING' }, notes: { type: 'STRING' } } },
  },
  required: ['taskType', 'title', 'requiredSections', 'deliverables', 'missingInformation'],
}

function geminiPrompt(operation, payload) {
  if (operation === 'analyze') return `You are Solvy, a careful senior project scoper. Analyze the actual supplied assignment materials, not merely the filename. Extract the exact visible assignment heading as title (never shorten it to a generic label), task type, subject, explicit deadline, citation style, required sections, every material deliverable, rubric criteria, and missing information. Then estimate realistic human support effort. Consider research depth, word/page count, number of deliverables, technical breadth, UI, frontend, backend, database, authentication, integrations, testing, documentation, deployment, and revision risk. Respect explicit duration: a guided 1-3 hour class/group activity or worksheet is usually Low complexity and about 2-3 support hours even when it contains several prompts. A complete application or end-to-end software system is Very high complexity and normally requires at least 16 support hours; do not price it like an essay. Return a short scope explanation and realistic estimatedEffortHours. Do not calculate money; the application applies its pricing policy. Do not invent requirements. Use null or an empty list only when the material truly does not provide a value. File metadata: ${JSON.stringify((payload.files || []).map(({ id, role, name, mimeType, size }) => ({ id, role, name, mimeType, size })))}`
  return `You are Solvy Explain & Defend, a learning assistant. Respond to the student's request in clear language grounded in the supplied context. Never claim to have inspected an artifact when its content was not supplied. Return JSON with grounding set to "general", plainExplanation containing paragraphs and bullets, whyItMatters containing paragraphs and bullets, and trySayingIt as a short practice sentence. Request: ${JSON.stringify(payload)}`
}

async function geminiParts(operation, payload, signal) {
  const parts = [{ text: geminiPrompt(operation, payload) }]
  if (operation !== 'analyze') return parts
  const supported = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
  for (const file of (payload.files || []).slice(0, 6)) {
    if (!file.url) { parts.push({ text: `File ${file.name} was supplied but its content is unavailable.` }); continue }
    const response = await fetch(file.url, { signal })
    if (!response.ok) throw Object.assign(new Error('SOLVY_FILE_FETCH_FAILED'), { code: 'SOLVY_PROVIDER_ERROR', retryable: response.status >= 500 })
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 4 * 1024 * 1024) throw Object.assign(new Error('SOLVY_FILE_TOO_LARGE'), { code: 'SOLVY_PROVIDER_ERROR', retryable: false })
    if (supported.has(file.mimeType)) parts.push({ inlineData: { mimeType: file.mimeType, data: bytes.toString('base64') } })
    else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name || '')) {
      const extracted = await mammoth.extractRawText({ buffer: bytes })
      const documentText = String(extracted.value || '').trim().slice(0, 100_000)
      parts.push({ text: documentText ? `Extracted Word document content from ${file.name}:\n\n${documentText}` : `The Word document ${file.name} contained no readable text.` })
    } else parts.push({ text: `File ${file.name} (${file.mimeType}) was supplied, but its content format is not directly readable in this beta analyzer.` })
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

export async function callSolvy(operation, payload, { timeoutMs = process.env.VERCEL ? 45_000 : 30_000 } = {}) {
  const config = configuration()
  if (circuit.openedAt && Date.now() - circuit.openedAt < RESET_MS) throw Object.assign(new Error('SOLVY_CIRCUIT_OPEN'), { code: 'SOLVY_PROVIDER_UNAVAILABLE' })
  if (circuit.openedAt) Object.assign(circuit, { failures: 0, openedAt: 0 })
  let lastError
  const maxAttempts = process.env.VERCEL ? 1 : 3
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
  const rawEstimate = source.estimate && typeof source.estimate === 'object' && !Array.isArray(source.estimate) ? source.estimate : {}
  const estimate = buildProvisionalEstimate({ ...rawEstimate, taskType: source.taskType, title: source.title, requiredSections: source.requiredSections, deliverables: source.deliverables })
  const result = {
    taskType: text(source.taskType, 100) || 'Academic task', title: text(source.title, 200) || 'New academic task', subject: text(source.subject, 120), deadline: text(source.deadline, 40), citationStyle: text(source.citationStyle, 80),
    requiredSections: list(source.requiredSections), deliverables: list(source.deliverables), missingInformation: list(source.missingInformation), rubric: source.rubric && typeof source.rubric === 'object' && !Array.isArray(source.rubric) ? source.rubric : null, estimate,
  }
  return { ...result, provider: process.env.GEMINI_API_KEY ? 'gemini' : 'solvy', providerVersion: text(payload.version || source.providerVersion, 80), analyzedAt: new Date().toISOString(), provisional: true }
}

export function buildProvisionalEstimate(rawEstimate = {}) {
  const textValue = (value, max = 500) => value == null ? null : String(value).trim().slice(0, max) || null
  const complexityText = textValue(rawEstimate.complexity, 40) || 'Medium'
  const normalizedComplexity = /very\s*high|advanced|extreme/i.test(complexityText) ? 'Very high' : /high|complex/i.test(complexityText) ? 'High' : /low|simple|basic/i.test(complexityText) ? 'Low' : 'Medium'
  const scopeText = [rawEstimate.taskType, rawEstimate.title, rawEstimate.scope, rawEstimate.notes, ...(rawEstimate.requiredSections || []), ...(rawEstimate.deliverables || [])].filter(Boolean).join(' ')
  const softwareSignals = ['application', 'software', 'full stack', 'full-stack', 'frontend', 'backend', 'database', 'api', 'authentication', 'deployment', 'mobile app', 'web app', 'system development'].filter((term) => scopeText.toLowerCase().includes(term))
  const isApplicationProject = softwareSignals.length >= 2 || /(?:build|develop|implement|design)\s+(?:a|an|the)?\s*(?:complete|full|web|mobile|software)?\s*(?:application|system|platform)/i.test(scopeText)
  const isPlatformScale = isApplicationProject && softwareSignals.length >= 5 && /(?:android|ios|admin console|multi[ -]?tenant|multi[ -]?club|role[ -]?based|offline|audit trail|full product|operating platform)/i.test(scopeText)
  const isShortGuidedActivity = !isApplicationProject && /(?:\b[1-3][ -]?hour\b|group activity|class activity|in-class|guided worksheet|workshop activity)/i.test(scopeText)
  const deliverableCount = Array.isArray(rawEstimate.deliverables) ? rawEstimate.deliverables.length : 0
  const scopedComplexity = isApplicationProject ? 'Very high' : isShortGuidedActivity ? 'Low' : deliverableCount >= 6 && normalizedComplexity === 'Medium' ? 'High' : normalizedComplexity
  const defaultHours = { Low: 4, Medium: 6, High: 12, 'Very high': 20 }[scopedComplexity]
  const providerHours = Number(rawEstimate.estimatedEffortHours || rawEstimate.effortHours) || defaultHours
  const scopeMinimumHours = isPlatformScale ? 40 : isApplicationProject ? 16 : isShortGuidedActivity ? 2.5 : deliverableCount >= 6 ? 10 : 2
  const effortHours = isShortGuidedActivity ? Math.min(3, Math.max(scopeMinimumHours, providerHours)) : Math.min(120, Math.max(scopeMinimumHours, providerHours))
  const lowRate = Math.max(100, Number(process.env.SOLVY_LKR_LOW_HOURLY || 1300))
  const highRate = Math.max(lowRate, Number(process.env.SOLVY_LKR_HIGH_HOURLY || 1700))
  const round500 = (value) => Math.max(500, Math.round(value / 500) * 500)
  const categoryFloor = isApplicationProject ? 22000 : scopedComplexity === 'Very high' ? 18000 : 0
  const low = Math.max(categoryFloor, round500(effortHours * lowRate))
  const high = isShortGuidedActivity ? Math.max(low + 500, Math.min(5000, round500(effortHours * highRate))) : Math.max(low + 500, round500(effortHours * highRate))
  const urgency = (id, label, hours, multiplier, note) => {
    const optionLow = round500(low * multiplier)
    const optionHigh = Math.max(optionLow + 500, round500(high * multiplier))
    return { id, label, turnaroundHours: hours, low: optionLow, high: optionHigh, labelPrice: `LKR ${optionLow.toLocaleString('en-US')} – ${optionHigh.toLocaleString('en-US')}`, note }
  }
  const urgencyOptions = [
    urgency('standard', 'Standard delivery', null, 1, 'Best-value schedule confirmed during human review.'),
    urgency('priority', 'Priority 12-hour review', 12, 1.35, 'Expedited scheduling, subject to expert availability and feasible scope.'),
    urgency('rush', 'Rush 6-hour review', 6, 1.75, isApplicationProject ? 'Only a feasible prototype or agreed milestone can be promised in six hours.' : 'Rush delivery requires human confirmation.'),
  ]
  const result = { ...rawEstimate, complexity: scopedComplexity, estimatedEffortHours: effortHours, pricingBasis: isPlatformScale ? 'Platform-scale product scope' : isApplicationProject ? 'End-to-end application scope' : isShortGuidedActivity ? 'Short guided activity' : `${scopedComplexity} complexity`, low, high, currency: 'LKR', label: `LKR ${low.toLocaleString('en-US')} – ${high.toLocaleString('en-US')}`, urgencyOptions, humanReviewRequired: true, provisional: true }
  for (const contextKey of ['taskType', 'title', 'requiredSections', 'deliverables']) delete result[contextKey]
  return result
}
