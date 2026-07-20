import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  candidateTarballName,
  compareCandidates,
  createCandidate,
  verifyCandidate,
} from './npm-candidate-lib.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const command = process.argv[2]
const args = process.argv.slice(3)

function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

function runPackageBuild() {
  const pnpmScript = process.env.npm_execpath
  if (!pnpmScript)
    throw new Error('package:candidate:build must run through pnpm.')
  execFileSync(process.execPath, [pnpmScript, 'run', 'build:npm-package'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

if (command === 'build') {
  const outputDir = path.resolve(
    option('--output', path.join(repoRoot, 'dist', 'npm-candidate')),
  )
  runPackageBuild()
  const { manifest, tarballPath } = createCandidate({
    repoRoot,
    packageRoot: path.join(repoRoot, 'dist', 'element-plus'),
    outputDir,
    sourceProfile: option('--profile', 'Release'),
  })
  console.log(
    `Built ${tarballPath} (${manifest.artifact.sha256}) for ${manifest.package.name}@${manifest.package.version}.`,
  )
} else if (command === 'verify') {
  const tarballPath = path.resolve(
    option(
      '--tarball',
      args.find((arg) => !arg.startsWith('--')),
    ) || path.join(repoRoot, 'dist', 'npm-candidate', candidateTarballName),
  )
  const tag = option('--tag-version', undefined)
  const manifest = verifyCandidate({
    repoRoot,
    tarballPath,
    expectedCommit: option('--commit', undefined),
    expectedTagVersion: tag?.replace(/^v/u, ''),
    requireProfile: option('--profile', 'Release'),
  })
  console.log(
    `Verified ${tarballPath} (${manifest.artifact.sha256}) for ${manifest.package.name}@${manifest.package.version} with dist-tag ${manifest.package.distTag}.`,
  )
} else if (command === 'compare') {
  const positional = args.filter((arg) => !arg.startsWith('--'))
  if (positional.length !== 2) {
    throw new Error(
      'Usage: package:candidate:compare <candidate-a.tgz> <candidate-b.tgz>',
    )
  }
  const result = compareCandidates(
    path.resolve(positional[0]),
    path.resolve(positional[1]),
  )
  console.log(
    `Candidates are canonically identical (${result.files} files, digest ${result.canonicalDigest}, byte-identical=${result.byteIdentical}).`,
  )
} else {
  throw new Error(
    'Usage: package-candidate.mjs <build|verify|compare> [options]',
  )
}
