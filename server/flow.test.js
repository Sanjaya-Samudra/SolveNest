import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const port = 4177
const base = `http://127.0.0.1:${port}`

function client() {
  let cookie = ''
  return {
    async call(path, options = {}) {
      const headers = { ...(options.headers || {}), ...(cookie ? { cookie } : {}) }
      const response = await fetch(base + path, { ...options, headers })
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) cookie = setCookie.split(';')[0]
      const text = await response.text()
      const body = response.headers.get('content-type')?.includes('application/json') ? (text ? JSON.parse(text) : null) : text
      return { response, body }
    },
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Server did not start')
}

test('Student flow is authenticated, idempotent, and ownership-scoped', async (t) => {
  const server = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], { cwd: fileURLToPath(new URL('.', import.meta.url)), env: { ...process.env, PORT: String(port), DEV_DEMO_SESSION: '0', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', SOLVY_API_URL: '', SOLVY_API_KEY: '', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', SMTP_HOST: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let startupError = ''
  server.stderr.on('data', (chunk) => { startupError += chunk.toString() })
  server.stdout.on('data', (chunk) => { startupError += chunk.toString() })
  t.after(() => server.kill())
  try { await waitForServer() } catch { throw new Error(startupError || 'Server did not start') }

  const studentA = client()
  const studentB = client()
  const suffix = crypto.randomUUID()
  const policyResponse = await fetch(`${base}/api/policies/current`)
  assert.equal(policyResponse.status, 200)
  const { policies } = await policyResponse.json()
  const policyConsents = policies.map(({ id, version, contentHash }) => ({ id, version, contentHash, acceptedAt: new Date().toISOString() }))
  const register = async (api, email) => {
    const result = await api.call('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Student', email, password: 'correct horse battery staple', policyConsents }) })
    assert.equal(result.response.status, 201)
  }
  await register(studentA, `a-${suffix}@example.com`)
  await register(studentB, `b-${suffix}@example.com`)

  const setup = await studentA.call('/api/student/task-creation/session', { method: 'POST' })
  assert.equal(setup.response.status, 201)
  const sessionId = setup.body.session.id

  const form = new FormData()
  const pngBrief = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('brief')])
  form.append('file', new Blob([pngBrief], { type: 'image/png' }), 'brief.png')
  form.append('kind', 'brief')
  form.append('sessionId', sessionId)
  const upload = await studentA.call('/api/student/task-creation/files', { method: 'POST', body: form })
  assert.equal(upload.response.status, 201)
  const fileId = upload.body.file.id

  const analysis = await studentA.call('/api/student/task-creation/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds: [fileId], sessionId }) })
  assert.equal(analysis.response.status, 202)
  let analyzed
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await studentA.call(`/api/student/task-creation/analysis-jobs/${analysis.body.job.id}`)
    if (result.body.analysis) { analyzed = result.body.analysis; break }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.equal(analyzed?.status, 'COMPLETED')
  assert.equal(analyzed?.estimate?.currency, 'LKR')
  assert.ok(analyzed?.estimate?.low > 0)
  assert.ok(analyzed?.estimate?.high > analyzed?.estimate?.low)

  const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': `create-${suffix}` }
  const payload = JSON.stringify({ fileIds: [fileId], analysisId: analyzed.id })
  const created = await studentA.call('/api/student/task-creation/tasks', { method: 'POST', headers, body: payload })
  const replayed = await studentA.call('/api/student/task-creation/tasks', { method: 'POST', headers, body: payload })
  assert.equal(created.response.status, 201)
  assert.equal(created.body.task.status, 'FEASIBILITY_REVIEW')
  assert.equal(replayed.response.status, 200)
  assert.equal(replayed.body.replayed, true)
  assert.equal(replayed.body.task.id, created.body.task.id)

  const conversations = await studentA.call('/api/student/conversations')
  assert.equal(conversations.response.status, 200)
  assert.equal(conversations.body.conversations.length, 1)
  const conversationId = conversations.body.conversations[0].id
  const sent = await studentA.call(`/api/student/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Please confirm the review requirements.' }) })
  assert.equal(sent.response.status, 201)
  const messages = await studentA.call(`/api/student/conversations/${conversationId}/messages`)
  assert.equal(messages.body.messages.length, 1)
  const payment = await studentA.call('/api/student/payments/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: created.body.task.id, idempotencyKey: `payment-${suffix}` }) })
  assert.equal(payment.response.status, 503)
  const explain = await studentA.call(`/api/student/explain/tasks/${created.body.task.id}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'explain', question: 'What is the task asking?' }) })
  assert.equal(explain.response.status, 409)

  const access = await studentA.call(`/api/student/files/${fileId}/access`)
  assert.equal(access.response.status, 200)
  const download = await studentA.call(access.body.signedUrl)
  assert.equal(download.response.status, 200)

  const forbiddenTask = await studentB.call(`/api/student/tasks/${created.body.task.id}/preview`)
  const forbiddenFile = await studentB.call(`/api/student/files/${fileId}/access`)
  assert.equal(forbiddenTask.response.status, 404)
  assert.equal(forbiddenFile.response.status, 404)
})
