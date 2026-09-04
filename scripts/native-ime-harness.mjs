#!/usr/bin/env node

/**
 * Native CJK IME acceptance harness for ElMarkdownEditor.
 *
 * Runs a real headed browser on a real X11 display, focuses the demo fixture's
 * real textarea, and injects OS-native ibus keystrokes through XTEST.
 * Every acceptance path (commit, cancel, candidate selection, Backspace,
 * undo/redo) is bound to a full candidate SHA, OS, browser, IME, locale,
 * window/PID, page/document and fixture identity, and written as non-empty
 * evidence under .tmp/native-ime-evidence (or --out).
 *
 * This harness is intentionally NOT part of the default CI gates: it requires
 * a Linux X11 session with a real CJK IME engine. It fails explicitly (never
 * prints a green receipt) when the runtime cannot be established.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, webkit } from 'playwright'

import {
  connectMarionette,
  createMarionettePage,
  spawnOfficialFirefox,
} from './native-ime-marionette.mjs'
import {
  computeX11Target,
  resolveBrowserProfile,
  resolveEngineProfile,
  resolveOfficialFirefox,
  scriptPattern,
} from './native-ime-profiles.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const x11Helper = resolve(repositoryRoot, 'scripts/native-ime-x11.py')
const demoAppDirectory = resolve(repositoryRoot, 'vue/packages/demo-app')
const viteEntry = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js')
const defaultOutputDirectory = resolve(
  repositoryRoot,
  '.tmp/native-ime-evidence',
)
const fixtureTestId = 'markdown-editor-transaction-fixture'
const defaultEditorSelector = `[data-testid="${fixtureTestId}"] .el-markdown-editor textarea`

const EXIT_CODES = {
  'prerequisite-missing': 2,
  'page-not-ready': 3,
  'target-absent': 4,
  'window-pid-mismatch': 5,
  'input-not-delivered': 6,
  'composition-not-started': 7,
  'assertion-failed': 8,
  'internal-error': 9,
}

class HarnessFailure extends Error {
  constructor(category, message) {
    super(message)
    this.category = category
  }
}

const fail = (category, message) => {
  throw new HarnessFailure(category, message)
}

const environment = (name, fallback) => process.env[name] ?? fallback

const readEnvironmentJson = (name) => {
  const raw = process.env[name]
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const sleep = (milliseconds) =>
  new Promise((resolveWait) =>
    globalThis.setTimeout(resolveWait, milliseconds),
  )

const parseArguments = (argv) => {
  const options = {
    out: defaultOutputDirectory,
    skipBuild: false,
    noScreenshot: false,
    help: false,
    engine: environment('FSUS_IME_ENGINE', environment('FSUS_IME_REQUIRE_ENGINE', 'libpinyin')),
    browser: environment('FSUS_IME_BROWSER', 'chromium'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      options.help = true
    } else if (argument === '--skip-build') {
      options.skipBuild = true
    } else if (argument === '--no-screenshot') {
      options.noScreenshot = true
    } else if (argument === '--out') {
      options.out = resolve(process.cwd(), argv[++index])
    } else if (argument.startsWith('--out=')) {
      options.out = resolve(process.cwd(), argument.slice('--out='.length))
    } else if (argument === '--engine') {
      options.engine = argv[++index]
    } else if (argument.startsWith('--engine=')) {
      options.engine = argument.slice('--engine='.length)
    } else if (argument === '--browser') {
      options.browser = argv[++index]
    } else if (argument.startsWith('--browser=')) {
      options.browser = argument.slice('--browser='.length)
    } else {
      fail('internal-error', `unknown argument: ${argument}`)
    }
  }
  return options
}

const osRelease = () => {
  try {
    const data = readFileSync('/etc/os-release', 'utf8')
    const record = {}
    for (const line of data.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line)
      if (!match) continue
      record[match[1]] = match[2].replaceAll('"', '')
    }
    return {
      id: record.ID ?? null,
      name: record.NAME ?? null,
      version: record.VERSION_ID ?? null,
    }
  } catch {
    return { id: null, name: null, version: null }
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
  if (!port) fail('internal-error', 'could not allocate a free port')
  return port
}

const waitForServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, {
        signal: globalThis.AbortSignal.timeout(1500),
      })
      if (response.ok) return
      lastError = new Error(`server returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(300)
  }
  fail(
    'page-not-ready',
    `demo preview did not become ready at ${url}: ${lastError?.message ?? 'timeout'}`,
  )
}

const runPythonX11 = (args, display) => {
  const python = environment('FSUS_IME_PYTHON', 'python3')
  const result = spawnSync(python, [x11Helper, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, DISPLAY: display },
  })
  const line = (result.stdout ?? '')
    .split('\n')
    .filter((entry) => entry.startsWith('X11_STATUS '))
    .at(-1)
  if (!line) {
    fail(
      'internal-error',
      `X11 helper produced no status: ${result.stderr || result.stdout}`,
    )
  }
  const parsed = JSON.parse(line.slice('X11_STATUS '.length))
  if (!parsed.ok) {
    fail(parsed.category ?? 'internal-error', parsed.message ?? 'X11 helper failed')
  }
  return parsed
}

const findSystemChrome = () => {
  const chromeCandidates = [
    environment('FSUS_IME_CHROME_PATH', ''),
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  return chromeCandidates.find((candidate) => {
    try {
      readFileSync(candidate)
      return true
    } catch {
      return false
    }
  })
}

const switchIbusEngine = (browserEnvironment, ibusName) => {
  let engine = ''
  for (let attempt = 0; attempt < 8; attempt += 1) {
    spawnSync('ibus', ['engine', ibusName], {
      encoding: 'utf8',
      env: browserEnvironment,
    })
    spawnSync('sleep', ['0.25'])
    const engineProbe = spawnSync('ibus', ['engine'], {
      encoding: 'utf8',
      env: browserEnvironment,
    })
    engine = (engineProbe.stdout ?? '').trim()
    if (engineProbe.status === 0 && engine.includes(ibusName)) return engine
  }
  fail(
    'prerequisite-missing',
    `ibus engine could not be selected as "${ibusName}"; reports "${engine}"`,
  )
}

const verifyPrerequisites = (browserEnvironment, engineProfile, browserProfile) => {
  if (process.platform !== 'linux') {
    fail(
      'prerequisite-missing',
      `native IME harness requires Linux + X11; platform=${process.platform}`,
    )
  }
  const display = environment('FSUS_IME_DISPLAY', process.env.DISPLAY)
  if (!display) {
    fail(
      'prerequisite-missing',
      'DISPLAY is not set (FSUS_IME_DISPLAY or DISPLAY)',
    )
  }
  const python = environment('FSUS_IME_PYTHON', 'python3')
  const pythonCheck = spawnSync(
    python,
    ['-c', 'import Xlib; import Xlib.ext.xtest'],
    { encoding: 'utf8' },
  )
  if (pythonCheck.status !== 0) {
    fail(
      'prerequisite-missing',
      `${python} cannot import python-xlib: ${pythonCheck.stderr}`,
    )
  }
  let chromePath = null
  if (browserProfile.needsSystemChrome) {
    chromePath = findSystemChrome()
    if (!chromePath) {
      fail(
        'prerequisite-missing',
        'no Chromium executable found (set FSUS_IME_CHROME_PATH)',
      )
    }
  }
  const engine = switchIbusEngine(browserEnvironment, engineProfile.ibusName)
  spawnSync('setxkbmap', ['-layout', 'us'], {
    encoding: 'utf8',
    env: browserEnvironment,
  })
  spawnSync('sleep', ['0.4'])
  return { chromePath, display, engine }
}

const findBrowserPid = (profileDirectory) => {
  const profile = realpathSync(profileDirectory)
  const matches = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/u.test(entry)) continue
    let commandLine = ''
    try {
      commandLine = readFileSync(join('/proc', entry, 'cmdline'), 'utf8')
    } catch {
      continue
    }
    const normalized = commandLine.replaceAll('\0', ' ')
    if (
      normalized.includes(profile) &&
      !normalized.includes('--type=') &&
      !normalized.includes('plugin-container') &&
      !normalized.includes('crashpad')
    ) {
      matches.push(Number(entry))
    }
  }
  if (matches.length === 0) {
    fail(
      'window-pid-mismatch',
      `no browser process found for profile ${profile}`,
    )
  }
  return { pid: matches[0], candidates: matches }
}

const readEditorState = (page) =>
  page.evaluate(() => {
    const fixture = document.querySelector(
      '[data-testid="markdown-editor-transaction-fixture"]',
    )
    const textarea = fixture?.querySelector('.el-markdown-editor textarea')
    const readOutput = (testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`)
      const text = element?.textContent?.trim()
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
    return {
      documentId: window.__fsusNativeImeDocumentId ?? null,
      probeId: fixture?.getAttribute('data-markdown-editor-probe-id') ?? null,
      fixtureVisible: fixture ? true : false,
      textareaPresent: textarea ? true : false,
      textareaEnabled: textarea ? !textarea.disabled : false,
      activeIsTextarea: document.activeElement === textarea,
      value: textarea?.value ?? null,
      selection:
        textarea && textarea.selectionStart !== undefined
          ? {
              start: textarea.selectionStart,
              end: textarea.selectionEnd,
              direction: textarea.selectionDirection,
            }
          : null,
      history: readOutput('markdown-editor-history'),
      lastTransaction: readOutput('markdown-editor-last-transaction'),
      selectionEvent: readOutput('markdown-editor-selection'),
      revision: readOutput('markdown-editor-revision'),
      trace: window.__fsusImeTrace ?? [],
    }
  })

const installTrace = (page) =>
  page.evaluate(() => {
    const trace = []
    window.__fsusImeTrace = trace
    const fixture = document.querySelector(
      '[data-testid="markdown-editor-transaction-fixture"]',
    )
    const textarea = fixture?.querySelector('.el-markdown-editor textarea')
    if (!textarea) return false
    const eventNames = [
      'keydown',
      'keyup',
      'beforeinput',
      'input',
      'compositionstart',
      'compositionupdate',
      'compositionend',
    ]
    for (const name of eventNames) {
      textarea.addEventListener(name, (event) => {
        trace.push({
          name,
          data: event.data ?? null,
          key: event.key ?? null,
          code: event.code ?? null,
          inputType: event.inputType ?? null,
          isComposing: event.isComposing ?? null,
          value: textarea.value,
          time: Date.now(),
        })
      })
    }
    return true
  })

const bindDocumentIdentity = (page) =>
  page.evaluate(() => {
    if (!window.__fsusNativeImeDocumentId) {
      window.__fsusNativeImeDocumentId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random()}`
    }
    return {
      documentId: window.__fsusNativeImeDocumentId,
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
    }
  })

const readEditorBox = (page) =>
  page.evaluate(() => {
    const fixture = document.querySelector(
      '[data-testid="markdown-editor-transaction-fixture"]',
    )
    const textarea = fixture?.querySelector('.el-markdown-editor textarea')
    if (!textarea) return null
    const rectangle = textarea.getBoundingClientRect()
    return {
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      rect: {
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
      },
    }
  })

const computeTarget = (box, windowGeometry) => {
  if (!box || !Array.isArray(windowGeometry) || windowGeometry.length < 4) {
    return null
  }
  const point = computeX11Target({
    windowGeometry,
    devicePixelRatio: box.devicePixelRatio,
    innerWidth: box.innerWidth,
    innerHeight: box.innerHeight,
    rect: box.rect,
  })
  return { ...point, rect: box.rect }
}

/**
 * A visible fixture is not sufficient for native input: a delayed Vue mount can
 * replace the textarea after the locator resolves.  Bind the trace and X11
 * target only after the final textarea is connected, enabled, and has a usable
 * layout box in the current document.
 */
const waitForInteractiveEditor = async (page, editorSelector, timeoutMs) => {
  try {
    await page
      .locator(`[data-testid="${fixtureTestId}"]`)
      .waitFor({ state: 'visible', timeout: timeoutMs })
    await page.locator(editorSelector).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.waitForFunction(
      (selector) => {
        const textarea = document.querySelector(selector)
        if (!(textarea instanceof HTMLTextAreaElement)) return false
        const rectangle = textarea.getBoundingClientRect()
        return (
          textarea.isConnected &&
          !textarea.disabled &&
          rectangle.width > 0 &&
          rectangle.height > 0
        )
      },
      editorSelector,
      { timeout: timeoutMs },
    )
  } catch (error) {
    fail(
      'target-absent',
      `fixture/editor did not become interactive within ${timeoutMs}ms: ${error.message}`,
    )
  }
}

const hasEvent = (trace, name) => trace.some((entry) => entry.name === name)

const isNativeCompositionCommit = (state, script) => {
  const value = state.value ?? ''
  if (!script.test(value)) return false
  if (
    !hasEvent(state.trace, 'compositionstart') ||
    !hasEvent(state.trace, 'compositionend')
  ) {
    return false
  }
  if (!state.history?.canUndo) return false
  const transaction = state.lastTransaction?.transaction
  if (transaction?.metadata?.composition === true) {
    return transaction.origin === 'input' && transaction.history === 'separate'
  }
  // Hangul confirms the last syllable with Space; lastTransaction is then the
  // trailing space, not the composition commit.
  return true
}

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const printUsage = () => {
  console.log(`[native-ime] usage: node scripts/native-ime-harness.mjs [options]
  --out <directory>  evidence output directory (default .tmp/native-ime-evidence)
  --engine <name>    ibus engine: libpinyin|chewing|mozc-jp|hangul
  --browser <name>   headed browser: chromium|firefox|webkit
  --skip-build       reuse the existing demo build
  --no-screenshot    do not capture per-step screenshots
  --help             show this help

Environment:
  FSUS_IME_DISPLAY, FSUS_IME_CHROME_PATH, FSUS_IME_PYTHON,
  FSUS_IME_ENGINE / FSUS_IME_REQUIRE_ENGINE (default libpinyin),
  FSUS_IME_BROWSER (default chromium), FSUS_IME_EDITOR_SELECTOR,
  FSUS_IME_EXPECT_WINDOW_CLASS (defaults from the browser profile),
  FSUS_IME_DELAY_MOUNT_MS, FSUS_IME_MOUNT_TIMEOUT_MS,
  FSUS_IME_STEP_TIMEOUT_MS, FSUS_IME_SKIP_BUILD (same as --skip-build),
  FSUS_IME_EXTRA_ENV (JSON object merged into the browser/ibus environment,
  e.g. DBUS_SESSION_BUS_ADDRESS).`)
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }
  options.skipBuild =
    options.skipBuild || environment('FSUS_IME_SKIP_BUILD', '') === '1'

  const engineProfile = resolveEngineProfile(options.engine)
  const browserProfile = resolveBrowserProfile(options.browser)
  const committedScript = scriptPattern(engineProfile.scriptName)
  const display = environment('FSUS_IME_DISPLAY', process.env.DISPLAY)
  const requiredEngine = engineProfile.ibusName
  const editorSelector = environment(
    'FSUS_IME_EDITOR_SELECTOR',
    defaultEditorSelector,
  )
  const mountTimeoutMs = Number(
    environment('FSUS_IME_MOUNT_TIMEOUT_MS', '20000'),
  )
  const stepTimeoutMs = Number(
    environment('FSUS_IME_STEP_TIMEOUT_MS', '15000'),
  )
  const delayMountMs = Number(environment('FSUS_IME_DELAY_MOUNT_MS', '0'))
  const expectedWindowClass = environment(
    'FSUS_IME_EXPECT_WINDOW_CLASS',
    browserProfile.windowClass,
  )
  const extraEnvironment = readEnvironmentJson('FSUS_IME_EXTRA_ENV')
  const browserEnvironment = {
    ...process.env,
    ...extraEnvironment,
    DISPLAY: display,
    GTK_IM_MODULE: browserProfile.gtkImModule || 'ibus',
    QT_IM_MODULE: 'ibus',
    XMODIFIERS: '@im=ibus',
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      join(process.env.HOME || '/home/lyuaoss', '.cache/ms-playwright'),
    MOZ_DISABLE_CONTENT_SANDBOX:
      browserProfile.name === 'firefox' ? '1' : process.env.MOZ_DISABLE_CONTENT_SANDBOX,
    IBUS_USE_PORTAL: '0',
    IBUS_ADDRESS: process.env.IBUS_ADDRESS || extraEnvironment.IBUS_ADDRESS || '',
    IBUS_ENABLE_SYNC_MODE: '1',
  }
  const { chromePath, engine } = verifyPrerequisites(
    browserEnvironment,
    engineProfile,
    browserProfile,
  )

  const candidateSha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).stdout.trim()
  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).stdout.trim()
  if (!/^[0-9a-f]{40}$/u.test(candidateSha)) {
    fail(
      'internal-error',
      `could not resolve candidate SHA from ${repositoryRoot}`,
    )
  }

  const outputDirectory = options.out
  rmSync(outputDirectory, { force: true, recursive: true })
  mkdirSync(join(outputDirectory, 'steps'), { recursive: true })
  mkdirSync(join(outputDirectory, 'screenshots'), { recursive: true })

  const startedAt = new Date().toISOString()
  let serverProcess = null
  let context = null
  let firefoxProcess = null
  let marionetteSession = null
  let profileDirectory = null
  const evidence = {
    schemaVersion: 1,
    verdict: 'fail',
    candidateSha,
    branch,
    repositoryRoot,
    startedAt,
    os: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      ...osRelease(),
    },
    browser: {
      name: browserProfile.name,
      executable: chromePath,
      pid: null,
      userAgent: null,
      profile: null,
    },
    ime: {
      engine,
      requiredEngine,
      enginePid: null,
      display,
    },
    locale: {
      pageLocale: engineProfile.locale,
      envLang: process.env.LANG ?? null,
      envLcAll: process.env.LC_ALL ?? null,
    },
    matrix: {
      engine: engineProfile.ibusName,
      browser: browserProfile.name,
      script: engineProfile.scriptName,
    },
    window: null,
    page: null,
    fixture: {
      testId: fixtureTestId,
      selector: editorSelector,
    },
    steps: [],
  }

  const cleanup = async () => {
    if (marionetteSession) {
      try {
        marionetteSession.close()
      } catch {
        // best-effort cleanup
      }
      marionetteSession = null
    }
    if (firefoxProcess && firefoxProcess.exitCode === null) {
      firefoxProcess.kill('SIGTERM')
      firefoxProcess = null
    }
    if (context) {
      try {
        await context.close()
      } catch {
        // best-effort cleanup
      }
      context = null
    }
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM')
    }
    if (profileDirectory) {
      rmSync(profileDirectory, { force: true, recursive: true })
      profileDirectory = null
    }
  }

  try {
    if (!options.skipBuild) {
      console.log('[native-ime] building demo for candidate SHA', candidateSha)
      const build = spawnSync('pnpm', ['run', 'build:demo'], {
        cwd: repositoryRoot,
        stdio: 'inherit',
      })
      if (build.status !== 0) {
        fail('page-not-ready', `pnpm run build:demo exited with ${build.status}`)
      }
    }

    const port = await findFreePort()
    const baseUrl = `http://127.0.0.1:${port}`
    serverProcess = spawn(
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
      {
        cwd: demoAppDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    serverProcess.stdout.on('data', () => {})
    serverProcess.stderr.on('data', () => {})
    await waitForServer(baseUrl, 30_000)

    const fixtureQuery = new globalThis.URLSearchParams({
      audit: 'ui-states',
      markdownEditorTransaction: '1',
      markdownEditorIme: '1',
    })
    if (delayMountMs > 0) {
      fixtureQuery.set('markdownEditorDelayMount', String(delayMountMs))
    }
    const fixtureUrl = `${baseUrl}/?${fixtureQuery.toString()}`

    profileDirectory = mkdtempSync(join(tmpdir(), 'fsusui-native-ime-profile-'))
    let page
    if (browserProfile.name === 'firefox') {
      const firefoxPath = resolveOfficialFirefox()
      if (!firefoxPath) {
        fail(
          'prerequisite-missing',
          'official Firefox not found (set FSUS_IME_FIREFOX_PATH or install to ~/.cache/fsus-mozilla-firefox/firefox/firefox). Playwright Firefox cannot attach ibus.',
        )
      }
      const marionettePort = await findFreePort()
      firefoxProcess = spawnOfficialFirefox({
        executable: firefoxPath,
        profileDirectory,
        env: browserEnvironment,
        marionettePort,
      })
      firefoxProcess.stdout.on('data', () => {})
      firefoxProcess.stderr.on('data', () => {})
      marionetteSession = await connectMarionette(marionettePort)
      page = await createMarionettePage(marionetteSession)
      evidence.browser.executable = firefoxPath
    } else {
      const playwrightBrowsers = { chromium, webkit }
      const launcher = playwrightBrowsers[browserProfile.name]
      if (!launcher) {
        fail('internal-error', `no Playwright launcher for ${browserProfile.name}`)
      }
      const launchOptions = {
        headless: false,
        env: browserEnvironment,
        locale: engineProfile.locale,
        timezoneId: 'Asia/Shanghai',
        colorScheme: 'light',
        viewport: { width: 1280, height: 1100 },
        args: browserProfile.args,
      }
      if (chromePath) launchOptions.executablePath = chromePath
      context = await launcher.launchPersistentContext(
        profileDirectory,
        launchOptions,
      )
      page = context.pages()[0] ?? (await context.newPage())
    }
    const browserPid = findBrowserPid(profileDirectory)
    evidence.browser.pid = browserPid.pid
    evidence.browser.profile = realpathSync(profileDirectory)

    await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
    const pageReady = await page.evaluate(() => ({
      readyState: document.readyState,
      url: window.location.href,
    }))
    if (pageReady.url !== fixtureUrl) {
      fail(
        'page-not-ready',
        `page navigated to ${pageReady.url} instead of ${fixtureUrl}`,
      )
    }
    if (pageReady.readyState !== 'complete') {
      fail('page-not-ready', `page readyState=${pageReady.readyState}`)
    }

    await waitForInteractiveEditor(page, editorSelector, mountTimeoutMs)

    const documentIdentity = await bindDocumentIdentity(page)
    const fixtureIdentity = await page
      .locator(`[data-testid="${fixtureTestId}"]`)
      .getAttribute('data-markdown-editor-probe-id')
    evidence.page = {
      url: fixtureUrl,
      documentId: documentIdentity.documentId,
      title: documentIdentity.title,
      readyState: documentIdentity.readyState,
      viewport: { width: 1280, height: 1100 },
    }
    evidence.fixture.probeId = fixtureIdentity
    evidence.fixture.url = fixtureUrl

    let inspect = null
    const windowDeadline = Date.now() + 15_000
    while (Date.now() < windowDeadline) {
      const attempts = [
        ['--expect-class', expectedWindowClass, '--expect-pid', String(browserPid.pid)],
        ['--expect-pid', String(browserPid.pid)],
        ['--expect-class', expectedWindowClass],
      ]
      for (const args of attempts) {
        try {
          inspect = runPythonX11(args, display)
          break
        } catch (error) {
          if (
            !(error instanceof HarnessFailure) ||
            error.category !== 'window-pid-mismatch'
          ) {
            throw error
          }
        }
      }
      if (inspect) break
      await sleep(400)
    }
    if (!inspect) {
      fail(
        'window-pid-mismatch',
        `no mapped window for class=${expectedWindowClass} pid=${browserPid.pid}`,
      )
    }
    evidence.window = inspect.window
    const boundWindowClass =
      Array.isArray(inspect.window?.class) && inspect.window.class.length > 0
        ? inspect.window.class.filter(Boolean).at(-1)
        : expectedWindowClass
    evidence.browser.userAgent = await page.evaluate(
      () => navigator.userAgent,
    )
    const enginePids = readdirSync('/proc')
      .filter((entry) => /^\d+$/u.test(entry))
      .filter((entry) => {
        try {
          const commandLine = readFileSync(join('/proc', entry, 'cmdline'), 'utf8')
          return commandLine.includes(engineProfile.processMatch)
        } catch {
          return false
        }
      })
    if (enginePids.length > 0) {
      evidence.ime.enginePid = Number(enginePids[0])
    }

    const scenarios = [
      {
        name: 'commit',
        fresh: true,
        keys: [...(engineProfile.activateKeys ?? []), ...engineProfile.commitKeys],
      },
      ...(engineProfile.hasCandidates
        ? [
            {
              name: 'candidate',
              fresh: true,
              keys: [
                ...(engineProfile.activateKeys ?? []),
                ...engineProfile.candidateKeys,
              ],
            },
          ]
        : []),
      { name: 'backspace', fresh: false, keys: ['BackSpace'] },
      { name: 'undo', fresh: false, keys: ['ctrl+z'] },
      { name: 'redo', fresh: false, keys: ['ctrl+shift+z'] },
      {
        name: 'cancel',
        fresh: true,
        keys: [...(engineProfile.activateKeys ?? []), ...engineProfile.cancelKeys],
      },
    ]

    const waitForScenario = async (scenario, predicate) => {
      const deadline = Date.now() + stepTimeoutMs
      let latest = null
      while (Date.now() < deadline) {
        latest = await readEditorState(page)
        if (await predicate(latest)) return latest
        await sleep(200)
      }
      const trace = latest?.trace ?? []
      let category = 'assertion-failed'
      if (trace.length === 0) {
        category = 'input-not-delivered'
      } else if (
        ['commit', 'cancel', 'candidate'].includes(scenario.name) &&
        !hasEvent(trace, 'compositionstart')
      ) {
        category = 'composition-not-started'
      }
      fail(
        category,
        `scenario ${scenario.name} did not reach expected state within ${stepTimeoutMs}ms; trace=${JSON.stringify(trace.slice(-6))}`,
      )
    }

    for (const scenario of scenarios) {
      if (scenario.fresh) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await waitForInteractiveEditor(page, editorSelector, mountTimeoutMs)
        await bindDocumentIdentity(page)
      }

      const before = await readEditorState(page)
      if (!before.textareaPresent || !before.textareaEnabled) {
        fail(
          'target-absent',
          'editor textarea is missing or disabled before step',
        )
      }
      const editorBox = await readEditorBox(page)
      const target = computeTarget(editorBox, evidence.window?.geometry)
      if (!target) fail('target-absent', 'could not compute editor target point')
      await page.locator(editorSelector).click({ timeout: 5000 })
      const installed = await installTrace(page)
      if (!installed) {
        fail(
          'target-absent',
          'trace listener could not attach to editor textarea',
        )
      }
      await page.evaluate(() => {
        window.__fsusNativeImePointerDown = null
        document.addEventListener(
          'pointerdown',
          (event) => {
            window.__fsusNativeImePointerDown = {
              clientX: event.clientX,
              clientY: event.clientY,
              target: event.target?.tagName ?? null,
            }
          },
          { capture: true, once: true },
        )
      })
      await page.locator(editorSelector).evaluate((textarea) => textarea.blur())
      const beforeDocumentId = before.documentId

      const x11Pid = evidence.window?.pid ?? browserPid.pid
      const x11ClickResult = runPythonX11(
        [
          '--expect-class',
          boundWindowClass || expectedWindowClass,
          '--expect-pid',
          String(x11Pid),
          '--target-x',
          String(target.x),
          '--target-y',
          String(target.y),
          '--activate',
          '--click',
        ],
        display,
      )
      if (x11ClickResult.window.id !== evidence.window.id) {
        fail(
          'window-pid-mismatch',
          `window identity changed: ${evidence.window.id} -> ${x11ClickResult.window.id}`,
        )
      }
      try {
        await page.waitForFunction(
          (selector) => document.activeElement === document.querySelector(selector),
          editorSelector,
          { timeout: 5000 },
        )
      } catch {
        const pointerDown = await page.evaluate(
          () => window.__fsusNativeImePointerDown,
        )
        fail(
          'input-not-delivered',
          `native pointer click did not focus the editor at (${target.x}, ${target.y}); pointer=${JSON.stringify(x11ClickResult.pointer)} dom=${JSON.stringify(pointerDown)} box=${JSON.stringify(editorBox)}`,
        )
      }
      // Let the platform input method attach to the freshly focused native
      // window before XTEST sends the first real key. This is deliberately a
      // separate OS-input step; Playwright is only observing focus here.
      await sleep(300)
      const x11KeyResult = runPythonX11(
        [
          '--expect-class',
          boundWindowClass || expectedWindowClass,
          '--expect-pid',
          String(x11Pid),
          '--keys',
          ...scenario.keys,
        ],
        display,
      )
      if (x11KeyResult.window.id !== evidence.window.id) {
        fail(
          'window-pid-mismatch',
          `window identity changed: ${evidence.window.id} -> ${x11KeyResult.window.id}`,
        )
      }

      const stepStarted = new Date().toISOString()
      const previousValue = before.value
      let predicate
      if (scenario.name === 'commit') {
        predicate = (state) => isNativeCompositionCommit(state, committedScript)
      } else if (scenario.name === 'cancel') {
        predicate = (state) =>
          state.value === '' &&
          hasEvent(state.trace, 'compositionstart') &&
          hasEvent(state.trace, 'compositionend') &&
          (state.history?.undoDepth ?? 0) === 0
      } else if (scenario.name === 'candidate') {
        predicate = (state) =>
          state.value &&
          committedScript.test(state.value) &&
          state.trace.some(
            (entry) =>
              (entry.name === 'keydown' || entry.name === 'keyup') &&
              (entry.key === 'ArrowDown' || entry.code === 'ArrowDown'),
          )
      } else if (scenario.name === 'backspace') {
        predicate = (state) =>
          state.value !== null && state.value.length < previousValue.length
      } else if (scenario.name === 'undo') {
        predicate = (state) => state.history?.canRedo === true
      } else {
        predicate = (state) => state.history?.canRedo === false
      }
      await waitForScenario(scenario, predicate)
      await sleep(500)
      const state = await readEditorState(page)

      if (!state.documentId || state.documentId !== beforeDocumentId) {
        fail(
          'assertion-failed',
          `document identity changed during ${scenario.name}: ${beforeDocumentId} -> ${state.documentId}`,
        )
      }
      if (scenario.fresh && state.probeId !== evidence.fixture.probeId) {
        fail(
          'assertion-failed',
          `fixture probe identity changed after reload: ${evidence.fixture.probeId} -> ${state.probeId}`,
        )
      }

      const stepRecord = {
        name: scenario.name,
        keys: scenario.keys,
        startedAt: stepStarted,
        finishedAt: new Date().toISOString(),
        target,
        trace: state.trace,
        finalState: {
          value: state.value,
          selection: state.selection,
          history: state.history,
          lastTransaction: state.lastTransaction,
          selectionEvent: state.selectionEvent,
        },
        screenshot: null,
      }
      if (!options.noScreenshot) {
        const screenshotPath = join(
          outputDirectory,
          'screenshots',
          `${scenario.name}.png`,
        )
        await page.screenshot({ path: screenshotPath })
        stepRecord.screenshot = `screenshots/${scenario.name}.png`
      }
      writeJson(join(outputDirectory, 'steps', `${scenario.name}.json`), stepRecord)
      evidence.steps.push(stepRecord)

      if (scenario.name === 'commit') {
        if (!isNativeCompositionCommit(state, committedScript)) {
          fail(
            'assertion-failed',
            `commit produced no native ${engineProfile.scriptName} composition: value=${JSON.stringify(state.value)} transaction=${JSON.stringify(state.lastTransaction?.transaction)}`,
          )
        }
      } else if (scenario.name === 'cancel') {
        if (state.value !== '') {
          fail(
            'assertion-failed',
            `cancel left committed text: ${JSON.stringify(state.value)}`,
          )
        }
        if (
          !hasEvent(state.trace, 'compositionstart') ||
          !hasEvent(state.trace, 'compositionend')
        ) {
          fail(
            'composition-not-started',
            'cancel trace lacks compositionstart/compositionend',
          )
        }
        if (state.history?.undoDepth !== 0) {
          fail('assertion-failed', 'cancel must not create history entries')
        }
        const cancelTransaction = state.lastTransaction?.transaction
        if (
          cancelTransaction &&
          cancelTransaction.metadata?.composition !== true &&
          Array.isArray(cancelTransaction.changes) &&
          cancelTransaction.changes.some((change) => change.insert)
        ) {
          fail(
            'assertion-failed',
            `cancel left a non-composition insert: ${JSON.stringify(cancelTransaction)}`,
          )
        }
      } else if (scenario.name === 'candidate') {
        if (!state.value || !committedScript.test(state.value)) {
          fail(
            'assertion-failed',
            `candidate selection committed no ${engineProfile.scriptName} text: ${JSON.stringify(state.value)}`,
          )
        }
        if (
          !state.trace.some(
            (entry) =>
              (entry.name === 'keydown' || entry.name === 'keyup') &&
              (entry.key === 'ArrowDown' || entry.code === 'ArrowDown'),
          )
        ) {
          fail(
            'assertion-failed',
            'candidate trace lacks a native ArrowDown key event',
          )
        }
        const candidateTransaction = state.lastTransaction?.transaction
        if (
          candidateTransaction &&
          candidateTransaction.metadata?.composition !== true
        ) {
          fail('assertion-failed', 'candidate transaction lacks composition metadata')
        }
        if (
          !candidateTransaction &&
          !(
            hasEvent(state.trace, 'compositionend') &&
            state.history?.canUndo
          ) &&
          !(
            hasEvent(state.trace, 'compositionstart') &&
            committedScript.test(state.value)
          )
        ) {
          fail(
            'assertion-failed',
            'candidate left no composition transaction or undoable history',
          )
        }
      } else if (scenario.name === 'backspace') {
        const commitStep =
          evidence.steps.find((step) => step.name === 'candidate') ??
          evidence.steps.find((step) => step.name === 'commit')
        if (
          !commitStep ||
          state.value.length >= commitStep.finalState.value.length
        ) {
          fail(
            'assertion-failed',
            'Backspace did not shorten the committed value',
          )
        }
        const backspaceMeta = state.lastTransaction?.transaction?.metadata
        const backspaceChanges = state.lastTransaction?.transaction?.changes
        const deleted = Array.isArray(backspaceChanges)
          ? backspaceChanges.some(
              (change) =>
                Number(change.to) > Number(change.from) && !change.insert,
            )
          : false
        if (
          backspaceMeta?.inputType !== 'deleteContentBackward' &&
          !deleted
        ) {
          fail(
            'assertion-failed',
            `backspace inputType mismatch: ${JSON.stringify(backspaceMeta)}`,
          )
        }
      } else if (scenario.name === 'undo') {
        const candidateStep =
          evidence.steps.find((step) => step.name === 'candidate') ??
          evidence.steps.find((step) => step.name === 'commit')
        if (!candidateStep || state.value !== candidateStep.finalState.value) {
          fail(
            'assertion-failed',
            'native undo did not revert the Backspace edit',
          )
        }
        if (state.history?.canRedo !== true) {
          fail('assertion-failed', 'native undo did not enable redo')
        }
      } else if (scenario.name === 'redo') {
        const undoStep = evidence.steps.find((step) => step.name === 'undo')
        if (!undoStep || state.value === undoStep.finalState.value) {
          fail('assertion-failed', 'native redo did not restore the undone edit')
        }
        if (state.history?.canRedo !== false) {
          fail('assertion-failed', 'native redo did not consume redo depth')
        }
      }
    }

    evidence.verdict = 'pass'
    evidence.finishedAt = new Date().toISOString()
    writeJson(join(outputDirectory, 'manifest.json'), evidence)
    const receiptLines = [
      'native-ime-harness receipt',
      `candidate-sha: ${candidateSha}`,
      `branch: ${branch}`,
      `os: ${process.platform} ${process.arch}`,
      `browser: ${browserProfile.name} ${chromePath ?? 'playwright'} pid=${evidence.browser.pid} version=${evidence.browser.userAgent}`,
      `ime: ${engine} enginePid=${evidence.ime.enginePid}`,
      `window: ${evidence.window.id} pid=${evidence.window.pid}`,
      `fixture: ${fixtureTestId} probe=${evidence.fixture.probeId}`,
      `document: ${evidence.page.documentId}`,
      'verdict: pass',
    ]
    for (const step of evidence.steps) {
      receiptLines.push(
        `step ${step.name}: PASS value=${JSON.stringify(step.finalState.value)} history=${JSON.stringify(step.finalState.history)} traceEvents=${step.trace.length}`,
      )
    }
    receiptLines.push(`evidence: ${outputDirectory}`)
    writeFileSync(
      join(outputDirectory, 'receipt.txt'),
      `${receiptLines.join('\n')}\n`,
      'utf8',
    )
    console.log(
      `[native-ime] PASS candidate=${candidateSha} steps=${evidence.steps.length}`,
    )
    for (const step of evidence.steps) {
      console.log(
        `[native-ime]   ${step.name}: PASS value=${JSON.stringify(step.finalState.value)} history=${JSON.stringify(step.finalState.history)}`,
      )
    }
  } catch (error) {
    const category =
      error instanceof HarnessFailure ? error.category : 'internal-error'
    const message = error instanceof Error ? error.message : String(error)
    evidence.verdict = 'fail'
    evidence.finishedAt = new Date().toISOString()
    evidence.failure = { category, message }
    writeJson(join(outputDirectory, 'manifest.json'), evidence)
    writeJson(join(outputDirectory, 'failure.json'), {
      category,
      message,
      finishedAt: evidence.finishedAt,
    })
    writeFileSync(
      join(outputDirectory, 'receipt.txt'),
      `native-ime-harness receipt\ncandidate-sha: ${candidateSha}\nverdict: fail\ncategory: ${category}\nmessage: ${message}\n`,
      'utf8',
    )
    console.error(`[native-ime] FAIL category=${category}`)
    console.error(`[native-ime] ${message}`)
    process.exitCode = EXIT_CODES[category] ?? 1
  } finally {
    await cleanup()
    console.log(`[native-ime] evidence written to ${outputDirectory}`)
  }
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isMain) {
  main()
}
