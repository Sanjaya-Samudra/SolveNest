const startedAt = Date.now()
const routes = new Map()
const MAX_ROUTES = 250

function routeKey(req) {
  return `${req.method} ${String(req.baseUrl || '')}${String(req.route?.path || req.path || '')}`
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/[^/]{48,}/g, '/:token')
}

export function observeRequest(req, res, next) {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const key = routeKey(req)
    if (!routes.has(key) && routes.size >= MAX_ROUTES) return
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
    const current = routes.get(key) || { requests: 0, errors: 0, totalMs: 0, maxMs: 0, statuses: {} }
    current.requests += 1
    current.errors += res.statusCode >= 500 ? 1 : 0
    current.totalMs += elapsedMs
    current.maxMs = Math.max(current.maxMs, elapsedMs)
    const family = `${Math.floor(res.statusCode / 100)}xx`
    current.statuses[family] = Number(current.statuses[family] || 0) + 1
    routes.set(key, current)
  })
  next()
}

export function observabilitySnapshot() {
  const memory = process.memoryUsage()
  return {
    generatedAt: new Date().toISOString(),
    process: { uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), node: process.version, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed },
    routes: [...routes.entries()].map(([route, value]) => ({ route, requests: value.requests, errors: value.errors, averageMs: Math.round(value.totalMs / value.requests), maxMs: Math.round(value.maxMs), statuses: value.statuses })).sort((a, b) => b.requests - a.requests),
  }
}
