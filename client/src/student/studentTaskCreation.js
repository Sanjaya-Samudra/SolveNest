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

export function uploadStudentTaskFile(file, kind, onProgress) {
  const body = new FormData()
  body.append('file', file)
  body.append('kind', kind)
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

export function analyzeStudentTask(fileIds) {
  return request('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ fileIds }) })
}

export function createStudentTask(payload) {
  return request('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
}
