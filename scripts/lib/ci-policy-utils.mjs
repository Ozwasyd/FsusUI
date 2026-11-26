import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

export const readRepoText = (relativePath, root = repoRoot) =>
  readFileSync(path.join(root, relativePath), 'utf8')

export const readRepoJson = (relativePath, root = repoRoot) =>
  JSON.parse(readRepoText(relativePath, root))

export const loadScriptsMap = (root = repoRoot) =>
  readRepoJson('package.json', root).scripts ?? {}

export const loadGovernanceDocs = (root = repoRoot) =>
  `${readRepoText('docs/releases/governance.md', root)}\n${readRepoText('docs/engineering-handoff.md', root)}`

export const extractWorkflowJob = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

export const countOccurrences = (value, fragment) =>
  value.split(fragment).length - 1

export const createPolicyAssert = (tag) => (condition, message) => {
  if (!condition) {
    console.error(`[${tag}] ${message}`)
    process.exit(1)
  }
}

export const assertIncludesAll = (
  assertFn,
  haystack,
  fragments,
  formatMessage,
) => {
  for (const fragment of fragments) {
    assertFn(haystack.includes(fragment), formatMessage(fragment))
  }
}

export const assertExcludesAll = (
  assertFn,
  haystack,
  fragments,
  formatMessage,
) => {
  for (const fragment of fragments) {
    assertFn(!haystack.includes(fragment), formatMessage(fragment))
  }
}

export const assertRegisteredGovernanceScript = (
  assertFn,
  scripts,
  scriptName,
  scriptPath,
  label = scriptName,
) => {
  assertFn(
    scripts[scriptName]?.includes(scriptPath),
    `package.json must expose ${scriptName}`,
  )
  assertFn(
    scripts['governance:check']?.includes(scriptName),
    `governance:check must include ${label}`,
  )
}

export const expectThrows = (label, fn) => {
  assert.throws(fn, (error) => {
    const message = error instanceof Error ? error.message : String(error)
    assert.ok(message.length > 0, `${label}: empty error`)
    return true
  }, `${label}: expected failure`)
}

export const deepClone = (value) => JSON.parse(JSON.stringify(value))
