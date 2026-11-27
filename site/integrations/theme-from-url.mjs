/**
 * Dev-server endpoint for the theme configurator's "From website" flow:
 * POST /api/theme-from-url/ with `{ "url": "…" }` renders the site in
 * headless Chrome and returns its style readings and a screenshot.
 *
 * Development only. The hook runs on `astro dev`; `astro build` emits static
 * files and no endpoint, so the deployed docs cannot read websites. A
 * deployment would need a server-side equivalent (see site/AGENTS.md).
 */
const PATH = '/api/theme-from-url/'
const MAX_BODY = 4096

export default function themeFromUrl() {
  return {
    name: 'anta-theme-from-url',
    hooks: {
      'astro:server:setup': ({ server }) => {
        let busy = false
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith(PATH.slice(0, -1))) return next()
          const send = (status, body) => {
            res.statusCode = status
            res.setHeader('content-type', 'application/json')
            res.setHeader('cache-control', 'no-store')
            res.end(JSON.stringify(body))
          }
          if (req.method !== 'POST') return send(405, { error: 'Use POST.' })
          // Only the docs page itself may call this: other sites open in the same browser must not use it as a proxy.
          const host = req.headers.host
          const origin = req.headers.origin
          if (!origin || new URL(origin).host !== host || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Same-origin requests only.' })
          if (busy) return send(429, { error: 'Another website is being read. Try again in a moment.' })

          let raw = ''
          for await (const chunk of req) {
            raw += chunk
            if (raw.length > MAX_BODY) return send(413, { error: 'Request too large.' })
          }
          let url
          try {
            url = JSON.parse(raw).url
          } catch {
            return send(400, { error: 'Send JSON with a url field.' })
          }
          if (typeof url !== 'string' || !url.trim()) return send(400, { error: 'Enter a website address.' })

          busy = true
          try {
            const { checkUrl, readPage } = await import('../lib/theme-from-url/read-page.mjs')
            const checked = await checkUrl(url.trim())
            if (checked.error) return send(400, { error: checked.error })
            send(200, await readPage(checked.url))
          } catch (error) {
            const message = String(error?.message ?? error)
            if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
              return send(500, { error: 'No headless browser found. Run `pnpm --filter anta-site exec playwright install chromium`, or install Google Chrome.' })
            }
            send(502, { error: /timeout/i.test(message) ? 'The website took too long to load.' : `Could not read the website: ${message.split('\n')[0]}` })
          } finally {
            busy = false
          }
        })
      },
    },
  }
}
