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
import { spawnSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const checker = path.join(root, 'scripts/check-avalonia-aot-smoke-contract.mjs')
const paths = [
  'scripts/test-avalonia-aot-smoke.mjs',
  'tests/fixtures/avalonia-aot-smoke/FsusUI.Avalonia.AotSmoke.csproj',
  'tests/fixtures/avalonia-aot-smoke/NuGet.Config',
  'tests/fixtures/avalonia-aot-smoke/Program.cs',
]
const run = (cwd) =>
  spawnSync(process.execPath, [checker], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FSUSUI_AOT_SMOKE_ROOT: cwd },
  })

const green = run(root)
assert.equal(green.status, 0, green.stderr || green.stdout)

const mutate = (relative, rewrite, label) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-aot-contract-'))
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

const project =
  'tests/fixtures/avalonia-aot-smoke/FsusUI.Avalonia.AotSmoke.csproj'
mutate(
  project,
  (text) =>
    text.replace(
      '</Project>',
      '<ItemGroup><ProjectReference Include="../../../dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj" /></ItemGroup></Project>',
    ),
  'ProjectReference',
)
mutate(
  'scripts/test-avalonia-aot-smoke.mjs',
  (text) => text.replace(/'publish',\s*consumerProject/u, "'run', consumerProject"),
  'JIT run',
)
mutate(
  'scripts/test-avalonia-aot-smoke.mjs',
  (text) =>
    text.replace(
      'seedLocalFeed(globalPackages, { includeCandidatePackages: false })',
      'seedLocalFeed(globalPackages)',
    ),
  'stale FsusUI global package cache',
)
mutate(
  'scripts/test-avalonia-aot-smoke.mjs',
  (text) => text.replace('const stableScenarios = stableFamilies()', "const stableScenarios = JSON.parse(readFileSync(path.join(root, 'spec/ci/avalonia-stable-readiness.json'), 'utf8')).releaseScopeFamilies"),
  'manual stable scenario authority',
)
mutate(
  'tests/fixtures/avalonia-aot-smoke/NuGet.Config',
  (text) =>
    text.replace(
      '</packageSources>',
      '<add key="nuget.org" value="https://api.nuget.org/v3/index.json" /></packageSources>',
    ),
  'external network source',
)
mutate(
  project,
  (text) => text.replace('<SelfContained>true</SelfContained>', '<SelfContained>false</SelfContained>'),
  'runtime dependency',
)
mutate(
  project,
  (text) => text.replace('<InvariantGlobalization>false</InvariantGlobalization>', '<InvariantGlobalization>true</InvariantGlobalization>'),
  'invariant globalization',
)

console.log(
  'Avalonia Native AOT smoke mutations killed: ProjectReference, JIT run, stale FsusUI global package cache, manual stable scenario authority, external network, runtime dependency, invariant globalization.',
)
