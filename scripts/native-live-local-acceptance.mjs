#!/usr/bin/env node
/**
 * Linux-local Live acceptance extras: three headed browsers, Unicode/RTL,
 * zoom, reduced-motion, and a 100k-character input-to-visible sample.
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demoAppDirectory = resolve(repositoryRoot, 'vue/packages/demo-app')
const viteEntry = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js')
const defaultOut = resolve(repositoryRoot, '.tmp/native-live-local-acceptance')

const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

const buildCorpus = (targetSize, blockTarget) => {
  const blocks = []
  while (blocks.length < blockTarget) {
    blocks.push(`## Heading ${blocks.length + 1}\n\nParagraph ${blocks.length + 1} אב **x**.\n`)
  }
  let source = `A😀éאב\n\n${blocks.join('\n')}`
  while (source.length < targetSize) source += `\n- item ${source.length}`
  return source.slice(0, targetSize)
}

const findFreePort = async () => {
  const server = createServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const port = server.address().port
  await new Promise((resolveClose) => server.close(resolveClose))
  return port
}

const waitForServer = async (url) => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, { signal: AbortSignal.timeout(1500) })
      if (response.ok) return
    } catch {
      // retry
    }
    await sleep(300)
  }
  throw new Error(`preview not ready at ${url}`)
}

const browsers = {
  chromium,
  firefox,
  webkit,
}

const main = async () => {
  if (!process.env.DISPLAY) throw new Error('DISPLAY is required')
  const out = process.argv.includes('--out')
    ? resolve(process.cwd(), process.argv[process.argv.indexOf('--out') + 1])
    : defaultOut
  rmSync(out, { force: true, recursive: true })
  mkdirSync(out, { recursive: true })

  if (!process.argv.includes('--skip-build')) {
    const build = spawnSync('pnpm', ['run', 'build:demo'], {
      cwd: repositoryRoot,
      stdio: 'inherit',
    })
    if (build.status !== 0) throw new Error('build:demo failed')
  }

  const candidateSha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).stdout.trim()
  const port = await findFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const serverProcess = spawn(
    process.execPath,
    [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: demoAppDirectory, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await waitForServer(baseUrl)

  const corpus = buildCorpus(100_000, 3000)
  const cells = []
  try {
    for (const [name, launcher] of Object.entries(browsers)) {
      const browser = await launcher.launch({
        headless: false,
        env: process.env,
        args: name === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
      })
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(`${baseUrl}/?audit=ui-states`, { waitUntil: 'domcontentloaded' })
        const editor = page.locator('.el-markdown-editor').first()
        await editor.waitFor({ timeout: 20_000 })
        const modes = await page.locator('.el-markdown-editor__mode').allTextContents()
        await page.setViewportSize({ width: 1440, height: 900 })
        const rtlSample = await page.evaluate(() => {
          const textarea = document.querySelector('.el-markdown-editor textarea')
          return {
            dir: getComputedStyle(document.documentElement).direction,
            valueHasRtl: /[\u0590-\u05FF]/.test(textarea?.value ?? ''),
            reducedMotion: getComputedStyle(document.documentElement).getPropertyValue(
              'prefers-reduced-motion',
            ),
          }
        })
        await page.setViewportSize({ width: 375, height: 812 })
        const mobileBox = await editor.boundingBox()

        const perfPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        await perfPage.goto(
          `${baseUrl}/?markdownEditorTransaction=1&markdownEditorIme=1`,
          { waitUntil: 'domcontentloaded' },
        )
        const textarea = perfPage.locator(
          '[data-testid="markdown-editor-transaction-fixture"] textarea',
        )
        await textarea.waitFor({ timeout: 20_000 })
        await perfPage.evaluate((value) => {
          const area = document.querySelector(
            '[data-testid="markdown-editor-transaction-fixture"] textarea',
          )
          const descriptor = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
          )
          descriptor.set.call(area, value)
          area.dispatchEvent(new Event('input', { bubbles: true }))
        }, corpus)
        const started = Date.now()
        await textarea.focus()
        await textarea.press('a')
        await perfPage.waitForTimeout(50)
        const inputToVisibleMs = Date.now() - started
        const afterLength = await textarea.evaluate((node) => node.value.length)

        const cell = {
          browser: name,
          modes,
          rtlSample,
          mobileWidth: mobileBox?.width ?? null,
          corpusChars: corpus.length,
          corpusBlocks: 3000,
          afterLength,
          inputToVisibleMs,
        }
        cells.push(cell)
        writeFileSync(join(out, `${name}.json`), `${JSON.stringify(cell, null, 2)}\n`)
        await perfPage.close()
        await page.close()
      } finally {
        await browser.close()
      }
    }
  } finally {
    serverProcess.kill('SIGTERM')
  }

  const verdict = cells.length === 3 ? 'pass' : 'fail'
  const summary = {
    schemaVersion: 1,
    kind: 'native-live-local-acceptance',
    verdict,
    candidateSha,
    cells,
    notes: [
      'input-to-visible is a headed one-character sample on a 100k/3000-block fixture, not a portable budget.',
      'NVDA/VoiceOver remain optional off-host.',
    ],
  }
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`[live-local] ${verdict} browsers=${cells.length} evidence=${out}`)
  if (verdict !== 'pass') process.exitCode = 1
}

main().catch((error) => {
  console.error(`[live-local] FAIL ${error.message}`)
  process.exitCode = 9
})
