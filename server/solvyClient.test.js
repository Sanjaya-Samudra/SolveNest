import test from 'node:test'
import assert from 'node:assert/strict'
import { callSolvy, normalizeSolvyAnalysis } from './solvyClient.js'

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
})
