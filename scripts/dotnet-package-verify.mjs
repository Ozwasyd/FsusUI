import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  createPackageAlignmentBinding,
  currentIdentity,
  readStableConsumerAuthority,
} from './avalonia-stable-readiness-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nugetRoot = path.join(root, 'dotnet/artifacts/nuget')
const manifestPath = path.join(root, 'dotnet/artifacts/package/manifest.json')
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })

fs.rmSync(nugetRoot, { recursive: true, force: true })
fs.rmSync(path.dirname(manifestPath), { recursive: true, force: true })
fs.mkdirSync(nugetRoot, { recursive: true })

const { alignment } = readStableConsumerAuthority({
  expected: currentIdentity({ requireCleanPackageInputs: true }),
})
const alignmentArtifact = fs.readFileSync(
  path.join(root, '.tmp/conformance-v2/alignment.json'),
)

run('dotnet', ['restore', 'dotnet/FsusUI.Avalonia.slnx'])
run('dotnet', [
  'build',
  'dotnet/FsusUI.Avalonia.slnx',
  '--no-restore',
  '--configuration',
  'Release',
])
run('dotnet', [
  'pack',
  'dotnet/FsusUI.Avalonia.slnx',
  '--no-build',
  '--configuration',
  'Release',
  '-o',
  'dotnet/artifacts/nuget',
])
run(process.execPath, ['scripts/check-nuget-metadata.mjs'])
run(process.execPath, ['scripts/check-nuget-package-smoke.mjs'])
run(process.execPath, ['scripts/check-avalonia-nuget-stable.mjs'])

const packages = fs
  .readdirSync(nugetRoot)
  .filter((file) => file.endsWith('.nupkg') || file.endsWith('.snupkg'))
  .sort()
  .map((file) => {
    const content = fs.readFileSync(path.join(nugetRoot, file))
    return {
      file,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  })
if (packages.length !== 6)
  throw new Error(
    `Expected one 6-file NuGet candidate, found ${packages.length} files.`,
  )

const candidateHash = createHash('sha256')
for (const candidate of packages)
  candidateHash.update(`${candidate.file}\0${candidate.sha256}\n`)
const manifest = {
  schemaVersion: 1,
  kind: 'dotnet-package-candidate',
  canonicalPlatform: 'linux',
  commitSha:
    process.env.GITHUB_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
  candidateSha256: candidateHash.digest('hex'),
  contractV2Alignment: createPackageAlignmentBinding(
    alignment,
    alignmentArtifact,
  ),
  packages,
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
fs.writeFileSync(
  path.join(path.dirname(manifestPath), 'contract-v2-alignment.json'),
  alignmentArtifact,
)
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[dotnet-package] candidate-sha256=${manifest.candidateSha256}`)
