#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checker = path.join(
  root,
  'scripts/check-avalonia-aot-remediation-contract.mjs',
)
const files = [
  'README.md',
  '.changeset/avalonia-aot-library-contract.md',
  'dotnet/Directory.Build.props',
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'dotnet/FsusUI.Avalonia/README.md',
  'dotnet/FsusUI.Avalonia/Controls/FsusPickerControls.cs',
  'dotnet/FsusUI.Avalonia/Controls/FsusMacOSNativeMenuAdapter.cs',
  'dotnet/FsusUI.Avalonia/Controls/FsusMarkdownEditorProjectionSurface.cs',
  'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'dotnet/FsusUI.Avalonia.Themes/README.md',
  'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  'dotnet/FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml',
  'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
  'dotnet/FsusUI.Avalonia.Icons/README.md',
  'dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml',
  'dotnet/FsusUI.Avalonia.HeadlessTests/FsusSelectHeadlessTests.cs',
  'dotnet/FsusUI.Avalonia.HeadlessTests/FsusNativeMenuMacOSAdapterTests.cs',
  'dotnet/FsusUI.Avalonia.Tests/Controls/FsusMarkdownEditorShellTests.cs',
  'docs/avalonia/installation.md',
  'docs/avalonia/components/picker.md',
  'docs/avalonia/components/navigation.md',
  'docs/avalonia/components/markdown-editor.md',
  'docs/releases/readiness/avalonia-stable.md',
  'spec/avalonia/aot-library-findings.json',
  'spec/avalonia/aot-library-boundaries.json',
  'spec/avalonia/public-api/FsusUI.Avalonia.json',
  'spec/avalonia/public-api/FsusUI.Avalonia.Themes.json',
  'spec/avalonia/public-api/FsusUI.Avalonia.Icons.json',
  'tests/fixtures/avalonia-packed-consumer/Program.cs',
]

const run = (candidate) =>
  spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FSUSUI_AOT_REMEDIATION_ROOT: candidate },
  })
const candidate = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fsusui-aot-remediation-'))
  for (const file of files) {
    const target = path.join(directory, file)
    mkdirSync(path.dirname(target), { recursive: true })
    cpSync(path.join(root, file), target)
  }
  return directory
}
const mutate = (relative, rewrite) => {
  const directory = candidate()
  try {
    const target = path.join(directory, relative)
    if (rewrite === null) unlinkSync(target)
    else writeFileSync(target, rewrite(readFileSync(target, 'utf8')))
    const result = run(directory)
    assert.notEqual(result.status, 0, `${relative} mutation must fail`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const green = candidate()
try {
  const result = run(green)
  assert.equal(result.status, 0, result.stderr || result.stdout)
} finally {
  rmSync(green, { recursive: true, force: true })
}

mutate('dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml', null)
mutate('tests/fixtures/avalonia-packed-consumer/Program.cs', (text) =>
  text.replace(
    'avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml',
    'avares://missing',
  ),
)
mutate('dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj', (text) =>
  text.replace('</PropertyGroup>', '<NoWarn>IL2026</NoWarn></PropertyGroup>'),
)
mutate('dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj', (text) =>
  text.replace(
    '</PropertyGroup>',
    '<TrimmerRootAssembly Include="FsusUI.Avalonia.Themes" /></PropertyGroup>',
  ),
)
mutate('dotnet/FsusUI.Avalonia/README.md', (text) =>
  text.replace('does not set `PublishAot`', 'sets `PublishAot`'),
)
mutate('spec/avalonia/aot-library-findings.json', () =>
  JSON.stringify({ ownerIssue: 358, allowFailure: true, findings: [] }),
)
mutate('spec/avalonia/aot-library-boundaries.json', () =>
  JSON.stringify({ ownerIssue: 358, boundaries: [] }),
)

console.log('Avalonia AOT remediation mutations failed closed.')
