#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { lstat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import {
  createDefaultVisualRuntimeConfig,
  fingerprintPaths,
  inspectVisualRuntime,
  readVisualRuntimeTools,
} from './visual-runtime-core.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const readOption = (name, fallback) => {
  const prefix = `--${name}=`
  return (
    args
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  )
}
const suite = readOption('suite', '')
const port = Number.parseInt(
  readOption('port', suite === 'dev' ? '5173' : '4173'),
  10,
)
const host = readOption('host', '127.0.0.1')
const runtimeRoot = readOption('runtime-dir', '.tmp/visual-runtime')
const config = createDefaultVisualRuntimeConfig(repositoryRoot, runtimeRoot)
config.tools = await readVisualRuntimeTools(repositoryRoot)

if (!['preview', 'dev'].includes(suite)) {
  console.error('[visual-runtime] --suite must be preview or dev')
  process.exit(2)
}
if (!Number.isFinite(port) || port < 1) {
  console.error('[visual-runtime] --port must be a positive integer')
  process.exit(2)
}

const inspection = await inspectVisualRuntime(config)
if (!inspection.ready) {
  console.error(
    [
      '[visual-runtime] runtime is missing, stale, or mismatched.',
      ...inspection.reasons.map((reason) => `  - ${reason}`),
      'Run `pnpm visual:prepare` before invoking Playwright directly.',
    ].join('\n'),
  )
  process.exit(1)
}

const childEnvironment = {
  ...process.env,
  FSUS_VISUAL_RUNTIME_FINGERPRINT: inspection.sourceFingerprint,
  FSUS_VISUAL_RUNTIME_MANIFEST: inspection.manifestPath,
}

async function verifyDevArtifacts() {
  const reasons = []
  for (const id of ['icons', 'wasm']) {
    const group = inspection.groups.find((candidate) => candidate.id === id)
    const sourcePath = resolve(repositoryRoot, group.sourceArtifactPath)
    const source = await fingerprintPaths(sourcePath, ['.'])
    const runtime = await fingerprintPaths(group.runtimeAbsolutePath, ['.'])
    if (source.missing.length > 0) {
      reasons.push(`${id} prepared workspace artifacts are missing`)
    } else if (source.fingerprint !== runtime.fingerprint) {
      reasons.push(`${id} workspace artifacts do not match runtime manifest`)
    }
  }
  return reasons
}

function forwardSignal(child, signal) {
  process.once(signal, () => child.kill(signal))
}

if (suite === 'dev') {
  const reasons = await verifyDevArtifacts()
  if (reasons.length > 0) {
    console.error(
      [
        '[visual-runtime] Dev artifacts do not match the prepared runtime.',
        ...reasons.map((reason) => `  - ${reason}`),
        'Run `pnpm visual:prepare` to restore the local runtime.',
      ].join('\n'),
    )
    process.exit(1)
  }

  const child = spawn(
    'pnpm',
    [
      '-C',
      'vue/packages/demo-app',
      'exec',
      'vite',
      '--host',
      host,
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: repositoryRoot,
      env: childEnvironment,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )
  child.once('error', (error) => {
    console.error(
      `[visual-runtime] failed to start Dev server: ${error.message}`,
    )
    process.exit(1)
  })
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 1)
  })
  forwardSignal(child, 'SIGINT')
  forwardSignal(child, 'SIGTERM')
} else {
  const demoRoot = resolve(
    inspection.runtimeRoot,
    inspection.manifest.paths.demoDist,
  )
  const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.wasm', 'application/wasm'],
  ])

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://local').pathname,
      )
      const requested = resolve(demoRoot, `.${pathname}`)
      const relativePath = relative(demoRoot, requested)
      if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
        response.writeHead(403).end('Forbidden')
        return
      }

      let target = requested
      let state = await lstat(target).catch(() => null)
      if (state?.isDirectory()) {
        target = join(target, 'index.html')
        state = await lstat(target).catch(() => null)
      }
      if (!state?.isFile()) {
        target = join(demoRoot, 'index.html')
        state = await lstat(target).catch(() => null)
      }
      if (!state?.isFile()) {
        response.writeHead(404).end('Not found')
        return
      }

      response.writeHead(200, {
        'Content-Length': state.size,
        'Content-Type':
          mimeTypes.get(extname(target)) ?? 'application/octet-stream',
        'X-Fsus-Visual-Runtime': inspection.sourceFingerprint,
      })
      if (request.method === 'HEAD') response.end()
      else createReadStream(target).pipe(response)
    } catch (error) {
      response.writeHead(500).end('Internal server error')
      console.error(`[visual-runtime] Preview request failed: ${error.message}`)
    }
  })
  server.listen(port, host, () => {
    process.send?.({
      type: 'visual-runtime-ready',
      host,
      port,
      fingerprint: inspection.sourceFingerprint,
    })
    console.info(
      `[visual-runtime] Preview ready http://${host}:${port} dist=${relative(repositoryRoot, demoRoot)} fingerprint=${inspection.sourceFingerprint}`,
    )
  })
}
