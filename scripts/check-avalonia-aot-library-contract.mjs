import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.env.FSUSUI_AOT_CONTRACT_ROOT
  ? resolve(process.env.FSUSUI_AOT_CONTRACT_ROOT)
  : resolve(import.meta.dirname, '..')
const publicPackages = [
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
]
const publicNames = new Set([
  'FsusUI.Avalonia.csproj',
  'FsusUI.Avalonia.Themes.csproj',
  'FsusUI.Avalonia.Icons.csproj',
])
const forbiddenProjectProperties = [
  /<PublishAot(?:\s|>)/i,
  /<SuppressTrimAnalysisWarnings>\s*true\s*<\/SuppressTrimAnalysisWarnings>/i,
  /<NoWarn>[^<]*\bIL\d*\*?[^<]*<\/NoWarn>/i,
  /<TrimmerRootAssembly(?:\s|>)/i,
  /<WarningsAsErrors>\s*false\s*<\/WarningsAsErrors>/i,
]
const requiredProjectProperties = [
  'IsAotCompatible',
  'IsTrimmable',
  'EnableTrimAnalyzer',
  'EnableSingleFileAnalyzer',
  'EnableAotAnalyzer',
]

async function source(path) {
  return readFile(resolve(root, path), 'utf8')
}

const failures = []
for (const project of publicPackages) {
  const text = await source(project)
  for (const property of requiredProjectProperties) {
    if (!new RegExp(`<${property}>\\s*true\\s*</${property}>`, 'i').test(text)) {
      failures.push(`${project} must declare ${property}=true`)
    }
  }
  for (const pattern of forbiddenProjectProperties) {
    if (pattern.test(text)) {
      failures.push(`${project} contains a forbidden AOT/trimming escape hatch`)
    }
  }
}

const directoryProps = await source('dotnet/Directory.Build.props')
if (/<IsAotCompatible>\s*true\s*<\/IsAotCompatible>/i.test(directoryProps)) {
  failures.push('dotnet/Directory.Build.props must not globally declare IsAotCompatible=true')
}
if (
  /<SuppressTrimAnalysisWarnings>\s*true\s*<\/SuppressTrimAnalysisWarnings>/i.test(
    directoryProps,
  ) ||
  /<NoWarn>[^<]*\bIL\d*\*?[^<]*<\/NoWarn>/i.test(directoryProps)
) {
  failures.push(
    'dotnet/Directory.Build.props must not globally suppress trimming or AOT warnings',
  )
}

const collectCsproj = (dir) => {
  const entries = readdirSync(resolve(root, dir), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const next = `${dir}/${entry.name}`
    if (entry.isDirectory() && entry.name !== 'bin' && entry.name !== 'obj') {
      files.push(...collectCsproj(next))
    } else if (entry.isFile() && entry.name.endsWith('.csproj')) {
      files.push(next)
    }
  }
  return files
}

for (const project of collectCsproj('dotnet')) {
  const name = project.split('/').pop()
  if (publicNames.has(name)) continue
  const text = await source(project)
  if (/<IsAotCompatible>\s*true\s*<\/IsAotCompatible>/i.test(text)) {
    failures.push(`${project} is not a public NuGet package and must not set IsAotCompatible=true`)
  }
}

const inventory = JSON.parse(await source('spec/avalonia/aot-library-findings.json'))
if (inventory.allowFailure === true) {
  failures.push('AOT library findings must not set allowFailure')
}
if (inventory.ownerIssue !== 358) {
  failures.push('AOT library findings must assign remediation ownership to #358')
}
for (const finding of inventory.findings ?? []) {
  if (!finding.package || !finding.member || !finding.path || !finding.code) {
    failures.push('each AOT finding must identify package, member, path, and code')
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Avalonia public NuGet library AOT contract is satisfied.')
}
