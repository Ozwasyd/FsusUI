#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(
  process.env.FSUSUI_PACKED_RUNTIME_SMOKE_ROOT ??
    path.join(import.meta.dirname, '..'),
)
const source = (relative) => readFile(path.join(root, relative), 'utf8')
const failures = []
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message)
}

const runner = await source('scripts/test-avalonia-packed-runtime-smoke.mjs')
const program = await source('tests/fixtures/avalonia-aot-smoke/Program.cs')
const config = await source('tests/fixtures/avalonia-aot-smoke/NuGet.Config')

for (const name of [
  'FSUSUI_AOT_CANDIDATE_ROOT',
  'FSUSUI_AOT_CANDIDATE_MANIFEST',
]) {
  requireMatch(
    runner,
    new RegExp(
      `assert\\.ok\\(${name === 'FSUSUI_AOT_CANDIDATE_ROOT' ? 'candidateRoot' : 'candidateManifestPath'}`,
      'u',
    ),
    `${name} must fail closed`,
  )
}
requireMatch(
  runner,
  /manifest\.commitSha,\s*commitSha,\s*'candidate commit must match HEAD'/u,
  'packed runtime must bind the exact candidate commit',
)
requireMatch(
  runner,
  /candidateHash\.digest\('hex'\),\s*manifest\.candidateSha256/u,
  'packed runtime must validate the candidate digest',
)
requireMatch(
  runner,
  /includeCandidatePackages\s*\|\|\s*!fsusUiCandidatePackagePattern\.test\(entry\.name\)/u,
  'packed runtime must exclude stale FsusUI candidates from the dependency cache',
)
requireMatch(
  runner,
  /seedLocalFeed\(path\.resolve\(candidateRoot\),\s*\{\s*includeCandidatePackages:\s*true\s*\}\)/u,
  'packed runtime must seed the supplied candidate explicitly',
)
requireMatch(
  runner,
  /'-p:PublishAot=false'[\s\S]*?'-p:PublishTrimmed=false'[\s\S]*?'-p:SelfContained=false'/u,
  'packed JIT mode must remain framework-dependent and non-AOT',
)
requireMatch(
  runner,
  /'-p:PublishAot=false'[\s\S]*?'-p:PublishTrimmed=true'[\s\S]*?'-p:SelfContained=true'/u,
  'packed trimmed mode must remain self-contained and non-AOT',
)
for (const mode of ['jit', 'trimmed']) {
  requireMatch(
    runner,
    new RegExp(`smokeArguments\\('${mode}'`, 'u'),
    `packed runtime must execute ${mode} smoke`,
  )
  requireMatch(
    runner,
    new RegExp(
      `validateApplicationReport\\(${mode}Report,\\s*'${mode}'\\)`,
      'u',
    ),
    `packed runtime must validate ${mode} smoke`,
  )
}
requireMatch(
  runner,
  /report\.MarkdownProjectionProducerReady[\s\S]*?report\.MarkdownAutomationReady[\s\S]*?report\.MarkdownVirtualizationReady/u,
  'packed runtime must validate complete MarkdownEditor evidence',
)
requireMatch(
  runner,
  /report\.NativeLogErrorCount,\s*0/u,
  'packed runtime must reject Avalonia runtime logs',
)
requireMatch(
  runner,
  /report\.CandidateSha256,\s*manifest\.candidateSha256/u,
  'each runtime report must bind the shared candidate',
)
requireMatch(config, /<clear\s*\/>/u, 'packed runtime sources must be cleared')
if (/https?:\/\//iu.test(config)) {
  failures.push('packed runtime must not restore from an external source')
}
requireMatch(
  runner,
  /no-external-sources/u,
  'local-only restore receipt is required',
)
requireMatch(
  runner,
  /await stopSpawnedChild\(xvfb,\s*'Xvfb'\)[\s\S]*?await stopProcessId\(sessionBusPid,\s*'isolated desktop session bus'\)/u,
  'packed runtime must await display and session-bus cleanup',
)
requireMatch(
  program,
  /RuntimeIndependent = options\.RuntimeMode != "jit"/u,
  'fixture must distinguish JIT from runtime-independent modes',
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    'Avalonia packed JIT/trimmed MarkdownEditor smoke contract is satisfied.',
  )
}
