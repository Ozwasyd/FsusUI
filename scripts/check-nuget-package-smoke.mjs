import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactRoot = path.join(root, 'dotnet/artifacts/nuget')
const expectedPackages = [
  'FsusUI.Avalonia',
  'FsusUI.Avalonia.Themes',
  'FsusUI.Avalonia.Icons',
]

try {
  if (!fs.existsSync(artifactRoot)) {
    throw new Error('dotnet/artifacts/nuget must exist after dotnet pack')
  }

  const files = fs.readdirSync(artifactRoot)
  for (const packageId of expectedPackages) {
    const packagePattern = new RegExp(
      `^${packageId.replaceAll('.', '\\.')}\\.\\d.*\\.nupkg$`,
      'u',
    )
    const candidate = files.find((file) => packagePattern.test(file))
    if (!candidate) throw new Error(`${packageId} nupkg is missing`)

    const stats = fs.statSync(path.join(artifactRoot, candidate))
    if (stats.size <= 0) throw new Error(`${candidate} is empty`)
  }

  console.log('NuGet package smoke passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
