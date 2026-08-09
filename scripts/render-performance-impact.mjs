import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const scopeRank = new Map([
  ['skip', 0],
  ['web-only', 1],
  ['avalonia-only', 1],
  ['both', 2],
])

const escapeRegex = (value) => value.replace(/[.+^${}()|[\]\\]/g, '\\$&')

export const patternToRegex = (pattern) => {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character !== '*') {
      source += escapeRegex(character)
      continue
    }
    if (pattern[index + 1] === '*') {
      index += 1
      source += pattern[index + 1] === '/' ? '(?:.*/)?' : '.*'
      if (pattern[index + 1] === '/') index += 1
    } else source += '[^/]*'
  }
  return new RegExp(`^${source}$`)
}

export const matchesPattern = (file, pattern) =>
  patternToRegex(pattern).test(file)

const mergeScope = (left, right) => {
  if (left === right) return left
  if (left === 'skip') return right
  if (right === 'skip') return left
  if (scopeRank.get(left) === 2 || scopeRank.get(right) === 2) return 'both'
  return 'both'
}

const selectedScenario = (matches, platform) => {
  const scenarios = [
    ...new Set(
      matches
        .filter(({ rule }) =>
          platform === 'web'
            ? rule.scope === 'web-only' || rule.scope === 'both'
            : rule.scope === 'avalonia-only' || rule.scope === 'both',
        )
        .map(({ rule }) => rule[`${platform}Scenario`])
        .filter(Boolean),
    ),
  ]
  const hasFull = matches.some(
    ({ rule }) =>
      (rule.scope === `${platform}-only` || rule.scope === 'both') &&
      !rule[`${platform}Scenario`],
  )
  return !hasFull && scenarios.length === 1 ? scenarios[0] : null
}

const digestOf = (contract) =>
  createHash('sha256').update(JSON.stringify(contract)).digest('hex')

export const createImpactPlan = ({
  changedFiles,
  registry,
  baseRef = null,
  fallbackReason = null,
}) => {
  const files = [
    ...new Set(changedFiles.map((file) => file.replaceAll('\\', '/'))),
  ].sort()
  const matches = []
  let scope = 'skip'
  for (const file of files) {
    const rule = registry.rules.find((candidate) =>
      candidate.patterns.some((pattern) => matchesPattern(file, pattern)),
    )
    if (!rule) {
      matches.push({
        file,
        rule: { id: 'unknown-safe-fallback', scope: 'both' },
      })
      scope = 'both'
      continue
    }
    matches.push({ file, rule })
    scope = mergeScope(scope, rule.scope)
  }
  if (fallbackReason) scope = 'both'
  const contract = {
    schemaVersion: 1,
    registrySchemaVersion: registry.schemaVersion,
    baseRef,
    changedFiles: files,
    scope,
    run: scope !== 'skip',
    fallbackReason,
    matchedOwnership: matches.map(({ file, rule }) => ({
      file,
      rule: rule.id,
      scope: rule.scope,
    })),
    platforms: {
      web: {
        run: scope === 'web-only' || scope === 'both',
        scenario: fallbackReason ? null : selectedScenario(matches, 'web'),
      },
      avalonia: {
        run: scope === 'avalonia-only' || scope === 'both',
        scenario: fallbackReason ? null : selectedScenario(matches, 'avalonia'),
      },
    },
    measurement: {
      profile: 'quick',
      warmups: 1,
      samples: 21,
      order: ['baseline', 'current'],
      repetitions: 2,
      sequence: ['baseline', 'current', 'current', 'baseline'],
      sameRunner: true,
      isolatedState: true,
    },
  }
  return { ...contract, planDigest: digestOf(contract) }
}

export const loadOwnershipRegistry = async (root) =>
  JSON.parse(
    await readFile(
      path.join(root, 'spec/ci/pr-render-performance-ownership.json'),
      'utf8',
    ),
  )

export const verifyImpactPlan = (plan) => {
  const { planDigest, ...contract } = plan
  if (!planDigest || digestOf(contract) !== planDigest)
    throw new Error('Performance impact plan digest is invalid')
  if (plan.measurement?.profile !== 'quick')
    throw new Error('PR performance impact plan must use the quick profile')
  if (plan.measurement?.warmups !== 1 || plan.measurement?.samples !== 21)
    throw new Error('PR performance impact plan has an unsupported sample plan')
  if (JSON.stringify(plan.measurement?.order) !== '["baseline","current"]')
    throw new Error(
      'PR performance impact plan must run baseline before current within each pair',
    )
  if (
    plan.measurement?.repetitions !== 2 ||
    JSON.stringify(plan.measurement?.sequence) !==
      '["baseline","current","current","baseline"]'
  )
    throw new Error(
      'PR performance impact plan must use the order-balanced baseline/current sequence',
    )
  return plan
}
