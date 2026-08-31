import assert from 'node:assert/strict'
import test from 'node:test'
import { URL } from 'node:url'
import {
  affectedDecision,
  aggregateLeaves,
  validateLeaf,
  validateReport,
  validateScenarioBindings,
  validateWorkflowContracts,
} from '../scripts/avalonia-aot-native.mjs'
import { readContractRegistry } from '../scripts/avalonia-stable-readiness-lib.mjs'
import fs from 'node:fs'

const commitSha = 'a'.repeat(40)
const candidateSha256 = 'b'.repeat(64)
const stableFamilies = () => readContractRegistry().releaseScopeFamilies
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
    passed: stableFamilies().length,
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
    validateScenarioBindings(source, stableFamilies()),
    stableFamilies(),
  )
  assert.throws(
    () =>
      validateScenarioBindings(
        source.replace('["tree"] =', '["tree-missing"] ='),
        stableFamilies(),
      ),
    /binding mismatch/u,
  )
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
    Scenarios: stableFamilies().map((Id) => ({
      Id,
      Component: `Fsus.${Id}`,
      Resource: 'packaged-template',
      Stage: 'behavior',
      Passed: true,
      Error: null,
      Exception: null,
    })),
    ScenarioCount: stableFamilies().length,
    ScenarioPassed: stableFamilies().length,
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
      stableFamilies(),
    ),
    true,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, CandidateSha256: 'e'.repeat(64) },
        { candidateSha256 },
        stableFamilies(),
      ),
    /candidate mismatch/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, Scenarios: report.Scenarios.slice(1) },
        undefined,
        stableFamilies(),
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
        stableFamilies(),
      ),
    /failed/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, NativeLogErrorCount: 1 },
        undefined,
        stableFamilies(),
      ),
    /native log/u,
  )
  assert.throws(
    () =>
      validateReport(
        { ...report, PartialCapabilities: [] },
        undefined,
        stableFamilies(),
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
