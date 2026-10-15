import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { defineConfig, type Plugin } from 'vite'

// Dev-only CORS proxy: the browser cannot call YouTube directly. The TV wrappers
// handle this natively (Android WebView request interception / Tizen access rules).
function ytProxy(): Plugin {
  const handler = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/__proxy')) return next()
    const target = new URL(req.url, 'http://x').searchParams.get('url')
    if (!target || !/^https:\/\/([\w-]+\.)*(youtube\.com|googlevideo\.com|ytimg\.com|sponsor\.ajay\.app)\//.test(target)) {
      res.statusCode = 400
      return res.end('bad url')
    }
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string' && !['host', 'origin', 'referer', 'cookie', 'connection', 'accept-encoding'].includes(k) && !k.startsWith('sec-')) headers[k] = v
    }
    if (headers['x-ua']) headers['user-agent'] = headers['x-ua']
    delete headers['x-ua']
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c)
    const body = chunks.length ? Buffer.concat(chunks) : undefined
    try {
      const r = await fetch(target, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body })
      res.statusCode = r.status
      r.headers.forEach((v, k) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v)
      })
      res.end(Buffer.from(await r.arrayBuffer()))
    } catch (e) {
      res.statusCode = 502
      res.end(String(e))
    }
  }
  return {
    name: 'yt-proxy',
    configureServer: (s) => void s.middlewares.use(handler),
    configurePreviewServer: (s) => void s.middlewares.use(handler),
  }
}

// Relative base so the bundle loads from file:// (Tizen .wgt, Android assets).
// Chrome 76 is the Tizen 6.0 baseline.
export default defineConfig({
  base: './',
  plugins: [react(), legacy({ targets: ['chrome >= 76'] }), ytProxy()],
  build: { target: 'chrome76' },
})
