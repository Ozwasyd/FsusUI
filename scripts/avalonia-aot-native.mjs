#!/usr/bin/env node
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readStableConsumerAuthority } from './avalonia-stable-readiness-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))
const nativeSpec = readJson('spec/ci/avalonia-aot-native.json')
const sha256 = (content) => createHash('sha256').update(content).digest('hex')
const fullSha = /^[0-9a-f]{40}$/u
const digest = /^[0-9a-f]{64}$/u

export const resolveStableConsumerAuthority = (authority = {}) =>
  readStableConsumerAuthority({
    registryPath: authority.registryPath ?? nativeSpec.contractRegistry,
    alignmentPath: authority.alignmentPath ?? nativeSpec.alignmentArtifact,
    expected: authority.expected,
  })

export const stableFamilies = (authority = {}) => [
  ...resolveStableConsumerAuthority(authority).releaseScopeFamilies,
]

export const validateScenarioBindings = (
  source,
  required = stableFamilies(),
) => {
  const bound = new Set(
    [...source.matchAll(/^\s*\["([a-z0-9-]+)"\]\s*=/gmu)].map(
      (match) => match[1],
    ),
  )
  const missing = required.filter((family) => !bound.has(family))
  const unexpected = [...bound].filter((family) => !required.includes(family))
  if (missing.length || unexpected.length) {
    throw new Error(
      `AOT stable scenario binding mismatch: missing=${missing.join(',') || 'none'} unexpected=${unexpected.join(',') || 'none'}`,
    )
  }
  if (source.includes('() => true'))
    throw new Error('AOT stable scenarios must not use type-only assertions')
  for (const evidence of [
    'FsusThemeVariant.Light',
    'FsusThemeVariant.Dark',
    'HighContrast = true',
    'ThirdPartyTextAdapter',
    'DismissKeyboardAsync',
    'DismissPointerOutsideAsync',
    'NativeLogErrorCount == 0',
    'ControlAutomationPeer.CreatePeerForElement(markdownEditor)',
    'largeMarkdownSource.Length >= 100_000',
    'largeVisuals.Length < 64',
    'RenderingMode = [X11RenderingMode.Software]',
    'UseDBusMenu = false',
    'ViewportSize = 160',
    '"embed"',
    'catch (Exception error)',
  ])
    if (!source.includes(evidence))
      throw new Error(`AOT native behavior evidence missing ${evidence}`)
  return required
}

export const validateReport = (
  report,
  expected,
  required = stableFamilies(),
) => {
  for (const field of nativeSpec.requiredReportFields) {
    if (
      report[field] === undefined ||
      report[field] === null ||
      report[field] === ''
    )
      throw new Error(`smoke report missing ${field}`)
  }
  if (report.SchemaVersion !== nativeSpec.reportSchema)
    throw new Error('smoke report schema mismatch')
  if (!fullSha.test(report.CommitSha))
    throw new Error('smoke report commit must be a full SHA')
  if (!digest.test(report.CandidateSha256))
    throw new Error('smoke report candidate digest is invalid')
  if (expected?.commitSha && report.CommitSha !== expected.commitSha)
    throw new Error('smoke report commit mismatch')
  if (
    expected?.candidateSha256 &&
    report.CandidateSha256 !== expected.candidateSha256
  )
    throw new Error('smoke report candidate mismatch')
  if (expected?.rid && report.Rid !== expected.rid)
    throw new Error('smoke report RID mismatch')
  if (report.RuntimeMode !== 'nativeaot')
    throw new Error('smoke report runtime mode must be nativeaot')
  const ids = report.Scenarios.map((item) => item.Id)
  if (
    new Set(ids).size !== ids.length ||
    required.some((id) => !ids.includes(id))
  )
    throw new Error('smoke report scenario coverage is incomplete')
  if (report.Scenarios.some((item) => !item.Passed) || report.ExitCode !== 0)
    throw new Error('smoke report contains failed scenarios')
  if (report.NativeLogErrorCount !== 0 || report.NativeLogAreas.length !== 0)
    throw new Error('smoke report contains native log errors')
  if (!digest.test(report.NativeBinarySha256))
    throw new Error('smoke report binary digest is invalid')
  if (
    !Array.isArray(report.NativeDependencies) ||
    report.NativeDependencies.length < 1
  )
    throw new Error('smoke report runtime dependencies are missing')
  if (!Array.isArray(report.PackageDigests) || report.PackageDigests.length < 1)
    throw new Error('smoke report package digests are missing')
  if (
    report.MarkdownAutomationReady !== true ||
    report.MarkdownAutomationNodeCount < 1 ||
    report.MarkdownAutomationNodeCount > 64
  )
    throw new Error('smoke report Markdown automation evidence is incomplete')
  if (
    report.MarkdownVirtualizationReady !== true ||
    report.MarkdownDocumentCharacters < 100_000 ||
    report.MarkdownBlockCount < 3_000 ||
    report.MarkdownHeadingCount < 10_000 ||
    report.MarkdownVisualCount >= 64 ||
    !Number.isFinite(report.MarkdownLayoutMilliseconds) ||
    report.MarkdownLayoutMilliseconds < 0 ||
    !Number.isSafeInteger(report.MarkdownManagedBytesDelta) ||
    report.MarkdownManagedBytesDelta < 0 ||
    !Number.isFinite(report.RenderScaling) ||
    report.RenderScaling <= 0
  )
    throw new Error(
      'smoke report Markdown virtualization evidence is incomplete',
    )
  if (
    !Array.isArray(report.PartialCapabilities) ||
    !report.PartialCapabilities.includes(
      'FsusMarkdownEditor:required-after-issue-343',
    )
  )
    throw new Error('smoke report must retain FsusMarkdownEditor as partial')
  if (
    report.Scenarios.some(
      (item) => !item.Component || !item.Resource || !item.Stage,
    )
  )
    throw new Error('smoke report scenario location is incomplete')
  if (
    !report.RuntimeIndependent ||
    report.NativeBinaryFormat !== 'ELF' ||
    report.NativeBinaryBytes < 1
  )
    throw new Error('smoke report runtime independence is incomplete')
  if (
    report.ScenarioCount !== required.length ||
    report.ScenarioPassed !== required.length ||
    report.ScenarioFailed !== 0 ||
    report.ScenarioSkipped !== 0
  )
    throw new Error('smoke report summary is inconsistent')
  return true
}

export const validateLeaf = (leaf, expected = {}) => {
  if (leaf.schemaVersion !== nativeSpec.leafSchema)
    throw new Error('leaf schema mismatch')
  if (leaf.status !== 'success') throw new Error('leaf status is not success')
  if (!fullSha.test(leaf.commitSha))
    throw new Error('leaf commit must be a full SHA')
  if (
    typeof leaf.packageVersion !== 'string' ||
    leaf.packageVersion.length === 0
  )
    throw new Error('leaf package version is required')
  if (!digest.test(leaf.candidateSha256))
    throw new Error('leaf candidate digest is invalid')
  if (expected.commitSha && leaf.commitSha !== expected.commitSha)
    throw new Error('leaf commit mismatch')
  if (
    expected.candidateSha256 &&
    leaf.candidateSha256 !== expected.candidateSha256
  )
    throw new Error('leaf candidate mismatch')
  if (expected.rid && leaf.rid !== expected.rid)
    throw new Error('leaf RID mismatch')
  if (
    leaf.rid === 'linux-x64' &&
    (leaf.operatingSystem !== 'linux' || leaf.architecture !== 'x64')
  )
    throw new Error('linux-x64 leaf runner identity mismatch')
  if (!leaf.nativeBinary?.runtimeIndependent)
    throw new Error('leaf is not runtime independent')
  if (!digest.test(leaf.nativeBinary?.sha256 ?? ''))
    throw new Error('leaf binary digest is invalid')
  if (!digest.test(leaf.report?.sha256 ?? ''))
    throw new Error('leaf report digest is invalid')
  if (leaf.publishWarnings !== 0)
    throw new Error('leaf publish warnings must be zero')
  if (
    leaf.report?.failed !== 0 ||
    leaf.report?.skipped !== 0 ||
    leaf.report?.passed < 1
  )
    throw new Error('leaf smoke summary is not fully successful')
  return true
}

export const aggregateLeaves = (leaves, expected) => {
  const byRid = new Map()
  for (const leaf of leaves) {
    validateLeaf(leaf, expected)
    if (byRid.has(leaf.rid))
      throw new Error(`duplicate AOT leaf RID: ${leaf.rid}`)
    byRid.set(leaf.rid, leaf)
  }
  for (const rid of nativeSpec.requiredRids)
    if (!byRid.has(rid)) throw new Error(`missing required AOT leaf: ${rid}`)
  const supportedRids = [...byRid.keys()].sort()
  const optionalOffHost = nativeSpec.optionalOffHostRids.filter(
    (rid) => !byRid.has(rid),
  )
  return {
    schemaVersion: nativeSpec.aggregateSchema,
    status: 'success',
    commitSha: expected.commitSha,
    candidateSha256: expected.candidateSha256,
    requiredRids: nativeSpec.requiredRids,
    supportedRids,
    optionalOffHost,
    leaves: [...byRid.values()].map((leaf) => ({
      rid: leaf.rid,
      manifestSha256: sha256(`${JSON.stringify(leaf)}\n`),
    })),
  }
}

export const affectedDecision = (paths) => {
  const affected = paths.filter((file) =>
    nativeSpec.affectedPrefixes.some(
      (prefix) => file === prefix || file.startsWith(prefix),
    ),
  )
  return {
    required: affected.length > 0,
    affected,
    reason:
      affected.length > 0 ? 'avalonia-aot-impact' : 'no-avalonia-aot-impact',
  }
}

export const validateWorkflowContracts = ({
  leaf,
  quality,
  caller,
  publish,
}) => {
  const requiredLeaf = [
    'workflow_call:',
    'actions/download-artifact@v4',
    'FSUSUI_AOT_CANDIDATE_ROOT',
    'test-avalonia-aot-smoke.mjs',
    'validate-leaf',
    "inputs.rid == 'linux-x64'",
  ]
  for (const term of requiredLeaf)
    if (!leaf.includes(term))
      throw new Error(`AOT leaf workflow missing ${term}`)
  for (const forbidden of [
    'dotnet pack',
    'dotnet:pack',
    'continue-on-error:',
    'allow-failure',
  ])
    if (leaf.includes(forbidden))
      throw new Error(`AOT leaf workflow must not contain ${forbidden}`)
  for (const term of [
    'avalonia-aot-linux:',
    'avalonia-aot:',
    'candidate-artifact: dotnet-nuget-candidate',
    'scripts/avalonia-aot-native.mjs aggregate',
    '\n      - avalonia-aot\n',
  ])
    if (!quality.includes(term))
      throw new Error(`quality workflow missing ${term.trim()}`)
  for (const term of [
    'pr-avalonia-aot-plan:',
    'pr-avalonia-aot-candidate:',
    'pr-avalonia-aot:',
    'scripts/avalonia-aot-native.mjs affected',
    'rid: linux-x64',
    'ref: ${{ github.event.pull_request.head.sha }}',
    'GITHUB_SHA: ${{ github.event.pull_request.head.sha }}',
  ])
    if (!caller.includes(term)) throw new Error(`PR workflow missing ${term}`)
  if (
    !publish.includes('release-readiness-digest') ||
    !publish.includes(
      'needs: [quality, plan, preflight, fsusblog-consumer]',
    )
  )
    throw new Error('publish workflow must remain bound to release readiness')
  return true
}

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

const command = process.argv[2]
if (command === 'check-scenarios') {
  const families = validateScenarioBindings(
    fs.readFileSync(
      path.join(root, 'tests/fixtures/avalonia-aot-smoke/Program.cs'),
      'utf8',
    ),
  )
  console.log(`[avalonia-aot] stable-scenarios=${families.length}`)
} else if (command === 'check-workflows') {
  validateWorkflowContracts({
    leaf: fs.readFileSync(
      path.join(root, '.github/workflows/_avalonia-aot-leaf.yml'),
      'utf8',
    ),
    quality: fs.readFileSync(
      path.join(root, '.github/workflows/_quality.yml'),
      'utf8',
    ),
    caller: fs.readFileSync(
      path.join(root, '.github/workflows/quality.yml'),
      'utf8',
    ),
    publish: fs.readFileSync(
      path.join(root, '.github/workflows/publish-npm.yml'),
      'utf8',
    ),
  })
  console.log('[avalonia-aot] workflow tiering valid')
} else if (command === 'validate-report') {
  const report = readJson(option('--report'))
  validateReport(report, {
    commitSha: option('--commit-sha'),
    candidateSha256: option('--candidate-digest'),
    rid: option('--rid'),
  })
  console.log('[avalonia-aot] smoke report valid')
} else if (command === 'validate-leaf') {
  validateLeaf(readJson(option('--manifest')), {
    commitSha: option('--commit-sha'),
    candidateSha256: option('--candidate-digest'),
    rid: option('--rid'),
  })
  console.log('[avalonia-aot] leaf manifest valid')
} else if (command === 'aggregate') {
  const directory = path.resolve(root, option('--leaf-dir'))
  const findLeafManifests = (current) =>
    fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const candidate = path.join(current, entry.name)
      if (entry.isDirectory()) return findLeafManifests(candidate)
      return entry.isFile() && entry.name === 'leaf-manifest.json'
        ? [candidate]
        : []
    })
  const leaves = findLeafManifests(directory)
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
  const aggregate = aggregateLeaves(leaves, {
    commitSha: option('--commit-sha'),
    candidateSha256: option('--candidate-digest'),
  })
  const out = path.resolve(root, option('--out'))
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(aggregate, null, 2)}\n`)
  console.log(
    `[avalonia-aot] aggregate=${out} supported=${aggregate.supportedRids.join(',')}`,
  )
} else if (command === 'affected') {
  const pathsFile = path.resolve(root, option('--paths'))
  const decision = affectedDecision(
    fs.readFileSync(pathsFile, 'utf8').split(/\r?\n/u).filter(Boolean),
  )
  console.log(JSON.stringify(decision))
  if (option('--out'))
    fs.writeFileSync(
      path.resolve(root, option('--out')),
      `${JSON.stringify(decision, null, 2)}\n`,
    )
  if (option('--github-output')) {
    fs.appendFileSync(
      path.resolve(option('--github-output')),
      `run=${decision.required}\nreason=${decision.reason}\naffected=${decision.affected.join(',')}\n`,
    )
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.error(
    'Usage: avalonia-aot-native.mjs check-scenarios|check-workflows|validate-report|validate-leaf|aggregate|affected',
  )
  process.exitCode = 1
}
