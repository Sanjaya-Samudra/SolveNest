import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProvisionalEstimate, callSolvy, normalizeSolvyAnalysis } from './solvyClient.js'

test('Gemini provider returns normalized Solvy analysis JSON', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY
  const previousModel = process.env.GEMINI_MODEL
  const previousFetch = globalThis.fetch
  process.env.GEMINI_API_KEY = 'test-gemini-key'
  process.env.GEMINI_MODEL = 'gemini-test-model'
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = previousKey
    if (previousModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = previousModel
    globalThis.fetch = previousFetch
  })

  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /gemini-test-model:generateContent$/)
    assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key')
    const request = JSON.parse(options.body)
    assert.equal(request.generationConfig.responseMimeType, 'application/json')
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ taskType: 'Report', title: 'Research report', subject: 'Business', deadline: null, citationStyle: 'APA 7', requiredSections: ['Introduction'], deliverables: ['Report'], missingInformation: ['deadline'], rubric: null, estimate: { complexity: 'Medium', suggestedDays: 5, notes: 'Provisional' } }) }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const raw = await callSolvy('analyze', { files: [] })
  const analysis = normalizeSolvyAnalysis(raw)
  assert.equal(analysis.provider, 'gemini')
  assert.equal(analysis.providerVersion, 'gemini-test-model')
  assert.equal(analysis.title, 'Research report')
  assert.deepEqual(analysis.requiredSections, ['Introduction'])
  assert.equal(analysis.estimate.currency, 'LKR')
  assert.equal(analysis.estimate.low, 8000)
  assert.equal(analysis.estimate.high, 10000)
  assert.equal(analysis.estimate.label, 'LKR 8,000 – 10,000')
})

test('end-to-end application scopes receive a realistic minimum range', () => {
  const estimate = buildProvisionalEstimate({
    complexity: 'Medium',
    estimatedEffortHours: 6,
    taskType: 'Software development project',
    title: 'Build a full-stack web application',
    deliverables: ['Frontend', 'Backend API', 'Database', 'Authentication', 'Testing', 'Deployment'],
  })
  assert.equal(estimate.complexity, 'Very high')
  assert.ok(estimate.estimatedEffortHours >= 16)
  assert.ok(estimate.low >= 22000)
  assert.ok(estimate.high > estimate.low)
  assert.equal(estimate.pricingBasis, 'End-to-end application scope')
  assert.equal(estimate.deliverables, undefined)
})

test('short guided group activities stay in the lightweight price band', () => {
  const estimate = buildProvisionalEstimate({
    complexity: 'Medium', estimatedEffortHours: 7, taskType: 'Group activity',
    title: 'Week 1 - 2-Hour Group Activity',
    scope: 'Guided HCI comparison worksheet and class discussion',
    deliverables: ['Initial analysis', 'Re-analysis', 'Discussion', 'Short report'],
  })
  assert.equal(estimate.complexity, 'Low')
  assert.equal(estimate.estimatedEffortHours, 3)
  assert.equal(estimate.low, 4000)
  assert.equal(estimate.high, 5000)
  assert.equal(estimate.pricingBasis, 'Short guided activity')
})
