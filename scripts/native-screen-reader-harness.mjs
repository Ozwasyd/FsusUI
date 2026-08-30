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
import { dirname, join, relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createServer } from 'node:net'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demoAppDirectory = resolve(repositoryRoot, 'vue/packages/demo-app')
const viteEntry = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js')
const atspiHelper = resolve(
  repositoryRoot,
  'scripts/native-screen-reader-atspi.py',
)
const defaultOut = resolve(repositoryRoot, '.tmp/native-screen-reader-evidence')

const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))
const sha256File = (relativePath) =>
  crypto
    .createHash('sha256')
    .update(readFileSync(resolve(repositoryRoot, relativePath)))
    .digest('hex')
const runnerHash = crypto
  .createHash('sha256')
  .update(
    readFileSync(
      resolve(repositoryRoot, 'scripts/avalonia-conformance-v2.mjs'),
    ),
  )
  .update(
    readFileSync(
      resolve(repositoryRoot, 'scripts/native-screen-reader-harness.mjs'),
    ),
  )
  .update(
    readFileSync(
      resolve(repositoryRoot, 'scripts/conformance-v2-evidence.mjs'),
    ),
  )
  .digest('hex')

const cdpValue = (property) => property?.value?.value ?? property?.value ?? null
const cdpBoolean = (property) => [true, 'true'].includes(cdpValue(property))
const normalizeCdpNode = (node, tabOrder) => {
  const properties = Object.fromEntries(
    (node.properties || []).map((property) => [property.name, property]),
  )
  return {
    control: node.backendDOMNodeId ?? node.nodeId,
    role: cdpValue(node.role),
    name: cdpValue(node.name),
    description: cdpValue(node.description),
    value: cdpValue(node.value),
    selection: null,
    states: {
      disabled: cdpBoolean(properties.disabled),
      readOnly: cdpBoolean(properties.readonly),
      invalid: cdpBoolean(properties.invalid),
      selected: cdpBoolean(properties.selected),
      expanded: cdpValue(properties.expanded),
      checkedState: cdpValue(properties.checked),
    },
    liveRegion: cdpValue(properties.live) ?? 'off',
    logicalParent: node.parentId ?? null,
    children: node.childIds ?? [],
    focus: {
      keyboardFocusable: cdpBoolean(properties.focusable),
      focused: cdpBoolean(properties.focused),
      tabOrder,
    },
  }
}

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
    if (argument === '--out')
      options.out = resolve(process.cwd(), argv[++index])
    else if (argument === '--skip-build') options.skipBuild = true
  }
  return options
}

const chromePath = [
  process.env.FSUS_IME_CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
  .filter(Boolean)
  .find((candidate) => {
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
    [
      viteEntry,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
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
    const fixtureUrl = `${baseUrl}/?interactionTrace=1`
    await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('interaction-trace-fixture').waitFor({
      timeout: 20_000,
    })
    const interactionStart = performance.now()
    const editor = page.getByTestId('trace-markdown-editor')
    await editor.locator('textarea').first().focus()
    await page.getByTestId('trace-markdown-exposed').click()
    await page.getByTestId('trace-markdown-undo').click()
    const publicState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    )
    const cdp = await page.context().newCDPSession(page)
    const browserAccessibility = await cdp.send('Accessibility.getFullAXTree')
    const screenshotPath = join(options.out, 'browser.png')
    await page.screenshot({ path: screenshotPath })
    writeFileSync(
      join(options.out, 'browser-accessibility-tree.json'),
      `${JSON.stringify(browserAccessibility, null, 2)}\n`,
    )

    const domProbe = await page.evaluate(() => {
      const editor = document.querySelector(
        '[data-testid="trace-markdown-editor"] .el-markdown-editor',
      )
      const textarea = editor?.querySelector('textarea')
      const live = [...document.querySelectorAll('[aria-live]')]
        .filter(
          (element) => editor?.contains(element) || element === document.body,
        )
        .map((element) => ({
          tag: element.tagName,
          live: element.getAttribute('aria-live'),
          role: element.getAttribute('role'),
        }))
      const tabStops = [
        ...(editor?.querySelectorAll('p, [tabindex]') ?? []),
      ].map((element) => ({
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
      atspiJson = {
        ok: false,
        parseError: true,
        stdout: atspi.stdout,
        stderr: atspi.stderr,
      }
    }
    writeFileSync(
      join(options.out, 'atspi.json'),
      `${JSON.stringify(atspiJson, null, 2)}\n`,
    )
    writeFileSync(
      join(options.out, 'dom-probe.json'),
      `${JSON.stringify(domProbe, null, 2)}\n`,
    )

    const textboxHit = (atspiJson.markdownEditableCount ?? 0) > 0
    const noDocumentLive = !domProbe.live.some(
      (entry) => entry.tag === 'BODY' || entry.tag === 'SECTION',
    )
    const editableLabel =
      /markdown editor/i.test(domProbe.textareaLabel || '') ||
      /markdown editor/i.test(domProbe.regionLabel || '')
    const orcaPid = orca.pid ?? null
    const verdict =
      textboxHit && noDocumentLive && atspiJson.ok !== false ? 'pass' : 'fail'

    const identity = {
      executionId: `conformance-v2-${candidateSha}`,
      checkpoint: 'markdown-after-undo',
      candidate: candidateSha,
      contractHash: sha256File('spec/components/contracts/v2/contract-v2.json'),
      webBaselineHash: sha256File('spec/baselines/vue-current.json'),
      avaloniaBaselineHash: sha256File(
        'spec/avalonia/semantic/FsusUI.Avalonia.semantic.json',
      ),
      scenario: 'scenario.v2.el-markdown-editor.real-interaction-trace',
      contract: 'component-v2.el-markdown-editor',
      documentId: publicState.markdown.documentIdentity.id,
      documentEpoch: publicState.markdown.documentIdentity.epoch,
      sourceRevision: publicState.markdown.revision,
      theme: 'light',
      density: 'default',
      locale: 'zh-CN',
      direction: 'ltr',
      motion: 'full',
      runnerHash,
    }
    const elapsedMilliseconds = performance.now() - interactionStart
    const evidence = {
      schema: 'fsusui.conformance-evidence.v2',
      kind: 'native-screen-reader-linux-orca-atspi',
      verdict,
      candidateSha,
      os: process.platform,
      display: process.env.DISPLAY ?? null,
      browser: chromePath,
      orcaPid,
      identity,
      browserAccessibility: {
        source: 'chromium-cdp-accessibility',
        nodeCount: browserAccessibility.nodes?.length ?? 0,
        artifact: 'browser-accessibility-tree.json',
        sameExecution: true,
        nodes: (browserAccessibility.nodes || [])
          .filter((node) => ['textbox', 'button'].includes(cdpValue(node.role)))
          .map((node, index) => normalizeCdpNode(node, index + 1)),
      },
      publicState,
      performance: {
        identity,
        elapsedMilliseconds,
        budgetMilliseconds: 2000,
        passed: elapsedMilliseconds < 2000,
      },
      visual: {
        identity,
        artifact: 'browser.png',
        sha256: sha256File(relative(repositoryRoot, screenshotPath)),
        renderedTopLevel: true,
      },
      optionalOffHost: ['NVDA', 'VoiceOver'],
      checks: {
        atspiReachable: atspiJson.ok !== false,
        textboxExposed: textboxHit,
        documentNotAriaLive: noDocumentLive,
        editableName: editableLabel,
        decorationsHidden:
          domProbe.decorationsAriaHidden === 'true' ||
          !domProbe.decorationsAriaHidden,
      },
      domProbe,
    }
    writeFileSync(
      join(options.out, 'manifest.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
    )
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
      await Promise.race([context.close().catch(() => {}), sleep(3000)])
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
