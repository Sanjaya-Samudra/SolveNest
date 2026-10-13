import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

const allowed = new Set(['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png'])

function validOfficeArchive(bytes, extension) {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return false
  const start = Math.max(0, bytes.length - 65557)
  let end = -1
  for (let offset = bytes.length - 22; offset >= start; offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) return false
  const count = bytes.readUInt16LE(end + 10)
  const directorySize = bytes.readUInt32LE(end + 12)
  let position = bytes.readUInt32LE(end + 16)
  if (!count || count > 2000 || directorySize > 8 * 1024 * 1024 || position + directorySize !== end) return false
  const directoryEnd = position + directorySize
  const names = new Set()
  let expanded = 0
  for (let index = 0; index < count; index++) {
    if (position + 46 > directoryEnd || bytes.readUInt32LE(position) !== 0x02014b50) return false
    const flags = bytes.readUInt16LE(position + 8)
    const method = bytes.readUInt16LE(position + 10)
    const compressed = bytes.readUInt32LE(position + 20)
    const uncompressed = bytes.readUInt32LE(position + 24)
    const nameLength = bytes.readUInt16LE(position + 28)
    const extraLength = bytes.readUInt16LE(position + 30)
    const commentLength = bytes.readUInt16LE(position + 32)
    const externalAttributes = bytes.readUInt32LE(position + 38)
    const localOffset = bytes.readUInt32LE(position + 42)
    const next = position + 46 + nameLength + extraLength + commentLength
    if (next > directoryEnd || !nameLength || flags & 1 || ![0, 8].includes(method) || compressed === 0xffffffff || uncompressed === 0xffffffff) return false
    const name = bytes.toString('utf8', position + 46, position + 46 + nameLength)
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || names.has(name) || !/^[\x20-\x7e]+$/.test(name)) return false
    if (((externalAttributes >>> 16) & 0xf000) === 0xa000) return false
    if (localOffset + 30 > position || bytes.readUInt32LE(localOffset) !== 0x04034b50) return false
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localExtraLength = bytes.readUInt16LE(localOffset + 28)
    if (localOffset + 30 + localNameLength + localExtraLength + compressed > bytes.length) return false
    if (bytes.toString('utf8', localOffset + 30, localOffset + 30 + localNameLength) !== name) return false
    if (uncompressed > 100 * 1024 * 1024 || (compressed === 0 ? uncompressed > 0 : uncompressed / compressed > 100)) return false
    expanded += uncompressed
    if (expanded > 250 * 1024 * 1024) return false
    names.add(name)
    position = next
  }
  return position === directoryEnd && names.has('[Content_Types].xml') && names.has('_rels/.rels') && names.has(extension === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml')
}

function validContent(bytes, name) {
  const extension = path.extname(name).slice(1).toLowerCase()
  if (!allowed.has(extension)) return false
  const starts = (signature) => bytes.subarray(0, signature.length).equals(Buffer.from(signature))
  if (extension === 'pdf') return starts([0x25, 0x50, 0x44, 0x46, 0x2d])
  if (extension === 'jpg' || extension === 'jpeg') return starts([0xff, 0xd8, 0xff])
  if (extension === 'png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return validOfficeArchive(bytes, extension)
}

function scanWithClamd(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: process.env.CLAMD_HOST, port: Number(process.env.CLAMD_PORT || 3310) })
    let response = ''
    let settled = false
    const finish = (error, result) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve(result)
    }
    socket.setTimeout(60_000, () => finish(new Error('MALWARE_SCAN_TIMEOUT')))
    socket.on('error', (error) => finish(error))
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8')
      if (response.length > 4096) return finish(new Error('MALWARE_SCAN_BAD_RESPONSE'))
      if (response.includes('\0') || response.includes('\n')) {
        if (/^stream: OK\b/i.test(response)) finish(null, 'clean')
        else if (/^stream: .* FOUND\b/i.test(response)) finish(null, 'infected')
        else finish(new Error('MALWARE_SCAN_BAD_RESPONSE'))
      }
    })
    socket.on('end', () => finish(new Error('MALWARE_SCAN_INCOMPLETE')))
    socket.on('connect', async () => {
      try {
        const send = (data) => new Promise((done, fail) => socket.write(data, (error) => error ? fail(error) : done()))
        await send('zINSTREAM\0')
        for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
          const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length))
          const length = Buffer.alloc(4)
          length.writeUInt32BE(chunk.length)
          await send(length)
          await send(chunk)
        }
        await send(Buffer.alloc(4))
      } catch (error) { finish(error) }
    })
  })
}

export async function inspectUpload(file) {
  const bytes = file.buffer || await fs.readFile(file.path)
  if (!validContent(bytes, file.originalname)) return 'invalid'
  if (!process.env.CLAMD_HOST) return process.env.NODE_ENV === 'production' ? 'unavailable' : 'clean'
  try { return await scanWithClamd(bytes) } catch { return 'unavailable' }
}

export function checkMalwareScanner() {
  if (!process.env.CLAMD_HOST) return Promise.resolve(process.env.NODE_ENV !== 'production')
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: process.env.CLAMD_HOST, port: Number(process.env.CLAMD_PORT || 3310) })
    let result = ''
    let done = false
    const finish = (healthy) => { if (done) return; done = true; socket.destroy(); resolve(healthy) }
    socket.setTimeout(3000, () => finish(false))
    socket.on('error', () => finish(false))
    socket.on('connect', () => socket.write('zPING\0'))
    socket.on('data', (data) => { result += data.toString('utf8'); if (result.includes('PONG')) finish(true); else if (result.length > 128) finish(false) })
    socket.on('end', () => finish(false))
  })
}
