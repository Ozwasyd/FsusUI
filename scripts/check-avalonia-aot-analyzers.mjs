#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projects = process.env.FSUSUI_AOT_ANALYZER_PROJECTS
  ? process.env.FSUSUI_AOT_ANALYZER_PROJECTS.split(path.delimiter)
  : [
      'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
      'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
      'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
    ]
const dotnet = process.env.DOTNET_HOST_PATH || 'dotnet'
const warning = /\bwarning\s+(IL[23]\d{3})\b/giu

for (const project of projects) {
  const result = spawnSync(
    dotnet,
    [
      'build',
      project,
      '--no-restore',
      '--configuration',
      'Release',
      '--maxcpucount:1',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)
  const diagnostics = [...output.matchAll(warning)].map((match) => match[1])
  if (result.status !== 0) process.exit(result.status ?? 1)
  if (diagnostics.length > 0) {
    console.error(
      `${project} emitted AOT/trimming analyzer warnings: ${[...new Set(diagnostics)].join(', ')}`,
    )
    process.exit(1)
  }
}

console.log('Avalonia public NuGet package analyzers completed with zero IL2xxx/IL3xxx warnings.')
