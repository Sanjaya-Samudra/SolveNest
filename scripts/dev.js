import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = []
let stopping = false

function start(name, entry, cwd) {
  const child = spawn(process.execPath, [entry], { cwd, stdio: 'inherit', env: process.env })
  children.push(child)
  child.on('exit', (code) => {
    if (stopping) return
    console.error(`${name} stopped${code == null ? '' : ` (exit ${code})`}. Stopping the development stack.`)
    stop(code || 1)
  })
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill()
  process.exitCode = code
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

start('API', path.join(root, 'server', 'index.js'), path.join(root, 'server'))
start('Vite', path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js'), path.join(root, 'client'))
