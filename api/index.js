import app from '../server/index.js'

export default function handler(req, res) {
  const url = new URL(req.url, 'https://vercel.local')
  const originalPath = url.searchParams.get('__originalPath')

  if (originalPath) {
    url.searchParams.delete('__originalPath')
    const query = url.searchParams.toString()
    req.url = `${originalPath}${query ? `?${query}` : ''}`
  }

  return app(req, res)
}
