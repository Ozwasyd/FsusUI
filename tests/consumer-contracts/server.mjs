import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { pathToFileURL, URL } from 'node:url'

export const STRICT_CSP_HEADER =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; style-src-attr 'none'; img-src 'self' data: blob:"

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function createSyntheticSvg(label, accent, width = 1200, height = 800) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#14171f"/>`,
    `<rect x="64" y="64" width="${width - 128}" height="${height - 128}" fill="none" stroke="${accent}" stroke-width="6"/>`,
    `<circle cx="${width / 2}" cy="${height / 2 - 40}" r="120" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="4"/>`,
    `<text x="${width / 2}" y="${height / 2 + 160}" fill="#ffffff" font-family="sans-serif" font-size="42" text-anchor="middle">${label}</text>`,
    '</svg>',
  ].join('')
}

const SYNTHETIC_IMAGES = {
  '/images/fig-1.svg': createSyntheticSvg('Figure 1 · Topology', '#4B79CC'),
  '/images/fig-2.svg': createSyntheticSvg('Figure 2 · Throughput', '#22C55E'),
  '/images/fig-3.svg': createSyntheticSvg('Figure 3 · Telemetry', '#F59E0B'),
}

function collectManifestAssets(manifest, entryKey) {
  const visited = new Set()
  const cssFiles = new Set()
  const visit = (key) => {
    if (visited.has(key)) return
    visited.add(key)
    const chunk = manifest[key]
    if (!chunk) return
    for (const css of chunk.css ?? []) cssFiles.add(css)
    for (const imp of chunk.imports ?? []) visit(imp)
  }
  visit(entryKey)
  const entry = manifest[entryKey]
  if (!entry?.file) {
    throw new Error(`Missing client entry in Vite manifest: ${entryKey}`)
  }
  return {
    script: `/${entry.file}`,
    stylesheets: [...cssFiles].map((file) => `/${file}`),
  }
}

function resolveSsrEntryKey(manifest) {
  const exact = 'src/entry-ssr-client.ts'
  if (manifest[exact]) return exact
  const found = Object.keys(manifest).find((key) =>
    key.endsWith('entry-ssr-client.ts'),
  )
  if (!found) {
    throw new Error(
      `Could not find entry-ssr-client.ts in manifest keys: ${Object.keys(manifest).join(', ')}`,
    )
  }
  return found
}

function buildSsrDocument({
  appHtml,
  viewerTeleport,
  probeTeleport,
  initialOpen,
  theme,
  assets,
  includeCspViolationProbe = false,
}) {
  const cssLinks = assets.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n    ')
  const violationNode = includeCspViolationProbe
    ? '<div id="csp-probe-violation" style="color: red;">Intentional inline style probe</div>'
    : ''

  return `<!doctype html>
<html lang="en" class="${theme}" data-fsus-theme="${theme}" data-theme-mode="${theme}" data-theme-resolved="${theme}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FsusUI ImageViewer SSR + CSP Contract (#835)</title>
    ${cssLinks}
    <script>
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', function (event) {
        window.__cspViolations.push({
          blockedURI: event.blockedURI || '',
          effectiveDirective: event.effectiveDirective || '',
          violatedDirective: event.violatedDirective || '',
          disposition: event.disposition || '',
        });
      });
    </script>
  </head>
  <body>
    <div id="app" data-initial-open="${String(initialOpen)}" data-theme="${theme}">${appHtml}</div>
    <div id="app-pre-inert" data-testid="ssr-app-pre-inert" inert="app-owned">App-owned inert sibling</div>
    <div id="probe-teleports">${probeTeleport}</div>
    <div id="viewer-teleports">${viewerTeleport}</div>
    ${violationNode}
    <script type="module" src="${assets.script}"></script>
  </body>
</html>`
}

export async function startContractServer({
  clientDistDir,
  serverEntryPath,
  metadata = {},
  host = '127.0.0.1',
  port = 0,
}) {
  const manifestPath = path.join(clientDistDir, '.vite', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const ssrAssets = collectManifestAssets(manifest, resolveSsrEntryKey(manifest))
  const spaHtml = readFileSync(path.join(clientDistDir, 'index.html'), 'utf8')

  const serverModule = await import(pathToFileURL(serverEntryPath).href)
  if (typeof serverModule.render !== 'function') {
    throw new Error(`SSR server entry does not export render(): ${serverEntryPath}`)
  }

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${host}`)
      const pathname = requestUrl.pathname

      if (pathname === '/__meta') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(metadata, null, 2))
        return
      }

      if (pathname === '/images/broken.png') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Image not found')
        return
      }

      if (SYNTHETIC_IMAGES[pathname]) {
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-cache',
        })
        res.end(SYNTHETIC_IMAGES[pathname])
        return
      }

      if (
        pathname === '/ssr/open' ||
        pathname === '/ssr/closed' ||
        pathname === '/ssr/open-dark' ||
        pathname === '/ssr/csp-violation-probe'
      ) {
        const initialOpen =
          pathname === '/ssr/open' || pathname === '/ssr/open-dark'
        const theme =
          pathname === '/ssr/open-dark' ||
          requestUrl.searchParams.get('theme') === 'dark'
            ? 'dark'
            : 'light'
        const rendered = await serverModule.render({ initialOpen, theme })
        const documentHtml = buildSsrDocument({
          ...rendered,
          initialOpen,
          theme,
          assets: ssrAssets,
          includeCspViolationProbe: pathname === '/ssr/csp-violation-probe',
        })
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': STRICT_CSP_HEADER,
          'Cache-Control': 'no-store',
        })
        res.end(documentHtml)
        return
      }

      if (pathname.startsWith('/assets/')) {
        const safeRel = path
          .normalize(pathname)
          .replace(/^(\.\.(\/|\\|$))+/, '')
          .replace(/^\/+/, '')
        const filePath = path.resolve(clientDistDir, safeRel)
        if (
          filePath.startsWith(path.resolve(clientDistDir)) &&
          existsSync(filePath)
        ) {
          const ext = path.extname(filePath)
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
          })
          res.end(readFileSync(filePath))
          return
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Asset not found')
        return
      }

      if (pathname === '/favicon.ico') {
        res.writeHead(204)
        res.end()
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(spaHtml)
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error)
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(message)
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind consumer contract HTTP server port.')
  }

  return {
    server,
    port: address.port,
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}
