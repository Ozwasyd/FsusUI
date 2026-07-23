import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import { createServer as createViteServer } from 'vite'

const portArgument = process.argv.find((value) => value.startsWith('--port='))
const port = Number(portArgument?.slice('--port='.length) || 5183)
const demoRoot = fileURLToPath(
  new URL('../../packages/demo-app', import.meta.url),
)
const configFile = fileURLToPath(
  new URL('../../packages/demo-app/vite.config.ts', import.meta.url),
)

const vite = await createViteServer({
  root: demoRoot,
  configFile,
  appType: 'custom',
  server: { hmr: false, middlewareMode: true },
})

const server = createHttpServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }

  if (request.url?.startsWith('/ssr-motion')) {
    try {
      const entry = await vite.ssrLoadModule('/src/ssr-motion-server.ts')
      const rendered = await entry.render()
      const template = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FsusUI motion SSR contract</title>
  </head>
  <body>
    <div id="app" data-server-rendered="true">${rendered.html}</div>
    ${rendered.teleports}
    <script type="module" src="/src/ssr-motion-client.ts"></script>
  </body>
</html>`
      const html = await vite.transformIndexHtml(request.url, template)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(html)
    } catch (error) {
      vite.ssrFixStacktrace(error)
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.stack : String(error))
    }
    return
  }

  vite.middlewares(request, response)
})

server.listen(port, '127.0.0.1')

const shutdown = async () => {
  await vite.close()
  server.close()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
