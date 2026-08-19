#!/usr/bin/env node
/**
 * Linux-local screen-reader evidence: headed Chromium + AT-SPI (+ Orca if present).
 * NVDA/VoiceOver remain optional off-host cells.
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demoAppDirectory = resolve(repositoryRoot, 'vue/packages/demo-app')
const viteEntry = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js')
const atspiHelper = resolve(repositoryRoot, 'scripts/native-screen-reader-atspi.py')
const defaultOut = resolve(repositoryRoot, '.tmp/native-screen-reader-evidence')

const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

const findFreePort = async () => {
  const server = createServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise((resolveClose) => server.close(resolveClose))
  return port
}

const waitForServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, {
        signal: AbortSignal.timeout(1500),
      })
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(300)
  }
  throw new Error(`preview not ready: ${lastError?.message ?? 'timeout'}`)
}

const parseArguments = (argv) => {
  const options = { out: defaultOut, skipBuild: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') options.out = resolve(process.cwd(), argv[++index])
    else if (argument === '--skip-build') options.skipBuild = true
  }
  return options
}

const chromePath = [
  process.env.FSUS_IME_CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((candidate) => {
  try {
    readFileSync(candidate)
    return true
  } catch {
    return false
  }
})

const main = async () => {
  if (!process.env.DISPLAY) {
    throw new Error('DISPLAY is required for native screen-reader evidence')
  }
  if (!chromePath) throw new Error('no Chromium executable found')
  const options = parseArguments(process.argv.slice(2))
  rmSync(options.out, { force: true, recursive: true })
  mkdirSync(options.out, { recursive: true })

  if (!options.skipBuild) {
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
  await waitForServer(baseUrl, 30_000)

  const profileDirectory = mkdtempSync(join(tmpdir(), 'fsusui-sr-profile-'))
  let context = null
  let orca = null
  try {
    orca = spawn('orca', ['--replace', '--no-setup'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await sleep(1500)

    context = await chromium.launchPersistentContext(profileDirectory, {
      headless: false,
      executablePath: chromePath,
      env: process.env,
      locale: 'zh-CN',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--force-renderer-accessibility',
        '--window-size=1280,1100',
        '--window-position=80,80',
      ],
      viewport: { width: 1280, height: 1100 },
    })
    const page = context.pages()[0] ?? (await context.newPage())
    const fixtureUrl = `${baseUrl}/?markdownEditorTransaction=1&audit=ui-states`
    await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('.el-markdown-editor textarea').first().waitFor({
      timeout: 20_000,
    })

    const domProbe = await page.evaluate(() => {
      const editor = document.querySelector('.el-markdown-editor')
      const textarea = editor?.querySelector('textarea')
      const live = [...document.querySelectorAll('[aria-live]')]
        .filter((element) => editor?.contains(element) || element === document.body)
        .map((element) => ({
          tag: element.tagName,
          live: element.getAttribute('aria-live'),
          role: element.getAttribute('role'),
        }))
      const tabStops = [...(editor?.querySelectorAll('p, [tabindex]') ?? [])].map((element) => ({
        tag: element.tagName,
        tabIndex: element.tabIndex,
        role: element.getAttribute('role'),
      }))
      return {
        regionRole: editor?.getAttribute('role'),
        regionLabel: editor?.getAttribute('aria-label'),
        textareaLabel: textarea?.getAttribute('aria-label'),
        textareaHidden: textarea?.getAttribute('aria-hidden'),
        decorationsAriaHidden: editor
          ?.querySelector('[data-markdown-live-decorations]')
          ?.getAttribute('aria-hidden'),
        live,
        tabStops,
      }
    })

    const atspi = spawnSync('python3', [atspiHelper], {
      encoding: 'utf8',
      env: process.env,
      timeout: 25_000,
    })
    let atspiJson = null
    try {
      atspiJson = JSON.parse(atspi.stdout || '{}')
    } catch {
      atspiJson = { ok: false, parseError: true, stdout: atspi.stdout, stderr: atspi.stderr }
    }
    writeFileSync(join(options.out, 'atspi.json'), `${JSON.stringify(atspiJson, null, 2)}\n`)
    writeFileSync(join(options.out, 'dom-probe.json'), `${JSON.stringify(domProbe, null, 2)}\n`)

    const textboxHit = (atspiJson.textboxCount ?? 0) > 0
    const noDocumentLive = !domProbe.live.some(
      (entry) => entry.tag === 'BODY' || entry.tag === 'SECTION',
    )
    const editableLabel =
      /markdown editor/i.test(domProbe.textareaLabel || '') ||
      /markdown editor/i.test(domProbe.regionLabel || '')
    const orcaPid = orca.pid ?? null
    const verdict =
      textboxHit && noDocumentLive && atspiJson.ok !== false ? 'pass' : 'fail'

    const evidence = {
      schemaVersion: 1,
      kind: 'native-screen-reader-linux-orca-atspi',
      verdict,
      candidateSha,
      os: process.platform,
      display: process.env.DISPLAY ?? null,
      browser: chromePath,
      orcaPid,
      optionalOffHost: ['NVDA', 'VoiceOver'],
      checks: {
        atspiReachable: atspiJson.ok !== false,
        textboxExposed: textboxHit,
        documentNotAriaLive: noDocumentLive,
        editableName: editableLabel,
        decorationsHidden: domProbe.decorationsAriaHidden === 'true' || !domProbe.decorationsAriaHidden,
      },
      domProbe,
    }
    writeFileSync(join(options.out, 'manifest.json'), `${JSON.stringify(evidence, null, 2)}\n`)
    writeFileSync(
      join(options.out, 'receipt.txt'),
      [
        'native-screen-reader receipt',
        `candidate-sha: ${candidateSha}`,
        `verdict: ${verdict}`,
        `orca-pid: ${orcaPid}`,
        `atspi-apps: ${(atspiJson.apps || []).join(', ')}`,
        `textbox-count: ${atspiJson.textboxCount}`,
        `optional-off-host: NVDA, VoiceOver`,
        `evidence: ${options.out}`,
        '',
      ].join('\n'),
    )
    console.log(`[screen-reader] ${verdict} evidence=${options.out}`)
    if (verdict !== 'pass') process.exitCode = 8
  } finally {
    if (context) {
      await Promise.race([
        context.close().catch(() => {}),
        sleep(3000),
      ])
    }
    if (orca) {
      orca.kill('SIGTERM')
      await sleep(300)
      orca.kill('SIGKILL')
    }
    serverProcess.kill('SIGTERM')
    rmSync(profileDirectory, { force: true, recursive: true })
  }
}

main().catch((error) => {
  console.error(`[screen-reader] FAIL ${error.message}`)
  process.exitCode = 9
})
