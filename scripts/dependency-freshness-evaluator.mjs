const requiredExceptionFields = [
  'id',
  'dependencyId',
  'datasource',
  'packageName',
  'currentVersion',
  'targetVersion',
  'reason',
  'evidence',
  'owner',
  'createdAt',
  'expiresAt',
]

const allowedExceptionFields = new Set([
  ...requiredExceptionFields,
  'vulnerability',
])

const hour = 60 * 60 * 1000
const generalTtl = 14 * 24 * hour
const vulnerabilityTtl = 72 * hour

function instant(value) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanCell(value) {
  return String(value ?? '')
    .trim()
    .replace(/^`([^`]*)`$/u, '$1')
    .replace(/^\*\*([^*]*)\*\*$/u, '$1')
    .trim()
}

export function normalizeDependencyVersion(value) {
  return cleanCell(value).replace(/^v(?=\d)/u, '')
}

function tableCells(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed.slice(1, -1).split('|').map(cleanCell)
}

function tablePackage(cell) {
  const cleaned = cleanCell(cell)
  const link = cleaned.match(/^\[([^\]]+)\]\([^)]*\)$/u)
  return cleanCell(link?.[1] ?? cleaned)
}

function tableVersion(cell) {
  const codeValues = [...String(cell ?? '').matchAll(/`([^`]+)`/gu)].map(
    (match) => match[1],
  )
  if (codeValues.length > 0) {
    return normalizeDependencyVersion(codeValues.at(-1))
  }
  const arrow = cleanCell(cell).match(/(?:->|→)\s*([^\s\]]+)\s*\]?$/u)
  return normalizeDependencyVersion(arrow?.[1] ?? cell)
}

function tableTarget(body, identities) {
  const lines = String(body ?? '').split(/\r?\n/u)
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = tableCells(lines[index])
    const separator = tableCells(lines[index + 1])
    if (
      !headers ||
      !separator ||
      separator.some((cell) => !/^:?-{3,}:?$/u.test(cell))
    ) {
      continue
    }
    const packageIndex = headers.findIndex((header) =>
      /^(?:package|dependency)$/iu.test(header),
    )
    const targetIndex = headers.findIndex((header) =>
      /^(?:change|new value|new|to|target)$/iu.test(header),
    )
    if (packageIndex < 0 || targetIndex < 0) continue
    const targets = []
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = tableCells(lines[rowIndex])
      if (!cells) break
      if (identities.has(tablePackage(cells[packageIndex]))) {
        targets.push(tableVersion(cells[targetIndex]))
      }
    }
    const unique = [...new Set(targets.filter(Boolean))]
    if (unique.length === 1) return unique[0]
    if (unique.length > 1) return null
  }
  return null
}

export function extractPullRequestTarget(pullRequest, entry) {
  const identities = new Set([entry.id, entry.packageName].filter(Boolean))
  const fromTable = tableTarget(pullRequest.body, identities)
  if (fromTable) return fromTable

  const title = String(pullRequest.title ?? '').trim()
  for (const identity of identities) {
    const escaped = identity.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const match = title.match(
      new RegExp(
        `^(?:chore\\(deps\\):\\s*)?(?:update|bump)\\s+(?:dependency\\s+)?${escaped}\\s+to\\s+([^\\s]+)$`,
        'iu',
      ),
    )
    if (match) return normalizeDependencyVersion(match[1])
  }
  return null
}

function normalizeCheck(check) {
  return {
    name: check.name ?? check.context ?? '',
    conclusion: String(
      check.conclusion ?? check.state ?? check.status ?? 'missing',
    ).toLowerCase(),
    createdAt: check.createdAt ?? null,
    startedAt: check.startedAt ?? null,
    completedAt: check.completedAt ?? null,
  }
}

export function selectRenovatePullRequests(pullRequests, entry) {
  return (pullRequests ?? [])
    .filter((pullRequest) =>
      /^renovate(?:[/-]|$)/iu.test(pullRequest.headRefName ?? ''),
    )
    .map((pullRequest) => ({
      number: pullRequest.number,
      title: pullRequest.title,
      url: pullRequest.url,
      headRefName: pullRequest.headRefName,
      targetVersion: extractPullRequestTarget(pullRequest, entry),
      state: 'OPEN',
      createdAt: pullRequest.createdAt,
      superseding: /(?:supersedes|replaces)\s+#\d+/iu.test(
        pullRequest.body ?? '',
      ),
      labels: (pullRequest.labels ?? []).map((label) => label.name),
      checks: (pullRequest.statusCheckRollup ?? []).map(normalizeCheck),
    }))
    .filter((pullRequest) => pullRequest.targetVersion !== null)
}

export function validateFreshnessException(
  exception,
  { entry, currentVersion, latestVersion, now, allowExpired = false },
) {
  const errors = []
  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) {
    return ['exception-record-invalid']
  }
  for (const field of requiredExceptionFields) {
    if (
      typeof exception[field] !== 'string' ||
      exception[field].trim() === ''
    ) {
      errors.push(`exception-field:${field}`)
    }
  }
  for (const field of Object.keys(exception)) {
    if (!allowedExceptionFields.has(field))
      errors.push(`exception-field-unknown:${field}`)
  }
  if (
    'vulnerability' in exception &&
    typeof exception.vulnerability !== 'boolean'
  ) {
    errors.push('exception-field:vulnerability')
  }
  for (const field of ['dependencyId', 'datasource', 'packageName']) {
    if (String(exception[field] ?? '').includes('*')) {
      errors.push(`exception-wildcard:${field}`)
    }
  }
  if (exception.dependencyId !== entry?.id) errors.push('exception-dependency')
  if (exception.datasource !== entry?.datasource)
    errors.push('exception-datasource')
  if (exception.packageName !== entry?.packageName)
    errors.push('exception-package')
  if (
    currentVersion &&
    normalizeDependencyVersion(exception.currentVersion) !==
      normalizeDependencyVersion(currentVersion)
  ) {
    errors.push('exception-current-version')
  }
  if (
    latestVersion &&
    normalizeDependencyVersion(exception.targetVersion) !==
      normalizeDependencyVersion(latestVersion)
  ) {
    errors.push('exception-target-version')
  }

  const createdAt = instant(exception.createdAt)
  const expiresAt = instant(exception.expiresAt)
  const observedAt = instant(now)
  if (createdAt === null) errors.push('exception-created-at')
  if (expiresAt === null) errors.push('exception-expires-at')
  if (observedAt === null) errors.push('exception-observed-at')
  if (createdAt !== null && expiresAt !== null) {
    const maximum = exception.vulnerability ? vulnerabilityTtl : generalTtl
    if (expiresAt <= createdAt || expiresAt - createdAt > maximum) {
      errors.push('exception-ttl')
    }
  }
  if (createdAt !== null && observedAt !== null && createdAt > observedAt) {
    errors.push('exception-created-in-future')
  }
  if (
    !allowExpired &&
    expiresAt !== null &&
    observedAt !== null &&
    expiresAt <= observedAt
  ) {
    errors.push('exception-expired')
  }
  return [...new Set(errors)]
}

export function validateExceptionRegistry(registry, entries, now) {
  const errors = []
  const byDependency = new Map()
  if (
    !registry ||
    typeof registry !== 'object' ||
    registry.schemaVersion !== 1 ||
    !Array.isArray(registry.exceptions)
  ) {
    return { byDependency, errors: ['exception-registry-invalid'] }
  }
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const ids = new Set()
  for (const exception of registry.exceptions) {
    const dependencyId = exception?.dependencyId
    if (ids.has(exception?.id)) {
      errors.push(`exception-duplicate-id:${exception?.id ?? '-'}`)
      continue
    }
    ids.add(exception?.id)
    const entry = entryById.get(dependencyId)
    if (!entry) {
      errors.push(`exception-unowned:${dependencyId ?? '-'}`)
      continue
    }
    const recordErrors = validateFreshnessException(exception, {
      entry,
      currentVersion: exception.currentVersion,
      latestVersion: exception.targetVersion,
      now,
      allowExpired: true,
    })
    if (recordErrors.length > 0) {
      errors.push(...recordErrors.map((error) => `${dependencyId}:${error}`))
      continue
    }
    const records = byDependency.get(dependencyId) ?? []
    records.push(exception)
    byDependency.set(dependencyId, records)
  }
  return { byDependency, errors }
}

export function evaluateFreshnessEntry({
  entry,
  currentVersion,
  latestVersion,
  pullRequests = [],
  exception = null,
  exceptions = null,
  now,
}) {
  const errors = []
  if (!currentVersion || !latestVersion) {
    errors.push('incomplete-version-evidence')
    return {
      state: 'skipped',
      detail: 'cannot determine version',
      blockerReasons: ['incomplete-version-evidence'],
      errors,
      selectedPullRequest: null,
      selectedException: null,
    }
  }

  const records = exceptions ?? (exception ? [exception] : [])
  const observedAt = instant(now)
  const activeRecords = records.filter((record) => {
    const createdAt = instant(record?.createdAt)
    const expiresAt = instant(record?.expiresAt)
    return (
      record?.dependencyId === entry?.id &&
      record?.datasource === entry?.datasource &&
      record?.packageName === entry?.packageName &&
      createdAt !== null &&
      expiresAt !== null &&
      observedAt !== null &&
      createdAt <= observedAt &&
      expiresAt > observedAt
    )
  })
  const activeCandidates = activeRecords.filter(
    (record) =>
      normalizeDependencyVersion(record?.currentVersion) ===
        normalizeDependencyVersion(currentVersion) &&
      normalizeDependencyVersion(record?.targetVersion) ===
        normalizeDependencyVersion(latestVersion),
  )
  for (const record of activeRecords) {
    if (
      normalizeDependencyVersion(record.currentVersion) !==
      normalizeDependencyVersion(currentVersion)
    ) {
      errors.push(`exception-current-stale:${record.id}`)
    }
    if (
      normalizeDependencyVersion(record.targetVersion) !==
      normalizeDependencyVersion(latestVersion)
    ) {
      errors.push(`exception-target-stale:${record.id}`)
    }
  }
  const exceptionErrors = activeCandidates.flatMap((record) =>
    validateFreshnessException(record, {
      entry,
      currentVersion,
      latestVersion,
      now,
    }),
  )
  if (activeCandidates.length > 1) {
    exceptionErrors.push('exception-active-not-exact-one')
  }
  errors.push(...exceptionErrors)
  const matchingPullRequests = pullRequests.filter(
    (pullRequest) =>
      normalizeDependencyVersion(pullRequest.targetVersion) ===
      normalizeDependencyVersion(latestVersion),
  )
  const matches = []
  if (
    normalizeDependencyVersion(currentVersion) ===
    normalizeDependencyVersion(latestVersion)
  ) {
    matches.push({ state: 'current' })
  }
  if (matchingPullRequests.length > 0) {
    matches.push({
      state: 'latest-target-pr',
      pullRequest: matchingPullRequests[0],
    })
  }
  const selectedException = activeCandidates[0] ?? null
  if (selectedException) {
    matches.push({ state: 'exception', exception: selectedException })
  }
  if (matches.length > 1) {
    errors.push(
      `state-not-exact-one:${matches.map((match) => match.state).join(',')}`,
    )
  }
  if (matches.length === 1 && errors.length === 0) {
    const match = matches[0]
    if (match.state === 'current') {
      return {
        state: 'current',
        detail: currentVersion,
        blockerReasons: [],
        errors,
        selectedPullRequest: null,
        selectedException: null,
      }
    }
    if (match.state === 'latest-target-pr') {
      return {
        state: 'latest-target-pr',
        detail: `PR #${match.pullRequest.number}: ${match.pullRequest.title}`,
        blockerReasons: [],
        errors,
        selectedPullRequest: match.pullRequest,
        selectedException: null,
      }
    }
    return {
      state: 'exception',
      detail: `expires ${match.exception.expiresAt}: ${match.exception.reason}`,
      blockerReasons: [],
      errors,
      selectedPullRequest: null,
      selectedException: match.exception,
    }
  }
  return {
    state: 'stale',
    detail: `current=${currentVersion} latest=${latestVersion}`,
    blockerReasons: [
      pullRequests.length > 0 ? 'pr-target-not-latest' : 'stale',
    ],
    errors,
    selectedPullRequest: null,
    selectedException: null,
  }
}
