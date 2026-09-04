#!/usr/bin/env node
/* global setTimeout */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn, spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const fixture = path.join(root, 'tests/fixtures/avalonia-aot-smoke')
const candidateRoot = process.env.FSUSUI_AOT_CANDIDATE_ROOT
const candidateManifestPath = process.env.FSUSUI_AOT_CANDIDATE_MANIFEST
assert.ok(candidateRoot, 'FSUSUI_AOT_CANDIDATE_ROOT is required')
assert.ok(candidateManifestPath, 'FSUSUI_AOT_CANDIDATE_MANIFEST is required')

const temporaryBase = path.resolve(
  process.env.FSUSUI_PACKED_RUNTIME_TMPDIR ?? tmpdir(),
)
const temporaryRoot = mkdtempSync(
  path.join(temporaryBase, 'fsusui-packed-runtime-'),
)
const keepTemporaryRoot = process.env.FSUSUI_KEEP_PACKED_RUNTIME_SMOKE === '1'
process.on('exit', () => {
  if (!keepTemporaryRoot && existsSync(temporaryRoot)) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

const feed = path.join(temporaryRoot, 'feed')
const consumer = path.join(temporaryRoot, 'consumer')
const packagesRoot = path.join(temporaryRoot, 'packages')
const jitRoot = path.join(temporaryRoot, 'jit')
const trimmedRoot = path.join(temporaryRoot, 'trimmed')
const reportRoot = path.join(temporaryRoot, 'reports')
mkdirSync(feed, { recursive: true })
mkdirSync(reportRoot, { recursive: true })

const execute = (command, arguments_, options = {}) => {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    env: options.env ?? process.env,
    timeout: options.timeout ?? 600_000,
    killSignal: 'SIGKILL',
  })
  assert.equal(
    result.error,
    undefined,
    `${options.label ?? command} did not terminate cleanly: ${result.error?.message}`,
  )
  assert.equal(
    result.signal,
    null,
    `${options.label ?? command} was terminated by ${result.signal}`,
  )
  assert.equal(
    result.status,
    0,
    `${options.label ?? command} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return result
}

const commitSha = execute('git', ['rev-parse', 'HEAD'], {
  label: 'resolve exact candidate commit',
}).stdout.trim()
const dotnetInfo = execute('dotnet', ['--info'], {
  label: 'resolve .NET runtime',
}).stdout
const rid = dotnetInfo.match(/^\s*RID:\s*(\S+)\s*$/mu)?.[1]
assert.ok(rid, 'dotnet --info did not report the current host RID')

const manifest = JSON.parse(
  readFileSync(path.resolve(candidateManifestPath), 'utf8'),
)
assert.equal(manifest.kind, 'dotnet-package-candidate')
assert.equal(manifest.commitSha, commitSha, 'candidate commit must match HEAD')
assert.match(manifest.candidateSha256, /^[0-9a-f]{64}$/u)

const suppliedFiles = new Map()
const indexFiles = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) indexFiles(candidate)
    else if (entry.isFile()) suppliedFiles.set(entry.name, candidate)
  }
}
indexFiles(path.resolve(candidateRoot))

const candidateHash = createHash('sha256')
for (const item of manifest.packages) {
  const supplied = suppliedFiles.get(item.file)
  assert.ok(supplied, `candidate package is missing: ${item.file}`)
  const content = readFileSync(supplied)
  const actualDigest = createHash('sha256').update(content).digest('hex')
  assert.equal(
    actualDigest,
    item.sha256,
    `candidate package drift: ${item.file}`,
  )
  assert.equal(
    content.length,
    item.bytes,
    `candidate package size drift: ${item.file}`,
  )
  candidateHash.update(`${item.file}\0${actualDigest}\n`)
}
assert.equal(
  candidateHash.digest('hex'),
  manifest.candidateSha256,
  'candidate manifest digest mismatch',
)

const seedLocalFeed = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) seedLocalFeed(candidate)
    else if (entry.isFile() && entry.name.endsWith('.nupkg')) {
      copyFileSync(candidate, path.join(feed, entry.name))
    }
  }
}
const globalPackagesOutput = execute(
  'dotnet',
  ['nuget', 'locals', 'global-packages', '--list'],
  { label: 'resolve global NuGet cache' },
).stdout.trim()
const globalPackages = realpathSync(
  globalPackagesOutput.slice(globalPackagesOutput.indexOf(':') + 1).trim(),
)
seedLocalFeed(globalPackages)
seedLocalFeed(path.resolve(candidateRoot))

const candidatePackages = readdirSync(feed)
  .filter(
    (name) =>
      /^FsusUI\.Avalonia(?:\.Themes|\.Icons)?\..*\.nupkg$/u.test(name) &&
      !name.endsWith('.snupkg'),
  )
  .sort()
assert.equal(
  candidatePackages.length,
  3,
  'three packed FsusUI packages are required',
)

cpSync(fixture, consumer, { recursive: true })
const configTemplate = readFileSync(path.join(fixture, 'NuGet.Config'), 'utf8')
writeFileSync(
  path.join(consumer, 'NuGet.Config'),
  configTemplate.replace(
    '__FSUSUI_LOCAL_FEED__',
    feed.replaceAll('&', '&amp;'),
  ),
)
const consumerProject = path.join(consumer, 'FsusUI.Avalonia.AotSmoke.csproj')
const packageVersion = readFileSync(
  path.join(root, 'dotnet/Directory.Build.props'),
  'utf8',
).match(/<Version>([^<]+)<\/Version>/u)?.[1]
const stableScenarios = JSON.parse(
  readFileSync(
    path.join(root, 'spec/ci/avalonia-stable-readiness.json'),
    'utf8',
  ),
).requiredStableComponentFamilies
const packageDigests = manifest.packages.map(
  (item) => `${item.file}:${item.sha256}`,
)

const inheritedDisplay = process.env.DISPLAY
const inheritedDisplayReady =
  Boolean(inheritedDisplay) &&
  spawnSync('/usr/bin/xdpyinfo', ['-display', inheritedDisplay], {
    stdio: 'ignore',
  }).status === 0
const display = inheritedDisplayReady
  ? inheritedDisplay
  : `:${600 + (process.pid % 300)}`
const xvfb = inheritedDisplayReady
  ? null
  : spawn(
      '/usr/bin/Xvfb',
      [display, '-screen', '0', '1024x768x24', '-nolisten', 'tcp'],
      { stdio: 'ignore' },
    )
const wait = (milliseconds) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
let displayReady = inheritedDisplayReady
for (let attempt = 0; attempt < 50; attempt += 1) {
  if (
    spawnSync('/usr/bin/xdpyinfo', ['-display', display], {
      stdio: 'ignore',
    }).status === 0
  ) {
    displayReady = true
    break
  }
  wait(100)
}
assert.ok(displayReady, `Xvfb ${display} did not become ready`)

const sessionBus = execute(
  '/usr/bin/dbus-daemon',
  ['--session', '--fork', '--print-address=1', '--print-pid=1'],
  { label: 'start isolated desktop session bus' },
)
  .stdout.trim()
  .split('\n')
const sessionBusAddress = sessionBus[0]
const sessionBusPid = Number.parseInt(sessionBus[1], 10)
assert.ok(sessionBusAddress, 'isolated desktop session bus address is missing')
assert.ok(
  Number.isInteger(sessionBusPid),
  'isolated desktop session bus PID is missing',
)

const runtimeEnvironment = {
  ...process.env,
  DISPLAY: display,
  ...(inheritedDisplayReady && process.env.XAUTHORITY
    ? { XAUTHORITY: process.env.XAUTHORITY }
    : {}),
  DOTNET_CLI_HOME: path.join(temporaryRoot, 'dotnet-cli'),
  NUGET_PACKAGES: packagesRoot,
  XDG_CACHE_HOME: path.join(temporaryRoot, 'xdg-cache'),
  XDG_CONFIG_HOME: path.join(temporaryRoot, 'xdg-config'),
  XDG_RUNTIME_DIR: path.join(temporaryRoot, 'xdg-runtime'),
  LANG: 'C.UTF-8',
  DBUS_SESSION_BUS_ADDRESS: sessionBusAddress,
}
for (const directory of [
  runtimeEnvironment.DOTNET_CLI_HOME,
  runtimeEnvironment.NUGET_PACKAGES,
  runtimeEnvironment.XDG_CACHE_HOME,
  runtimeEnvironment.XDG_CONFIG_HOME,
  runtimeEnvironment.XDG_RUNTIME_DIR,
]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))
const stopSpawnedChild = async (child, label) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(50)
    if (child.exitCode !== null || child.signalCode !== null) return
  }
  child.kill('SIGKILL')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(50)
    if (child.exitCode !== null || child.signalCode !== null) return
  }
  throw new Error(`${label} did not terminate after SIGKILL`)
}
const isProcessRunning = (pid) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ', 1)[0] !== 'Z'
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}
const stopProcessId = async (pid, label) => {
  const signal = (value) => {
    try {
      process.kill(pid, value)
      return true
    } catch (error) {
      if (error?.code === 'ESRCH') return false
      throw error
    }
  }
  if (!isProcessRunning(pid) || !signal('SIGTERM')) return
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(50)
    if (!isProcessRunning(pid)) return
  }
  if (!signal('SIGKILL')) return
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(50)
    if (!isProcessRunning(pid)) return
  }
  throw new Error(`${label} did not terminate after SIGKILL`)
}

const smokeArguments = (runtimeMode, reportPath, dependencies) => [
  '--smoke',
  '--report',
  reportPath,
  '--commit-sha',
  commitSha,
  '--package-version',
  packageVersion ?? '',
  '--candidate-digest',
  manifest.candidateSha256,
  '--rid',
  rid,
  '--runtime-mode',
  runtimeMode,
  '--scenarios',
  stableScenarios.join(','),
  '--native-dependencies',
  dependencies.join(';'),
  '--package-digests',
  packageDigests.join(';'),
]

const validateApplicationReport = (report, runtimeMode) => {
  assert.equal(report.SchemaVersion, 'fsusui.avalonia-aot-smoke-report.v1')
  assert.equal(report.CommitSha, commitSha)
  assert.equal(report.CandidateSha256, manifest.candidateSha256)
  assert.deepEqual(report.PackageDigests, packageDigests)
  assert.equal(report.Rid, rid)
  assert.equal(report.RuntimeMode, runtimeMode)
  assert.equal(report.RuntimeIndependent, runtimeMode === 'trimmed')
  assert.equal(report.ExitCode, 0)
  assert.equal(report.ScenarioCount, stableScenarios.length)
  assert.equal(report.ScenarioPassed, stableScenarios.length)
  assert.equal(report.ScenarioFailed, 0)
  assert.equal(report.ScenarioSkipped, 0)
  assert.equal(report.NativeLogErrorCount, 0)
  assert.deepEqual(report.NativeLogAreas, [])
  assert.equal(report.MarkdownProjectionProducerReady, true)
  assert.equal(report.MarkdownAutomationReady, true)
  assert.equal(report.MarkdownVirtualizationReady, true)
  assert.ok(report.MarkdownDocumentCharacters >= 100_000)
  assert.ok(report.MarkdownBlockCount >= 3_000)
  assert.ok(report.MarkdownHeadingCount >= 10_000)
  assert.ok(report.MarkdownVisualCount < 64)
  assert.ok(report.RenderScaling > 0)
}

try {
  const commonRestore = [
    consumerProject,
    '--configfile',
    path.join(consumer, 'NuGet.Config'),
    '--packages',
    packagesRoot,
    '--no-cache',
    '--force',
    '-p:PublishAot=false',
  ]
  execute('dotnet', ['restore', ...commonRestore], {
    cwd: consumer,
    label: 'packed JIT local-only restore',
  })
  execute(
    'dotnet',
    [
      'build',
      consumerProject,
      '--configuration',
      'Release',
      '--no-restore',
      '--output',
      jitRoot,
      '-p:PublishAot=false',
      '-p:PublishTrimmed=false',
      '-p:SelfContained=false',
      '-p:PublishSingleFile=false',
    ],
    { cwd: consumer, label: 'packed JIT build' },
  )
  const jitReportPath = path.join(reportRoot, 'jit.json')
  execute(
    'dotnet',
    [
      path.join(jitRoot, 'FsusUI.Avalonia.AotSmoke.dll'),
      ...smokeArguments('jit', jitReportPath, ['framework-dependent-dotnet']),
    ],
    {
      cwd: temporaryRoot,
      env: runtimeEnvironment,
      label: 'packed JIT MarkdownEditor smoke',
    },
  )
  const jitReport = JSON.parse(readFileSync(jitReportPath, 'utf8'))
  validateApplicationReport(jitReport, 'jit')

  execute(
    'dotnet',
    [
      'restore',
      ...commonRestore,
      '--runtime',
      rid,
      '-p:UseRidGraph=true',
      '-p:PublishTrimmed=true',
      '-p:SelfContained=true',
    ],
    { cwd: consumer, label: 'packed trimmed local-only restore' },
  )
  const trimmedPublish = execute(
    'dotnet',
    [
      'publish',
      consumerProject,
      '--configuration',
      'Release',
      '--runtime',
      rid,
      '-p:UseRidGraph=true',
      '--no-restore',
      '--output',
      trimmedRoot,
      '-p:PublishAot=false',
      '-p:PublishTrimmed=true',
      '-p:SelfContained=true',
      '-p:PublishSingleFile=true',
      '-p:StripSymbols=true',
    ],
    { cwd: consumer, label: 'packed self-contained trimmed publish' },
  )
  assert.doesNotMatch(
    `${trimmedPublish.stdout}\n${trimmedPublish.stderr}`,
    /warning\s+(?:IL\d+|AOT\d+|trim)/iu,
    'trimmed publish must not emit IL/AOT/trim warnings',
  )
  const trimmedBinary = path.join(trimmedRoot, 'FsusUI.Avalonia.AotSmoke')
  assert.ok(existsSync(trimmedBinary), 'trimmed executable is missing')
  const trimmedDependencies = execute('ldd', [trimmedBinary], {
    label: 'inspect trimmed dependencies',
  })
    .stdout.trim()
    .split('\n')
    .map((line) => path.basename(line.trim().split(/\s+/u)[0]))
    .filter(Boolean)
  const trimmedReportPath = path.join(reportRoot, 'trimmed.json')
  execute(
    trimmedBinary,
    smokeArguments('trimmed', trimmedReportPath, trimmedDependencies),
    {
      cwd: temporaryRoot,
      env: runtimeEnvironment,
      label: 'packed trimmed MarkdownEditor smoke',
    },
  )
  const trimmedReport = JSON.parse(readFileSync(trimmedReportPath, 'utf8'))
  validateApplicationReport(trimmedReport, 'trimmed')

  const evidence = {
    schemaVersion: 'fsusui.avalonia-packed-runtime-smoke.v1',
    commitSha,
    candidateSha256: manifest.candidateSha256,
    rid,
    packageVersion,
    packageDigests,
    modes: [
      {
        mode: 'jit',
        runtimeIndependent: false,
        reportSha256: createHash('sha256')
          .update(readFileSync(jitReportPath))
          .digest('hex'),
        scenarioPassed: jitReport.ScenarioPassed,
      },
      {
        mode: 'trimmed',
        runtimeIndependent: true,
        reportSha256: createHash('sha256')
          .update(readFileSync(trimmedReportPath))
          .digest('hex'),
        scenarioPassed: trimmedReport.ScenarioPassed,
      },
    ],
  }
  const evidenceContent = `${JSON.stringify(evidence, null, 2)}\n`
  const evidenceOutput = process.env.FSUSUI_PACKED_RUNTIME_EVIDENCE_OUT
  if (evidenceOutput) {
    mkdirSync(path.resolve(evidenceOutput), { recursive: true })
    writeFileSync(
      path.join(path.resolve(evidenceOutput), 'packed-runtime-report.json'),
      evidenceContent,
    )
    copyFileSync(
      jitReportPath,
      path.join(path.resolve(evidenceOutput), 'jit-report.json'),
    )
    copyFileSync(
      trimmedReportPath,
      path.join(path.resolve(evidenceOutput), 'trimmed-report.json'),
    )
  }
  console.log(
    `Packed runtime smoke passed: modes=jit,trimmed scenarios=${stableScenarios.length}/${stableScenarios.length} candidate-sha256=${manifest.candidateSha256}`,
  )
  console.log(
    `packed-runtime-report-sha256=${createHash('sha256').update(evidenceContent).digest('hex')}`,
  )
  console.log('restore=isolated local feed only; no-external-sources')
} finally {
  try {
    await stopSpawnedChild(xvfb, 'Xvfb')
  } finally {
    try {
      await stopProcessId(sessionBusPid, 'isolated desktop session bus')
    } finally {
      if (!keepTemporaryRoot) {
        rmSync(temporaryRoot, { recursive: true, force: true })
      } else {
        console.log(`kept=${temporaryRoot}`)
      }
    }
  }
}
