import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fg from 'fast-glob'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from '../layout-playwright-plan.mjs'
import { filterOwnerPlanByImpact } from '../playwright-impact-filter.mjs'
import { stableStringify } from '../playwright-registry.mjs'
import { loadPlaywrightSuiteRegistry } from '../playwright-suites.mjs'
import { fingerprintPaths } from '../visual-runtime-core.mjs'

export { stableStringify }

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const REQUIRED_RECEIPT_KEYS = Object.freeze([
  'schemaVersion',
  'owner',
  'gate',
  'suiteId',
  'cellId',
  'project',
  'dimensions',
  'commitSha',
  'workflowGroup',
  'run',
  'toolchain',
  'runtime',
  'config',
  'tests',
  'report',
  'status',
  'startedAt',
  'endedAt',
])

export const fail = (message) => {
  throw new Error(message)
}

export const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) {
    const value = args[index + 1]
    return value !== undefined && !value.startsWith('--') ? value : fallback
  }
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

export const hasFlag = (args, name) => args.includes(`--${name}`)

function reportPlaywrightCliError(error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

export function runPlaywrightCli(moduleUrl, run) {
  if (moduleUrl !== pathToFileURL(process.argv[1] ?? '').href) return
  try {
    const result = run()
    if (result instanceof Promise) return result.catch(reportPlaywrightCliError)
  } catch (error) {
    reportPlaywrightCliError(error)
  }
}

function writeEvidenceJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

export const sha256Text = (value) =>
  createHash('sha256').update(value).digest('hex')

export const sha256File = (file) => {
  if (!existsSync(file)) fail(`file missing for digest: ${file}`)
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export const readRepositoryCommit = (root = repoRoot) => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

export const readToolVersion = (command, args, cwd = repoRoot) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : undefined
}

export const findPlaywrightPackage = (root = repoRoot) => {
  for (const candidate of [
    resolve(root, 'node_modules/@playwright/test/package.json'),
    resolve(root, 'node_modules/playwright/package.json'),
  ]) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')).version
    }
  }
  return undefined
}

export const readBrowserRevision = (prefix, fallback = null) => {
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : resolve(process.env.HOME ?? '', '.cache/ms-playwright')
  if (!existsSync(browserRoot)) return fallback
  try {
    return (
      readdirSync(browserRoot).find((name) => name.startsWith(`${prefix}-`)) ??
      fallback
    )
  } catch {
    return fallback
  }
}

export const readBrowserToolchain = ({
  browsers = ['chromium', 'firefox', 'webkit'],
  chromiumFallback = null,
} = {}) => {
  const result = {
    chromiumRevision: readBrowserRevision('chromium', chromiumFallback),
  }
  for (const browser of browsers) {
    if (browser === 'chromium') continue
    const revision = readBrowserRevision(browser, null)
    if (revision) result[`${browser}Revision`] = revision
  }
  return result
}

export const allocateFreePort = () =>
  new Promise((resolvePromise, rejectPromise) => {
    const probe = createServer()
    probe.once('error', rejectPromise)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : null
      probe.close(() => {
        if (port) resolvePromise(port)
        else rejectPromise(new Error('failed to allocate a free port'))
      })
    })
  })

export const waitForServer = async (url, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url)
      if (response.status === 200) return true
      lastError = new Error(`server responded ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }
  throw lastError ?? new Error(`server readiness timeout: ${url}`)
}

export const parseJsonReporterOutput = (stdout) => {
  const text = (stdout ?? '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.lastIndexOf('{')
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start))
      } catch {
        return null
      }
    }
    return null
  }
}

export const testsFromStats = (stats) => {
  const expected = Number.isFinite(stats?.expected) ? stats.expected : 0
  const unexpected = Number.isFinite(stats?.unexpected) ? stats.unexpected : 0
  const skipped = Number.isFinite(stats?.skipped) ? stats.skipped : 0
  const flaky = Number.isFinite(stats?.flaky) ? stats.flaky : 0
  return {
    total: expected + unexpected + skipped,
    passed: expected,
    failed: unexpected,
    skipped,
    flaky,
  }
}

export function validateCellReceipt(receipt, cell) {
  for (const key of REQUIRED_RECEIPT_KEYS) {
    if (!(key in receipt)) {
      fail(`receipt for ${cell?.id ?? 'cell'} missing ${key}`)
    }
  }
  if (receipt.schemaVersion !== 1) fail('receipt schemaVersion must be 1')
  if (receipt.cellId !== cell?.id) {
    fail(`receipt cellId mismatch: ${receipt.cellId}`)
  }
  if (receipt.suiteId !== cell?.suiteId) {
    fail(`receipt suiteId mismatch: ${receipt.suiteId}`)
  }
  if (receipt.project !== cell?.project) {
    fail(`receipt project mismatch: ${receipt.project}`)
  }
  if (receipt.status !== 'success' && receipt.status !== 'failure') {
    fail(`receipt status must be success|failure, got ${receipt.status}`)
  }
  if (!/^[0-9a-f]{40}$/u.test(receipt.commitSha)) {
    fail('receipt commitSha must be a full 40-hex SHA')
  }
  if (!receipt.runtime?.manifestDigest || !receipt.runtime?.sourceFingerprint) {
    fail('receipt runtime manifest digest/sourceFingerprint required')
  }
  if (!/^[0-9a-f]{64}$/u.test(receipt.runtime.manifestDigest)) {
    fail('receipt runtime manifestDigest must be 64 hex chars')
  }
  if (!/^[0-9a-f]{64}$/u.test(receipt.runtime.sourceFingerprint)) {
    fail('receipt runtime sourceFingerprint must be 64 hex chars')
  }
  if (!receipt.config?.sha256 || receipt.config.sha256.length !== 64) {
    fail('receipt config sha256 required')
  }
  if (
    typeof receipt.tests?.total !== 'number' ||
    typeof receipt.tests.passed !== 'number'
  ) {
    fail('receipt tests.total/passed must be numbers')
  }
  if (
    typeof receipt.tests.failed !== 'number' ||
    typeof receipt.tests.skipped !== 'number'
  ) {
    fail('receipt tests.failed/skipped must be numbers')
  }
  if (receipt.status === 'success' && receipt.tests.passed === 0) {
    fail(
      `receipt ${receipt.cellId} reports zero passed tests; 0-test/skip-all is fail-closed`,
    )
  }
  if (receipt.status === 'success' && !receipt.report?.path) {
    fail(`receipt ${receipt.cellId} missing report path`)
  }
  if (receipt.report?.sha256 && receipt.report.sha256.length !== 64) {
    fail('receipt report sha256 must be 64 hex chars')
  }
  if (receipt.dimensions?.browser && receipt.dimensions.browser.includes('-')) {
    fail(`receipt browser must not be composite: ${receipt.dimensions.browser}`)
  }
  if (typeof receipt.toolchain?.chromiumRevision !== 'string') {
    fail('receipt toolchain.chromiumRevision must be a string')
  }
  if (
    receipt.toolchain.firefoxRevision !== undefined &&
    typeof receipt.toolchain.firefoxRevision !== 'string'
  ) {
    fail('receipt toolchain.firefoxRevision must be a string when present')
  }
  if (
    receipt.toolchain.webkitRevision !== undefined &&
    typeof receipt.toolchain.webkitRevision !== 'string'
  ) {
    fail('receipt toolchain.webkitRevision must be a string when present')
  }
  return true
}

export const expandFingerprintInputs = async (inputs, root = repoRoot) => {
  const files = []
  for (const input of inputs) {
    if (input.includes('*')) {
      const matches = await fg(input, {
        cwd: root,
        onlyFiles: true,
        dot: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.tmp/**',
          '**/build/**',
        ],
      })
      files.push(...matches.map((match) => `./${match}`))
    } else {
      files.push(input)
    }
  }
  return files.sort()
}

export async function computeSuiteCellRuntime(
  cell,
  fingerprintInputsBySuite,
  { runtimeMode = 'native', label = 'playwright', root = repoRoot } = {},
) {
  const inputs = fingerprintInputsBySuite[cell.suiteId]
  if (!inputs) fail(`no ${label} fingerprint inputs for suite ${cell.suiteId}`)
  const fingerprintFiles = await expandFingerprintInputs(inputs, root)
  const fingerprint = await fingerprintPaths(root, fingerprintFiles)
  if (fingerprint.missing.length > 0) {
    fail(
      `${label} runtime fingerprint missing inputs for ${cell.id}: ${fingerprint.missing.join(', ')}`,
    )
  }
  const inputsDigest = sha256Text(
    stableStringify({ suiteId: cell.suiteId, inputs }),
  )
  return {
    runtimeMode,
    sourceFingerprint: fingerprint.fingerprint,
    inputsDigest,
    fingerprintInputs: inputs,
    fingerprintFiles,
  }
}

export function writeSuiteRuntimeManifest(
  cell,
  evidenceDir,
  runtime,
  manifestId = cell.suiteId,
  root = repoRoot,
) {
  const manifestPath = resolve(
    root,
    evidenceDir,
    'runtime-manifests',
    `${manifestId}.json`,
  )
  writeEvidenceJson(manifestPath, {
    schemaVersion: 1,
    suiteId: cell.suiteId,
    ...runtime,
  })
  return {
    ...runtime,
    manifestDigest: sha256File(manifestPath),
  }
}

export function createFixedOwnerPlanLoader({
  ownerId,
  fixedCells,
  label = ownerId,
  enforcePrFixedCells = false,
}) {
  return function loadFixedOwnerPlan(
    group,
    registry = loadPlaywrightSuiteRegistry(),
    owners = loadPlaywrightOwners(),
  ) {
    return validateFixedOwnerPlan(
      planOwnerCells(ownerId, group, registry, owners),
      fixedCells,
      `${label} owner plan isolation failed for ${group}`,
      enforcePrFixedCells,
    )
  }
}

function validateFixedOwnerPlan(
  plan,
  fixedCells,
  isolationError,
  enforcePr = false,
) {
  if (plan.group !== 'pr' || enforcePr) {
    assertOwnerFixedCells(plan, [...fixedCells])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) fail(`${isolationError}: ${isolation.join('; ')}`)
  return plan
}

export function loadOwnerRunPlan(ownerId, group, fixedCells, isolationError) {
  return validateFixedOwnerPlan(
    planOwnerCells(ownerId, group),
    fixedCells,
    isolationError,
  )
}

export function runOwnerPlanCli({
  argv = process.argv.slice(2),
  loadOwnerPlan,
  scriptName,
  label,
  formatCellCommand = (cell) => cell.command,
}) {
  const command = argv[0]
  if (command === 'owner-plan') {
    const group = option(argv, 'group', 'main')
    const plan = loadOwnerPlan(group)
    process.stdout.write(
      hasFlag(argv, 'json')
        ? `${JSON.stringify(plan, null, 2)}\n`
        : `${plan.cells
            .map(
              (cell) =>
                `${cell.id}\tproject=${cell.project}\tnamespace=${cell.artifactNamespace}\tcommand=${cell.command}`,
            )
            .join('\n')}\n`,
    )
    return
  }
  if (command === 'cell-command') {
    const cellId = option(argv, 'cell')
    if (!cellId) fail('cell-command requires --cell')
    const plan = loadOwnerPlan(option(argv, 'group', 'main'))
    const cell = plan.cells.find((entry) => entry.id === cellId)
    if (!cell) fail(`unknown ${label} cell ${cellId}`)
    process.stdout.write(`${formatCellCommand(cell, argv)}\n`)
    return
  }
  fail(`Usage: ${scriptName} <owner-plan|cell-command> [options]`)
}

export function loadReceiptsFromDirectory(
  directory,
  { requireCellId = false, root = repoRoot } = {},
) {
  const absolute = resolve(root, directory)
  if (!existsSync(absolute)) return []
  const receipts = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = resolve(current, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.name.endsWith('.json')) {
        const parsed = JSON.parse(readFileSync(target, 'utf8'))
        if (!requireCellId || parsed.cellId) receipts.push(parsed)
      }
    }
  }
  visit(absolute)
  return receipts
}

export function verifyOwnerReceiptsCore({
  ownerId,
  group,
  receipts,
  plan,
  logPrefix,
  expectedCommitSha,
  expectedRuntimeMode,
  resolveRuntimeManifestPath,
  checkFingerprintInputs = false,
  validateCellReceiptFn = validateCellReceipt,
  extraReceiptCheck,
  root = repoRoot,
}) {
  if (!plan || plan.owner !== ownerId || plan.group !== group) {
    fail(`${logPrefix} owner verify requires the matching owner plan`)
  }
  const expected = new Map(plan.cells.map((cell) => [cell.id, cell]))
  const actual = new Map(receipts.map((receipt) => [receipt.cellId, receipt]))
  const summary = { owner: ownerId, gate: plan.gate, group, cells: [] }
  let failed = false

  for (const [cellId, cell] of expected) {
    const receipt = actual.get(cellId)
    summary.cells.push({
      cellId,
      status: receipt?.status ?? 'missing',
      tests: receipt?.tests ?? null,
    })
    if (!receipt) {
      failed = true
      console.error(`[${logPrefix}] missing receipt for ${cellId}`)
      continue
    }
    try {
      validateCellReceiptFn(receipt, cell)
      if (receipt.owner !== ownerId) {
        fail(`receipt owner mismatch: ${receipt.owner}`)
      }
      if (receipt.gate !== plan.gate) {
        fail(`receipt gate mismatch: ${receipt.gate}`)
      }
      if (
        expectedRuntimeMode &&
        receipt.runtime?.runtimeMode !== expectedRuntimeMode
      ) {
        fail(`receipt ${cellId} runtimeMode must be ${expectedRuntimeMode}`)
      }
      if (expectedCommitSha && receipt.commitSha !== expectedCommitSha) {
        fail(
          `receipt ${cellId} binds ${receipt.commitSha}, expected ${expectedCommitSha}`,
        )
      }
      const manifestPath = resolveRuntimeManifestPath?.(cell)
      if (manifestPath) {
        const absoluteManifest = resolve(root, manifestPath)
        if (!existsSync(absoluteManifest)) {
          fail(`${logPrefix} runtime manifest missing: ${absoluteManifest}`)
        }
        const manifest = JSON.parse(readFileSync(absoluteManifest, 'utf8'))
        if (receipt.runtime.manifestDigest !== sha256File(absoluteManifest)) {
          fail(
            `receipt ${cellId} runtime manifestDigest does not match current runtime`,
          )
        }
        if (receipt.runtime.sourceFingerprint !== manifest.sourceFingerprint) {
          fail(
            `receipt ${cellId} runtime sourceFingerprint does not match current runtime`,
          )
        }
        if (
          checkFingerprintInputs &&
          manifest.fingerprintInputs &&
          manifest.fingerprintInputs.length > 0
        ) {
          for (const input of manifest.fingerprintInputs) {
            if (!receipt.runtime.fingerprintInputs?.includes(input)) {
              fail(
                `receipt ${cellId} runtime fingerprint inputs do not match current runtime`,
              )
            }
          }
        }
      }
      if (receipt.status !== 'success') {
        fail(`cell ${cellId} status=${receipt.status}`)
      }
      extraReceiptCheck?.(receipt, cell)
    } catch (error) {
      failed = true
      console.error(
        `[${logPrefix}] invalid receipt ${cellId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  for (const receipt of receipts) {
    if (!expected.has(receipt.cellId)) {
      failed = true
      console.error(`[${logPrefix}] unexpected receipt ${receipt.cellId}`)
    }
  }
  summary.status = failed ? 'failure' : 'success'
  return { summary, failed }
}

export async function runOwnerVerifyCli({
  argv = process.argv.slice(2),
  usage,
  defaultOwnerId,
  logPrefix,
  loadPlan,
  loadReceipts,
  verifyReceipts,
  readVerifyOptions,
  requireSubcommand = true,
  root = repoRoot,
}) {
  if (requireSubcommand && argv[0] !== 'owner-verify') {
    fail(usage)
  }
  const ownerId = option(argv, 'owner', defaultOwnerId)
  const group = option(argv, 'group', 'main')
  const receiptsDir = option(argv, 'receipts-dir')
  if (!ownerId || !receiptsDir) {
    fail('owner-verify requires --owner and --receipts-dir')
  }
  const plan = loadPlan(group, ownerId)
  const receipts = loadReceipts(receiptsDir)
  const { summary, failed } = await verifyReceipts(
    ownerId,
    group,
    receipts,
    plan,
    {
      evidenceDir: option(argv, 'evidence-dir'),
      expectedCommitSha: option(argv, 'commit-sha'),
      ...readVerifyOptions?.(argv),
    },
  )
  const evidenceOut = option(argv, 'evidence-out')
  if (evidenceOut) {
    writeEvidenceJson(resolve(root, evidenceOut), summary)
  }
  console.log(
    `[${logPrefix}] owner=${ownerId} group=${group} status=${summary.status} cells=${summary.cells.length}`,
  )
  if (failed) process.exitCode = 1
}

export function spawnPlaywrightJson(
  { config, project, outputDirectory, env },
  { asyncSpawn = false, root = repoRoot } = {},
) {
  const args = [
    'exec',
    'playwright',
    'test',
    `--config=${config}`,
    `--project=${project}`,
    '--reporter=json',
    `--output=${outputDirectory}`,
  ]
  if (!asyncSpawn) {
    return Promise.resolve(
      spawnSync('pnpm', args, {
        cwd: root,
        env,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      }),
    )
  }
  return new Promise((resolveRun) => {
    const stdoutChunks = []
    const stderrChunks = []
    const child = spawn('pnpm', args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk))
    child.once('error', (error) => {
      resolveRun({
        error,
        status: null,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      })
    })
    child.once('close', (status) => {
      resolveRun({
        status,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      })
    })
  })
}

export async function executeCellWithReceipt({
  ownerId,
  cellId,
  group,
  plan,
  evidenceDir,
  logPrefix,
  cellNotFoundLabel = logPrefix,
  asyncSpawn = false,
  writeStderrLog = false,
  browsers = ['chromium', 'firefox', 'webkit'],
  chromiumFallback = null,
  resolveDimensions = (cell) => ({
    browser: cell.dimensions.browser,
    viewport: cell.dimensions.viewport ?? null,
    theme: cell.dimensions.theme ?? null,
    deviceScaleFactor: cell.dimensions.deviceScaleFactor ?? null,
  }),
  resolveFailureDimensions,
  prepareRuntime,
  resolveFallbackRuntime,
  prepareEnv,
  afterPlaywrightRun,
  receiptExtension,
  validateReceipt,
  root = repoRoot,
}) {
  const cell = plan.cells.find((entry) => entry.id === cellId)
  if (!cell) fail(`unknown ${cellNotFoundLabel} cell ${cellId} for owner ${ownerId}`)

  const startedAt = new Date().toISOString()
  let runtime = null
  let report = null
  let tests = testsFromStats(null)

  const reportRelative = `${evidenceDir}/reports/${cell.suiteId}/${cell.project}/report.json`
  const reportPath = resolve(root, reportRelative)
  const outputDirectory = resolve(
    root,
    evidenceDir,
    'output',
    cell.suiteId,
    cell.project,
  )
  mkdirSync(outputDirectory, { recursive: true })
  mkdirSync(dirname(reportPath), { recursive: true })

  try {
    runtime = await prepareRuntime(cell)
    const childEnv = await prepareEnv(cell, runtime)
    const result = await spawnPlaywrightJson(
      {
        config: cell.config,
        project: cell.project,
        outputDirectory,
        env: childEnv,
      },
      { asyncSpawn, root },
    )
    const stdout = result.stdout ?? ''
    const parsed = parseJsonReporterOutput(stdout)
    tests = testsFromStats(parsed?.stats)
    writeFileSync(reportPath, stdout.trim() ? stdout : '{}')
    if (writeStderrLog) {
      writeFileSync(resolve(dirname(reportPath), 'stderr.log'), result.stderr ?? '')
    }
    report = { path: reportRelative, sha256: sha256File(reportPath) }
    afterPlaywrightRun?.(parsed, result)

    const status = result.status === 0 ? 'success' : 'failure'
    const playwrightVersion = readToolVersion(
      'pnpm',
      ['exec', 'playwright', '--version'],
      root,
    )
    const extension = receiptExtension
      ? await receiptExtension({
          cell,
          group,
          outputDirectory,
          parsedReport: parsed,
          reportPath,
          reportRelative,
          evidenceDir,
          runtime,
          tests,
        })
      : {}

    const receipt = {
      schemaVersion: 1,
      owner: ownerId,
      gate: plan.gate,
      suiteId: cell.suiteId,
      cellId: cell.id,
      project: cell.project,
      dimensions: resolveDimensions(cell),
      commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(root),
      workflowGroup: group,
      run: {
        id: process.env.GITHUB_RUN_ID ?? 'local',
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
      },
      toolchain: {
        node: process.version,
        pnpm: readToolVersion('pnpm', ['--version'], root) ?? 'unknown',
        playwright: playwrightVersion ?? findPlaywrightPackage(root),
        ...readBrowserToolchain({ browsers, chromiumFallback }),
      },
      runtime: {
        runtimeMode: runtime.runtimeMode,
        manifestDigest: runtime.manifestDigest,
        sourceFingerprint: runtime.sourceFingerprint,
        ...(runtime.inputsDigest
          ? {
              inputsDigest: runtime.inputsDigest,
              fingerprintInputs: runtime.fingerprintInputs,
              fingerprintFiles: runtime.fingerprintFiles,
            }
          : {}),
      },
      config: { path: cell.config, sha256: cell.configSha256 },
      tests,
      report,
      status,
      failureReason: null,
      startedAt,
      endedAt: new Date().toISOString(),
      ...extension,
    }
    validateCellReceipt(receipt, cell)
    validateReceipt?.(receipt, cell)

    const receiptRelative = cell.receiptPath
    writeEvidenceJson(resolve(root, receiptRelative), receipt)
    console.log(
      `[${logPrefix}] ${cell.id} status=${status} passed=${tests.passed} failed=${tests.failed} skipped=${tests.skipped} receipt=${receiptRelative}`,
    )
    return {
      ok: status === 'success',
      cellId: cell.id,
      status,
      receiptPath: receiptRelative,
    }
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)
    console.error(`[${logPrefix}] ${cellId} failed: ${failureReason}`)
    const fallbackRuntime = runtime ?? (await resolveFallbackRuntime?.(cell))
    if (fallbackRuntime) {
      const receipt = {
        schemaVersion: 1,
        owner: ownerId,
        gate: plan.gate,
        suiteId: cell.suiteId,
        cellId: cell.id,
        project: cell.project,
        dimensions: (resolveFailureDimensions ?? resolveDimensions)(cell),
        commitSha: process.env.GITHUB_SHA ?? readRepositoryCommit(root),
        workflowGroup: group,
        run: {
          id: process.env.GITHUB_RUN_ID ?? 'local',
          attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
        },
        toolchain: {
          node: process.version,
          pnpm: readToolVersion('pnpm', ['--version'], root) ?? 'unknown',
          playwright: findPlaywrightPackage(root),
          ...readBrowserToolchain({ browsers, chromiumFallback }),
        },
        runtime: fallbackRuntime,
        config: { path: cell.config, sha256: cell.configSha256 },
        tests,
        report,
        status: 'failure',
        failureReason,
        startedAt,
        endedAt: new Date().toISOString(),
      }
      writeEvidenceJson(resolve(root, cell.receiptPath), receipt)
      return {
        ok: false,
        cellId: cell.id,
        status: 'failure',
        receiptPath: cell.receiptPath,
        error: failureReason,
      }
    }
    return {
      ok: false,
      cellId: cell.id,
      status: 'failure',
      receiptPath: null,
      error: failureReason,
    }
  }
}

export function runVisualRuntimePrepare(
  runtimeDir,
  { checkOnly = false, logPrefix, root = repoRoot } = {},
) {
  if (logPrefix) {
    console.log(
      `[${logPrefix}] ${checkOnly ? 'checking runtime' : 'preparing visual runtime once'}: ${runtimeDir}`,
    )
  }
  const args = [
    'scripts/prepare-visual-runtime.mjs',
    ...(checkOnly ? ['--check'] : []),
    `--runtime-dir=${runtimeDir}`,
  ]
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    fail(
      `visual runtime ${checkOnly ? 'check' : 'prepare'} failed (${result.status ?? 'no status'}):\n${result.stdout}\n${result.stderr}`,
    )
  }
}

export function buildDemoOnce(root = repoRoot) {
  const result = spawnSync('pnpm', ['run', 'build:demo'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    fail(`demo build failed with status ${result.status ?? -1}`)
  }
}

export async function withSpawnedServer(
  { command, args, serverUrl, root = repoRoot },
  fn,
) {
  const server = spawn(command, args, { cwd: root, stdio: 'ignore' })
  try {
    await waitForServer(serverUrl)
    return await fn(serverUrl)
  } finally {
    if (!server.killed) server.kill('SIGTERM')
  }
}

export function prepareOwnerVisualRuntime(
  argv,
  runtimeDir,
  logPrefix,
  { logCheck = false } = {},
) {
  if (!hasFlag(argv, 'skip-prepare')) {
    runVisualRuntimePrepare(runtimeDir, { logPrefix })
  }
  runVisualRuntimePrepare(runtimeDir, {
    checkOnly: true,
    logPrefix: logCheck ? logPrefix : undefined,
  })
}

export function runPreparedVisualCells(
  runtimeDir,
  serverPort,
  { ownerId, group, cells, evidenceDir },
  runCell,
) {
  return withSpawnedServer(
    {
      command: process.execPath,
      args: [
        'scripts/serve-visual-runtime.mjs',
        '--suite=preview',
        '--host=127.0.0.1',
        `--port=${serverPort}`,
        `--runtime-dir=${runtimeDir}`,
      ],
      serverUrl: `http://127.0.0.1:${serverPort}`,
    },
    (serverUrl) =>
      runCellsWithConcurrency(cells, 1, (cell) =>
        runCell(ownerId, cell.id, group, { runtimeDir, evidenceDir, serverUrl }),
      ),
  )
}

export function runDemoPreviewCells(serverPort, cells, runCell) {
  buildDemoOnce()
  const concurrency = Number(process.env.FSUS_PLAYWRIGHT_CELL_CONCURRENCY) || 3
  return withSpawnedServer(
    {
      command: 'pnpm',
      args: [
        '-C',
        'vue/packages/demo-app',
        'exec',
        'vite',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(serverPort),
        '--strictPort',
      ],
      serverUrl: `http://127.0.0.1:${serverPort}`,
    },
    () => runCellsWithConcurrency(cells, concurrency, runCell),
  )
}

export async function runCellsWithConcurrency(cells, concurrency, workerFn) {
  const limit = Math.max(1, Math.min(cells.length, concurrency))
  const results = new Array(cells.length)
  let overallFailed = false
  let cursor = 0
  async function worker() {
    while (cursor < cells.length) {
      const index = cursor
      cursor += 1
      const result = await workerFn(cells[index], index)
      results[index] = result
      if (!result.ok) overallFailed = true
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()))
  return { results, overallFailed }
}

export function writeSkipOwnerEvidence({
  root = repoRoot,
  evidenceDir,
  ownerId,
  plan,
  group,
  commitSha,
  impactPlanDigest,
  logPrefix,
}) {
  const skipReceipt = {
    schemaVersion: 1,
    owner: ownerId,
    gate: plan.gate,
    group,
    commitSha,
    planDigest: plan.digest,
    impactPlanDigest,
    runtimeMode: plan.runtimeMode,
    skipReason: 'no cells selected for profile',
    status: 'success',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  writeEvidenceJson(evidencePath, skipReceipt)
  console.log(`[${logPrefix}] owner=${ownerId} group=${group} status=success (skipped)`)
  return { status: 'success', skipped: true, evidencePath }
}

export async function runPlaywrightOwner({
  argv = process.argv.slice(2),
  defaultOwnerId,
  defaultEvidenceDir,
  logPrefix = defaultOwnerId,
  loadPlan,
  executeCells,
  loadReceipts,
  verifyReceipts,
  verifyOptions,
  buildEvidenceExtra,
  includeStatusInEvidence = false,
  omitRuntimeModeInEvidence = false,
  root = repoRoot,
}) {
  const ownerId = option(argv, 'owner', defaultOwnerId)
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const evidenceDir = option(argv, 'evidence-dir', defaultEvidenceDir)
  const impactPlanPath = option(argv, 'impact-plan', '')
  const dryRun = hasFlag(argv, 'dry-run')

  const plan = loadPlan(group, ownerId)
  const { plan: selectedPlan, impactPlanDigest } = filterOwnerPlanByImpact({
    root,
    plan,
    group,
    impactPlanPath,
  })
  const cells = requestedCell
    ? selectedPlan.cells.filter((cell) => cell.id === requestedCell)
    : selectedPlan.cells
  if (requestedCell && cells.length === 0) {
    fail(`unknown cell ${requestedCell} for owner ${ownerId} group ${group}`)
  }

  const commitSha = process.env.GITHUB_SHA ?? readRepositoryCommit(root)
  if (cells.length === 0) {
    return writeSkipOwnerEvidence({
      root,
      evidenceDir,
      ownerId,
      plan,
      group,
      commitSha,
      impactPlanDigest,
      logPrefix,
    })
  }

  console.log(
    `[${logPrefix}] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) console.log(`- ${cell.id} ${cell.command}`)
    return { status: 'success', dryRun: true }
  }

  const execution = await executeCells({
    argv,
    ownerId,
    group,
    cells,
    plan,
    selectedPlan,
    evidenceDir,
    impactPlanPath,
    commitSha,
  })

  const receipts = loadReceipts(resolve(root, selectedPlan.receiptDirectory))
  const { summary, failed } = await verifyReceipts(
    ownerId,
    group,
    receipts,
    selectedPlan,
    { evidenceDir, expectedCommitSha: commitSha || undefined, ...verifyOptions },
  )

  const finalStatus =
    execution.overallFailed || failed ? 'failure' : 'success'
  const extra = buildEvidenceExtra?.({ execution, summary, evidenceDir }) ?? {}
  const evidence = {
    schemaVersion: 1,
    owner: ownerId,
    gate: plan.gate,
    group,
    commitSha,
    planDigest: plan.digest,
    impactPlanDigest,
    ...(omitRuntimeModeInEvidence ? {} : { runtimeMode: plan.runtimeMode }),
    ...extra,
    cells: execution.results,
    aggregate: summary,
    ...(includeStatusInEvidence ? { status: finalStatus } : {}),
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  writeEvidenceJson(evidencePath, evidence)

  console.log(
    `[${logPrefix}] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length} evidence=${evidencePath.slice(root.length + 1)}`,
  )
  if (finalStatus !== 'success') process.exitCode = 1
  return { status: finalStatus, evidencePath }
}
