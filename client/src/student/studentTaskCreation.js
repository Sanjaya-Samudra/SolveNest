const API = '/api/student/task-creation'

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options })
  if (response.status === 401 || response.status === 403) throw new Error('Your student session is no longer available.')
  if (!response.ok) {
    let message = 'The request could not be completed.'
    try { message = (await response.json()).message || message } catch {}
    throw new Error(message)
  }
  return response.json()
}

export function createStudentTaskSession() { return request('/session', { method: 'POST', headers: { Accept: 'application/json' } }) }

export function uploadStudentTaskFile(file, kind, onProgress, sessionId) {
  const body = new FormData()
  body.append('file', file)
  body.append('kind', kind)
  if (sessionId) body.append('sessionId', sessionId)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)) }
    xhr.onload = async () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)) } catch { reject(new Error('The upload response was invalid.')) } } else { reject(new Error('Upload failed. Please try again.')) } }
    xhr.onerror = () => reject(new Error('Upload failed. Please try again.'))
    xhr.send(body)
  })
}

export function removeStudentTaskFile(fileId) {
  return request(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } })
}

export async function analyzeStudentTask(fileIds, sessionId) {
  const started = await request('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ fileIds, sessionId }) })
  if (started.analysis) return started
  const jobId = started.job?.id
  if (!jobId) throw new Error('The analysis job could not be started.')
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const result = await request(`/analysis-jobs/${encodeURIComponent(jobId)}`, { headers: { Accept: 'application/json' } })
    if (result.analysis) return { analysis: result.analysis, job: result.job }
    if (result.job?.status === 'failed') throw new Error('Analysis could not be completed. Your files are saved and staff can retry the job.')
  }
  throw new Error('Analysis is still processing. Keep this task setup open and try again shortly.')
}

export function createStudentTask(payload) {
  const key = payload.idempotencyKey || crypto.randomUUID()
  return request('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ ...payload, idempotencyKey: key }) })
}
