#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.env.FSUSUI_AOT_REMEDIATION_ROOT
  ? resolve(process.env.FSUSUI_AOT_REMEDIATION_ROOT)
  : resolve(import.meta.dirname, '..')
const packages = [
  {
    id: 'FsusUI.Avalonia',
    project: 'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
    readme: 'dotnet/FsusUI.Avalonia/README.md',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.json',
  },
  {
    id: 'FsusUI.Avalonia.Themes',
    project: 'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
    readme: 'dotnet/FsusUI.Avalonia.Themes/README.md',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.Themes.json',
  },
  {
    id: 'FsusUI.Avalonia.Icons',
    project: 'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
    readme: 'dotnet/FsusUI.Avalonia.Icons/README.md',
    baseline: 'spec/avalonia/public-api/FsusUI.Avalonia.Icons.json',
  },
]
const resources = [
  [
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
    'avares://FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  ],
  [
    'dotnet/FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml',
    'avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml',
  ],
  [
    'dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml',
    'avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml',
  ],
]
const failures = []
const read = (file) => readFile(resolve(root, file), 'utf8')
const exists = (file) => existsSync(resolve(root, file))

for (const packageInfo of packages) {
  const project = await read(packageInfo.project)
  if (/<PublishAot(?:\s|>)/iu.test(project)) {
    failures.push(`${packageInfo.project} must not set PublishAot`)
  }
  if (
    /<(?:NoWarn|SuppressTrimAnalysisWarnings|TrimmerRootAssembly)(?:\s|>)/iu.test(
      project,
    )
  ) {
    failures.push(
      `${packageInfo.project} contains a broad AOT/trimming escape hatch`,
    )
  }
  const readme = (await read(packageInfo.readme))
    .toLowerCase()
    .replace(/\s+/gu, ' ')
  for (const term of [
    'aot-compatible library',
    'does not set `publishaot`',
    'final rid-specific native aot',
    'third-party plugins',
  ]) {
    if (!readme.includes(term)) {
      failures.push(`${packageInfo.readme} missing ${term}`)
    }
  }
  const baseline = JSON.parse(await read(packageInfo.baseline))
  if (
    baseline.packageId !== packageInfo.id ||
    !Array.isArray(baseline.publicSymbols) ||
    baseline.publicSymbols.length === 0
  ) {
    failures.push(
      `${packageInfo.baseline} is not a populated ${packageInfo.id} public API baseline`,
    )
  }
}

const commonProps = (await read('dotnet/Directory.Build.props')).toLowerCase()
for (const term of [
  'aot-compatible libraries',
  'final rid-specific native aot',
]) {
  if (!commonProps.includes(term)) {
    failures.push(
      `dotnet/Directory.Build.props PackageReleaseNotes missing ${term}`,
    )
  }
}

const packedConsumer = await read(
  'tests/fixtures/avalonia-packed-consumer/Program.cs',
)
for (const [resource, uri] of resources) {
  if (!exists(resource)) failures.push(`${resource} is missing`)
  if (!packedConsumer.includes(uri)) {
    failures.push(`packed consumer missing ${uri}`)
  }
}
if (!packedConsumer.includes('AvaloniaXamlLoader.Load')) {
  failures.push(
    'packed consumer must load packaged resources through AvaloniaXamlLoader',
  )
}

for (const document of [
  'README.md',
  'docs/avalonia/installation.md',
  'docs/releases/readiness/avalonia-stable.md',
]) {
  const content = (await read(document)).toLowerCase()
  if (!content.includes('aot-compatible librar')) {
    failures.push(`${document} missing the library AOT boundary`)
  }
}

const findings = JSON.parse(
  await read('spec/avalonia/aot-library-findings.json'),
)
if (
  findings.ownerIssue !== 358 ||
  findings.allowFailure !== false ||
  findings.findings?.length !== 0
) {
  failures.push(
    'spec/avalonia/aot-library-findings.json must be an empty fail-closed #358 inventory',
  )
}
const boundaryInventory = JSON.parse(
  await read('spec/avalonia/aot-library-boundaries.json'),
)
if (
  boundaryInventory.ownerIssue !== 358 ||
  !Array.isArray(boundaryInventory.boundaries)
) {
  failures.push(
    'spec/avalonia/aot-library-boundaries.json must be owned by #358',
  )
}
for (const boundary of boundaryInventory.boundaries ?? []) {
  for (const field of [
    'package',
    'member',
    'path',
    'annotation',
    'code',
    'docs',
    'test',
  ]) {
    if (!boundary[field]) failures.push(`AOT dynamic boundary missing ${field}`)
  }
  for (const file of [boundary.path, boundary.docs, boundary.test]) {
    if (file && !exists(file)) {
      failures.push(`AOT dynamic boundary evidence missing ${file}`)
    }
  }
  if (boundary.path && boundary.annotation && exists(boundary.path)) {
    const source = await read(boundary.path)
    if (
      !source.includes(boundary.annotation) ||
      !source.includes(boundary.member.split('.').pop())
    ) {
      failures.push(
        `${boundary.path} no longer binds ${boundary.member} to ${boundary.annotation}`,
      )
    }
  }
}

const sourceFiles = []
const walk = (directory) => {
  for (const entry of readdirSync(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.cs')) sourceFiles.push(file)
  }
}
walk('dotnet/FsusUI.Avalonia')
for (const file of sourceFiles) {
  const source = await read(file)
  for (const annotation of [
    'UnconditionalSuppressMessage',
    'DynamicDependency',
  ]) {
    if (
      source.includes(annotation) &&
      !(boundaryInventory.boundaries ?? []).some(
        (entry) => entry.path === file && entry.annotation === annotation,
      )
    ) {
      failures.push(`${file} has unreviewed ${annotation}`)
    }
  }
  if (
    /(?:Assembly\.Load|AssemblyLoadContext|Activator\.CreateInstance|Reflection\.Emit|Expression\.Compile|JsonSerializer\.(?:Deserialize|Serialize))/u.test(
      source,
    )
  ) {
    failures.push(`${file} has an unreviewed dynamic tooling dependency`)
  }
}

if (!exists('.changeset/avalonia-aot-library-contract.md')) {
  failures.push('Avalonia AOT library changeset is missing')
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    'Avalonia AOT remediation, resources, package docs, and dynamic boundaries are satisfied.',
  )
}
