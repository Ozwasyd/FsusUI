import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdir,
  readFile,
  writeFile,
  statfs,
  readdir,
  mkdtemp,
  rm,
} from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
export const driverHash =
  'e384083854812459bddc2e83f478c9564c5ccf6e537f39a4295914bf2dc6bf7f'
export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex')
const theme = 'theme-switch'
const prefix = [
  'virtual-list-fixed-100k',
  'virtual-list-variable-100k',
  'table-v2-two-axis-100k',
  'data-table-sort-select-replace',
  'tree-expand-scroll',
  'input-continuous',
  theme,
]
export const diagnosticArms = Object.freeze(
  [
    ['A1F', 'baseline', 'fresh'],
    ['B1F', 'candidate', 'fresh'],
    ['B1P', 'candidate', 'prefix'],
    ['A1P', 'baseline', 'prefix'],
    ['A2P', 'baseline', 'prefix'],
    ['B2P', 'candidate', 'prefix'],
    ['B2F', 'candidate', 'fresh'],
    ['A2F', 'baseline', 'fresh'],
  ].map(([name, product, context]) => ({ name, product, context })),
)
export function assess(p95) {
  for (const { name } of diagnosticArms)
    assert.ok(Number.isFinite(p95[name]) && p95[name] > 0, `invalid P95 ${name}`)
  const pair = (context) => {
    const ratios = [1, 2].map((i) => p95[`B${i}${context}`] / p95[`A${i}${context}`])
    return { ratios, balancedRatio: Math.sqrt(ratios[0] * ratios[1]) }
  }
  const fresh = pair('F')
  const prefix = pair('P')
  return {
    kind: 'diagnostic-only-not-acceptance',
    formalAcceptance: false,
    p95,
    fresh,
    prefix,
    prefixToFreshInteraction: prefix.balancedRatio / fresh.balancedRatio,
  }
}
import { runHistoricalProcess } from './historical-bounded-process.mjs'

export const productShas = Object.freeze({
  baseline: 'f2d929a5d045439c35e93b4771f912ce50ec2337',
  candidate: '3cb39670f9427a0506466001261649925c129254',
})
const relativeProject =
  'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj'
const relativeDriver = 'dotnet/FsusUI.Avalonia.Demo/RenderPerformanceRunner.cs'
const originalBaselineHash =
  '847ac4385b6fec58b6e8fbf6a9e09289878853e6294936f1ab78fea46aff85e1'
const git = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 }).trim()
const targets = `<Project><Target Name="DiagnosticDriver" BeforeTargets="CoreCompile" Condition="'$(MSBuildProjectFullPath)' == '$(DiagnosticProject)'">
<ItemGroup><Old Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(DiagnosticOriginal)'"/><New Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(DiagnosticAdapted)'"/></ItemGroup>
<Error Condition="'@(Old->Count())' != '1' Or '@(New->Count())' != '0'" Text="Unexpected original Compile inputs"/>
<ItemGroup><Compile Remove="@(Old)"/><Compile Include="$(DiagnosticAdapted)"/><OldAfter Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(DiagnosticOriginal)'"/><NewAfter Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(DiagnosticAdapted)'"/></ItemGroup>
<Error Condition="'@(OldAfter->Count())' != '0' Or '@(NewAfter->Count())' != '1'" Text="Unexpected substituted Compile inputs"/>
<WriteLinesToFile File="$(DiagnosticManifest)" Lines="original=1/0;adapted=0/1" Overwrite="true"/>
</Target></Project>`
export function diagnosticArguments(assembly, output, scenario) {
  return [
    assembly,
    '--render-performance',
    '--profile',
    'quick',
    '--warmups',
    '1',
    '--samples',
    '21',
    '--long-scroll-iterations',
    '256',
    '--output',
    path.join(output, 'summary.json'),
    ...(scenario ? ['--scenario', scenario] : []),
  ]
}
async function checkedRun(command, args, options, log) {
  try {
    const result = await runHistoricalProcess(command, args, {
      ...options,
      stream: true,
    })
    await writeFile(log, `${result.stdout}\n${result.stderr}`)
    assert.equal(result.code, 0, `${command} failed; see ${log}`)
    assert.equal(result.signal, null)
    return result
  } catch (error) {
    await writeFile(
      log,
      `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.stack}`,
    )
    throw error
  }
}
export async function main(
  args = process.argv.slice(2),
  {
    readOsRelease = () => readFile('/etc/os-release', 'utf8'),
    readDiskSpace = statfs,
    probeDotnet = execFileSync,
    runCommand = checkedRun,
  } = {},
) {
  const arg = (name) => {
    const i = args.indexOf(name)
    assert.ok(i >= 0 && args[i + 1], `missing ${name}`)
    return path.resolve(args[i + 1])
  }
  const products = {
    baseline: arg('--baseline'),
    candidate: arg('--candidate'),
  }
  const output = arg('--output')
  assert.equal(process.platform, 'linux', 'hosted diagnostic requires Linux')
  const osRelease = await readOsRelease()
  assert.match(osRelease, /^ID=ubuntu$/m)
  assert.match(osRelease, /^VERSION_ID="22\.04"$/m)
  assert.ok(
    !process.env.CustomAfterMicrosoftCommonTargets,
    'unexpected target override',
  )
  for (const [name, cwd] of Object.entries(products)) {
    assert.equal(git(cwd, ['rev-parse', 'HEAD']), productShas[name])
    git(cwd, ['diff', '--quiet', 'HEAD', '--'])
  }
  const sdkList = probeDotnet('dotnet', ['--list-sdks'], {
    encoding: 'utf8',
    timeout: 30000,
  })
  const sdkMatch = /^10\.0\.401 \[(.+)\]$/m.exec(sdkList)
  assert.ok(sdkMatch, 'SDK 10.0.401 absent')
  const host = path.join(path.dirname(sdkMatch[1]), 'dotnet')
  const sdkCli = path.join(sdkMatch[1], '10.0.401', 'dotnet.dll')
  for (const cwd of Object.values(products))
    assert.equal(
      probeDotnet(host, [sdkCli, '--version'], {
        cwd,
        encoding: 'utf8',
        timeout: 30000,
      }).trim(),
      '10.0.401',
      'SDK mismatch',
    )
  const version = '10.0.401'
  const runtimes = probeDotnet(host, ['--list-runtimes'], {
    encoding: 'utf8',
    timeout: 30000,
  })
  assert.match(
    runtimes,
    /^Microsoft.NETCore.App 10\.0\.15 /m,
    'required runtime absent',
  )
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const fs = await readDiskSpace(output)
  assert.ok(fs.bavail * fs.bsize >= 2 * 1024 ** 3, 'need 2 GiB free scratch')
  const driver = await readFile(
    path.join(products.candidate, relativeDriver),
    'utf8',
  )
  assert.equal(sha256(driver), driverHash, 'unexpected immutable driver')
  const adapted = path.join(output, 'RenderPerformanceRunner.cs')
  const target = path.join(output, 'Diagnostic.targets')
  await writeFile(adapted, driver)
  await writeFile(target, targets)
  const manifest = {
    kind: 'diagnostic-only-not-acceptance',
    protocols: { fresh: 'variable-list-layout-ready.v1', prefix: 'variable-list-layout-ready.v2' },
    productShas,
    sourceDriverSha256: driverHash,
    effectiveDriverSha256: sha256(driver),
    sdk: version,
    installedRuntimes: runtimes,
    osRelease,
    instrumentation: 'none',
    sequence: diagnosticArms,
    builds: {},
    arms: [],
  }
  const save = () =>
    writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    )
  await save()
  const buildScratch = await mkdtemp(
    path.join(tmpdir(), 'fsus-theme-build-'),
  )
  const cleanEnv = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    AVALONIA_TELEMETRY_OPTOUT: '1',
    RestoreLockedMode: 'true',
  }
  for (const key of Object.keys(cleanEnv))
    if (
      key.startsWith('FSUSUI_AVALONIA_') ||
      key.startsWith('DOTNET_EventPipe') ||
      key.startsWith('COMPlus_EventPipe') ||
      [
        'DOTNET_EnableEventPipe',
        'COMPlus_EnableEventPipe',
        'DOTNET_DiagnosticPorts',
      ].includes(key)
    )
      delete cleanEnv[key]
  try {
    for (const [name, cwd] of Object.entries(products)) {
      const original = path.join(cwd, relativeDriver)
      const originalHash = sha256(await readFile(original))
      assert.equal(
        originalHash,
        name === 'baseline' ? originalBaselineHash : driverHash,
      )
      const build = path.join(buildScratch, name)
      const compileManifest = path.join(output, `${name}-compile.txt`)
      const env = {
        ...cleanEnv,
        CustomAfterMicrosoftCommonTargets: target,
        DiagnosticProject: path.join(cwd, relativeProject),
        DiagnosticOriginal: original,
        DiagnosticAdapted: adapted,
        DiagnosticManifest: compileManifest,
      }
      await runCommand(
        host,
        [
          sdkCli,
          'build',
          relativeProject,
          '-c',
          'Release',
          '--output',
          build,
          '--no-incremental',
        ],
        { cwd, env, stage: `build-${name}`, timeoutMs: 6 * 60_000 },
        path.join(output, `${name}-build.log`),
      )
      const substitution = (await readFile(compileManifest, 'utf8'))
        .trim()
        .split(/\r?\n/)
        .join(';')
      assert.equal(substitution, 'original=1/0;adapted=0/1')
      const assembly = path.join(build, 'FsusUI.Avalonia.Demo.dll')
      manifest.builds[name] = {
        originalHash,
        substitution,
        assemblySha256: sha256(await readFile(assembly)),
      }
      await save()
    }
    let environment
    for (const arm of diagnosticArms) {
      const directory = path.join(output, arm.name)
      await mkdir(directory)
      const cwd = products[arm.product]
      const assembly = path.join(
        buildScratch,
        arm.product,
        'FsusUI.Avalonia.Demo.dll',
      )
      const prefixed = arm.context === 'prefix'
      const protocol = manifest.protocols[arm.context]
      const launchId = prefixed ? randomUUID() : null
      const env = {
        ...cleanEnv,
        FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL: protocol,
        ...(prefixed ? { FSUSUI_AVALONIA_MEASUREMENT_PARTITION: 'canonical', FSUSUI_AVALONIA_MEASUREMENT_LAUNCH_ID: launchId } : {}),
        GITHUB_SHA: productShas[arm.product],
      }
      const appArgs = [
        'exec',
        '--fx-version',
        '10.0.15',
        ...diagnosticArguments(assembly, directory, prefixed ? undefined : theme),
      ]
      const command = '/usr/bin/xvfb-run'
      const commandArgs = ['-a', host, ...appArgs]
      const started = Date.now()
      await runCommand(
        command,
        commandArgs,
        { cwd, env, stage: arm.name, timeoutMs: 10 * 60_000 },
        path.join(directory, 'run.log'),
      )
      const summary = JSON.parse(
        await readFile(path.join(directory, 'summary.json'), 'utf8'),
      )
      assert.equal(summary.GitSha, productShas[arm.product])
      assert.equal(summary.Environment.DotNet, '.NET 10.0.15')
      if (environment)
        assert.deepEqual(
          summary.Environment,
          environment,
          'arm environment mismatch',
        )
      else environment = summary.Environment
      const ids = prefixed ? prefix : [theme]
      assert.equal(summary.Kind, 'real-avalonia-render-measurement')
      assert.equal(summary.Profile, 'quick')
      assert.equal(summary.MeasurementProtocol, protocol)
      assert.deepEqual(summary.Runner, { Warmups: 1, Samples: 21, LongScrollIterations: 256, ScenarioCount: ids.length })
      if (prefixed) {
        assert.equal(summary.MeasurementPartition, 'canonical')
        assert.equal(summary.LaunchId, launchId)
        assert.ok(Number.isSafeInteger(summary.ProcessId) && summary.ProcessId > 0)
      }
      assert.equal(summary.Environment.WindowPlatform, 'XID')
      assert.equal(summary.Environment.RequestedBackend, 'auto')
      assert.equal(summary.Environment.PlatformGraphicsBackend, 'software-no-platform-graphics')
      assert.deepEqual(summary.Results.map((row) => row.Id), ids)
      const rawFiles = await readdir(path.join(directory, 'raw'))
      assert.deepEqual(rawFiles.filter((file) => file.endsWith('.raw.json')).sort(), ids.map((id) => `${id}.raw.json`).sort())
      for (const row of summary.Results) {
        const raw = JSON.parse(await readFile(path.join(directory, 'raw', `${row.Id}.raw.json`), 'utf8'))
        assert.equal(row.MeasurementProtocol, protocol)
        assert.equal(raw.MeasurementProtocol, protocol)
        assert.equal(raw.Id, row.Id)
        assert.equal(raw.FrameMs.length, 21)
        assert.ok(raw.FrameMs.every((frame) => Number.isFinite(frame) && frame > 0))
        assert.equal([...raw.FrameMs].sort((a, b) => a - b)[19], row.FrameMs.P95)
      }
      const target = summary.Results.at(-1)
      const files = [
        'summary.json',
        ...(await readdir(path.join(directory, 'raw'))).map((f) => `raw/${f}`),
      ]
      const hashes = Object.fromEntries(
        await Promise.all(
          files.map(async (f) => [
            f,
            sha256(await readFile(path.join(directory, f))),
          ]),
        ),
      )
      const receipt = {
        ...arm,
        seconds: (Date.now() - started) / 1000,
        productSha: productShas[arm.product],
        effectiveDriverSha256: manifest.effectiveDriverSha256,
        environment,
        hashes,
        protocol,
        command: [command, ...commandArgs],
        processId: summary.ProcessId ?? null,
        launchId,
        themeGen2: target.Gc,
        frameP95: target.FrameMs.P95,
      }
      await writeFile(
        path.join(directory, 'receipt.json'),
        JSON.stringify(receipt, null, 2),
      )
      manifest.arms.push(receipt)
      await save()
    }
    const assessment = assess(
      Object.fromEntries(manifest.arms.map((arm) => [arm.name, arm.frameP95])),
    )
    await writeFile(
      path.join(output, 'assessment.json'),
      JSON.stringify(assessment, null, 2),
    )
    manifest.assessmentSha256 = sha256(
      await readFile(path.join(output, 'assessment.json')),
    )
    manifest.status = 'diagnostic-complete'
    await save()
  } catch (error) {
    manifest.status = 'failed'
    manifest.error = error.message
    await save()
    throw error
  } finally {
    await rm(buildScratch, { recursive: true, force: true })
    for (const cwd of Object.values(products))
      git(cwd, ['diff', '--quiet', 'HEAD', '--'])
  }
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  await main()
