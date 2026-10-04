import 'dotenv/config'
import 'node:process'
import { closeDatabase, migrate } from './db.js'

try {
  await migrate()
  console.log('SolveNest database migrations applied.')
} finally {
  await closeDatabase()
}
