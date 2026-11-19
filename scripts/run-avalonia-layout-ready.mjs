import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

export const nativeProtocol = 'variable-list-layout-ready.v1'
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

export async function readNativeBinding(output, expectedProductSha, expectedDriverHash, expectedScenario) {
  const evidence = JSON.parse(await readFile(path.join(output, binding), 'utf8'))
  requireThat(
    evidence.schemaVersion === 1
      && evidence.protocol === nativeProtocol
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
  const actual = await artifactHashes(output)
  requireThat(JSON.stringify(evidence.artifacts) === JSON.stringify(actual), 'artifact hash mismatch')
  return evidence
}

export async function launchAvaloniaLayoutReady({ controllerRoot, productRoot, output, appArgs, scenario, run }) {
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
    const runtime = avaloniaRuntimeCommand(assembly, appArgs, env)
    if (runtime.command === '/usr/bin/xvfb-run') await access(runtime.command)
    await run(runtime.command, runtime.args, { env })
    if (historical)
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: productRoot })
    requireThat(productHead(productRoot) === productSha, 'product revision changed during measurement')
    requireThat(await nativeDriverHash(controllerRoot) === effectiveDriverSha256, 'driver changed during measurement')
    await writeFile(path.join(output, binding), `${JSON.stringify({
      schemaVersion: 1,
      protocol: nativeProtocol,
      scenario,
      productSha,
      historical,
      originalDriverSha256,
      effectiveDriverSha256,
      demoAssemblySha256,
      compileSubstitution,
      artifacts: await artifactHashes(output),
    }, null, 2)}\n`, { flag: 'wx' })
    return { productSha, effectiveDriverSha256 }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
