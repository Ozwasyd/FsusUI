import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { materializeDriver } from './run-quick-web-60hz.mjs'
import { runHistoricalProcess } from './historical-bounded-process.mjs'
import { describeCadence } from './web-render-cadence.mjs'

export const scalarScenario = 'data-pipeline-table-100000-60hz-dpr2-reduced'
const definition = ['data-pipeline-table', 100_000, 60, 2, 'reduced']
const sha = (value) => createHash('sha256').update(value).digest('hex')
const protocolDefinition = {
  schema: 'fsusui.web-scalar-diagnostic.v1',
  scope: definition,
  browserVersion: '147.0.7727.15',
  sandbox: true,
  metric: 'nearest-rank end-to-end P95 including wait',
  warmups: 1,
}
const git = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const replace = (source, from, to) => {
  assert.equal(
    source.split(from).length,
    2,
    'unsupported Web calibration anchor',
  )
  return source.replace(from, to)
}

export function scalarDriver(source) {
  // Keep the pinned adapter's rendering and sandbox behavior. This is a distinct,
  // single-scenario diagnostic, not an accepted or renamed production artifact.
  const oldGuard =
    "if (profile !== 'quick' || scenarioFilter !== '')\n  throw new Error('quick-web-60hz.v1 requires the complete unfiltered quick matrix')\n"
  const exactGuard =
    "if (profile !== 'quick' || scenarioFilter !== 'data-pipeline-table')\n  throw new Error('Web scalar calibration only permits the pipeline table fixture')\n"
  let next = replace(source, oldGuard, exactGuard)
  next = replace(next, '...quickDimensions[0],', '...quickDimensions[1],')
  next = replace(
    next,
    '  const idleCadence = await captureIdleCadence(browser)',
    `  const target = JSON.stringify(${JSON.stringify(definition)})
  if (matrix.length !== 1 || JSON.stringify(matrix[0]) !== target)
    throw new Error('Web scalar calibration matrix mismatch')
  if (browser.version() !== '147.0.7727.15')
    throw new Error('Web scalar calibration requires the pinned Chromium 147.0.7727.15')
  const idleCadence = await captureIdleCadence(browser)`,
  )
  return next
}

export async function collect({
  productRoot,
  controllerRoot,
  expectedSha,
  output,
  browser,
  samples = 61,
  port = 5188,
  timeoutMs = 90_000,
}) {
  assert.match(expectedSha, /^[a-f0-9]{40}$/u)
  assert.ok([61, 101].includes(samples))
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535)
  assert.ok(path.isAbsolute(browser))
  const pristine = () => {
    assert.equal(git(productRoot, ['rev-parse', 'HEAD']), expectedSha)
    assert.equal(
      git(productRoot, ['diff', 'HEAD', '--']),
      '',
      'tracked product source dirty',
    )
  }
  pristine()
  await access(browser)
  const actual = execFileSync(browser, ['--version'], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim()
  assert.match(
    actual,
    /^(?:Chromium|(?:Google )?Chrome(?: for Testing)?) 147\.0\.7727\.15(?:\s|$)/u,
    'not the pinned 147 build',
  )
  const browserModule = createRequire(
    path.join(controllerRoot, 'package.json'),
  ).resolve('@playwright/test')
  const original = await readFile(
    path.join(productRoot, 'scripts/web-render-performance.mjs'),
    'utf8',
  )
  const adapted = materializeDriver(original, productRoot, browserModule)
  const effective = scalarDriver(adapted.effectiveSource)
  const processId = randomUUID()
  const startedAt = new Date().toISOString()
  const executable = await realpath(browser)
  const browserStat = await stat(executable, { bigint: true })
  const environmentDigest = sha(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      machine: os.hostname(),
      cores: os.availableParallelism(),
      cpu: os.cpus()[0]?.model,
      browserVersion: actual,
      browserPath: executable,
      browserFile: [
        browserStat.dev,
        browserStat.ino,
        browserStat.size,
        browserStat.mtimeNs,
      ].map(String),
      display: process.env.DISPLAY ?? null,
      runner: process.env.ImageVersion ?? null,
      cpuQuota: await readFile('/sys/fs/cgroup/cpu.max', 'utf8').catch(
        () => null,
      ),
      cpuSet: await readFile(
        '/sys/fs/cgroup/cpuset.cpus.effective',
        'utf8',
      ).catch(() => null),
    }),
  )
  const controllerSha = git(controllerRoot, ['rev-parse', 'HEAD'])
  const controllerFiles = [
    './web-ci-measurement-capture.mjs',
    './web-ci-measurement-score.mjs',
    './run-web-ci-measurement.mjs',
    './run-quick-web-60hz.mjs',
    './quick-web-60hz-adapter.mjs',
    './web-idle-cadence.mjs',
    './web-render-cadence.mjs',
    './historical-bounded-process.mjs',
  ]
  const controllerDigests = await Promise.all(
    controllerFiles.map(async (file) =>
      sha(await readFile(new URL(file, import.meta.url))),
    ),
  )
  const binding = {
    schema: 'fsusui.web-scalar-diagnostic.v1',
    experimental: true,
    processId,
    startedAt,
    protocolDigest: sha(
      JSON.stringify({
        ...protocolDefinition,
        samples,
        adapter: adapted.evidence.protocolDigest,
        controllerSha,
        controllerDigests,
      }),
    ),
    environmentDigest,
    scenario: scalarScenario,
    expectedSha,
    controllerSha,
    controllerDigests,
    browserVersion: actual,
    sourceSha256: sha(original),
    effectiveSha256: sha(effective),
    samples,
    warmups: 1,
  }
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'fsus-web-scalar-'))
  const sidecar = path.join(tmp, 'driver.mjs')
  await writeFile(
    path.join(output, 'scalar-binding.json'),
    JSON.stringify(binding, null, 2) + '\n',
  )
  await writeFile(sidecar, effective)
  try {
    const run = await runHistoricalProcess(
      process.execPath,
      [
        sidecar,
        '--profile',
        'quick',
        '--scenario',
        'data-pipeline-table',
        '--warmups',
        '1',
        '--samples',
        String(samples),
        '--output',
        output,
        '--port',
        String(port),
      ],
      {
        cwd: productRoot,
        env: {
          ...process.env,
          GITHUB_SHA: expectedSha,
          FSUSUI_PERF_BROWSER_EXECUTABLE: browser,
          FSUSUI_WEB_FAILURE_DIAGNOSTICS: '0',
          FSUSUI_WEB_PROTOCOL_BINDING: JSON.stringify(binding),
        },
        timeoutMs,
        stage: 'web-scalar-calibration',
        stream: true,
        maxOutputBytes: 4 * 1024 * 1024,
      },
    )
    await writeFile(
      path.join(output, 'process.log'),
      `${run.stdout ?? ''}\n${run.stderr ?? ''}`,
    )
    assert.equal(run.code, 0, 'targeted benchmark did not complete')
    assert.ok(!run.signal)
    pristine()
    const rawName = `${scalarScenario}.raw.json`
    const rawBytes = await readFile(path.join(output, rawName))
    const raw = JSON.parse(rawBytes)
    assert.equal(raw.id, scalarScenario)
    assert.equal(raw.inputToFrame.length, samples)
    assert.equal(raw.frameWork.length, samples)
    assert.ok(
      raw.inputToFrame.every(
        (x, i) =>
          Number.isFinite(x) &&
          Number.isFinite(raw.frameWork[i]) &&
          x >= raw.frameWork[i] &&
          raw.frameWork[i] >= 0,
      ),
    )
    const summary = JSON.parse(
      await readFile(path.join(output, 'summary.json'), 'utf8'),
    )
    assert.equal(summary.gitSha, expectedSha)
    assert.deepEqual(summary.measurementProtocol, binding)
    assert.deepEqual(raw.measurementProtocol, binding)
    assert.deepEqual(
      summary.results.map((r) => r.id),
      [scalarScenario],
    )
    const idleIntervals = raw.idleCadence?.intervals
    assert.equal(idleIntervals?.length, 20, 'missing idle cadence evidence')
    assert.equal(raw.idleCadence.browserVersion, '147.0.7727.15')
    assert.equal(
      describeCadence(60, idleIntervals).status,
      'consistent-with-request',
    )
    assert.deepEqual(summary.idleCadence, raw.idleCadence)
    const endedAt = new Date().toISOString()
    const rawSha256 = sha(rawBytes)
    const envelope = {
      schema: 'fsusui.process-web-capture.v1',
      processId,
      productSha: expectedSha,
      scenario: scalarScenario,
      protocolDigest: binding.protocolDigest,
      environmentDigest,
      warmups: 1,
      idleIntervals,
      generatedAt: summary.generatedAt,
      originalRaw: rawName,
      originalRawSha256: rawSha256,
      inputToFrame: raw.inputToFrame,
      frameWork: raw.frameWork,
    }
    const bytes = JSON.stringify(envelope, null, 2) + '\n'
    await writeFile(path.join(output, 'process-capture.json'), bytes, {
      flag: 'wx',
    })
    const proof = {
      ...binding,
      endedAt,
      rawSha256,
      capture: {
        processId,
        productSha: expectedSha,
        startedAt,
        endedAt,
        artifact: 'process-capture.json',
        sha256: sha(bytes),
      },
    }
    await writeFile(
      path.join(output, 'scalar-proof.json'),
      JSON.stringify(proof, null, 2) + '\n',
      { flag: 'wx' },
    )
    return { proof, bytes }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}
