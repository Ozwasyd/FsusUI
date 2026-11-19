import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdir,
  readFile,
  writeFile,
  stat,
  statfs,
  readdir,
  mkdtemp,
  rm,
} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  createGcOverlay,
  diagnosticArms,
  sha256,
  driverHash,
} from './avalonia-gc-overlay.mjs'
import { runHistoricalProcess } from './historical-bounded-process.mjs'
import { verifyAvaloniaLayoutReady } from './verify-avalonia-layout-ready.mjs'

export const productShas = Object.freeze({
  baseline: 'f2d929a5d045439c35e93b4771f912ce50ec2337',
  candidate: '4923ba3e148efc84792bef0c5c7593a706b5efc7',
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
export async function main(args = process.argv.slice(2)) {
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
  const os = await readFile('/etc/os-release', 'utf8')
  assert.match(os, /^ID=ubuntu$/m)
  assert.match(os, /^VERSION_ID="22\.04"$/m)
  assert.ok(
    !process.env.CustomAfterMicrosoftCommonTargets,
    'unexpected target override',
  )
  for (const [name, cwd] of Object.entries(products)) {
    assert.equal(git(cwd, ['rev-parse', 'HEAD']), productShas[name])
    git(cwd, ['diff', '--quiet', 'HEAD', '--'])
  }
  const sdkList = execFileSync('dotnet', ['--list-sdks'], {
    encoding: 'utf8',
    timeout: 30000,
  })
  const sdkMatch = /^10\.0\.401 \[(.+)\]$/m.exec(sdkList)
  assert.ok(sdkMatch, 'SDK 10.0.401 absent')
  const host = path.join(path.dirname(sdkMatch[1]), 'dotnet')
  const sdkCli = path.join(sdkMatch[1], '10.0.401', 'dotnet.dll')
  for (const cwd of Object.values(products))
    assert.equal(
      execFileSync(host, [sdkCli, '--version'], {
        cwd,
        encoding: 'utf8',
        timeout: 30000,
      }).trim(),
      '10.0.401',
      'SDK mismatch',
    )
  const version = '10.0.401'
  const runtimes = execFileSync(host, ['--list-runtimes'], {
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
  const fs = await statfs(output)
  assert.ok(fs.bavail * fs.bsize >= 2 * 1024 ** 3, 'need 2 GiB free scratch')
  const driver = await readFile(
    path.join(products.candidate, relativeDriver),
    'utf8',
  )
  const overlay = createGcOverlay(driver)
  const adapted = path.join(output, 'RenderPerformanceRunner.cs')
  const target = path.join(output, 'Diagnostic.targets')
  await writeFile(adapted, overlay)
  await writeFile(target, targets)
  const manifest = {
    kind: 'diagnostic-only-not-acceptance',
    protocol: 'variable-list-layout-ready.v1',
    productShas,
    sourceDriverSha256: driverHash,
    overlaySha256: sha256(overlay),
    sdk: version,
    installedRuntimes: runtimes,
    osRelease: os,
    provider:
      'Microsoft-Windows-DotNETRuntime:1:4,FsusUI-RenderPhases:FFFFFFFFFFFFFFFF:4',
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
  const buildScratch = await mkdtemp(path.join(os.tmpdir(), 'fsus-gc-build-'))
  const cleanEnv = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    AVALONIA_TELEMETRY_OPTOUT: '1',
    RestoreLockedMode: 'true',
    FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL: 'variable-list-layout-ready.v1',
  }
  for (const key of Object.keys(cleanEnv))
    if (key.startsWith('DOTNET_EventPipe') || key === 'DOTNET_EnableEventPipe')
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
      await checkedRun(
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
      const trace = path.join(directory, 'gc.nettrace')
      const cwd = products[arm.product]
      const assembly = path.join(
        buildScratch,
        arm.product,
        'FsusUI.Avalonia.Demo.dll',
      )
      const env = {
        ...cleanEnv,
        GITHUB_SHA: productShas[arm.product],
        DOTNET_EnableEventPipe: '1',
        DOTNET_EventPipeConfig: manifest.provider,
        DOTNET_EventPipeCircularMB: '20',
        DOTNET_EventPipeOutputStreaming: '1',
        DOTNET_EventPipeOutputPath: trace,
      }
      const appArgs = [
        'exec',
        '--fx-version',
        '10.0.15',
        ...diagnosticArguments(assembly, directory, arm.scenario),
      ]
      const command = env.DISPLAY ? host : '/usr/bin/xvfb-run'
      const commandArgs = env.DISPLAY ? appArgs : ['-a', host, ...appArgs]
      const started = Date.now()
      await checkedRun(
        command,
        commandArgs,
        { cwd, env, stage: arm.name, timeoutMs: 10 * 60_000 },
        path.join(directory, 'run.log'),
      )
      await verifyAvaloniaLayoutReady(directory, { scenario: arm.scenario })
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
      assert.ok((await stat(trace)).size > 0, 'missing trace')
      assert.ok(
        (await stat(trace)).size <= 256 * 1024 ** 2,
        'trace exceeds 256MiB budget',
      )
      const files = [
        'summary.json',
        'gc.nettrace',
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
        overlaySha256: manifest.overlaySha256,
        environment,
        hashes,
        traceDecoded: false,
      }
      await writeFile(
        path.join(directory, 'receipt.json'),
        JSON.stringify(receipt, null, 2),
      )
      manifest.arms.push(receipt)
      await save()
    }
    manifest.status = 'captured-not-yet-decoded'
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
