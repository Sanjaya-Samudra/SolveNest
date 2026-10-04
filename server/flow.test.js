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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Server did not start')
}

test('Student flow is authenticated, idempotent, and ownership-scoped', async (t) => {
  const server = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], { cwd: fileURLToPath(new URL('.', import.meta.url)), env: { ...process.env, PORT: String(port), DEV_DEMO_SESSION: '0', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let startupError = ''
  server.stderr.on('data', (chunk) => { startupError += chunk.toString() })
  t.after(() => server.kill())
  try { await waitForServer() } catch { throw new Error(startupError || 'Server did not start') }

  const studentA = client()
  const studentB = client()
  const suffix = crypto.randomUUID()
  const register = async (api, email) => {
    const result = await api.call('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Student', email, password: 'correct horse battery staple' }) })
    assert.equal(result.response.status, 201)
  }
  await register(studentA, `a-${suffix}@example.com`)
  await register(studentB, `b-${suffix}@example.com`)

  const form = new FormData()
  form.append('file', new Blob([Buffer.from('brief')], { type: 'image/png' }), 'brief.png')
  form.append('kind', 'brief')
  const upload = await studentA.call('/api/student/task-creation/files', { method: 'POST', body: form })
  assert.equal(upload.response.status, 201)
  const fileId = upload.body.file.id

  const analysis = await studentA.call('/api/student/task-creation/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds: [fileId] }) })
  assert.equal(analysis.response.status, 201)
  assert.equal(analysis.body.analysis.status, 'COMPLETED')

  const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': `create-${suffix}` }
  const payload = JSON.stringify({ fileIds: [fileId], analysis: analysis.body.analysis })
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
  assert.equal(explain.response.status, 503)

  const access = await studentA.call(`/api/student/files/${fileId}/access`)
  assert.equal(access.response.status, 200)
  const download = await studentA.call(access.body.signedUrl)
  assert.equal(download.response.status, 200)

  const forbiddenTask = await studentB.call(`/api/student/tasks/${created.body.task.id}/preview`)
  const forbiddenFile = await studentB.call(`/api/student/files/${fileId}/access`)
  assert.equal(forbiddenTask.response.status, 404)
  assert.equal(forbiddenFile.response.status, 404)
})
