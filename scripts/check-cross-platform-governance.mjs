import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const registryFiles = [
  'spec/platform-overrides/web.yaml',
  'spec/platform-overrides/avalonia.yaml',
  'spec/platform-overrides/avalonia-linux.yaml',
  'spec/platform-overrides/avalonia-windows.yaml',
  'spec/platform-overrides/avalonia-macos.yaml',
  'spec/platform-overrides/visual-thresholds.yaml',
  'spec/platform-overrides/accessibility-overrides.yaml',
]

const requiredRegistryFields = [
  'id:',
  'area:',
  'platform:',
  'status:',
  'reason:',
  'allowedDeviation:',
  'testPolicy:',
  'owner:',
  'reviewAfter:',
  'linkedIssues:',
]

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const checkRegistry = () => {
  execFileSync(process.execPath, ['scripts/check-platform-overrides.mjs'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (const file of registryFiles) {
    assert(exists(file), `${file} must exist`)
    const content = read(file)
    for (const field of requiredRegistryFields) {
      assert(content.includes(field), `${file} must include ${field}`)
    }
  }
  console.log('governance:registry passed')
}

const checkReleaseDocs = () => {
  const docs = [
    'docs/releases/cross-platform-governance.md',
    'docs/releases/nuget-policy.md',
    'docs/api/cross-platform-api-boundary.md',
  ]
  for (const file of docs) {
    assert(exists(file), `${file} must exist`)
  }

  const governance = read(
    'docs/releases/cross-platform-governance.md',
  ).toLowerCase()
  for (const term of [
    'spec version',
    'token schema version',
    'release classification',
    'contract-perfect',
    'visually bounded',
  ]) {
    assert(
      governance.includes(term.toLowerCase()),
      `cross-platform governance must include ${term}`,
    )
  }

  const nuget = read('docs/releases/nuget-policy.md').toLowerCase()
  for (const term of [
    'NuGet',
    'package metadata',
    'preview',
    'release evidence',
  ]) {
    assert(
      nuget.includes(term.toLowerCase()),
      `nuget policy must include ${term}`,
    )
  }

  const boundary = read('docs/api/cross-platform-api-boundary.md').toLowerCase()
  for (const term of [
    'undocumented',
    'Element Plus',
    'Avalonia template',
    'product integrations',
  ]) {
    assert(
      boundary.includes(term.toLowerCase()),
      `cross-platform API boundary must include ${term}`,
    )
  }

  console.log('governance:release-docs passed')
}

const checkContractReleaseClassification = () => {
  const contract = read(
    'spec/components/contracts/v1/vue-public-contracts.json',
  )
  assert(
    contract.includes('"releaseClassification": "preview"'),
    'component contracts must include releaseClassification',
  )
  console.log('governance:contract-classification passed')
}

try {
  checkRegistry()
  checkReleaseDocs()
  checkContractReleaseClassification()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
