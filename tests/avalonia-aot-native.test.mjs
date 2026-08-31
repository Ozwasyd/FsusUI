import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'
import {
  affectedDecision,
  aggregateLeaves,
  stableFamilies,
  validateLeaf,
  validateReport,
  validateScenarioBindings,
  validateWorkflowContracts,
} from '../scripts/avalonia-aot-native.mjs'
import {
  alignmentHash,
  deriveStableConsumers,
  readContractRegistry,
} from '../scripts/avalonia-stable-readiness-lib.mjs'
import fs from 'node:fs'

const commitSha = 'a'.repeat(40)
const candidateSha256 = 'b'.repeat(64)
const authorityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-aot-authority-'))
const registryPath = path.join(authorityRoot, 'contract-v2.json')
const alignmentPath = path.join(authorityRoot, 'alignment.json')
const registrySource = fs.readFileSync(
  new URL('../spec/components/contracts/v2/contract-v2.json', import.meta.url),
)
fs.writeFileSync(registryPath, registrySource)
const { registry, releaseScopeFamilies } = readContractRegistry(registryPath)
const expected = { candidate: 'c'.repeat(40), contractHash: 'd'.repeat(64) }
const alignment = {
  schema: 'fsusui.alignment.v2',
  identity: expected,
  statuses: registry.contracts.map(({ id }) => ({
    id,
    status: 'aligned',
    source: 'derived',
  })),
  stable: registry.contracts.map(({ id }) => id),
  webOnly: [],
  gaps: [],
}
alignment.consumers = deriveStableConsumers(registry, alignment)
alignment.identity.alignmentHash = alignmentHash(alignment)
fs.writeFileSync(alignmentPath, `${JSON.stringify(alignment, null, 2)}\n`)
const authority = { registryPath, alignmentPath, expected }
const expectedStableFamilies = () => stableFamilies(authority)
test.after(() => fs.rmSync(authorityRoot, { recursive: true, force: true }))
const leaf = (overrides = {}) => ({
  schemaVersion: 'fsusui.avalonia-aot-leaf-manifest.v1',
  status: 'success',
  commitSha,
  packageVersion: '0.0.0-preview.0',
  candidateSha256,
  rid: 'linux-x64',
  operatingSystem: 'linux',
  architecture: 'x64',
  publishWarnings: 0,
  nativeBinary: { runtimeIndependent: true, sha256: 'c'.repeat(64) },
  report: {
    sha256: 'd'.repeat(64),
    passed: expectedStableFamilies().length,
    failed: 0,
    skipped: 0,
  },
  ...overrides,
})

test('stable registry owns the native scenario set', () => {
  const source = fs.readFileSync(
    new URL('../tests/fixtures/avalonia-aot-smoke/Program.cs', import.meta.url),
    'utf8',
  )
  assert.deepEqual(
    validateScenarioBindings(source, expectedStableFamilies()),
    expectedStableFamilies(),
  )
  assert.throws(
    () =>
      validateScenarioBindings(
        source.replace('["tree"] =', '["tree-missing"] ='),
        expectedStableFamilies(),
      ),
    /binding mismatch/u,
  )
  const stale = JSON.parse(fs.readFileSync(alignmentPath, 'utf8'))
  stale.identity.candidate = 'e'.repeat(40)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(stale, null, 2)}\n`)
  assert.throws(() => stableFamilies(authority), /identity candidate is stale/u)
  const duplicate = structuredClone(alignment)
  duplicate.statuses.push({ ...duplicate.statuses[0] })
  duplicate.identity.alignmentHash = alignmentHash(duplicate)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(duplicate, null, 2)}\n`)
  assert.throws(() => stableFamilies(authority), /not uniquely derived/u)
  const ungoverned = structuredClone(alignment)
  const partialId = ungoverned.statuses[0].id
  ungoverned.statuses[0].status = 'partial'
  ungoverned.stable = ungoverned.stable.filter((id) => id !== partialId)
  ungoverned.gaps = [{ contract: partialId }]
  ungoverned.consumers = deriveStableConsumers(registry, ungoverned)
  ungoverned.identity.alignmentHash = alignmentHash(ungoverned)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(ungoverned, null, 2)}\n`)
  assert.throws(() => stableFamilies(authority), /is ungoverned/u)
  fs.writeFileSync(alignmentPath, `${JSON.stringify(alignment, null, 2)}\n`)
})

test('report rejects stale identity, skipped behavior and incomplete registry coverage', () => {
  const report = {
    SchemaVersion: 'fsusui.avalonia-aot-smoke-report.v1',
    CommitSha: commitSha,
    PackageVersion: '1.0.0',
    CandidateSha256: candidateSha256,
    Rid: 'linux-x64',
    OperatingSystem: 'Linux',
    ProcessArchitecture: 'X64',
    DotnetVersion: '10.0.0',
    AvaloniaVersion: '12.0.4',
    NativeBinaryName: 'FsusUI.Avalonia.AotSmoke',
    NativeBinaryPath: 'publish/FsusUI.Avalonia.AotSmoke',
    NativeBinaryFormat: 'ELF',
    NativeBinaryBytes: 1024,
    NativeBinarySha256: 'c'.repeat(64),
    NativeDependencies: ['libc.so.6'],
    PackageDigests: [`FsusUI.Avalonia.nupkg:${'d'.repeat(64)}`],
    PartialCapabilities: ['FsusMarkdownEditor:required-after-issue-343'],
    RuntimeIndependent: true,
    StartedAtUtc: '2026-01-01T00:00:00Z',
    EndedAtUtc: '2026-01-01T00:00:01Z',
    Scenarios: expectedStableFamilies().map((Id) => ({
      Id,
      Component: `Fsus.${Id}`,
      Resource: 'packaged-template',
      Stage: 'behavior',
      Passed: true,
      Error: null,
      Exception: null,
    })),
    ScenarioCount: expectedStableFamilies().length,
    ScenarioPassed: expectedStableFamilies().length,
    ScenarioFailed: 0,
    ScenarioSkipped: 0,
    NativeLogErrorCount: 0,
    NativeLogAreas: [],
    StdoutSummary: 'native smoke completed',
    StderrSummary: 'no Avalonia warnings or errors',
    ExitCode: 0,
  }
  assert.equal(
    validateReport(
      report,
      { commitSha, candidateSha256, rid: 'linux-x64' },
      expectedStableFamilies(),
    ),
    true,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, CandidateSha256: 'e'.repeat(64) },
        { candidateSha256 },
        expectedStableFamilies(),
      ),
    /candidate mismatch/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, Scenarios: report.Scenarios.slice(1) },
        undefined,
        expectedStableFamilies(),
      ),
    /coverage/u,
  )
  assert.throws(
    () =>
      validateReport(
        {
          ...report,
          Scenarios: report.Scenarios.map((item, index) =>
            index ? item : { ...item, Passed: false },
          ),
        },
        undefined,
        expectedStableFamilies(),
      ),
    /failed/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, NativeLogErrorCount: 1 },
        undefined,
        expectedStableFamilies(),
      ),
    /native log/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, PartialCapabilities: [] },
        undefined,
        expectedStableFamilies(),
      ),
    /MarkdownEditor as partial/u,
  )
})

test('leaf and aggregate fail closed on wrong architecture, candidate, warnings and missing required RID', () => {
  assert.equal(
    validateLeaf(leaf(), { commitSha, candidateSha256, rid: 'linux-x64' }),
    true,
  )
  assert.throws(
    () => validateLeaf(leaf({ architecture: 'arm64' })),
    /runner identity/u,
  )
  assert.throws(() => validateLeaf(leaf({ publishWarnings: 1 })), /warnings/u)
  assert.throws(
    () => aggregateLeaves([], { commitSha, candidateSha256 }),
    /missing required/u,
  )
  assert.throws(
    () =>
      aggregateLeaves([leaf({ candidateSha256: 'e'.repeat(64) })], {
        commitSha,
        candidateSha256,
      }),
    /candidate mismatch/u,
  )
  const aggregate = aggregateLeaves([leaf()], { commitSha, candidateSha256 })
  assert.deepEqual(aggregate.supportedRids, ['linux-x64'])
  assert.deepEqual(aggregate.optionalOffHost, ['win-x64', 'osx-arm64'])
})

test('affected selection cannot skip dotnet, AOT scripts or workflow changes', () => {
  assert.equal(affectedDecision(['docs/guide/quickstart.md']).required, false)
  for (const file of [
    'dotnet/FsusUI.Avalonia/Controls/FsusButton.cs',
    'scripts/avalonia-aot-native.mjs',
    'scripts/dotnet-package-verify.mjs',
    'spec/ci/readiness-gates.json',
    '.github/workflows/_quality.yml',
    '.github/workflows/quality.yml',
  ])
    assert.equal(affectedDecision([file]).required, true)
})

test('workflow policy kills repack, allow-failure and missing required Linux wiring', () => {
  const files = {
    leaf: fs.readFileSync(
      new URL('../.github/workflows/_avalonia-aot-leaf.yml', import.meta.url),
      'utf8',
    ),
    quality: fs.readFileSync(
      new URL('../.github/workflows/_quality.yml', import.meta.url),
      'utf8',
    ),
    caller: fs.readFileSync(
      new URL('../.github/workflows/quality.yml', import.meta.url),
      'utf8',
    ),
    publish: fs.readFileSync(
      new URL('../.github/workflows/publish-npm.yml', import.meta.url),
      'utf8',
    ),
  }
  assert.equal(validateWorkflowContracts(files), true)
  assert.throws(
    () =>
      validateWorkflowContracts({
        ...files,
        leaf: `${files.leaf}\ncontinue-on-error: true\n`,
      }),
    /must not contain/u,
  )
  assert.throws(
    () =>
      validateWorkflowContracts({
        ...files,
        leaf: files.leaf.replace(
          'node scripts/test-avalonia-aot-smoke.mjs',
          'dotnet pack',
        ),
      }),
    /missing|must not/u,
  )
  assert.throws(
    () =>
      validateWorkflowContracts({
        ...files,
        quality: files.quality.replaceAll('\n      - avalonia-aot\n', '\n'),
      }),
    /quality workflow missing/u,
  )
  assert.throws(
    () =>
      validateWorkflowContracts({
        ...files,
        caller: files.caller.replace('rid: linux-x64', 'rid: win-x64'),
      }),
    /PR workflow missing/u,
  )
})
