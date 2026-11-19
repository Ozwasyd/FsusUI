import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

export const nativeProtocol = 'variable-list-layout-ready.v1'
export const nativeSplitProtocol = 'variable-list-layout-ready.v2'
export const supportedNativeProtocol = protocol => [nativeProtocol, nativeSplitProtocol].includes(protocol)
const partitions = ['canonical', 'sustained']
export const nativePartitionPath = (output, partition) => {
  requireThat(partitions.includes(partition), 'unknown process partition')
  return partition === 'canonical' ? output : path.join(output, 'sustained')
}

export const historicalNativeSha = 'f2d929a5d045439c35e93b4771f912ce50ec2337'
const demo = 'dotnet/FsusUI.Avalonia.Demo'
const project = `${demo}/FsusUI.Avalonia.Demo.csproj`
const driver = `${demo}/RenderPerformanceRunner.cs`
const historicalDriverHash = '847ac4385b6fec58b6e8fbf6a9e09289878853e6294936f1ab78fea46aff85e1'
const binding = 'measurement-layout-binding.json'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const hashFile = async (file) => sha256(await readFile(file))
const productHead = (cwd) =>
  execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
const requireThat = (condition, message) => {
  if (!condition) throw new Error(`Avalonia layout-ready: ${message}`)
}

export const nativeDriverHash = (root) => hashFile(path.join(root, driver))

// The historical SDK bridge runs the SDK's managed CLI, not the dotnet muxer.
// It selects the exact SDK for build; runtime DLLs must use the underlying host.
export function avaloniaRuntimeCommand(assembly, appArgs, env, platform = process.platform) {
  const host = env.DOTNET_HOST_PATH || 'dotnet'
  requireThat(host === 'dotnet' || path.isAbsolute(host), 'runtime host must be absolute')
  const args = [assembly, ...appArgs]
  return platform === 'linux' && !env.DISPLAY
    ? { command: '/usr/bin/xvfb-run', args: ['-a', host, ...args] }
    : { command: host, args }
}

const historicalCompileTargets = `<Project>
  <Target Name="FsusLayoutReadyDriver" BeforeTargets="CoreCompile"
          Condition="'$(MSBuildProjectFullPath)' == '$(FsusLayoutReadyProject)'">
    <ItemGroup>
      <_FsusOld Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(FsusLayoutReadyOriginal)'" />
      <_FsusNew Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(FsusLayoutReadyAdapted)'" />
    </ItemGroup>
    <Error Condition="'@(_FsusOld->Count())' != '1' Or '@(_FsusNew->Count())' != '0'"
           Text="Unexpected Avalonia benchmark Compile inputs" />
    <ItemGroup>
      <Compile Remove="@(_FsusOld)" />
      <Compile Include="$(FsusLayoutReadyAdapted)" />
      <_FsusOldAfter Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(FsusLayoutReadyOriginal)'" />
      <_FsusNewAfter Include="@(Compile)" Condition="'%(Compile.FullPath)' == '$(FsusLayoutReadyAdapted)'" />
    </ItemGroup>
    <Error Condition="'@(_FsusOldAfter->Count())' != '0' Or '@(_FsusNewAfter->Count())' != '1'"
           Text="Avalonia benchmark Compile substitution failed" />
    <WriteLinesToFile File="$(FsusLayoutReadyManifest)" Lines="original=1/0;adapted=0/1" Overwrite="true" />
  </Target>
</Project>
`

async function artifactHashes(output) {
  const files = ['summary.json']
  for (const name of (await readdir(path.join(output, 'raw'))).sort()) {
    if (name.endsWith('.raw.json')) files.push(`raw/${name}`)
  }
  requireThat(files.length > 1, 'no raw benchmark outputs')
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    await hashFile(path.join(output, file)),
  ])))
}

const releaseSummary = async output => JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'))

async function partitionRecord(output, partition, launchId, productSha) {
  const directory = nativePartitionPath(output, partition)
  const summary = await releaseSummary(directory)
  requireThat(summary.GitSha === productSha && summary.MeasurementProtocol === nativeSplitProtocol
    && summary.MeasurementPartition === partition && summary.LaunchId === launchId
    && Number.isSafeInteger(summary.ProcessId) && summary.ProcessId > 0,
  'partition process/source identity mismatch')
  return { partition, launchId, processId: summary.ProcessId,
    artifacts: await artifactHashes(directory) }
}

export async function readNativeBinding(output, expectedProductSha, expectedDriverHash, expectedScenario, expectedProtocol = nativeProtocol) {
  const evidence = JSON.parse(await readFile(path.join(output, binding), 'utf8'))
  requireThat(
    evidence.schemaVersion === (expectedProtocol === nativeSplitProtocol ? 2 : 1)
      && evidence.protocol === expectedProtocol
      && typeof evidence.scenario === 'string'
      && (expectedScenario === undefined || evidence.scenario === expectedScenario)
      && evidence.productSha === expectedProductSha
      && evidence.effectiveDriverSha256 === expectedDriverHash
      && /^[0-9a-f]{64}$/u.test(evidence.demoAssemblySha256)
      && evidence.historical === (expectedProductSha === historicalNativeSha)
      && (!evidence.historical || evidence.originalDriverSha256 === historicalDriverHash)
      && (!evidence.historical || evidence.compileSubstitution === 'original=1/0;adapted=0/1')
      && (evidence.historical || evidence.originalDriverSha256 === expectedDriverHash),
    'measurement provenance mismatch',
  )
  if (expectedProtocol === nativeSplitProtocol) {
    requireThat(evidence.scenario === '' && Array.isArray(evidence.partitions)
      && evidence.partitions.length === 2, 'split manifest incomplete')
    const actual = await Promise.all(partitions.map(async (partition, i) => {
      const proof = evidence.partitions[i]
      requireThat(proof.partition === partition && /^[a-f0-9-]{36}$/u.test(proof.launchId), 'split partition order or identity')
      return partitionRecord(output, partition, proof.launchId, expectedProductSha)
    }))
    requireThat(actual[0].launchId !== actual[1].launchId && actual[0].processId !== actual[1].processId,
      'split partitions must have distinct process identities')
    requireThat(JSON.stringify(evidence.partitions) === JSON.stringify(actual), 'split partition artifact mismatch')
  } else {
    const actual = await artifactHashes(output)
    requireThat(JSON.stringify(evidence.artifacts) === JSON.stringify(actual), 'artifact hash mismatch')
  }
  return evidence
}

export async function launchAvaloniaLayoutReady({ controllerRoot, productRoot, output, appArgs, scenario, run, protocol = nativeProtocol }) {
  requireThat(supportedNativeProtocol(protocol), 'unsupported measurement protocol')
  const split = protocol === nativeSplitProtocol
  requireThat(!split || scenario === '', 'split requires an unfiltered native run')
  const historical = controllerRoot !== productRoot
  const productSha = productHead(productRoot)
  const effectiveDriver = await readFile(path.join(controllerRoot, driver))
  const originalDriverSha256 = await nativeDriverHash(productRoot)
  const effectiveDriverSha256 = sha256(effectiveDriver)
  requireThat(!historical || productSha === historicalNativeSha, 'unsupported historical product SHA')
  requireThat(!historical || originalDriverSha256 === historicalDriverHash, 'historical driver drift')
  requireThat(historical || originalDriverSha256 === effectiveDriverSha256, 'candidate driver drift')
  requireThat(!process.env.CustomAfterMicrosoftCommonTargets, 'unexpected custom MSBuild target import')
  if (historical)
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: productRoot })
  await mkdir(output)
  const scratch = await mkdtemp(path.join(tmpdir(), 'fsus-av-layout-ready-'))
  const manifest = path.join(scratch, 'compile-manifest.txt')
  try {
    const env = { ...process.env, GITHUB_SHA: productSha }
    if (historical) {
      const targets = path.join(scratch, 'NativeMeasurement.targets')
      const adapted = path.join(scratch, 'RenderPerformanceRunner.cs')
      await writeFile(targets, historicalCompileTargets)
      await writeFile(adapted, effectiveDriver)
      Object.assign(env, {
        CustomAfterMicrosoftCommonTargets: targets,
        FsusLayoutReadyProject: path.join(productRoot, project),
        FsusLayoutReadyOriginal: path.join(productRoot, driver),
        FsusLayoutReadyAdapted: adapted,
        FsusLayoutReadyManifest: manifest,
      })
    }
    const build = path.join(scratch, 'build')
    await run('dotnet', ['build', project, '--configuration', 'Release', '--output', build, '--no-incremental'], { env })
    const compileSubstitution = historical
      ? (await readFile(manifest, 'utf8')).trim().split(/\r?\n/u).join(';')
      : null
    requireThat(!historical || compileSubstitution === 'original=1/0;adapted=0/1', 'historical replacement was not compiled')
    const assembly = path.join(build, 'FsusUI.Avalonia.Demo.dll')
    const demoAssemblySha256 = await hashFile(assembly)
    const launch = async (args, launchEnv) => {
      const runtime = avaloniaRuntimeCommand(assembly, args, launchEnv)
      if (runtime.command === '/usr/bin/xvfb-run') await access(runtime.command)
      await run(runtime.command, runtime.args, { env: launchEnv })
    }
    const splitRecords = []
    if (split) {
      requireThat(!env.FSUSUI_AVALONIA_MEASUREMENT_PARTITION && !env.FSUSUI_AVALONIA_MEASUREMENT_LAUNCH_ID,
        'unexpected ambient split identity')
      const outputIndex = appArgs.indexOf('--output')
      requireThat(outputIndex !== -1 && appArgs.lastIndexOf('--output') === outputIndex, 'split requires one output flag')
      for (const partition of partitions) {
        const launchId = randomUUID()
        const args = [...appArgs]
        args[outputIndex + 1] = path.join(nativePartitionPath(output, partition), 'summary.json')
        await launch(args, { ...env, FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL: protocol,
          FSUSUI_AVALONIA_MEASUREMENT_PARTITION: partition, FSUSUI_AVALONIA_MEASUREMENT_LAUNCH_ID: launchId })
        splitRecords.push(await partitionRecord(output, partition, launchId, productSha))
      }
      requireThat(splitRecords[0].processId !== splitRecords[1].processId, 'split reused one process')
    } else await launch(appArgs, env)
    if (historical)
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: productRoot })
    requireThat(productHead(productRoot) === productSha, 'product revision changed during measurement')
    requireThat(await nativeDriverHash(controllerRoot) === effectiveDriverSha256, 'driver changed during measurement')
    await writeFile(path.join(output, binding), `${JSON.stringify({
      schemaVersion: split ? 2 : 1,
      protocol,
      scenario,
      productSha,
      historical,
      originalDriverSha256,
      effectiveDriverSha256,
      demoAssemblySha256,
      compileSubstitution,
      ...(split ? { partitions: splitRecords } : { artifacts: await artifactHashes(output) }),
    }, null, 2)}\n`, { flag: 'wx' })
    return { productSha, effectiveDriverSha256 }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
