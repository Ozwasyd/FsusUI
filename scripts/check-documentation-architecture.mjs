#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const violations = []

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

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) violations.push(`${file} missing`)
}

const retiredPaths = [
  'docs/release',
  'release-evidence',
  'docs/release-governance.md',
  'docs/releases/public-preview.md',
  'docs/releases/cross-platform-governance.md',
  'docs/releases/nuget-policy.md',
  'docs/releases/avalonia-stable-readiness.md',
  'docs/releases/avalonia-performance-budgets.md',
  'docs/releases/platform-overrides.md',
]

for (const retiredPath of retiredPaths) {
  if (existsSync(resolve(root, retiredPath))) {
    violations.push(`${retiredPath} is retired; use docs/releases/`)
  }
}

const docsRoot = resolve(root, 'docs')
for (const entry of readdirSync(docsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  if (entry.name === 'releases') continue
  if (/^releases?$/u.test(entry.name)) {
    violations.push(
      `docs/${entry.name}/ conflicts with the canonical docs/releases/ domain`,
    )
  }
}

const narrativeMarkdownName =
  /(?:^|[-_])\d{4}-\d{2}-\d{2}(?:[-_.]|$)|^(?:issue|ticket|run|actor|receipt|acceptance|verification)[-_].*\.md$|^[a-z0-9]+-[a-z0-9]+-\d+\.md$/iu

const inspectDocumentationFiles = (directory, relativeDirectory = 'docs') => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`
    if (entry.isDirectory()) {
      inspectDocumentationFiles(resolve(directory, entry.name), relativePath)
    } else if (entry.isFile() && narrativeMarkdownName.test(entry.name)) {
      violations.push(
        `${relativePath} is workflow narration; update an existing durable document`,
      )
    }
  }
}

inspectDocumentationFiles(docsRoot)

const pathContracts = [
  {
    file: '.github/workflows/_quality.yml',
    required: ['docs/releases'],
    forbidden: ['docs/release/', 'release-evidence/'],
  },
  {
    file: 'scripts/ci-readiness.mjs',
    required: [],
    forbidden: [
      'docs/release/',
      'release-evidence/',
      'materializeLegacyReleaseArchiveInput',
    ],
  },
]

for (const contract of pathContracts) {
  const absolute = resolve(root, contract.file)
  if (!existsSync(absolute)) {
    violations.push(`${contract.file} missing`)
    continue
  }
  const source = readFileSync(absolute, 'utf8')
  for (const required of contract.required) {
    if (!source.includes(required)) {
      violations.push(`${contract.file} must reference ${required}`)
    }
  }
  for (const forbidden of contract.forbidden) {
    if (source.includes(forbidden)) {
      violations.push(
        `${contract.file} must not reference retired path ${forbidden}`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('Documentation architecture violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('Documentation architecture contract passed.')
