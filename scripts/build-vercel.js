import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'client', 'dist')
const destination = path.join(root, 'public')

await fs.rm(destination, { recursive: true, force: true })
await fs.cp(source, destination, { recursive: true })
console.log('Prepared client/dist as Vercel public assets.')
