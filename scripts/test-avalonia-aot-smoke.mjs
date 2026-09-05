#!/usr/bin/env node
/* global setTimeout */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { stableFamilies } from './avalonia-aot-native.mjs'

const root = path.resolve(import.meta.dirname, '..')
const fixture = path.join(root, 'tests/fixtures/avalonia-aot-smoke')
const publicProjects = [
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
]
const repositoryLockSnapshots = publicProjects.map((project) => {
  const lockPath = path.join(
    path.dirname(path.join(root, project)),
    'packages.lock.json',
  )
  return [lockPath, readFileSync(lockPath)]
})
const temporaryBase = path.resolve(
  process.env.FSUSUI_AOT_TMPDIR ?? path.dirname(root) ?? tmpdir(),
)
const temporaryRoot = mkdtempSync(
  path.join(temporaryBase, 'fsusui-native-aot-'),
)
const keepTemporaryRoot = process.env.FSUSUI_KEEP_AOT_SMOKE === '1'
process.on('exit', () => {
  for (const [lockPath, content] of repositoryLockSnapshots) {
    writeFileSync(lockPath, content)
  }
  if (!keepTemporaryRoot && existsSync(temporaryRoot)) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
const feed = path.join(temporaryRoot, 'feed')
const consumer = path.join(temporaryRoot, 'consumer')
const repositoryPackages = path.join(temporaryRoot, 'repository-packages')
const repositoryArtifacts = path.join(temporaryRoot, 'repository-artifacts')
const consumerPackages = path.join(temporaryRoot, 'consumer-packages')
const publishRoot = path.join(temporaryRoot, 'publish')
const reportPath = path.join(temporaryRoot, 'reports/smoke.json')
const leafManifestPath = path.join(temporaryRoot, 'reports/leaf-manifest.json')
const missingDotnetRoot = path.join(temporaryRoot, 'no-dotnet-runtime')
const dotnetInfo = spawnSync('dotnet', ['--info'], { encoding: 'utf8' })
const rid = dotnetInfo.stdout.match(/^\s*RID:\s*(\S+)\s*$/mu)?.[1]
const commitSha = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout.trim()
const packageVersion = readFileSync(
  path.join(root, 'dotnet/Directory.Build.props'),
  'utf8',
).match(/<Version>([^<]+)<\/Version>/u)?.[1]
const stableScenarios = stableFamilies()

assert.equal(dotnetInfo.status, 0, dotnetInfo.stderr)
assert.ok(rid, 'dotnet --info did not report the current host RID')
mkdirSync(feed, { recursive: true })
mkdirSync(missingDotnetRoot, { recursive: true })

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
  assert.notEqual(
    result.status,
    null,
    `${options.label ?? command} did not return an exit status`,
  )
  if (options.expectFailure) {
    assert.notEqual(
      result.status,
      0,
      `${options.label ?? command} unexpectedly succeeded`,
    )
  } else {
    assert.equal(
      result.status,
      0,
      `${options.label ?? command} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    )
  }
  return result
}

const globalPackagesOutput = execute(
  'dotnet',
  ['nuget', 'locals', 'global-packages', '--list'],
  { label: 'resolve global NuGet cache' },
).stdout.trim()
const globalPackages = realpathSync(
  globalPackagesOutput.slice(globalPackagesOutput.indexOf(':') + 1).trim(),
)
const candidatePackagePattern =
  /^fsusui\.avalonia(?:\.themes|\.icons)?\..*\.nupkg$/iu
const seedLocalFeed = (
  directory,
  { includeCandidatePackages = false } = {},
) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      seedLocalFeed(candidate, { includeCandidatePackages })
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.nupkg') &&
      (includeCandidatePackages ||
        !candidatePackagePattern.test(entry.name))
    ) {
      copyFileSync(candidate, path.join(feed, entry.name))
    }
  }
}
seedLocalFeed(globalPackages, { includeCandidatePackages: false })

const systemDotnet = realpathSync(
  execute('sh', ['-c', 'command -v dotnet'], {
    label: 'resolve .NET host',
  }).stdout.trim(),
)
const systemDotnetRoot = path.dirname(systemDotnet)
const isolatedSdkRoot = path.join(temporaryRoot, 'isolated-sdk')
mkdirSync(isolatedSdkRoot)
copyFileSync(systemDotnet, path.join(isolatedSdkRoot, 'dotnet'))
chmodSync(path.join(isolatedSdkRoot, 'dotnet'), 0o755)
for (const entry of readdirSync(systemDotnetRoot, { withFileTypes: true })) {
  if (entry.name === 'dotnet' || entry.name === 'packs') continue
  if (entry.name === 'sdk') {
    cpSync(
      path.join(systemDotnetRoot, entry.name),
      path.join(isolatedSdkRoot, entry.name),
      { recursive: true },
    )
    continue
  }
  symlinkSync(
    path.join(systemDotnetRoot, entry.name),
    path.join(isolatedSdkRoot, entry.name),
    entry.isDirectory() ? 'dir' : 'file',
  )
}
const isolatedPacks = path.join(isolatedSdkRoot, 'packs')
mkdirSync(isolatedPacks)
for (const entry of readdirSync(path.join(systemDotnetRoot, 'packs'), {
  withFileTypes: true,
})) {
  symlinkSync(
    path.join(systemDotnetRoot, 'packs', entry.name),
    path.join(isolatedPacks, entry.name),
    entry.isDirectory() ? 'dir' : 'file',
  )
}
for (const packageName of [
  'Microsoft.NETCore.App.Runtime',
  'Microsoft.AspNetCore.App.Runtime',
  'Microsoft.NETCore.App.Runtime.NativeAOT',
  'Microsoft.NETCore.App.Host',
]) {
  const alias = path.join(isolatedPacks, `${packageName}.linux-x64`)
  if (!existsSync(alias)) {
    symlinkSync(
      path.join(systemDotnetRoot, 'packs', `${packageName}.${rid}`),
      alias,
      'dir',
    )
  }
}
const ilCompilerAlias = path.join(
  isolatedPacks,
  'runtime.linux-x64.Microsoft.DotNet.ILCompiler',
)
if (!existsSync(ilCompilerAlias)) {
  symlinkSync(
    path.join(
      systemDotnetRoot,
      'packs',
      `runtime.${rid}.Microsoft.DotNet.ILCompiler`,
    ),
    ilCompilerAlias,
    'dir',
  )
}
const isolatedDotnet = path.join(isolatedSdkRoot, 'dotnet')
const linkerRoot = path.join(temporaryRoot, 'native-linker')
mkdirSync(linkerRoot)
const linkerCache = execute('/sbin/ldconfig', ['-p'], {
  label: 'resolve installed native libraries',
}).stdout
for (const [linkName, soname] of [
  ['libssl.so', 'libssl.so.3'],
  ['libcrypto.so', 'libcrypto.so.3'],
  ['libbrotlienc.so', 'libbrotlienc.so.1'],
  ['libbrotlidec.so', 'libbrotlidec.so.1'],
  ['libbrotlicommon.so', 'libbrotlicommon.so.1'],
]) {
  const escaped = soname.replaceAll('.', '\\.')
  const libraryPath = linkerCache.match(
    new RegExp(`^\\s*${escaped}\\s+.*=>\\s+(\\S+)\\s*$`, 'mu'),
  )?.[1]
  assert.ok(libraryPath, `${soname} is required by the Native AOT toolchain`)
  symlinkSync(libraryPath, path.join(linkerRoot, linkName), 'file')
}

const configTemplate = readFileSync(path.join(fixture, 'NuGet.Config'), 'utf8')
const configFor = (source) =>
  configTemplate.replace(
    '__FSUSUI_LOCAL_FEED__',
    source.replaceAll('&', '&amp;'),
  )
const nugetConfig = path.join(temporaryRoot, 'NuGet.Config')
writeFileSync(nugetConfig, configFor(feed))

const suppliedCandidateRoot = process.env.FSUSUI_AOT_CANDIDATE_ROOT
if (suppliedCandidateRoot) {
  seedLocalFeed(path.resolve(suppliedCandidateRoot), {
    includeCandidatePackages: true,
  })
} else {
  for (const project of publicProjects) {
    execute(
      'dotnet',
      [
        'restore',
        path.join(root, project),
        '--configfile',
        nugetConfig,
        '--packages',
        repositoryPackages,
        '--artifacts-path',
        repositoryArtifacts,
        '--no-cache',
        '--force',
      ],
      { label: `isolated repository restore ${project}` },
    )
    execute(
      'dotnet',
      [
        'pack',
        path.join(root, project),
        '--configuration',
        'Release',
        '--no-restore',
        '--output',
        feed,
        '--artifacts-path',
        repositoryArtifacts,
        `-p:RestorePackagesPath=${repositoryPackages}`,
      ],
      { label: `local pack ${project}` },
    )
  }
}

const candidatePackages = readdirSync(feed)
  .filter(
    (name) =>
      /^FsusUI\.Avalonia(?:\.Themes|\.Icons)?\..*\.nupkg$/u.test(name) &&
      !name.endsWith('.snupkg'),
  )
  .sort()
  .map((name) => {
    const content = readFileSync(path.join(feed, name))
    return {
      name,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  })
assert.equal(
  candidatePackages.length,
  3,
  'one three-package NuGet candidate is required',
)
const candidateHash = createHash('sha256')
for (const item of candidatePackages)
  candidateHash.update(`${item.name}\0${item.sha256}\n`)
let candidateDigest = candidateHash.digest('hex')
const suppliedManifest = process.env.FSUSUI_AOT_CANDIDATE_MANIFEST
if (suppliedManifest) {
  const manifest = JSON.parse(
    readFileSync(path.resolve(suppliedManifest), 'utf8'),
  )
  assert.equal(
    manifest.commitSha,
    commitSha,
    'supplied candidate commit mismatch',
  )
  assert.equal(manifest.kind, 'dotnet-package-candidate')
  const suppliedFiles = new Map()
  const indexSuppliedFiles = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name)
      if (entry.isDirectory()) indexSuppliedFiles(candidate)
      else if (entry.isFile()) suppliedFiles.set(entry.name, candidate)
    }
  }
  indexSuppliedFiles(path.resolve(suppliedCandidateRoot))
  const producerHash = createHash('sha256')
  for (const item of manifest.packages) {
    const suppliedFile = suppliedFiles.get(item.file)
    assert.ok(suppliedFile, `supplied candidate file is missing: ${item.file}`)
    const content = readFileSync(suppliedFile)
    const actualSha256 = createHash('sha256').update(content).digest('hex')
    assert.equal(
      actualSha256,
      item.sha256,
      `supplied candidate file digest mismatch: ${item.file}`,
    )
    assert.equal(
      content.length,
      item.bytes,
      `supplied candidate file size mismatch: ${item.file}`,
    )
    producerHash.update(`${item.file}\0${actualSha256}\n`)
  }
  assert.equal(
    producerHash.digest('hex'),
    manifest.candidateSha256,
    'supplied candidate digest mismatch',
  )
  for (const item of candidatePackages) {
    const producerItem = manifest.packages.find(
      (entry) => entry.file === item.name,
    )
    assert.equal(
      producerItem?.sha256,
      item.sha256,
      `consumed package digest mismatch: ${item.name}`,
    )
  }
  candidateDigest = manifest.candidateSha256
}

cpSync(fixture, consumer, { recursive: true })
writeFileSync(path.join(consumer, 'NuGet.Config'), configFor(feed))
const consumerProject = path.join(consumer, 'FsusUI.Avalonia.AotSmoke.csproj')
const publish = execute(
  isolatedDotnet,
  [
    'restore',
    consumerProject,
    '--runtime',
    rid,
    '-p:UseRidGraph=true',
    '--configfile',
    path.join(consumer, 'NuGet.Config'),
    '--packages',
    consumerPackages,
    '--no-cache',
    '--force',
  ],
  {
    cwd: consumer,
    label: 'isolated local-only consumer restore no-external-sources',
  },
)
assert.doesNotMatch(
  `${publish.stdout}\n${publish.stderr}`,
  /warning\s+(?:IL\d+|AOT\d+|trim)/iu,
  'Native AOT publish must not emit IL/AOT/trim warnings',
)
execute(
  isolatedDotnet,
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
    publishRoot,
  ],
  {
    cwd: consumer,
    env: { ...process.env, LIBRARY_PATH: linkerRoot },
    label: `Native AOT publish ${rid}`,
  },
)

const nativeBinary = path.join(publishRoot, 'FsusUI.Avalonia.AotSmoke')
assert.ok(
  existsSync(nativeBinary),
  `native binary is missing at ${nativeBinary}`,
)
const dynamicDependencies = execute('ldd', [nativeBinary], {
  label: 'inspect native dependencies',
}).stdout
assert.doesNotMatch(
  dynamicDependencies,
  /(?:coreclr|hostfxr|hostpolicy|libdotnet)/iu,
  'native executable must not link to an installed .NET runtime',
)
const nativeDependencyNames = dynamicDependencies
  .trim()
  .split('\n')
  .map((line) => path.basename(line.trim().split(/\s+/u)[0]))
  .filter(Boolean)

const inheritedDisplay = process.env.DISPLAY
const inheritedDisplayReady =
  Boolean(inheritedDisplay) &&
  spawnSync('/usr/bin/xdpyinfo', ['-display', inheritedDisplay], {
    stdio: 'ignore',
  }).status === 0
const display = inheritedDisplayReady
  ? inheritedDisplay
  : `:${100 + (process.pid % 500)}`
const xvfb = inheritedDisplayReady
  ? null
  : spawn(
      '/usr/bin/Xvfb',
      [display, '-screen', '0', '1024x768x24', '-nolisten', 'tcp'],
      { stdio: 'ignore' },
    )
const wait = (milliseconds) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
let ready = inheritedDisplayReady
for (let attempt = 0; attempt < 50; attempt += 1) {
  const probe = spawnSync('/usr/bin/xdpyinfo', ['-display', display], {
    stdio: 'ignore',
  })
  if (probe.status === 0) {
    ready = true
    break
  }
  wait(100)
}
assert.ok(ready, `Xvfb ${display} did not become ready`)

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

const runtimeFreeEnvironment = {
  DISPLAY: display,
  ...(inheritedDisplayReady && process.env.XAUTHORITY
    ? { XAUTHORITY: process.env.XAUTHORITY }
    : {}),
  HOME: path.join(temporaryRoot, 'home'),
  XDG_CACHE_HOME: path.join(temporaryRoot, 'xdg-cache'),
  XDG_CONFIG_HOME: path.join(temporaryRoot, 'xdg-config'),
  XDG_RUNTIME_DIR: path.join(temporaryRoot, 'xdg-runtime'),
  DOTNET_ROOT: missingDotnetRoot,
  DOTNET_MULTILEVEL_LOOKUP: '0',
  PATH: path.join(temporaryRoot, 'no-runtime-path'),
  LANG: 'C.UTF-8',
  DBUS_SESSION_BUS_ADDRESS: sessionBusAddress,
  ...(process.env.FSUSUI_AOT_DIAGNOSTIC === '1'
    ? { FSUSUI_AOT_DIAGNOSTIC: '1' }
    : {}),
}
const smokeArguments = (targetReport, extra = []) => [
  '--smoke',
  '--report',
  targetReport,
  '--commit-sha',
  commitSha,
  '--package-version',
  packageVersion ?? '',
  '--candidate-digest',
  candidateDigest,
  '--rid',
  rid,
  '--runtime-mode',
  'nativeaot',
  '--scenarios',
  stableScenarios.join(','),
  '--native-dependencies',
  nativeDependencyNames.join(';'),
  '--package-digests',
  candidatePackages.map((item) => `${item.name}:${item.sha256}`).join(';'),
  ...extra,
]
for (const directory of [
  runtimeFreeEnvironment.HOME,
  runtimeFreeEnvironment.XDG_CACHE_HOME,
  runtimeFreeEnvironment.XDG_CONFIG_HOME,
  runtimeFreeEnvironment.XDG_RUNTIME_DIR,
]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
}

const negativeControlTimeout = 60_000
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
    const processState = stat.slice(stat.lastIndexOf(')') + 2).split(' ', 1)[0]
    return processState !== 'Z'
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
  if (!isProcessRunning(pid)) return
  if (!signal('SIGTERM')) return
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

try {
  const positive = execute(nativeBinary, smokeArguments(reportPath), {
    cwd: temporaryRoot,
    env: runtimeFreeEnvironment,
    label: 'direct runtime-free native executable',
  })
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const binaryContent = readFileSync(nativeBinary)
  const binarySha256 = createHash('sha256').update(binaryContent).digest('hex')
  assert.equal(report.NativeBinarySha256, binarySha256)
  assert.deepEqual(report.NativeDependencies, nativeDependencyNames)
  assert.equal(report.PackageDigests.length, candidatePackages.length)
  assert.equal(report.NativeLogErrorCount, 0)
  assert.doesNotMatch(
    `${positive.stdout}\n${positive.stderr}`,
    /binding|resource|automation|loader.*(?:warning|error|failed)/iu,
  )
  assert.deepEqual(
    {
      smokeRequested: report.SmokeRequested,
      topLevelCreated: report.TopLevelCreated,
      dispatcherReached: report.DispatcherReached,
      platformHandleCreated: report.PlatformHandleCreated,
      scenarioCount: report.Scenarios.length,
      commandPaletteTreeCount: report.CommandPaletteTreeCount,
      codeEditorReady: report.CodeEditorReady,
      webViewAdapterReady: report.WebViewAdapterReady,
      activitySectionCount: report.ActivitySectionCount,
      documentCount: report.DocumentCount,
      titleBarPlatform: report.TitleBarPlatform,
      exitCode: report.ExitCode,
    },
    {
      smokeRequested: true,
      topLevelCreated: true,
      dispatcherReached: true,
      platformHandleCreated: true,
      scenarioCount: stableScenarios.length,
      commandPaletteTreeCount: 1,
      codeEditorReady: true,
      webViewAdapterReady: true,
      activitySectionCount: 1,
      documentCount: 1,
      titleBarPlatform: 'Linux',
      exitCode: 0,
    },
  )

  const resourceFailure = execute(
    nativeBinary,
    smokeArguments(path.join(temporaryRoot, 'reports/resource-failure.json'), [
      '--fail',
      'resource',
    ]),
    {
      cwd: temporaryRoot,
      env: runtimeFreeEnvironment,
      expectFailure: true,
      label: 'missing packaged resource',
      timeout: negativeControlTimeout,
    },
  )
  assert.match(resourceFailure.stderr, /resource failure|DefinitelyMissing/iu)

  const loaderFailure = execute(
    nativeBinary,
    smokeArguments(path.join(temporaryRoot, 'reports/loader-failure.json')),
    {
      cwd: temporaryRoot,
      env: { ...runtimeFreeEnvironment, DISPLAY: '' },
      expectFailure: true,
      label: 'missing Avalonia platform loader',
      timeout: negativeControlTimeout,
    },
  )
  assert.match(loaderFailure.stderr, /loader failure|display|x11/iu)

  execute(
    nativeBinary,
    smokeArguments(path.join(temporaryRoot, 'reports/ignored-log.json'), [
      '--fail',
      'ignored-log',
    ]),
    {
      cwd: temporaryRoot,
      env: runtimeFreeEnvironment,
      expectFailure: true,
      label: 'ignored binding log',
      timeout: negativeControlTimeout,
    },
  )
  const ignoredLogReport = JSON.parse(
    readFileSync(path.join(temporaryRoot, 'reports/ignored-log.json'), 'utf8'),
  )
  assert.ok(ignoredLogReport.NativeLogErrorCount > 0)
  assert.ok(ignoredLogReport.NativeLogAreas.includes('binding'))

  for (const name of readdirSync(feed)) {
    if (/^FsusUI\.Avalonia\.Icons\..*\.nupkg$/iu.test(name)) {
      rmSync(path.join(feed, name))
    }
  }
  const missingPackageConfig = path.join(
    temporaryRoot,
    'missing-package.config',
  )
  writeFileSync(missingPackageConfig, configFor(feed))
  const packageFailure = execute(
    isolatedDotnet,
    [
      'restore',
      consumerProject,
      '--runtime',
      rid,
      '-p:UseRidGraph=true',
      '--configfile',
      missingPackageConfig,
      '--packages',
      path.join(temporaryRoot, 'missing-package-cache'),
      '--no-cache',
      '--force',
    ],
    {
      expectFailure: true,
      label: 'missing local FsusUI package',
      timeout: negativeControlTimeout,
    },
  )
  assert.match(
    packageFailure.stdout + packageFailure.stderr,
    /FsusUI\.Avalonia\.Icons/iu,
  )

  const reportContent = readFileSync(reportPath)
  const leafManifest = {
    schemaVersion: 'fsusui.avalonia-aot-leaf-manifest.v1',
    status: 'success',
    commitSha,
    packageVersion,
    candidateSha256: candidateDigest,
    candidatePackages,
    rid,
    operatingSystem: process.platform,
    architecture: process.arch,
    nativeBinary: {
      name: path.basename(nativeBinary),
      format: 'ELF',
      bytes: binaryContent.length,
      sha256: binarySha256,
      runtimeIndependent: true,
      dependencies: nativeDependencyNames,
    },
    report: {
      schemaVersion: report.SchemaVersion,
      sha256: createHash('sha256').update(reportContent).digest('hex'),
      scenarioCount: report.Scenarios.length,
      passed: report.Scenarios.filter((item) => item.Passed).length,
      failed: report.Scenarios.filter((item) => !item.Passed).length,
      skipped: 0,
    },
    publishWarnings: 0,
    stdoutSummary: positive.stdout.trim() || 'no stdout',
    stderrSummary: positive.stderr.trim() || 'no stderr',
    optionalOffHost: ['win-x64', 'osx-arm64'],
  }
  writeFileSync(leafManifestPath, `${JSON.stringify(leafManifest, null, 2)}\n`)
  const evidenceOut = process.env.FSUSUI_AOT_EVIDENCE_OUT
  if (evidenceOut) {
    mkdirSync(evidenceOut, { recursive: true })
    copyFileSync(reportPath, path.join(evidenceOut, 'smoke-report.json'))
    copyFileSync(leafManifestPath, path.join(evidenceOut, 'leaf-manifest.json'))
    writeFileSync(path.join(evidenceOut, 'native-stdout.log'), positive.stdout)
    writeFileSync(path.join(evidenceOut, 'native-stderr.log'), positive.stderr)
  }

  console.log(`Native AOT smoke passed: rid=${rid}`)
  console.log(`native=${nativeBinary}`)
  console.log(`report=${JSON.stringify(report)}`)
  console.log(`candidate-sha256=${candidateDigest}`)
  console.log(`leaf-manifest=${leafManifestPath}`)
  console.log('restore=isolated local feed only; no-external-sources')
  console.log(
    'runtime=direct ELF launch with unavailable DOTNET_ROOT/PATH; no CLR/host dependency',
  )
  console.log(
    'negative=missing package, resource, platform loader, and ignored binding log returned nonzero',
  )
  if (positive.stdout) process.stdout.write(positive.stdout)
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
