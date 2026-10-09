import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { verifyCandidate } from '../../../scripts/npm-candidate-lib.mjs'

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(fixtureRoot, '../../..')
const [candidateArg, consumerArg, seedLockArg] = process.argv.slice(2)
assert.ok(
  candidateArg && consumerArg && seedLockArg,
  'Usage: pnpm exec node tests/fixtures/public-emitted-payload-declarations/install-consumer.mjs <candidate.tgz> <new-consumer-directory> <unchanged-seed-lock.yaml>',
)
const candidate = path.resolve(candidateArg)
const consumer = path.resolve(consumerArg)
const seedLock = path.resolve(seedLockArg)
assert.equal(existsSync(consumer), false, 'Consumer directory must be new')
const manifest = verifyCandidate({ repoRoot, tarballPath: candidate })
assert.equal(manifest.toolchain.pnpm, '10.33.0')
assert.equal(
  execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  manifest.toolchain.pnpm,
  'Use the pinned pnpm executable',
)
const packageJson = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'vue/tests/consumer-install/template/package.json'),
    'utf8',
  ),
)
packageJson.dependencies[manifest.package.name] = `file:${candidate}`
mkdirSync(consumer, { recursive: true })
writeFileSync(
  path.join(consumer, 'package.json'),
  `${JSON.stringify(packageJson, null, 2)}\n`,
)
for (const file of [
  'tsconfig.all.json',
  'probe.ts',
  'motion-probe.ts',
  'global-probe.ts',
]) {
  copyFileSync(
    path.join(fixtureRoot, 'consumer', file),
    path.join(consumer, file),
  )
}
copyFileSync(seedLock, path.join(consumer, 'pnpm-lock.yaml'))
const readLock = (file) => yaml.load(readFileSync(file, 'utf8'))
const before = readLock(seedLock)
const run = (args) =>
  execFileSync('pnpm', args, {
    cwd: consumer,
    stdio: 'inherit',
  })
// Match the original pnpm consumer procedure: bind the new local artifact,
// then install frozen. The seed lock is read-only; third-party blocks must match.
run(['install', '--lockfile-only', '--ignore-scripts'])
const after = readLock(path.join(consumer, 'pnpm-lock.yaml'))
const external = (section) =>
  Object.fromEntries(
    Object.entries(section).filter(
      ([name]) => !name.startsWith(`${manifest.package.name}@`),
    ),
  )
for (const section of ['packages', 'snapshots']) {
  assert.deepEqual(
    external(after[section]),
    external(before[section]),
    `${section}: third-party resolution drift; stop before frozen install`,
  )
}
run(['install', '--frozen-lockfile', '--ignore-scripts'])
console.log(
  `Installed verified candidate ${manifest.artifact.sha256}; third-party resolutions preserved.`,
)
