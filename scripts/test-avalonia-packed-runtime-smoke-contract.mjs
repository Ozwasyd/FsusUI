#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const checker = path.join(
  root,
  'scripts/check-avalonia-packed-runtime-smoke-contract.mjs',
)
const paths = [
  'scripts/test-avalonia-packed-runtime-smoke.mjs',
  'tests/fixtures/avalonia-aot-smoke/NuGet.Config',
  'tests/fixtures/avalonia-aot-smoke/Program.cs',
]
const run = (cwd) =>
  spawnSync(process.execPath, [checker], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FSUSUI_PACKED_RUNTIME_SMOKE_ROOT: cwd },
  })

const green = run(root)
assert.equal(green.status, 0, green.stderr || green.stdout)

const mutate = (relative, rewrite, label) => {
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), 'fsusui-packed-runtime-contract-'),
  )
  try {
    for (const item of paths) {
      const target = path.join(temporaryRoot, item)
      mkdirSync(path.dirname(target), { recursive: true })
      cpSync(path.join(root, item), target)
    }
    const target = path.join(temporaryRoot, relative)
    writeFileSync(target, rewrite(readFileSync(target, 'utf8')))
    const result = run(temporaryRoot)
    assert.notEqual(result.status, 0, `${label} mutation must fail`)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

const runner = 'scripts/test-avalonia-packed-runtime-smoke.mjs'
mutate(
  runner,
  (text) =>
    text.replace(
      'assert.ok(candidateRoot,',
      'void(candidateRoot); assert.ok(true,',
    ),
  'missing candidate accepted',
)
mutate(
  runner,
  (text) =>
    text.replace("candidateHash.digest('hex'),", 'manifest.candidateSha256,'),
  'candidate digest ignored',
)
mutate(
  runner,
  (text) =>
    text.replace('!fsusUiCandidatePackagePattern.test(entry.name)', 'true'),
  'stale cached candidate accepted',
)
mutate(
  runner,
  (text) => text.replace("smokeArguments('jit'", "smokeArguments('debug'"),
  'JIT mode omitted',
)
mutate(
  runner,
  (text) =>
    text.replaceAll("'-p:PublishTrimmed=true',", "'-p:PublishTrimmed=false',"),
  'trimmed publish disabled',
)
mutate(
  runner,
  (text) => text.replace('report.MarkdownAutomationReady', 'true'),
  'Markdown automation ignored',
)
mutate(
  runner,
  (text) => text.replace('report.NativeLogErrorCount, 0', '0, 0'),
  'runtime logs ignored',
)
mutate(
  'tests/fixtures/avalonia-aot-smoke/NuGet.Config',
  (text) =>
    text.replace(
      '</packageSources>',
      '<add key="nuget.org" value="https://api.nuget.org/v3/index.json" /></packageSources>',
    ),
  'external restore source',
)
mutate(
  runner,
  (text) =>
    text.replace(
      "await stopSpawnedChild(xvfb, 'Xvfb')",
      "xvfb?.kill('SIGTERM')",
    ),
  'unawaited display cleanup',
)

console.log(
  'Avalonia packed runtime smoke mutations killed: missing candidate, candidate digest, stale cached candidate, JIT mode, trimmed publish, Markdown automation, runtime logs, external restore source, and display cleanup.',
)
