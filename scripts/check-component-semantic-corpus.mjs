import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath, URL } from 'node:url'

import { compile } from 'sass'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = join(
  repositoryRoot,
  'tests/fixtures/component-semantic-rules',
)
const productionRegistryPath = join(
  repositoryRoot,
  'spec/components/component-surface-semantic-registry.json',
)
const productionSchemaPath = join(
  repositoryRoot,
  'spec/components/component-surface-semantic-registry.schema.json',
)
const productionThemePath = join(
  repositoryRoot,
  'vue/packages/theme-chalk/src/index.scss',
)

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const loadProductionRegistry = async () => readJson(productionRegistryPath)

const findRule = (registry, ruleId) => {
  const rule = registry.rules.find(({ id }) => id === ruleId)
  assert.ok(rule, `production registry is missing ${ruleId}`)
  return rule
}

const primaryWebSelector = (rule) => {
  const selector = rule.selectorOwnership.selectors.find(
    ({ platform }) => platform === 'web',
  )?.selector
  assert.ok(selector, `${rule.id} has no owned web selector`)
  return selector
}

const decodePointerSegment = (segment) =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~')

const resolveReference = async (root, reference) => {
  const document = await readJson(join(root, reference.path))
  const segments = reference.pointer
    .split('/')
    .slice(1)
    .map(decodePointerSegment)
  let value = document
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    if (Array.isArray(value)) {
      const name = segments.slice(index).join('.')
      value = value.find((candidate) => candidate?.name === name)
      assert.ok(value, `${reference.pointer} does not resolve token ${name}`)
      return value
    }
    value = value?.[segment]
    assert.notEqual(value, undefined, `${reference.pointer} does not resolve`)
  }
  return value
}

const readMutationContract = async (name) => {
  const css = await readFile(join(fixtureRoot, `mutations/${name}`), 'utf8')
  const ruleId = css.match(/fsus-rule-id:\s*([^\s*]+)/u)?.[1]
  assert.ok(ruleId, `${name} is missing fsus-rule-id metadata`)
  return {
    css,
    referenceFamily: css.match(/fsus-reference-family:\s*([^\s*]+)/u)?.[1],
    referenceRuleId: css.match(/fsus-reference-rule-id:\s*([^\s*]+)/u)?.[1],
    ruleId,
  }
}

const renderMutation = async ({ name, registry, root }) => {
  const { css, referenceFamily, referenceRuleId, ruleId } =
    await readMutationContract(name)
  const rule = findRule(registry, ruleId)
  let rendered = css.replaceAll('__RULE_SELECTOR__', primaryWebSelector(rule))
  if (referenceRuleId) {
    const referenceRule = findRule(registry, referenceRuleId)
    rendered = rendered.replaceAll(
      '__REFERENCE_SELECTOR__',
      primaryWebSelector(referenceRule),
    )
    if (rendered.includes('__REFERENCE_ALIAS__')) {
      assert.ok(referenceFamily, `${name} is missing fsus-reference-family`)
      const reference = referenceRule.constraints[referenceFamily][0]
      const resolved = await resolveReference(root, reference)
      const alias = resolved.aliases?.[0]
      assert.equal(typeof alias, 'string')
      rendered = rendered.replaceAll('__REFERENCE_ALIAS__', alias)
    }
  }
  if (rendered.includes('__CANONICAL_VALUE__')) {
    const reference = rule.constraints.geometry[0]
    const resolved = await resolveReference(root, reference)
    assert.equal(typeof resolved.value, 'string')
    rendered = rendered.replaceAll('__CANONICAL_VALUE__', resolved.value)
  }
  assert.doesNotMatch(
    rendered,
    /__(?:RULE_SELECTOR|REFERENCE_SELECTOR|REFERENCE_ALIAS|CANONICAL_VALUE)__/u,
  )
  return { css: rendered, rule }
}

const productionCss = () =>
  compile(productionThemePath, {
    loadPaths: [dirname(productionThemePath)],
    sourceMap: false,
    style: 'expanded',
  }).css

const createFixtureRoot = async () => {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'fsusui-corpus-'))
  const root = join(temporaryParent, 'fixture')
  const registry = await loadProductionRegistry()
  await mkdir(join(root, 'entrypoints'), { recursive: true })
  await mkdir(join(root, 'mutations'), { recursive: true })
  await mkdir(join(root, 'compiled'), { recursive: true })
  for (const source of Object.values(registry.sourceDigests)) {
    const target = join(root, source.path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(repositoryRoot, source.path), target)
  }
  await copyFile(productionRegistryPath, join(root, 'registry.json'))
  await copyFile(
    productionSchemaPath,
    join(root, 'component-surface-semantic-registry.schema.json'),
  )
  await writeFile(join(root, 'compiled/theme.css'), productionCss())
  return { parent: temporaryParent, registry, root }
}

const evaluate = async ({ candidateIdentity, root, mutation }) => {
  if (mutation) {
    const rendered = await renderMutation({
      name: mutation,
      registry: await loadProductionRegistry(),
      root,
    })
    await writeFile(join(root, `mutations/${mutation}`), rendered.css)
  }
  const relativeCompiledPath = relative(
    join(root, 'entrypoints'),
    join(root, 'compiled/theme.css'),
  )
    .split(sep)
    .join('/')
  const imports = [`@import "${relativeCompiledPath}";`]
  if (mutation) imports.push(`@import "../mutations/${mutation}";`)
  await writeFile(
    join(root, 'entrypoints/candidate.css'),
    `${imports.join('\n')}\n`,
  )
  const { evaluateSemanticStyles } =
    await import('./component-semantic-style-evaluator.mjs')
  return evaluateSemanticStyles({
    candidateIdentity,
    entrypoint: 'entrypoints/candidate.css',
    sourceRoot: root,
  })
}

const failuresForMutation = (analysis, mutation) =>
  analysis.diagnostics.filter(
    (candidate) =>
      candidate.status === 'fail' &&
      candidate.actual?.source?.path === `mutations/${mutation}`,
  )

export const assertCaseKilled = (analysis, corpusCase) => {
  const failures = failuresForMutation(analysis, corpusCase.mutation)
  const matched = failures.filter(
    (candidate) =>
      candidate.ruleId === corpusCase.ruleId &&
      (corpusCase.property
        ? candidate.property === corpusCase.property
        : true) &&
      (corpusCase.reasonCode
        ? candidate.reasonCode === corpusCase.reasonCode
        : true),
  )
  assert.ok(
    matched.length > 0,
    [
      `${corpusCase.id} (${corpusCase.mutation}) was not killed by ${corpusCase.ruleId}`,
      `property=${corpusCase.property ?? 'any'}`,
      `reasonCode=${corpusCase.reasonCode ?? 'any'}`,
      `observed fails from mutation: ${JSON.stringify(
        failures.map((candidate) => ({
          ruleId: candidate.ruleId,
          property: candidate.property,
          reasonCode: candidate.reasonCode,
          value: candidate.actual?.value,
        })),
      )}`,
    ].join('\n'),
  )
  return matched
}

export const assertPositiveGreen = (analysis, positive) => {
  const failures = failuresForMutation(analysis, positive.mutation)
  assert.deepEqual(
    failures.map((candidate) => ({
      property: candidate.property,
      reasonCode: candidate.reasonCode,
      ruleId: candidate.ruleId,
      value: candidate.actual?.value,
    })),
    [],
    `${positive.id} (${positive.mutation}) must stay green`,
  )
  return true
}

const gitStatus = async () => {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: repositoryRoot,
  })
  return stdout
}

export const renderRequirementsFor = (rule, unknown) => {
  const requirements = []
  const surfaceRole = rule.surfaceRole
  const selectorText =
    unknown.selector ?? rule.selectorOwnership.selectors[0].selector
  if (
    /(?:overlay|panel|card|surface)/u.test(surfaceRole) ||
    rule.constraints.surfaceCardMotif.length > 0
  ) {
    requirements.push({
      id: 'card-stack',
      requirement: `render ${rule.componentId}/${rule.partId} with sibling overlay/panel layers in the same viewport and record z-order, elevation, overlap, and edge alignment for each theme/density combination`,
    })
  }
  if (
    rule.constraints.surfaceCardMotif.length > 0 ||
    unknown.fields?.includes('surfaceCardMotif')
  ) {
    requirements.push({
      id: 'motif-repetition',
      requirement: `render at least two adjacent motif instances of ${rule.componentId}/${rule.partId} and record spacing, alignment, radius, and emphasis consistency`,
    })
  }
  if (
    rule.constraints.stateColor.length > 0 ||
    /(?:selected|checked|current)/u.test(selectorText)
  ) {
    requirements.push({
      id: 'focus-selected-layering',
      requirement: `render focus-visible over the selected/checked state of ${rule.componentId}/${rule.partId} and record token identity, contrast, and visual layering without hover impersonation`,
    })
  }
  if (rule.componentId === 'web.date-picker') {
    requirements.push({
      id: 'range-continuity',
      requirement: `render a contiguous start/mid/end date range and record cell radius, background, and text continuity across hover/selected/today states`,
    })
  }
  requirements.push({
    id: 'semantic-evidence-capture',
    requirement: `render every state/theme/viewport/zoom/input combination for ${rule.componentId}/${rule.partId} and capture the expectedSemanticEvidence references without automated aesthetic scoring`,
  })
  return requirements
}

export const planVisualScenarios = ({
  analysis,
  registry,
  candidateIdentity,
}) => {
  const scenarios = []
  for (const unknown of analysis.staticUnknowns) {
    const rule = registry.rules.find(
      ({ componentId, partId }) =>
        componentId === unknown.componentId && partId === unknown.partId,
    )
    assert.ok(
      rule,
      `static unknown ${unknown.componentId}/${unknown.partId} has no canonical rule`,
    )
    const visualRequirements = unknown.visualRequirements ?? []
    assert.ok(
      visualRequirements.length > 0,
      `${rule.id} has no visual requirement`,
    )
    visualRequirements.forEach((visualRequirement, index) => {
      scenarios.push({
        scenarioId:
          visualRequirements.length === 1
            ? `${rule.id}.${visualRequirement.id}`
            : `${rule.id}.${visualRequirement.id}.${index}`,
        status: 'blocking',
        componentId: rule.componentId,
        partId: rule.partId,
        ruleId: rule.id,
        selector:
          unknown.selector ?? rule.selectorOwnership.selectors[0].selector,
        scope: unknown.scope,
        fields: [...(unknown.fields ?? [])],
        verificationRequirement: unknown.verificationRequirement,
        reasonCode: unknown.reasonCode,
        states: [...visualRequirement.states],
        themes: [...visualRequirement.themes],
        viewports: visualRequirement.viewports.map((viewport) => ({
          ...viewport,
        })),
        zooms: [...visualRequirement.zooms],
        inputs: [...visualRequirement.inputs],
        expectedSemanticEvidence:
          visualRequirement.expectedSemanticEvidence.map((evidence) => ({
            ...evidence,
          })),
        renderRequirements: renderRequirementsFor(rule, unknown),
        candidateIdentity: { ...candidateIdentity },
      })
    })
  }
  return scenarios
}

export const verifyCorpusCoverage = async (corpus, registry) => {
  const byId = new Map(
    corpus.cases.map((corpusCase) => [corpusCase.id, corpusCase]),
  )
  assert.equal(byId.size, corpus.cases.length, 'duplicate corpus case id')
  for (const corpusCase of corpus.cases) {
    findRule(registry, corpusCase.ruleId)
    const contract = await readMutationContract(corpusCase.mutation)
    assert.equal(
      contract.ruleId,
      corpusCase.ruleId,
      `${corpusCase.id} rule metadata mismatch`,
    )
  }
  for (const positive of corpus.positiveFixtures) {
    findRule(registry, positive.ruleId)
    const contract = await readMutationContract(positive.mutation)
    assert.equal(
      contract.ruleId,
      positive.ruleId,
      `${positive.id} rule metadata mismatch`,
    )
  }
  const covered = new Map(
    corpus.issueCoverage.map(({ issue, caseIds }) => [issue, caseIds]),
  )
  for (let issue = 293; issue <= 310; issue += 1) {
    const caseIds = covered.get(issue)
    assert.ok(
      Array.isArray(caseIds) && caseIds.length > 0,
      `issue ${issue} has no corpus case`,
    )
    for (const caseId of caseIds) {
      const corpusCase = byId.get(caseId)
      assert.ok(corpusCase, `issue ${issue} references unknown case ${caseId}`)
      assert.ok(
        corpusCase.issues.includes(issue),
        `${caseId} does not claim issue ${issue}`,
      )
    }
  }
  return true
}

export const runCorpus = async ({ candidateIdentity, verify = true } = {}) => {
  const corpus = await readJson(join(fixtureRoot, 'corpus.json'))
  const registry = await loadProductionRegistry()
  const before = await gitStatus()
  const { parent, root } = await createFixtureRoot()
  try {
    if (verify) await verifyCorpusCoverage(corpus, registry)
    const baseline = await evaluate({ candidateIdentity, root })
    const scenarios = planVisualScenarios({
      analysis: baseline,
      candidateIdentity,
      registry,
    })
    const cases = []
    for (const corpusCase of corpus.cases) {
      const analysis = await evaluate({
        candidateIdentity,
        mutation: corpusCase.mutation,
        root,
      })
      const failures = verify
        ? assertCaseKilled(analysis, corpusCase)
        : failuresForMutation(analysis, corpusCase.mutation).filter(
            (candidate) => candidate.ruleId === corpusCase.ruleId,
          )
      cases.push({
        id: corpusCase.id,
        mutation: corpusCase.mutation,
        ruleId: corpusCase.ruleId,
        killed: failures.length > 0,
        failures: failures.map((candidate) => ({
          ruleId: candidate.ruleId,
          componentId: candidate.componentId,
          partId: candidate.partId,
          property: candidate.property,
          reasonCode: candidate.reasonCode,
          selector: candidate.selector,
          scope: candidate.scope,
          expected: candidate.expected,
          actual: candidate.actual,
        })),
      })
    }
    const positiveFixtures = []
    for (const positive of corpus.positiveFixtures) {
      const analysis = await evaluate({
        candidateIdentity,
        mutation: positive.mutation,
        root,
      })
      const failures = failuresForMutation(analysis, positive.mutation)
      if (verify) assertPositiveGreen(analysis, positive)
      positiveFixtures.push({
        id: positive.id,
        mutation: positive.mutation,
        ruleId: positive.ruleId,
        green: failures.length === 0,
        failures: failures.map((candidate) => ({
          ruleId: candidate.ruleId,
          property: candidate.property,
          reasonCode: candidate.reasonCode,
          selector: candidate.selector,
          actual: candidate.actual?.value,
        })),
      })
    }
    const after = await gitStatus()
    const worktreeClean = before === after
    assert.equal(before, after, 'corpus run polluted the worktree')
    return {
      candidateIdentity,
      baseline: {
        compiledCssDigest: baseline.compiledCssDigest,
        registryDigest: baseline.registryDigest,
        diagnostics: baseline.diagnostics,
        staticUnknowns: baseline.staticUnknowns,
      },
      cases,
      positiveFixtures,
      scenarios,
      worktreeClean,
    }
  } finally {
    await rm(parent, { force: true, recursive: true })
  }
}

const summarize = (report) => ({
  candidateIdentity: report.candidateIdentity,
  baseline: {
    compiledCssDigest: report.baseline.compiledCssDigest,
    registryDigest: report.baseline.registryDigest,
    diagnostics: report.baseline.diagnostics.length,
    staticUnknowns: report.baseline.staticUnknowns.length,
    failSources: [
      ...new Set(
        report.baseline.diagnostics
          .filter(({ status }) => status === 'fail')
          .map(({ actual }) => actual?.source?.path),
      ),
    ],
  },
  cases: report.cases.map(({ id, mutation, ruleId, killed, failures }) => ({
    id,
    mutation,
    ruleId,
    killed,
    failureCount: failures.length,
    reasonCodes: [
      ...new Set(failures.map(({ reasonCode }) => reasonCode).filter(Boolean)),
    ],
  })),
  positiveFixtures: report.positiveFixtures.map(
    ({ id, mutation, ruleId, green }) => ({ id, mutation, ruleId, green }),
  ),
  scenarios: report.scenarios.length,
  worktreeClean: report.worktreeClean,
})

const isCli =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const repository = 'Ozwasyd/FsusUI'
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
  })
  const report = await runCorpus({
    candidateIdentity: {
      repository,
      revision: stdout.trim(),
    },
  })
  const summary = summarize(report)
  const failedCases = summary.cases.filter((corpusCase) => !corpusCase.killed)
  const failedPositives = summary.positiveFixtures.filter(
    (positive) => !positive.green,
  )
  const failed =
    !summary.worktreeClean ||
    failedCases.length > 0 ||
    failedPositives.length > 0
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (failed) {
    console.error(
      [
        'component semantic corpus check failed',
        ...failedCases.map((corpusCase) => `${corpusCase.id} not killed`),
        ...failedPositives.map((positive) => `${positive.id} not green`),
        ...(summary.worktreeClean ? [] : ['worktree polluted']),
      ].join('\n'),
    )
    process.exitCode = 1
  }
}
