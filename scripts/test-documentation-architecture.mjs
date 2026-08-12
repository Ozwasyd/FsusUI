import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const checker = path.resolve('scripts/check-documentation-architecture.mjs')
const requiredFiles = [
  'docs/releases/README.md',
  'docs/releases/governance.md',
  'docs/releases/policy/README.md',
  'docs/releases/policy/cross-platform.md',
  'docs/releases/policy/npm-registry.md',
  'docs/releases/policy/nuget.md',
  'docs/releases/channels/README.md',
  'docs/releases/channels/public-preview.md',
  'docs/releases/readiness/README.md',
  'docs/releases/readiness/avalonia-stable.md',
  'docs/releases/readiness/avalonia-performance-budgets.md',
  'docs/releases/readiness/platform-overrides.md',
  'docs/releases/evidence/README.md',
  'docs/releases/evidence/npm-public-preview/README.md',
  'docs/releases/evidence/public-preview/README.md',
  'docs/releases/evidence/avalonia-preview/README.md',
  'docs/releases/evidence/avalonia-stable/README.md',
]
const retiredDirectories = ['docs/release', 'release-evidence']
const retiredFiles = [
  'docs/release-governance.md',
  'docs/releases/public-preview.md',
  'docs/releases/cross-platform-governance.md',
  'docs/releases/nuget-policy.md',
  'docs/releases/avalonia-stable-readiness.md',
  'docs/releases/avalonia-performance-budgets.md',
  'docs/releases/platform-overrides.md',
]

const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fsusui-documentation-architecture-'),
)

const write = (relativePath, content = '') => {
  const absolutePath = path.join(fixtureRoot, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, content)
}

const run = () =>
  spawnSync(process.execPath, [checker], {
    cwd: fixtureRoot,
    encoding: 'utf8',
  })

try {
  for (const file of requiredFiles) write(file)
  write('.github/workflows/_quality.yml', 'docs/releases\n')
  write('scripts/ci-readiness.mjs')

  const valid = run()
  assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`)

  for (const retiredPath of retiredDirectories) {
    const absolutePath = path.join(fixtureRoot, retiredPath)
    fs.mkdirSync(absolutePath, { recursive: true })
    const invalid = run()
    assert.notEqual(invalid.status, 0)
    assert.match(
      `${invalid.stdout}\n${invalid.stderr}`,
      new RegExp(`${retiredPath.replace('/', '\\/')} is retired`, 'u'),
    )
    fs.rmSync(absolutePath, { recursive: true })
  }

  for (const retiredPath of retiredFiles) {
    write(retiredPath)
    const invalid = run()
    assert.notEqual(invalid.status, 0)
    assert.match(
      `${invalid.stdout}\n${invalid.stderr}`,
      new RegExp(`${retiredPath.replaceAll('/', '\\/')} is retired`, 'u'),
    )
    fs.rmSync(path.join(fixtureRoot, retiredPath))
  }

  const narrativeFiles = [
    'docs/ozwasyd-fsusui-267.md',
    'docs/issue-267.md',
    'docs/components/2026-08-13-acceptance.md',
  ]
  for (const narrativePath of narrativeFiles) {
    write(narrativePath)
    const invalid = run()
    assert.notEqual(invalid.status, 0)
    assert.match(
      `${invalid.stdout}\n${invalid.stderr}`,
      /is workflow narration; update an existing durable document/u,
    )
    fs.rmSync(path.join(fixtureRoot, narrativePath))
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

console.log(
  '[documentation-architecture-fixtures] valid=1 retired-directories=2 retired-files=7 narrative-files=3',
)
