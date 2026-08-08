#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

import {
  checkComponentSurfaceSemanticRegistry,
  loadComponentSurfaceSemanticRegistry,
} from './check-component-surface-semantic-registry.mjs'
import { runCorpus } from './check-component-semantic-corpus.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const registryPath = 'spec/components/component-surface-semantic-registry.json'
const registrySchemaPath =
  'spec/components/component-surface-semantic-registry.schema.json'
const reportSchemaPath = 'spec/components/visual-governance-report.schema.json'
const checkerFiles = {
  registry: 'scripts/check-component-surface-semantic-registry.mjs',
  evaluator: 'scripts/component-semantic-style-evaluator.mjs',
  corpus: 'scripts/check-component-semantic-corpus.mjs',
}
const defaultOutput = '.tmp/visual-governance/report.json'

const readJson = async (file) =>
  JSON.parse(await readFile(path.join(repositoryRoot, file), 'utf8'))
const fileDigest = async (file) =>
  createHash('sha256')
    .update(await readFile(path.join(repositoryRoot, file)))
    .digest('hex')
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  )
}
export const digestValue = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')

export class VisualGovernanceError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'VisualGovernanceError'
    this.code = code
  }
}
const fail = (code, message) => {
  throw new VisualGovernanceError(code, message)
}

const sameMembers = (left, right) =>
  Array.isArray(left) &&
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
const typedSchemaNode = (node) => {
  if (
    !node ||
    !['type', '$ref', 'const', 'enum', 'anyOf', 'oneOf'].some(
      (field) => field in node,
    )
  ) {
    return false
  }
  if (node.type === 'array' && !typedSchemaNode(node.items)) return false
  return Object.values(node.properties ?? {}).every(typedSchemaNode)
}

const expectedReportDefinitions = [
  'actualEvidence',
  'allowlist',
  'allowlistEntry',
  'baseline',
  'candidate',
  'digests',
  'expectedEvidence',
  'generated',
  'mutationCases',
  'mutationSummary',
  'positiveFixtures',
  'scenario',
  'violation',
  'visualScenarios',
]

const validateReportSchemaContract = (schema) => {
  const definitions = schema?.$defs ?? {}
  const closedDefinitions =
    sameMembers(Object.keys(definitions), expectedReportDefinitions) &&
    expectedReportDefinitions.every((name) => {
      const definition = definitions[name]
      return (
        definition?.type === 'object' &&
        definition.additionalProperties === false &&
        sameMembers(
          definition.required,
          Object.keys(definition.properties ?? {}),
        ) &&
        typedSchemaNode(definition)
      )
    })
  const scenario = definitions.scenario
  const evidence = scenario?.properties?.expectedSemanticEvidence
  if (
    !schema ||
    schema.type !== 'object' ||
    schema.additionalProperties !== false ||
    !sameMembers(schema.required, Object.keys(schema.properties ?? {})) ||
    !schema.properties ||
    !closedDefinitions ||
    schema.properties.schemaVersion?.const !==
      'fsusui.visual-governance-report.v1' ||
    schema.properties.issue?.const !== 404 ||
    schema.properties.worktreeClean?.const !== true ||
    schema.properties.candidate?.$ref !== '#/$defs/candidate' ||
    schema.properties.baseline?.$ref !== '#/$defs/baseline' ||
    schema.properties.mutationSummary?.$ref !== '#/$defs/mutationSummary' ||
    schema.properties.visualScenarios?.$ref !== '#/$defs/visualScenarios' ||
    evidence?.type !== 'array'
  ) {
    fail(
      'report-schema-contract-weak',
      'report schema is not a closed typed contract',
    )
  }
}

const ruleDigests = (registry) =>
  Object.fromEntries(registry.rules.map((rule) => [rule.id, digestValue(rule)]))

const portableViolation = (diagnostic) => ({
  ruleId: diagnostic.ruleId,
  componentId: diagnostic.componentId,
  partId: diagnostic.partId,
  surfaceRole: diagnostic.surfaceRole,
  selector: diagnostic.selector,
  scope: diagnostic.scope,
  property: diagnostic.property,
  reasonCode: diagnostic.reasonCode ?? null,
  status: diagnostic.status,
  expected: {
    canonicalReference: diagnostic.expected?.canonicalReference ?? null,
  },
  actual: {
    source: diagnostic.actual?.source
      ? {
          path: diagnostic.actual.source.path,
          line: diagnostic.actual.source.line,
          column: diagnostic.actual.source.column,
          owner: diagnostic.actual.source.owner,
        }
      : null,
    value: diagnostic.actual?.value ?? null,
  },
})

const mutationSummary = (corpus) => ({
  cases: {
    total: corpus.cases.length,
    killed: corpus.cases.filter((corpusCase) => corpusCase.killed).length,
    notKilled: corpus.cases
      .filter((corpusCase) => !corpusCase.killed)
      .map((corpusCase) => corpusCase.id),
  },
  positiveFixtures: {
    total: corpus.positiveFixtures.length,
    green: corpus.positiveFixtures.filter((positive) => positive.green).length,
    failed: corpus.positiveFixtures
      .filter((positive) => !positive.green)
      .map((positive) => positive.id),
  },
})

export const buildVisualGovernanceReport = async ({
  candidateIdentity,
  registry,
  registrySchema,
  corpus,
}) => {
  const violations = corpus.baseline.diagnostics
    .filter((diagnostic) => diagnostic.status === 'fail')
    .map(portableViolation)
  const checkers = {}
  for (const [name, file] of Object.entries(checkerFiles)) {
    checkers[name] = await fileDigest(file)
  }
  return {
    $schema: 'https://fsusui.dev/schema/visual-governance-report.v1.json',
    schemaVersion: 'fsusui.visual-governance-report.v1',
    issue: 404,
    candidate: {
      repository: candidateIdentity.repository,
      revision: candidateIdentity.revision,
    },
    digests: {
      algorithm: 'sha256',
      registry: digestValue(registry),
      schema: digestValue(registrySchema),
      checkers,
      rules: ruleDigests(registry),
    },
    allowlist: {
      count: (registry.allowlist ?? []).length,
      entries: (registry.allowlist ?? []).map((entry) => ({ ...entry })),
    },
    baseline: {
      compiledCssDigest: corpus.baseline.compiledCssDigest,
      registryDigest: corpus.baseline.registryDigest,
      violations,
    },
    mutationSummary: mutationSummary(corpus),
    visualScenarios: {
      total: corpus.scenarios.length,
      scenarios: corpus.scenarios.map((scenario) => ({ ...scenario })),
    },
    worktreeClean: corpus.worktreeClean,
    generated: {
      producer: 'scripts/check-visual-governance.mjs',
      sourceRevision: candidateIdentity.revision,
      digestAlgorithm: 'sha256',
    },
  }
}

export const validateVisualGovernanceReport = (report, schema) => {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  let validate
  try {
    validate = ajv.compile(schema)
  } catch (error) {
    fail('report-schema-contract-weak', error.message)
  }
  if (!validate(report)) {
    fail(
      'report-schema-invalid',
      ajv.errorsText(validate.errors, { separator: '; ' }),
    )
  }
  if (report.worktreeClean !== true) {
    fail('report-worktree-dirty', 'corpus run polluted the worktree')
  }
  if (report.mutationSummary.cases.notKilled.length > 0) {
    fail(
      'report-mutation-not-killed',
      `negative mutations not killed: ${report.mutationSummary.cases.notKilled.join(', ')}`,
    )
  }
  if (report.mutationSummary.positiveFixtures.failed.length > 0) {
    fail(
      'report-positive-fixture-failed',
      `positive fixtures failed: ${report.mutationSummary.positiveFixtures.failed.join(', ')}`,
    )
  }
  if (report.allowlist.count !== report.allowlist.entries.length) {
    fail('report-allowlist-invalid', 'allowlist count does not match entries')
  }
  const candidate = report.candidate
  for (const scenario of report.visualScenarios.scenarios) {
    const bound = scenario.candidateIdentity
    if (
      !bound ||
      bound.repository !== candidate.repository ||
      bound.revision !== candidate.revision
    ) {
      fail(
        'report-candidate-mismatch',
        `scenario ${scenario.scenarioId} is bound to a different candidate`,
      )
    }
    if (
      !Array.isArray(scenario.expectedSemanticEvidence) ||
      scenario.expectedSemanticEvidence.length === 0
    ) {
      fail(
        'report-visual-evidence-missing',
        `scenario ${scenario.scenarioId} has no required visual evidence`,
      )
    }
  }
  return true
}

export const checkVisualGovernance = async ({
  output = defaultOutput,
  candidateIdentityOverride,
} = {}) => {
  const assets = await loadComponentSurfaceSemanticRegistry({
    root: repositoryRoot,
    registryPath,
    schemaPath: registrySchemaPath,
  })
  await checkComponentSurfaceSemanticRegistry({ root: repositoryRoot })
  const candidateIdentity = candidateIdentityOverride ?? {
    repository: 'Ozwasyd/FsusUI',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      cwd: repositoryRoot,
    }).trim(),
  }
  const corpus = await runCorpus({ candidateIdentity })
  const report = await buildVisualGovernanceReport({
    candidateIdentity,
    registry: assets.registry,
    registrySchema: assets.schema,
    corpus,
  })
  const reportSchema = await readJson(reportSchemaPath)
  validateReportSchemaContract(reportSchema)
  validateVisualGovernanceReport(report, reportSchema)
  const resolvedOutput = path.resolve(repositoryRoot, output)
  await mkdir(path.dirname(resolvedOutput), { recursive: true })
  await writeFile(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

const isCli =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const outputArg = process.argv.indexOf('--output')
  const output =
    outputArg !== -1 && process.argv[outputArg + 1]
      ? process.argv[outputArg + 1]
      : defaultOutput
  try {
    const report = await checkVisualGovernance({ output })
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: report.schemaVersion,
          issue: report.issue,
          candidate: report.candidate,
          digests: report.digests,
          allowlistCount: report.allowlist.count,
          violationCount: report.baseline.violations.length,
          mutationSummary: report.mutationSummary,
          visualScenarioCount: report.visualScenarios.total,
          worktreeClean: report.worktreeClean,
          report: output,
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    process.stderr.write(
      `${error.code ?? 'visual-governance-check-failed'}: ${error.message}\n`,
    )
    process.exitCode = 1
  }
}
