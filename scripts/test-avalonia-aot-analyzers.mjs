#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = 'tests/fixtures/avalonia-aot-analyzer-warning/AotAnalyzerWarning.csproj'
const dotnet = process.env.DOTNET_HOST_PATH || 'dotnet'

const restore = spawnSync(dotnet, ['restore', project], {
  cwd: root,
  encoding: 'utf8',
})
assert.equal(restore.status, 0, restore.stderr || restore.stdout)

const result = spawnSync(process.execPath, ['scripts/check-avalonia-aot-analyzers.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    DOTNET_HOST_PATH: dotnet,
    FSUSUI_AOT_ANALYZER_PROJECTS: project,
  },
})
assert.notEqual(result.status, 0, 'IL2026 analyzer warning must fail the package analyzer gate')
assert.match(`${result.stdout}${result.stderr}`, /warning\s+IL2026/iu)
console.log('Avalonia AOT analyzer warning mutation failed closed.')
