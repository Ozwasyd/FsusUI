import { createHash } from 'node:crypto'

export const BLOCKER_ISSUE_TITLE = 'Dependency freshness blockers'
export const BLOCKER_LABEL = 'dependency-blocked'
export const BLOCKER_MARKER = 'fsusui-dependency-freshness-blocker'

const compare = (left, right) => (left === right ? 0 : left < right ? -1 : 1)
const sorted = (values, select = (value) => value) =>
  [...values].sort((left, right) => compare(select(left), select(right)))

function parseInstant(value, field) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp))
    throw new Error(`${field} must be an ISO timestamp`)
  return timestamp
}

function markdown(value) {
  return String(value ?? '—')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>')
}

function markerFromBody(body = '') {
  const match = body.match(
    /<!-- fsusui-dependency-freshness-blocker:(\{[^\n]*\}) -->/u,
  )
  if (!match) return null
  try {
    const value = JSON.parse(match[1])
    if (value?.schemaVersion !== 1) return null
    parseInstant(value.appliedAt, 'blocker issue appliedAt')
    return value
  } catch {
    return null
  }
}

export function validateFreshnessReport(report) {
  if (report?.schemaVersion !== 1) {
    throw new Error('freshness report schemaVersion must be 1')
  }
  parseInstant(report.generatedAt, 'freshness report generatedAt')
  if (!Array.isArray(report.results) || !Array.isArray(report.errors)) {
    throw new Error('freshness report results and errors must be arrays')
  }
  if (
    !Array.isArray(report.requiredChecks) ||
    report.requiredChecks.length === 0
  ) {
    throw new Error('freshness report requiredChecks must be a non-empty array')
  }
  const ids = new Set()
  for (const result of report.results) {
    if (!result?.dependencyId || ids.has(result.dependencyId)) {
      throw new Error('freshness report dependencyId values must be unique')
    }
    ids.add(result.dependencyId)
    if (!result.datasource || !result.packageName || !result.state) {
      throw new Error(
        `${result.dependencyId} has incomplete freshness identity`,
      )
    }
    if (!Array.isArray(result.pullRequests)) {
      throw new Error(`${result.dependencyId} pullRequests must be an array`)
    }
    if (result.state === 'skipped') {
      throw new Error(
        `${result.dependencyId} has no complete registry freshness result`,
      )
    }
  }
  if (report.errors.length > 0) {
    throw new Error(
      `freshness report contains operational errors: ${report.errors
        .map((error) => error.message ?? String(error))
        .join('; ')}`,
    )
  }
  return report
}

function checkName(check) {
  return check.name ?? check.context ?? ''
}

function checkConclusion(check) {
  return String(
    check.conclusion ?? check.state ?? check.status ?? 'missing',
  ).toLowerCase()
}

function failedRequiredChecks(report, pullRequest) {
  const required = new Set(report.requiredChecks ?? [])
  const checks = new Map(
    (pullRequest.checks ?? []).map((check) => [checkName(check), check]),
  )
  return sorted(
    [...required]
      .map((name) => checks.get(name) ?? { name, conclusion: 'missing' })
      .filter((check) => checkConclusion(check) !== 'success'),
    checkName,
  )
}

function checkAgeHours(check, pullRequest, observedAt) {
  const since =
    check.completedAt ??
    check.startedAt ??
    check.createdAt ??
    pullRequest.createdAt
  return (
    (observedAt - parseInstant(since, `check ${checkName(check)} age`)) /
    3_600_000
  )
}

function normalizePullRequests(result) {
  return sorted(result.pullRequests ?? [], (pullRequest) =>
    String(pullRequest.number).padStart(20, '0'),
  )
}

export function blockersFromReport(report, firstObservedAt = {}) {
  validateFreshnessReport(report)
  const observedAt = parseInstant(
    report.generatedAt,
    'freshness report generatedAt',
  )
  const blockers = []
  const labelActions = []

  for (const result of sorted(report.results, (entry) => entry.dependencyId)) {
    const pullRequests = normalizePullRequests(result)
    const overdueChecks = []
    for (const pullRequest of pullRequests) {
      if (pullRequest.state && pullRequest.state !== 'OPEN') continue
      const failed = failedRequiredChecks(report, pullRequest)
      const overdue = failed.filter(
        (check) => checkAgeHours(check, pullRequest, observedAt) > 24,
      )
      const hasLabel = (pullRequest.labels ?? []).includes(BLOCKER_LABEL)
      if (overdue.length > 0) {
        overdueChecks.push(
          ...overdue.map((check) => ({
            name: checkName(check),
            conclusion: checkConclusion(check),
            pullRequest: pullRequest.number,
          })),
        )
        if (!hasLabel) {
          labelActions.push({ action: 'add', number: pullRequest.number })
        }
      } else if (hasLabel) {
        labelActions.push({ action: 'remove', number: pullRequest.number })
      }
    }

    if (
      result.state !== 'stale' &&
      (result.blockerReasons ?? []).length === 0 &&
      overdueChecks.length === 0
    ) {
      continue
    }
    blockers.push({
      ...result,
      pullRequests,
      failedChecks: overdueChecks,
      firstObservedAt:
        firstObservedAt[result.dependencyId] ?? report.generatedAt,
    })
  }

  return {
    blockers,
    labelActions: sorted(
      labelActions,
      (action) => `${String(action.number).padStart(20, '0')}:${action.action}`,
    ),
  }
}

function pullRequestText(pullRequests) {
  if (pullRequests.length === 0) return '—'
  return pullRequests
    .map((pullRequest) => {
      const link = pullRequest.url
        ? `[#${pullRequest.number}](${pullRequest.url})`
        : `#${pullRequest.number}`
      return pullRequest.superseding ? `${link} (superseding)` : link
    })
    .join(', ')
}

function failedCheckText(checks) {
  if (checks.length === 0) return '—'
  return sorted(
    checks.map(
      (check) => `#${check.pullRequest} ${check.name} (${check.conclusion})`,
    ),
  ).join(', ')
}

function exceptionText(exception) {
  if (!exception) return '—'
  return `${exception.owner ?? '—'} / ${exception.expiresAt ?? '—'}`
}

export function renderBlockerIssue(report, blockers) {
  const firstObservedAt = Object.fromEntries(
    blockers.map((blocker) => [blocker.dependencyId, blocker.firstObservedAt]),
  )
  const marker = JSON.stringify({
    schemaVersion: 1,
    appliedAt: report.generatedAt,
    firstObservedAt,
  })
  const rows = blockers.map((blocker) => {
    const versions = `${blocker.currentVersion ?? '—'} → ${blocker.targetVersion ?? '—'}`
    return `| ${[
      blocker.dependencyId,
      versions,
      blocker.datasource,
      pullRequestText(blocker.pullRequests),
      failedCheckText(blocker.failedChecks),
      exceptionText(blocker.exception),
      blocker.firstObservedAt,
    ]
      .map(markdown)
      .join(' | ')} |`
  })
  return [
    `<!-- ${BLOCKER_MARKER}:${marker} -->`,
    'This issue is maintained by the dependency freshness workflow. Do not close it while blockers remain.',
    '',
    '| dependencyId | current → target | datasource | open/superseding PR | failed required checks | exception owner / expiry | firstObservedAt |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Source result: \`${report.generatedAt}\`.`,
  ].join('\n')
}

function renderRecoveredIssue(report, firstObservedAt) {
  const marker = JSON.stringify({
    schemaVersion: 1,
    appliedAt: report.generatedAt,
    firstObservedAt,
  })
  return [
    `<!-- ${BLOCKER_MARKER}:${marker} -->`,
    'No dependency freshness blockers remain. This issue was closed automatically.',
    '',
    `Source result: \`${report.generatedAt}\`.`,
  ].join('\n')
}

function issueSnapshot(issues) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        sorted(issues, (issue) => String(issue.number).padStart(20, '0')).map(
          ({ number, state, title, body, updatedAt }) => ({
            number,
            state,
            title,
            body,
            updatedAt,
          }),
        ),
      ),
    )
    .digest('hex')
}

function canonicalIssue(issues) {
  return sorted(issues, (issue) => String(issue.number).padStart(20, '0'))[0]
}

function newestAppliedAt(issues) {
  return issues
    .map((issue) => markerFromBody(issue.body)?.appliedAt)
    .filter(Boolean)
    .sort(compare)
    .at(-1)
}

function knownFirstObservedAt(issues) {
  const values = {}
  for (const issue of sorted(issues, (entry) => entry.updatedAt ?? '')) {
    Object.assign(values, markerFromBody(issue.body)?.firstObservedAt ?? {})
  }
  return values
}

async function assertSnapshot(client, expected) {
  const current = await client.listIssuesByTitle(BLOCKER_ISSUE_TITLE)
  if (issueSnapshot(current) !== expected) {
    throw new Error('blocker issue changed concurrently; refusing stale write')
  }
}

async function deduplicate(client) {
  const issues = await client.listIssuesByTitle(BLOCKER_ISSUE_TITLE)
  if (issues.length <= 1) return issues
  const canonical = canonicalIssue(issues)
  for (const duplicate of issues.filter(
    (issue) => issue.number !== canonical.number,
  )) {
    await client.updateIssue(duplicate.number, {
      title: `[duplicate of #${canonical.number}] ${BLOCKER_ISSUE_TITLE}`,
      state: 'closed',
    })
  }
  return [canonical]
}

export async function reconcileFreshnessReport({ report, client }) {
  validateFreshnessReport(report)
  await client.assertWritable()
  let issues = await client.listIssuesByTitle(BLOCKER_ISSUE_TITLE)
  const newest = newestAppliedAt(issues)
  if (newest && parseInstant(report.generatedAt) < parseInstant(newest)) {
    throw new Error(
      `freshness result ${report.generatedAt} is older than applied result ${newest}`,
    )
  }

  const expectedSnapshot = issueSnapshot(issues)
  const firstObservedAt = knownFirstObservedAt(issues)
  const { blockers, labelActions } = blockersFromReport(report, firstObservedAt)
  await assertSnapshot(client, expectedSnapshot)

  for (const action of labelActions) {
    await client.setPullRequestLabel(
      action.number,
      BLOCKER_LABEL,
      action.action,
    )
  }
  await assertSnapshot(client, expectedSnapshot)

  if (blockers.length === 0) {
    issues = await deduplicate(client)
    const canonical = canonicalIssue(issues)
    if (canonical) {
      await client.updateIssue(canonical.number, {
        body: renderRecoveredIssue(report, firstObservedAt),
        state: 'closed',
      })
    }
    return {
      action: canonical?.state === 'open' ? 'closed' : 'noop',
      blockers: 0,
    }
  }

  const body = renderBlockerIssue(report, blockers)
  const canonical = canonicalIssue(issues)
  let action = 'created'
  if (canonical) {
    if (
      issues.length === 1 &&
      canonical.state === 'open' &&
      canonical.title === BLOCKER_ISSUE_TITLE &&
      canonical.body === body
    ) {
      action = 'noop'
    } else {
      await client.updateIssue(canonical.number, {
        title: BLOCKER_ISSUE_TITLE,
        body,
        state: 'open',
      })
      action = 'updated'
    }
  } else {
    await client.createIssue({ title: BLOCKER_ISSUE_TITLE, body })
  }

  issues = await deduplicate(client)
  if (issues.length !== 1 || issues[0].state !== 'open') {
    throw new Error('failed to establish exact-one open blocker issue')
  }
  return {
    action,
    blockers: blockers.length,
    issueNumber: issues[0].number,
  }
}
