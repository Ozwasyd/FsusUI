import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dotnetRoot = path.join(root, 'dotnet')
const packageProjects = [
  'FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
]
const commonProps = fs.readFileSync(
  path.join(dotnetRoot, 'Directory.Build.props'),
  'utf8',
)
const centralVersions = fs.readFileSync(
  path.join(dotnetRoot, 'Directory.Packages.props'),
  'utf8',
)

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const read = (relativePath) =>
  fs.readFileSync(path.join(dotnetRoot, relativePath), 'utf8')

const hasXmlElement = (content, name) =>
  new RegExp(`<${name}>[^<]+</${name}>`, 'u').test(content)

try {
  for (const field of [
    'Version',
    'RepositoryUrl',
    'RepositoryType',
    'PackageLicenseExpression',
    'PackageTags',
    'PackageReleaseNotes',
    'Deterministic',
  ]) {
    assert(
      hasXmlElement(commonProps, field),
      `Directory.Build.props must define ${field}`,
    )
  }

  for (const packageName of [
    'Avalonia',
    'Avalonia.Desktop',
    'Avalonia.Themes.Fluent',
    'Microsoft.NET.Test.Sdk',
    'xunit',
  ]) {
    assert(
      centralVersions.includes(`Include="${packageName}" Version="`),
      `Directory.Packages.props must centralize ${packageName}`,
    )
  }

  for (const project of packageProjects) {
    const content = read(project)
    assert(
      hasXmlElement(content, 'PackageId'),
      `${project} must define PackageId`,
    )
    assert(
      hasXmlElement(content, 'Description'),
      `${project} must define Description`,
    )
    assert(
      content.includes('<IsPackable>true</IsPackable>'),
      `${project} must be packable`,
    )
    assert(
      !content.includes(' Version="'),
      `${project} must use central package versions`,
    )
  }

  console.log('NuGet metadata policy passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
