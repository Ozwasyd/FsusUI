#!/usr/bin/env node
import assert from 'node:assert/strict'
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

const root = path.resolve(import.meta.dirname, '..')
const fixture = path.join(root, 'tests/fixtures/avalonia-aot-smoke')
const temporaryBase = path.resolve(
  process.env.FSUSUI_AOT_TMPDIR ?? path.dirname(root) ?? tmpdir(),
)
const temporaryRoot = mkdtempSync(
  path.join(temporaryBase, 'fsusui-native-aot-'),
)
const keepTemporaryRoot = process.env.FSUSUI_KEEP_AOT_SMOKE === '1'
process.on('exit', () => {
  if (!keepTemporaryRoot && existsSync(temporaryRoot)) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
const feed = path.join(temporaryRoot, 'feed')
const consumer = path.join(temporaryRoot, 'consumer')
const repositoryPackages = path.join(temporaryRoot, 'repository-packages')
const consumerPackages = path.join(temporaryRoot, 'consumer-packages')
const publishRoot = path.join(temporaryRoot, 'publish')
const reportPath = path.join(temporaryRoot, 'reports/smoke.json')
const missingDotnetRoot = path.join(temporaryRoot, 'no-dotnet-runtime')
const dotnetInfo = spawnSync('dotnet', ['--info'], { encoding: 'utf8' })
const rid = dotnetInfo.stdout.match(/^\s*RID:\s*(\S+)\s*$/mu)?.[1]

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
  })
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
const seedLocalFeed = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      seedLocalFeed(candidate)
    } else if (entry.isFile() && entry.name.endsWith('.nupkg')) {
      copyFileSync(candidate, path.join(feed, entry.name))
    }
  }
}
seedLocalFeed(globalPackages)

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
  const destination = path.join(isolatedPacks, `${packageName}.linux-x64`)
  if (existsSync(destination)) continue
  symlinkSync(
    path.join(systemDotnetRoot, 'packs', `${packageName}.${rid}`),
    destination,
    'dir',
  )
}
symlinkSync(
  path.join(
    systemDotnetRoot,
    'packs',
    `runtime.${rid}.Microsoft.DotNet.ILCompiler`,
  ),
  path.join(isolatedPacks, 'runtime.linux-x64.Microsoft.DotNet.ILCompiler'),
  'dir',
)
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
  configTemplate.replace('__FSUSUI_LOCAL_FEED__', source.replaceAll('&', '&amp;'))
const nugetConfig = path.join(temporaryRoot, 'NuGet.Config')
writeFileSync(nugetConfig, configFor(feed))

const publicProjects = [
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
]
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
      `-p:RestorePackagesPath=${repositoryPackages}`,
    ],
    { label: `local pack ${project}` },
  )
}

cpSync(fixture, consumer, { recursive: true })
writeFileSync(path.join(consumer, 'NuGet.Config'), configFor(feed))
const consumerProject = path.join(
  consumer,
  'FsusUI.Avalonia.AotSmoke.csproj',
)
execute(
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
  { cwd: consumer, label: 'isolated local-only consumer restore no-external-sources' },
)
execute(
  isolatedDotnet,
  ['publish', consumerProject, '--configuration', 'Release', '--runtime', rid, '-p:UseRidGraph=true', '--no-restore', '--output', publishRoot],
  {
    cwd: consumer,
    env: { ...process.env, LIBRARY_PATH: linkerRoot },
    label: `Native AOT publish ${rid}`,
  },
)

const nativeBinary = path.join(publishRoot, 'FsusUI.Avalonia.AotSmoke')
assert.ok(existsSync(nativeBinary), `native binary is missing at ${nativeBinary}`)
const dynamicDependencies = execute('ldd', [nativeBinary], {
  label: 'inspect native dependencies',
}).stdout
assert.doesNotMatch(
  dynamicDependencies,
  /(?:coreclr|hostfxr|hostpolicy|libdotnet)/iu,
  'native executable must not link to an installed .NET runtime',
)

const display = `:${100 + (process.pid % 500)}`
const xvfb = spawn('/usr/bin/Xvfb', [
  display,
  '-screen',
  '0',
  '1024x768x24',
  '-nolisten',
  'tcp',
])
const wait = (milliseconds) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
let ready = false
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

const runtimeFreeEnvironment = {
  DISPLAY: display,
  HOME: path.join(temporaryRoot, 'home'),
  XDG_CACHE_HOME: path.join(temporaryRoot, 'xdg-cache'),
  XDG_CONFIG_HOME: path.join(temporaryRoot, 'xdg-config'),
  XDG_RUNTIME_DIR: path.join(temporaryRoot, 'xdg-runtime'),
  DOTNET_ROOT: missingDotnetRoot,
  DOTNET_MULTILEVEL_LOOKUP: '0',
  PATH: path.join(temporaryRoot, 'no-runtime-path'),
  LANG: 'C.UTF-8',
}
for (const directory of [
  runtimeFreeEnvironment.HOME,
  runtimeFreeEnvironment.XDG_CACHE_HOME,
  runtimeFreeEnvironment.XDG_CONFIG_HOME,
  runtimeFreeEnvironment.XDG_RUNTIME_DIR,
]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
}

try {
  const positive = execute(
    nativeBinary,
    ['--smoke', '--report', reportPath],
    {
      cwd: temporaryRoot,
      env: runtimeFreeEnvironment,
      label: 'direct runtime-free native executable',
    },
  )
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  assert.deepEqual(
    {
      smokeRequested: report.SmokeRequested,
      topLevelCreated: report.TopLevelCreated,
      dispatcherReached: report.DispatcherReached,
      platformHandleCreated: report.PlatformHandleCreated,
      packageControlCount: report.PackageControlCount,
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
      packageControlCount: 4,
      activitySectionCount: 1,
      documentCount: 1,
      titleBarPlatform: 'Linux',
      exitCode: 0,
    },
  )

  const resourceFailure = execute(
    nativeBinary,
    [
      '--smoke',
      '--report',
      path.join(temporaryRoot, 'reports/resource-failure.json'),
      '--fail',
      'resource',
    ],
    {
      cwd: temporaryRoot,
      env: runtimeFreeEnvironment,
      expectFailure: true,
      label: 'missing packaged resource',
    },
  )
  assert.match(resourceFailure.stderr, /resource failure|DefinitelyMissing/iu)

  const loaderFailure = execute(
    nativeBinary,
    ['--smoke', '--report', path.join(temporaryRoot, 'reports/loader-failure.json')],
    {
      cwd: temporaryRoot,
      env: { ...runtimeFreeEnvironment, DISPLAY: '' },
      expectFailure: true,
      label: 'missing Avalonia platform loader',
    },
  )
  assert.match(loaderFailure.stderr, /loader failure|display|x11/iu)

  for (const name of readdirSync(feed)) {
    if (/^FsusUI\.Avalonia\.Icons\..*\.nupkg$/iu.test(name)) {
      rmSync(path.join(feed, name))
    }
  }
  const missingPackageConfig = path.join(temporaryRoot, 'missing-package.config')
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
    { expectFailure: true, label: 'missing local FsusUI package' },
  )
  assert.match(packageFailure.stdout + packageFailure.stderr, /FsusUI\.Avalonia\.Icons/iu)

  console.log(`Native AOT smoke passed: rid=${rid}`)
  console.log(`native=${nativeBinary}`)
  console.log(`report=${JSON.stringify(report)}`)
  console.log('restore=isolated local feed only; no-external-sources')
  console.log('runtime=direct ELF launch with unavailable DOTNET_ROOT/PATH; no CLR/host dependency')
  console.log('negative=missing package, resource, and platform loader returned nonzero')
  if (positive.stdout) process.stdout.write(positive.stdout)
} finally {
  xvfb.kill('SIGTERM')
  if (!keepTemporaryRoot) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  } else {
    console.log(`kept=${temporaryRoot}`)
  }
}
