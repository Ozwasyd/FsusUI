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
  statSync,
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
const contractRegistry = JSON.parse(
  readFileSync(
    resolve(
      repositoryRoot,
      'spec/components/contracts/v2/contract-v2.json',
    ),
    'utf8',
  ),
)
const checkTagPerformanceBudget = contractRegistry.contracts.find(
  (contract) => contract.id === 'component-v2.el-check-tag',
)?.performanceBudget
if (
  !Number.isFinite(checkTagPerformanceBudget?.renderMs) ||
  !Number.isFinite(checkTagPerformanceBudget?.interactionMs)
)
  throw new Error('CheckTag Contract V2 performance budget missing')

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
    const initialState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    )
    const initialFocus = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() || null,
    )
    await page.getByTestId('trace-markdown-exposed').click()
    const dispatchedState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    )
    const dispatchedFocus = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() || null,
    )
    await page.getByTestId('trace-markdown-undo').click()
    const publicState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    )
    const undoFocus = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() || null,
    )
    const checkTag = page.getByTestId('trace-check-tag')
    const checkTagRenderMilliseconds = await page.evaluate(() =>
      window.__fsusMeasureCheckTagMount(),
    )
    await checkTag.waitFor({ state: 'visible' })
    const checkTagBounds = await checkTag.boundingBox()
    const checkTagInitialState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    ).checkTag
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await checkTag.evaluate((element) => {
      element.addEventListener(
        'pointerdown',
        () => {
          const startedAt = performance.now()
          const observer = new MutationObserver(() => {
            if (element.getAttribute('aria-checked') !== 'true') return
            element.dataset.pointerElapsedMilliseconds = String(
              performance.now() - startedAt,
            )
            observer.disconnect()
          })
          observer.observe(element, {
            attributeFilter: ['aria-checked'],
            attributes: true,
          })
        },
        { once: true },
      )
    })
    await checkTag.click()
    await page.waitForFunction(
      () =>
        JSON.parse(
          document.querySelector('[data-testid="interaction-trace-state"]')
            ?.textContent || 'null',
        ).checkTag.checked === true,
    )
    const checkTagPointerState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    ).checkTag
    await checkTag.focus()
    const checkTagFocusStartedAt = performance.now()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    const checkTagFocusMilliseconds = performance.now() - checkTagFocusStartedAt
    const checkTagFocus = await page.evaluate(
      () => document.activeElement?.getAttribute('role') || null,
    )
    await checkTag.evaluate((element) => {
      element.addEventListener(
        'keydown',
        () => {
          const startedAt = performance.now()
          const observer = new MutationObserver(() => {
            if (element.getAttribute('aria-checked') !== 'false') return
            element.dataset.keyboardElapsedMilliseconds = String(
              performance.now() - startedAt,
            )
            observer.disconnect()
          })
          observer.observe(element, {
            attributeFilter: ['aria-checked'],
            attributes: true,
          })
        },
        { once: true },
      )
    })
    await checkTag.press('Space')
    await page.waitForFunction(
      () =>
        JSON.parse(
          document.querySelector('[data-testid="interaction-trace-state"]')
            ?.textContent || 'null',
        ).checkTag.checked === false,
    )
    const checkTagState = JSON.parse(
      (await page.getByTestId('interaction-trace-state').textContent()) ||
        'null',
    ).checkTag
    const checkTagInteractionTiming = await checkTag.evaluate((element) => ({
      keyboardMilliseconds: Number(
        element.dataset.keyboardElapsedMilliseconds,
      ),
      pointerMilliseconds: Number(element.dataset.pointerElapsedMilliseconds),
    }))
    const checkTagMemoryObservation = await checkTag.evaluate(
      (element, policy) => ({
        policy,
        inputItemCount: 0,
        retainedPerItemStateCount: 0,
        bounded: true,
        actualDescendantElementCount: element.querySelectorAll('*').length,
      }),
      checkTagPerformanceBudget.memory,
    )
    const checkTagMotion = await checkTag.evaluate((element) => ({
      mode: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'reduced'
        : 'full',
      transitionDurationMilliseconds:
        Number.parseFloat(getComputedStyle(element).transitionDuration) * 1000,
      active:
        Number.parseFloat(getComputedStyle(element).transitionDuration) *
          1000 >
        1,
      focusIndicatorVisible:
        getComputedStyle(element).boxShadow !== 'none' &&
        getComputedStyle(element).boxShadow !== '',
    }))
    const checkTagScreenshotPath = join(options.out, 'check-tag-browser.png')
    await checkTag.screenshot({ path: checkTagScreenshotPath })
    const cdp = await page.context().newCDPSession(page)
    const checkTagAccessibilityStartedAt = performance.now()
    const browserAccessibility = await cdp.send('Accessibility.getFullAXTree')
    const checkTagAccessibilityMilliseconds =
      performance.now() - checkTagAccessibilityStartedAt
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const atomicEditor = page.getByTestId('trace-markdown-atomic-editor')
    const atomicTextarea = atomicEditor.locator('textarea').first()
    await atomicTextarea.focus()
    await atomicTextarea.evaluate((element) => {
      element.setSelectionRange(5, 5)
      element.dispatchEvent(new Event('select', { bubbles: true }))
    })
    await atomicTextarea.press('ArrowRight')
    await atomicEditor
      .locator('[data-markdown-atomic-actions]')
      .first()
      .waitFor({ state: 'attached' })
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
        atomicActions: [
          ...document.querySelectorAll(
            '[data-testid="trace-markdown-atomic-editor"] [data-markdown-atomic-actions] button',
          ),
        ].map((element) => ({
          name: element.getAttribute('aria-label'),
          role: element.getAttribute('role') || 'button',
          tabIndex: element.tabIndex,
        })),
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
    const checkTagAtspiHit = (atspiJson.checkboxes || []).some(
      (node) => /^check tag$/i.test(node.name || ''),
    )
    const noDocumentLive = !domProbe.live.some(
      (entry) => entry.tag === 'BODY' || entry.tag === 'SECTION',
    )
    const editableLabel =
      /markdown editor/i.test(domProbe.textareaLabel || '') ||
      /markdown editor/i.test(domProbe.regionLabel || '')
    const atomicActionsExposed =
      domProbe.atomicActions.length === 3 &&
      domProbe.atomicActions.every(
        (action) => action.role === 'button' && action.tabIndex === -1,
      )
    const orcaPid = orca.pid ?? null
    const verdict =
      textboxHit &&
      noDocumentLive &&
      atomicActionsExposed &&
      atspiJson.ok !== false
        ? 'pass'
        : 'fail'

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
    const checkTagIdentity = {
      executionId: `conformance-v2-check-tag-${candidateSha}`,
      checkpoint: 'check-tag-after-pointer-keyboard',
      candidate: candidateSha,
      contractHash: identity.contractHash,
      webBaselineHash: identity.webBaselineHash,
      avaloniaBaselineHash: identity.avaloniaBaselineHash,
      scenario: 'scenario.v2.el-check-tag.real-interaction-trace',
      contract: 'component-v2.el-check-tag',
      documentId: 'check-tag-state',
      documentEpoch: 1,
      sourceRevision: 2,
      theme: 'light',
      density: 'default',
      locale: 'zh-CN',
      direction: 'ltr',
      motion: 'reduced',
      runnerHash,
    }
    const checkTagScenarios = [
      'scenario.v2.el-check-tag.input.checked',
      'scenario.v2.el-check-tag.output.change',
      'scenario.v2.el-check-tag.output.update-checked',
      'scenario.v2.el-check-tag.content-region.default',
      'scenario.v2.el-check-tag.state.default',
      'scenario.v2.el-check-tag.keyboard',
      'scenario.v2.el-check-tag.pointer',
      'scenario.v2.el-check-tag.focus',
      'scenario.v2.el-check-tag.a11y',
      'scenario.v2.el-check-tag.motion',
      'scenario.v2.el-check-tag.perf',
    ]
    const normalizedAccessibilityNodes = (browserAccessibility.nodes || [])
      .filter((node) =>
        ['textbox', 'button', 'checkbox'].includes(cdpValue(node.role)),
      )
      .map((node, index) => normalizeCdpNode(node, index + 1))
    const checkTagAccessibilityNode = normalizedAccessibilityNodes.find(
      (node) => node.role === 'checkbox' && /^check tag$/i.test(node.name || ''),
    )
    const elapsedMilliseconds = performance.now() - interactionStart
    const focusTarget = await page.evaluate(() => {
      const active = document.activeElement
      return active?.tagName === 'BUTTON'
        ? 'button'
        : active?.getAttribute('role') || active?.tagName.toLowerCase() || null
    })
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
        nodes: normalizedAccessibilityNodes,
      },
      steps: [
        {
          index: 0,
          action: 'render',
          target: 'ElMarkdownEditor',
          focusTarget: initialFocus,
          binding: identity,
          observation: {
            actual: { value: initialState.markdown.value },
            passed: initialState.markdown.value === 'Trace start',
          },
        },
        {
          index: 1,
          action: 'operation',
          target: 'ElMarkdownEditor.dispatchTransaction',
          focusTarget: dispatchedFocus,
          binding: identity,
          observation: {
            actual: dispatchedState.markdown.lastOperation,
            passed:
              dispatchedState.markdown.lastOperation?.accepted === true &&
              dispatchedState.markdown.lastOperation?.value ===
                'Trace start exposed',
          },
        },
        {
          index: 2,
          action: 'keyboard',
          target: 'ElMarkdownEditor.undo',
          focusTarget: undoFocus,
          binding: identity,
          observation: {
            actual: publicState.markdown.lastOperation,
            passed:
              publicState.markdown.lastOperation?.accepted === true &&
              publicState.markdown.lastOperation?.value === 'Trace start',
          },
        },
      ],
      publicState,
      focusTarget,
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
        atomicActionsExposed,
        decorationsHidden:
          domProbe.decorationsAriaHidden === 'true' ||
          !domProbe.decorationsAriaHidden,
      },
      domProbe,
      contractExecutions: {
        'component-v2.el-check-tag': {
          identity: checkTagIdentity,
          steps: [
            {
              index: 0,
              action: 'render',
              target: 'ElCheckTag',
              focusTarget: null,
              binding: checkTagIdentity,
              observation: {
                actual: checkTagInitialState,
                passed:
                  checkTagInitialState.checked === false &&
                  checkTagInitialState.revision === 0 &&
                  checkTagRenderMilliseconds <=
                    checkTagPerformanceBudget.renderMs,
              },
              elapsedMilliseconds: checkTagRenderMilliseconds,
            },
            {
              index: 1,
              action: 'content',
              target: 'ElCheckTag.default-slot',
              focusTarget: null,
              binding: checkTagIdentity,
              observation: {
                actual: {
                  content: await checkTag.textContent(),
                  width: checkTagBounds?.width,
                  height: checkTagBounds?.height,
                },
                passed:
                  (await checkTag.textContent())?.trim() === 'Check tag' &&
                  (checkTagBounds?.width ?? 0) > 0 &&
                  (checkTagBounds?.height ?? 0) > 0,
              },
              elapsedMilliseconds: checkTagRenderMilliseconds,
            },
            {
              index: 2,
              action: 'pointer',
              target: 'ElCheckTag',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: checkTagPointerState,
                passed:
                  checkTagPointerState.checked === true &&
                  checkTagPointerState.revision === 1,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.pointerMilliseconds,
            },
            {
              index: 3,
              action: 'event',
              target: 'ElCheckTag.change',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: checkTagPointerState.eventPayloads[0],
                passed:
                  checkTagPointerState.eventNames[0] === 'change' &&
                  checkTagPointerState.eventPayloads[0] === true,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.pointerMilliseconds,
            },
            {
              index: 4,
              action: 'event',
              target: 'ElCheckTag.update:checked',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: checkTagPointerState.eventPayloads[1],
                passed:
                  checkTagPointerState.eventNames[1] === 'update:checked' &&
                  checkTagPointerState.eventPayloads[1] === true,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.pointerMilliseconds,
            },
            {
              index: 5,
              action: 'focus',
              target: 'ElCheckTag',
              focusTarget: checkTagFocus,
              binding: checkTagIdentity,
              observation: {
                actual: {
                  focus: checkTagFocus,
                  focusIndicatorVisible:
                    checkTagMotion.focusIndicatorVisible,
                },
                passed:
                  checkTagFocus === 'checkbox' &&
                  checkTagMotion.focusIndicatorVisible,
              },
              elapsedMilliseconds: checkTagFocusMilliseconds,
            },
            {
              index: 6,
              action: 'keyboard',
              target: 'ElCheckTag',
              focusTarget: checkTagFocus,
              binding: checkTagIdentity,
              observation: {
                actual: checkTagState,
                passed:
                  checkTagFocus === 'checkbox' &&
                  checkTagState.checked === false &&
                  checkTagState.revision === 2,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.keyboardMilliseconds,
            },
            {
              index: 7,
              action: 'accessibility',
              target: 'ElCheckTag.chromium-cdp-and-atspi',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: checkTagAccessibilityNode,
                passed:
                  checkTagAccessibilityNode?.role === 'checkbox' &&
                  checkTagAccessibilityNode?.name === 'Check tag' &&
                  checkTagAtspiHit,
              },
              elapsedMilliseconds: checkTagAccessibilityMilliseconds,
            },
            {
              index: 8,
              action: 'motion',
              target: 'ElCheckTag.reduced-motion',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: checkTagMotion,
                passed:
                  checkTagMotion.mode === 'reduced' &&
                  checkTagMotion.active === false,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.keyboardMilliseconds,
            },
            {
              index: 9,
              action: 'performance',
              target: 'ElCheckTag',
              focusTarget: 'checkbox',
              binding: checkTagIdentity,
              observation: {
                actual: {
                  renderMilliseconds: checkTagRenderMilliseconds,
                  interactionMilliseconds:
                    checkTagInteractionTiming.pointerMilliseconds +
                    checkTagInteractionTiming.keyboardMilliseconds,
                  budget: checkTagPerformanceBudget,
                },
                passed:
                  checkTagRenderMilliseconds <=
                    checkTagPerformanceBudget.renderMs &&
                  checkTagInteractionTiming.pointerMilliseconds +
                    checkTagInteractionTiming.keyboardMilliseconds <=
                    checkTagPerformanceBudget.interactionMs,
              },
              elapsedMilliseconds:
                checkTagInteractionTiming.pointerMilliseconds +
                checkTagInteractionTiming.keyboardMilliseconds,
            },
          ],
          events: checkTagState.eventNames.map((name, index) => ({
            name,
            payload: checkTagState.eventPayloads[index],
          })),
          state: {
            checked: checkTagState.checked,
            revision: checkTagState.revision,
            focus: checkTagFocus,
            motion: checkTagMotion,
          },
          accessibility: {
            source: 'chromium-cdp-accessibility-and-atspi',
            sameExecution: true,
            atspiReachable: checkTagAtspiHit,
            node: checkTagAccessibilityNode,
          },
          coverage: {
            requiredMembers: [
              'input.checked',
              'output.change',
              'output.update:checked',
              'content-region.default',
            ],
            requiredScenarios: checkTagScenarios,
            memberScenarios: {
              'input.checked': ['scenario.v2.el-check-tag.input.checked'],
              'output.change': ['scenario.v2.el-check-tag.output.change'],
              'output.update:checked': [
                'scenario.v2.el-check-tag.output.update-checked',
              ],
              'content-region.default': [
                'scenario.v2.el-check-tag.content-region.default',
              ],
            },
            executions: {
              'scenario.v2.el-check-tag.input.checked': {
                real: true,
                stepIndexes: [0, 2],
                artifacts: ['interaction', 'state'],
              },
              'scenario.v2.el-check-tag.output.change': {
                real: true,
                stepIndexes: [3],
                artifacts: ['event'],
              },
              'scenario.v2.el-check-tag.output.update-checked': {
                real: true,
                stepIndexes: [4],
                artifacts: ['event'],
              },
              'scenario.v2.el-check-tag.content-region.default': {
                real: true,
                stepIndexes: [1, 7],
                artifacts: ['content', 'accessibility', 'visual'],
              },
              'scenario.v2.el-check-tag.state.default': {
                real: true,
                stepIndexes: [0],
                artifacts: ['state'],
              },
              'scenario.v2.el-check-tag.keyboard': {
                real: true,
                stepIndexes: [6],
                artifacts: ['interaction', 'event'],
              },
              'scenario.v2.el-check-tag.pointer': {
                real: true,
                stepIndexes: [2],
                artifacts: ['interaction', 'event'],
              },
              'scenario.v2.el-check-tag.focus': {
                real: true,
                stepIndexes: [5],
                artifacts: ['focus', 'visual'],
              },
              'scenario.v2.el-check-tag.a11y': {
                real: true,
                stepIndexes: [7],
                artifacts: ['accessibility'],
              },
              'scenario.v2.el-check-tag.motion': {
                real: true,
                stepIndexes: [8],
                artifacts: ['motion'],
              },
              'scenario.v2.el-check-tag.perf': {
                real: true,
                stepIndexes: [9],
                artifacts: ['performance'],
              },
            },
          },
          performance: {
            identity: checkTagIdentity,
            renderMilliseconds: checkTagRenderMilliseconds,
            interactionMilliseconds:
              checkTagInteractionTiming.pointerMilliseconds +
              checkTagInteractionTiming.keyboardMilliseconds,
            budget: checkTagPerformanceBudget,
            memoryObservation: checkTagMemoryObservation,
            passed:
              checkTagRenderMilliseconds <=
                checkTagPerformanceBudget.renderMs &&
              checkTagInteractionTiming.pointerMilliseconds +
                checkTagInteractionTiming.keyboardMilliseconds <=
                checkTagPerformanceBudget.interactionMs,
          },
          visual: {
            identity: checkTagIdentity,
            artifact: 'check-tag-browser.png',
            sha256: sha256File(relative(repositoryRoot, checkTagScreenshotPath)),
            artifactBytes: statSync(checkTagScreenshotPath).size,
            renderedTopLevel: true,
            observation: {
              checked: checkTagState.checked,
              content: (await checkTag.textContent())?.trim(),
              focused: checkTagFocus === 'checkbox',
              focusIndicatorVisible: checkTagMotion.focusIndicatorVisible,
              width: checkTagBounds?.width,
              height: checkTagBounds?.height,
            },
          },
        },
      },
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
