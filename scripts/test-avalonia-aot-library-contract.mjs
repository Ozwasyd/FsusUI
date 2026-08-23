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
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const checkPath = path.join(scriptDir, 'check-avalonia-aot-library-contract.mjs')

const runCheck = (cwd) =>
  spawnSync(process.execPath, [checkPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FSUSUI_AOT_CONTRACT_ROOT: cwd },
  })

const green = runCheck(repoRoot)
assert.equal(green.status, 0, green.stderr || green.stdout)
assert.match(green.stdout, /Avalonia public NuGet library AOT contract is satisfied/)

const mutate = (relative, rewrite) => {
  const root = mkdtempSync(path.join(tmpdir(), 'fsusui-aot-'))
  try {
    for (const item of [
      'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
      'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
      'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
      'dotnet/Directory.Build.props',
      'spec/avalonia/aot-library-findings.json',
    ]) {
      const from = path.join(repoRoot, item)
      const to = path.join(root, item)
      mkdirSync(path.dirname(to), { recursive: true })
      cpSync(from, to)
    }
    const target = path.join(root, relative)
    writeFileSync(target, rewrite(readFileSync(target, 'utf8')))
    const result = runCheck(root)
    assert.notEqual(result.status, 0, `${relative} mutation must fail`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

mutate('dotnet/Directory.Build.props', (text) =>
  text.replace(
    '</PropertyGroup>',
    '    <IsAotCompatible>true</IsAotCompatible>\n  </PropertyGroup>',
  ),
)
mutate(
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  (text) =>
    text.replace(
      '</PropertyGroup>',
      '    <PublishAot>true</PublishAot>\n  </PropertyGroup>',
    ),
)
mutate(
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  (text) =>
    text.replace(
      '</PropertyGroup>',
      '    <NoWarn>IL2026;IL3050</NoWarn>\n  </PropertyGroup>',
    ),
)
mutate('spec/avalonia/aot-library-findings.json', () =>
  JSON.stringify({ allowFailure: true, findings: [] }),
)

console.log('Avalonia AOT library contract mutations failed closed.')
