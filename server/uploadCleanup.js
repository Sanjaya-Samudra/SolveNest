import fs from 'node:fs'
import path from 'node:path'
import { hasSupabase, supabaseListExpertWorkspaces } from './supabase.js'
import { readTaskStore, withTaskStore } from './taskStore.js'
import { hasObjectStorage, listStoredObjects, removeStoredObject } from './storage.js'

const minimumAgeMs = 24 * 60 * 60 * 1000

function collectStorageKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys
  if (typeof value.storageKey === 'string' && value.storageKey) keys.add(value.storageKey)
  for (const nested of Array.isArray(value) ? value : Object.values(value)) collectStorageKeys(nested, keys)
  return keys
}

function localExpertRecords(dataDir) {
  const records = []
  if (!fs.existsSync(dataDir)) return records
  for (const name of fs.readdirSync(dataDir)) {
    if (!/^expert(?:-|\.)/.test(name) || !name.endsWith('.json')) continue
    try { records.push(JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))) } catch {}
  }
  return records
}

export async function cleanupUploads({ uploadDir, dataDir }) {
  const expiredKeys = await withTaskStore((store) => {
    const expired = (store.guestTransfers || []).filter((item) => new Date(item.expiresAt).getTime() <= Date.now())
    store.guestTransfers = (store.guestTransfers || []).filter((item) => new Date(item.expiresAt).getTime() > Date.now())
    return [...collectStorageKeys(expired)]
  })
  const state = await readTaskStore()
  const referenced = collectStorageKeys(state)
  if (hasSupabase()) {
    for (const row of await supabaseListExpertWorkspaces()) collectStorageKeys(row.workspace, referenced)
  } else {
    for (const workspace of localExpertRecords(dataDir)) collectStorageKeys(workspace, referenced)
  }
  const cutoff = Date.now() - minimumAgeMs
  const removable = new Set(expiredKeys.filter((key) => !referenced.has(key)))
  if (hasObjectStorage()) {
    for (const object of await listStoredObjects()) {
      const modified = new Date(object.lastModified || 0).getTime()
      if (!referenced.has(object.key) && modified && modified < cutoff) removable.add(object.key)
    }
    for (const key of removable) await removeStoredObject(key)
  }
  if (fs.existsSync(uploadDir)) {
    for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
      if (!entry.isFile() || referenced.has(entry.name)) continue
      const target = path.join(uploadDir, entry.name)
      if (fs.statSync(target).mtimeMs < cutoff || removable.has(entry.name)) fs.unlinkSync(target)
    }
  }
  return { removed: removable.size }
}
