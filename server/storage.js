import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { hasSupabaseStorage, supabaseRemove, supabaseSignedUrl, supabaseUpload } from './supabase.js'

const bucket = process.env.S3_BUCKET
const client = bucket ? new S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' }) : null
export function hasObjectStorage() { return hasSupabaseStorage() || Boolean(client && bucket) }
export async function persistUpload(file, key) {
  if (hasSupabaseStorage()) { await supabaseUpload(file, key); return }
  if (!hasObjectStorage()) return
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(file.path), ContentType: file.mimetype, ContentLength: file.size }))
  try { fs.unlinkSync(file.path) } catch {}
}
export async function removeStoredObject(key) {
  if (hasSupabaseStorage()) return supabaseRemove(key)
  if (hasObjectStorage()) return client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  return undefined
}
export async function signedObjectUrl(key, filename) {
  if (hasSupabaseStorage()) return supabaseSignedUrl(key)
  if (!hasObjectStorage()) return null
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename="${path.basename(filename)}"` }), { expiresIn: 600 })
}
