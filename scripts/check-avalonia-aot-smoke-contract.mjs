#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(
  process.env.FSUSUI_AOT_SMOKE_ROOT ?? path.join(import.meta.dirname, '..'),
)
const source = (relative) => readFile(path.join(root, relative), 'utf8')
const failures = []
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message)
}
const forbidMatch = (text, pattern, message) => {
  if (pattern.test(text)) failures.push(message)
}

const project = await source(
  'tests/fixtures/avalonia-aot-smoke/FsusUI.Avalonia.AotSmoke.csproj',
)
const config = await source('tests/fixtures/avalonia-aot-smoke/NuGet.Config')
const program = await source('tests/fixtures/avalonia-aot-smoke/Program.cs')
const runner = await source('scripts/test-avalonia-aot-smoke.mjs')

for (const packageId of [
  'FsusUI.Avalonia',
  'FsusUI.Avalonia.Themes',
  'FsusUI.Avalonia.Icons',
]) {
  requireMatch(
    project,
    new RegExp(
      `<PackageReference\\s+Include="${packageId.replaceAll('.', '\\.')}"`,
      'u',
    ),
    `Native AOT consumer must reference ${packageId} as a package`,
  )
}
requireMatch(
  project,
  /<PublishAot>\s*true\s*<\/PublishAot>/iu,
  'PublishAot=true is required',
)
requireMatch(
  project,
  /<SelfContained>\s*true\s*<\/SelfContained>/iu,
  'SelfContained=true is required',
)
requireMatch(
  project,
  /<InvariantGlobalization>\s*false\s*<\/InvariantGlobalization>/iu,
  'locale scenarios require invariant globalization to be disabled',
)
forbidMatch(project, /<ProjectReference\b/iu, 'ProjectReference is forbidden')
requireMatch(config, /<clear\s*\/>/iu, 'NuGet sources must be cleared')
requireMatch(
  config,
  /__FSUSUI_LOCAL_FEED__/u,
  'NuGet config must bind the temporary local feed',
)
forbidMatch(config, /https?:\/\//iu, 'external NuGet sources are forbidden')
requireMatch(
  program,
  /StartWithClassicDesktopLifetime/u,
  'a desktop lifetime is required',
)
requireMatch(program, /window\.Show\(\)/u, 'the real Window must be shown')
requireMatch(
  program,
  /TryGetPlatformHandle/u,
  'the top-level platform handle must be verified',
)
requireMatch(
  program,
  /Dispatcher\.UIThread/u,
  'the UI dispatcher must be exercised',
)
requireMatch(
  program,
  /RuntimeMode is not \("jit" or "trimmed" or "nativeaot"\)/u,
  'runtime mode must fail closed',
)
requireMatch(
  program,
  /new FsusCommandPalette/u,
  'the command palette public control must be AOT-rooted',
)
requireMatch(
  program,
  /CommandTree\s*=/u,
  'the command palette tree binding must be AOT-rooted',
)
requireMatch(
  program,
  /ExecuteAsyncAction\s*=/u,
  'the async command delegate must be AOT-rooted',
)
requireMatch(
  program,
  /IFsusMarkdownProjectionProducer/u,
  'the Markdown projection producer contract must be AOT-rooted',
)
requireMatch(
  program,
  /ProduceAndCommitAsync/u,
  'the Markdown projection producer commit path must be AOT-rooted',
)
requireMatch(
  program,
  /new FsusWebViewAdapter/u,
  'the WebView adapter facade must be AOT-rooted',
)
requireMatch(
  program,
  /IFsusWebViewBackendAdapter/u,
  'the typed WebView backend contract must be AOT-rooted',
)
requireMatch(
  program,
  /ExecuteContextCommandAsync/u,
  'the WebView typed command path must be AOT-rooted',
)
requireMatch(
  program,
  /ExportPdfAsync/u,
  'the WebView tagged PDF path must be AOT-rooted',
)
requireMatch(
  program,
  /WebViewAdapterReady/u,
  'the WebView AOT result must be fail-closed in the report',
)
requireMatch(
  program,
  /\[JsonSerializable\(typeof\(SmokeReport\)\)\]/u,
  'source-generated JSON is required',
)
requireMatch(
  runner,
  /isolatedDotnet,\s*\[\s*'publish'/u,
  'the runner must publish a RID-specific executable',
)
requireMatch(
  runner,
  /execute\(\s*nativeBinary/u,
  'the runner must execute the native binary directly',
)
requireMatch(
  runner,
  /'--runtime-mode',\s*'nativeaot'/u,
  'the native report must identify the NativeAOT runtime mode',
)
requireMatch(
  runner,
  /DOTNET_ROOT:\s*missingDotnetRoot/u,
  'the runtime-free launch boundary is required',
)
requireMatch(
  runner,
  /no-external-sources/u,
  'the local-only restore receipt is required',
)
requireMatch(
  runner,
  /includeCandidatePackages\s*\|\|\s*!fsusUiCandidatePackagePattern\.test\(entry\.name\)/u,
  'Native AOT must exclude stale FsusUI candidates from the dependency cache',
)
requireMatch(
  runner,
  /seedLocalFeed\(path\.resolve\(suppliedCandidateRoot\),\s*\{\s*includeCandidatePackages:\s*true,\s*\}\)/u,
  'Native AOT must seed the supplied candidate explicitly',
)
requireMatch(
  runner,
  /spawn\(\s*'\/usr\/bin\/Xvfb',\s*\[[^\]]+\],\s*\{\s*stdio:\s*'ignore',?\s*\},?\s*\)/u,
  'Xvfb output must not use unread child-process pipes',
)
requireMatch(
  runner,
  /result\.error,[\s\S]*?result\.signal,[\s\S]*?result\.status/u,
  'child timeout, signal, and missing status must fail closed',
)
requireMatch(
  runner,
  /killSignal:\s*'SIGKILL'/u,
  'timed-out child processes must be terminated deterministically',
)
if ((runner.match(/timeout:\s*negativeControlTimeout/gu) ?? []).length !== 4) {
  failures.push('all four negative controls require the bounded timeout')
}
requireMatch(
  runner,
  /await stopSpawnedChild\(xvfb,\s*'Xvfb'\)/u,
  'Xvfb cleanup must wait for child termination',
)
requireMatch(
  runner,
  /await stopProcessId\(sessionBusPid,\s*'isolated desktop session bus'\)/u,
  'session-bus cleanup must wait for process termination',
)
requireMatch(
  runner,
  /readFileSync\(`\/proc\/\$\{pid\}\/stat`,\s*'utf8'\)[\s\S]*?processState !== 'Z'/u,
  'session-bus cleanup must recognize a terminated zombie in PID-namespace runs',
)
requireMatch(
  runner,
  /if \(!existsSync\(alias\)\)/u,
  'RID pack aliases must reuse an existing native pack link',
)
forbidMatch(
  runner,
  /\[\s*'run',\s*consumerProject/u,
  'dotnet run/JIT execution is forbidden',
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Avalonia Native AOT smoke contract is satisfied.')
}
