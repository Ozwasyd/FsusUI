import assert from 'node:assert/strict'
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
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { compile } from 'sass'

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
const registeredTestIds = new Set()
let compiledProductionCss

const contractTest = (id, title, implementation) => {
  assert.match(id, /^CSR-402-\d{2}[A-F]?$/u)
  assert.ok(!registeredTestIds.has(id), `duplicate test id ${id}`)
  registeredTestIds.add(id)
  test(`${id} ${title}`, implementation)
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const loadProductionRegistry = async () => readJson(productionRegistryPath)

const productionCss = () => {
  compiledProductionCss ??= compile(productionThemePath, {
    loadPaths: [dirname(productionThemePath)],
    sourceMap: false,
    style: 'expanded',
  }).css
  return compiledProductionCss
}

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

const copyRegistrySources = async (registry, root) => {
  for (const source of Object.values(registry.sourceDigests)) {
    const target = join(root, source.path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(repositoryRoot, source.path), target)
  }
}

// This adapter only packages the production registry, its owned sources, the
// real compiled theme, and one mutation. Rule selection and expected values are
// always resolved from the production registry at runtime.
const evaluateFixture = async ({
  compiledPath = 'compiled/theme.css',
  mutation,
  mutations = mutation ? [mutation] : [],
} = {}) => {
  const registry = await loadProductionRegistry()
  const temporaryParent = await mkdtemp(join(tmpdir(), 'fsusui-rules-eval-'))
  const temporaryRoot = join(temporaryParent, 'fixture')
  await mkdir(join(temporaryRoot, 'entrypoints'), { recursive: true })
  await mkdir(join(temporaryRoot, 'mutations'), { recursive: true })
  await mkdir(dirname(join(temporaryRoot, compiledPath)), { recursive: true })
  await copyRegistrySources(registry, temporaryRoot)
  await copyFile(productionRegistryPath, join(temporaryRoot, 'registry.json'))
  await copyFile(
    productionSchemaPath,
    join(temporaryRoot, 'component-surface-semantic-registry.schema.json'),
  )
  await writeFile(join(temporaryRoot, compiledPath), productionCss())

  const relativeCompiledPath = relative(
    join(temporaryRoot, 'entrypoints'),
    join(temporaryRoot, compiledPath),
  )
    .split(sep)
    .join('/')
  const imports = [`@import "${relativeCompiledPath}";`]
  for (const mutationName of mutations) {
    const rendered = await renderMutation({
      name: mutationName,
      registry,
      root: temporaryRoot,
    })
    await writeFile(
      join(temporaryRoot, `mutations/${mutationName}`),
      rendered.css,
    )
    imports.push(`@import "../mutations/${mutationName}";`)
  }
  await writeFile(
    join(temporaryRoot, 'entrypoints/candidate.css'),
    `${imports.join('\n')}\n`,
  )

  try {
    const { evaluateSemanticStyles } =
      await import('../scripts/component-semantic-style-evaluator.mjs')
    assert.equal(typeof evaluateSemanticStyles, 'function')
    const analysis = await evaluateSemanticStyles({
      candidateIdentity: {
        repository: 'Ozwasyd/FsusUI',
        revision: registry.generated.sourceRevision,
      },
      entrypoint: 'entrypoints/candidate.css',
      sourceRoot: temporaryRoot,
    })
    return { analysis, registry }
  } finally {
    await rm(temporaryParent, { force: true, recursive: true })
  }
}

const assertEnvelope = (analysis) => {
  assert.deepEqual(Object.keys(analysis).sort(), [
    'compiledCssDigest',
    'diagnostics',
    'registryDigest',
    'staticUnknowns',
  ])
  assert.match(analysis.registryDigest, /^[a-f0-9]{64}$/u)
  assert.match(analysis.compiledCssDigest, /^[a-f0-9]{64}$/u)
  assert.ok(Array.isArray(analysis.diagnostics))
  assert.ok(Array.isArray(analysis.staticUnknowns))
}

const recordsForRule = (analysis, rule) => [
  ...analysis.diagnostics.filter(
    ({ componentId, partId }) =>
      componentId === rule.componentId && partId === rule.partId,
  ),
  ...analysis.staticUnknowns.filter(
    ({ componentId, partId }) =>
      componentId === rule.componentId && partId === rule.partId,
  ),
]

const findFailure = (analysis, rule, property) => {
  assertEnvelope(analysis)
  const failure = analysis.diagnostics.find(
    (candidate) =>
      candidate.componentId === rule.componentId &&
      candidate.partId === rule.partId &&
      candidate.property === property &&
      candidate.status === 'fail',
  )
  assert.ok(
    failure,
    `missing fail ${rule.id}/${property} from ${JSON.stringify(
      analysis.diagnostics,
      null,
      2,
    )}`,
  )
  return failure
}

const findExactFailure = (
  analysis,
  rule,
  { property, reasonCode, source, value },
) => {
  assertEnvelope(analysis)
  const failure = analysis.diagnostics.find(
    (candidate) =>
      candidate.ruleId === rule.id &&
      candidate.componentId === rule.componentId &&
      candidate.partId === rule.partId &&
      candidate.surfaceRole === rule.surfaceRole &&
      candidate.property === property &&
      candidate.status === 'fail' &&
      candidate.reasonCode === reasonCode &&
      candidate.actual?.source?.path === source &&
      candidate.actual?.value === value,
  )
  assert.ok(
    failure,
    `missing exact failure ${rule.id}/${property}/${reasonCode}/${value}`,
  )
  return failure
}

const withoutPathFields = (value) =>
  JSON.parse(
    JSON.stringify(value, (key, candidate) =>
      key === 'path' ? '<path>' : candidate,
    ),
  )

const newMutationCases = [
  {
    family: 'geometry',
    id: 'CSR-402-18A',
    mutation: 'row-panel-radius.css',
    property: 'border-radius',
    reasonCode: 'internal-row-panel-geometry-forbidden',
    value: async (registry) => {
      const contract = await readMutationContract('row-panel-radius.css')
      const referenceRule = findRule(registry, contract.referenceRuleId)
      const reference = referenceRule.constraints[contract.referenceFamily][0]
      const resolved = await resolveReference(repositoryRoot, reference)
      return `var(${resolved.aliases[0]})`
    },
  },
  {
    family: 'stateColor',
    id: 'CSR-402-18B',
    mutation: 'hover-selected-token.css',
    property: 'background-color',
    reasonCode: 'hover-selection-token-forbidden',
    value: async (registry) => {
      const contract = await readMutationContract('hover-selected-token.css')
      const referenceRule = findRule(registry, contract.referenceRuleId)
      const reference = referenceRule.constraints[contract.referenceFamily][0]
      const resolved = await resolveReference(repositoryRoot, reference)
      return `var(${resolved.aliases[0]})`
    },
  },
  {
    family: 'stateColor',
    id: 'CSR-402-18C',
    mutation: 'rate-selected-token.css',
    property: 'color',
    reasonCode: 'rate-warning-token-required',
    value: async (registry) => {
      const contract = await readMutationContract('rate-selected-token.css')
      const referenceRule = findRule(registry, contract.referenceRuleId)
      const reference = referenceRule.constraints[contract.referenceFamily][0]
      const resolved = await resolveReference(repositoryRoot, reference)
      return `var(${resolved.aliases[0]})`
    },
  },
  {
    family: 'disabled',
    id: 'CSR-402-18D',
    mutation: 'disabled-independent-colors.css',
    properties: ['background-color', 'color', 'border-color'],
    reasonCode: 'disabled-state-token-required',
    value: async () => 'hotpink',
  },
  {
    family: 'typography',
    id: 'CSR-402-18E',
    mutation: 'table-header-weight.css',
    property: 'font-weight',
    reasonCode: 'typography-semantic-mismatch',
    value: async () => '100',
  },
  {
    family: 'motion',
    id: 'CSR-402-18F',
    mutation: 'control-duration.css',
    property: 'transition-duration',
    reasonCode: 'motion-duration-semantic-mismatch',
    value: async () => '999ms',
  },
  {
    family: 'motion',
    id: 'CSR-402-19',
    mutation: 'reduced-zero-duration.css',
    property: 'transition-duration',
    reasonCode: 'reduced-motion-lifecycle-required',
    value: async () => '0ms',
  },
]

contractTest(
  'CSR-402-01',
  'consumes the production registry and maps every issue 293 through 310',
  async () => {
    const registry = await loadProductionRegistry()
    const mapping = await readJson(join(fixtureRoot, 'acceptance-mapping.json'))
    assert.equal(registry.rules.length, 45)
    assert.deepEqual(
      registry.issueMappings.map(({ issue }) => issue),
      Array.from({ length: 18 }, (_, index) => index + 293),
    )
    assert.ok(productionCss().includes('.el-select-dropdown__item'))

    assert.equal(mapping.issue, 402)
    assert.deepEqual(
      mapping.acceptanceCriteria.map(({ id }) => id),
      ['AC-402-1', 'AC-402-2', 'AC-402-3', 'AC-402-4', 'AC-402-5'],
    )
    assert.deepEqual(
      mapping.fixedConstraints.map(({ id }) => id),
      ['FC-402-A', 'FC-402-B', 'FC-402-C', 'FC-402-D'],
    )
    assert.deepEqual(
      mapping.issueCoverage.map(({ issue }) => issue),
      Array.from({ length: 18 }, (_, index) => index + 293),
    )
    const optionRule = findRule(registry, 'web.select.option-row')
    const optionHeight = await resolveReference(
      repositoryRoot,
      optionRule.constraints.geometry[0],
    )
    for (const entry of [
      ...mapping.acceptanceCriteria,
      ...mapping.fixedConstraints,
      ...mapping.issueCoverage,
    ]) {
      assert.ok(entry.testIds.length > 0, `${entry.id ?? entry.issue} unmapped`)
      for (const id of entry.testIds) {
        assert.ok(registeredTestIds.has(id), `${id} is not a registered test`)
      }
    }

    for (const name of [
      'ancestor-opacity.css',
      'control-duration.css',
      'disabled-independent-colors.css',
      'eleven-pixel-header.css',
      'hardcoded-duplicate-value.css',
      'hover-selected-token.css',
      'list-overtravel.css',
      'neutral-only-selected.css',
      'rate-selected-token.css',
      'reduced-zero-duration.css',
      'row-panel-radius.css',
      'strong-scale.css',
      'table-header-weight.css',
      'transition-none.css',
    ]) {
      const { css, ruleId } = await readMutationContract(name)
      findRule(registry, ruleId)
      assert.ok(
        !css.includes('.el-'),
        `${name} duplicates a production selector`,
      )
      assert.ok(
        !css.includes(optionHeight.value),
        `${name} duplicates a canonical value`,
      )
    }
  },
)

contractTest(
  'CSR-402-02',
  'keeps internal rows separate from legal outer panels',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    const row = findRule(registry, 'web.select.option-row')
    const panel = registry.rules.find(
      ({ surfaceRole }) => surfaceRole === 'overlay.panel-root',
    )
    assert.ok(panel, 'production registry has no legal overlay.panel-root rule')
    assert.notEqual(row.surfaceRole, panel.surfaceRole)
    assert.ok(recordsForRule(analysis, row).length > 0)
    assert.ok(recordsForRule(analysis, panel).length > 0)
    assert.ok(
      recordsForRule(analysis, row).every(
        ({ surfaceRole }) => surfaceRole === row.surfaceRole,
      ),
    )
    assert.ok(
      recordsForRule(analysis, panel).every(
        ({ surfaceRole }) => surfaceRole === panel.surfaceRole,
      ),
    )
  },
)

contractTest(
  'CSR-402-03',
  'executes every registered static rule family',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    for (const mapping of registry.issueMappings) {
      for (const ruleId of mapping.ruleIds) {
        const rule = findRule(registry, ruleId)
        if (rule.verificationPolicy.staticFields.length === 0) continue
        assert.ok(
          recordsForRule(analysis, rule).length > 0,
          `${rule.id} did not execute`,
        )
      }
    }
  },
)

contractTest(
  'CSR-402-04',
  'keeps selected hover and Rate semantics independently registered',
  async () => {
    const registry = await loadProductionRegistry()
    const selectionRuleIds = registry.issueMappings
      .filter(({ issue }) => [293, 296, 301].includes(issue))
      .flatMap(({ ruleIds }) => ruleIds)
    const selectionRules = selectionRuleIds
      .map((ruleId) => findRule(registry, ruleId))
      .filter(({ constraints }) => constraints.stateColor.length > 0)
    assert.ok(selectionRules.length >= 3)
    for (const rule of selectionRules) {
      assert.ok(rule.verificationPolicy.staticFields.includes('stateColor'))
    }
    const rateMapping = registry.issueMappings.find(
      ({ issue }) => issue === 302,
    )
    assert.ok(rateMapping)
    const rateRule = rateMapping.ruleIds
      .map((ruleId) => findRule(registry, ruleId))
      .find(({ constraints }) => constraints.stateColor.length > 0)
    assert.ok(rateRule)
    assert.ok(rateRule.constraints.stateColor.length > 0)
    assert.notDeepEqual(
      rateRule.constraints.stateColor,
      findRule(registry, 'web.select.option-row').constraints.stateColor,
    )
  },
)

contractTest(
  'CSR-402-05',
  'registers disabled roots separately from independently styled controls',
  async () => {
    const registry = await loadProductionRegistry()
    for (const mapping of registry.issueMappings.filter(({ issue }) =>
      [307, 309].includes(issue),
    )) {
      assert.ok(mapping.ruleIds.length >= 2, `issue ${mapping.issue}`)
      const roles = mapping.ruleIds.map(
        (ruleId) => findRule(registry, ruleId).surfaceRole,
      )
      assert.equal(new Set(roles).size, roles.length)
    }
  },
)

contractTest(
  'CSR-402-06',
  'registers task and Table typography without a shared literal',
  async () => {
    const registry = await loadProductionRegistry()
    for (const issue of [303, 304, 305, 306]) {
      const mapping = registry.issueMappings.find(
        (candidate) => candidate.issue === issue,
      )
      assert.ok(mapping)
      assert.ok(
        mapping.ruleIds.some((ruleId) =>
          findRule(registry, ruleId).verificationPolicy.staticFields.includes(
            'typography',
          ),
        ),
        `issue ${issue} has no static typography rule`,
      )
    }
  },
)

contractTest(
  'CSR-402-07',
  'executes motion rules including list travel and reduced lifecycle',
  async () => {
    const { analysis, registry } = await evaluateFixture({
      mutation: 'list-overtravel.css',
    })
    const { ruleId } = await readMutationContract('list-overtravel.css')
    const rule = findRule(registry, ruleId)
    const failure = findFailure(analysis, rule, 'transform')
    assert.equal(failure.reasonCode, 'list-travel-budget-exceeded')
    const reduced = registry.issueMappings.find(({ issue }) => issue === 310)
    assert.ok(reduced)
    assert.ok(
      reduced.ruleIds.some((id) =>
        findRule(registry, id).verificationPolicy.staticFields.includes(
          'motion',
        ),
      ),
    )
  },
)

contractTest(
  'CSR-402-08',
  'escalates visual-only motif and optical fields without static pass',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    assertEnvelope(analysis)
    const visualRules = registry.rules.filter(
      ({ verificationPolicy }) =>
        verificationPolicy.visualProbeFields.length > 0,
    )
    assert.ok(visualRules.length > 0)
    for (const unknown of analysis.staticUnknowns) {
      assert.ok(unknown.fields.length > 0)
      assert.ok(unknown.fields.every((field) => typeof field === 'string'))
      const rule = registry.rules.find(
        ({ componentId, partId }) =>
          componentId === unknown.componentId && partId === unknown.partId,
      )
      assert.ok(rule, `${unknown.componentId}/${unknown.partId}`)
      assert.deepEqual(
        unknown.visualRequirements,
        rule.verificationPolicy.visualRequirements,
      )
      assert.equal(unknown.status, 'visual-evidence-required')
    }
    assert.ok(
      visualRules.some((rule) => recordsForRule(analysis, rule).length > 0),
    )
  },
)

contractTest(
  'CSR-402-09',
  'keeps theme density and media scopes explicit',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    const scopedRules = registry.rules.filter(
      ({ scope }) =>
        scope.themes.length > 1 ||
        scope.densities.length > 1 ||
        scope.devices.length > 1,
    )
    assert.ok(scopedRules.length > 0)
    for (const rule of scopedRules) {
      const records = recordsForRule(analysis, rule)
      assert.ok(records.length > 0, `${rule.id} has no scoped evaluation`)
      for (const record of records) {
        assert.ok(record.scope)
        assert.ok(record.scope.theme)
        assert.ok(record.scope.density)
        assert.ok(record.scope.media)
      }
    }
  },
)

contractTest(
  'CSR-402-10',
  'reports role expected actual and source for a semantic failure',
  async () => {
    const { analysis, registry } = await evaluateFixture({
      mutation: 'ancestor-opacity.css',
    })
    const { ruleId } = await readMutationContract('ancestor-opacity.css')
    const rule = findRule(registry, ruleId)
    const failure = findFailure(analysis, rule, 'opacity')
    assert.equal(failure.surfaceRole, rule.surfaceRole)
    assert.ok(failure.expected.canonicalReference)
    assert.equal(failure.actual.value, '0.64')
    assert.equal(failure.actual.source.path, 'mutations/ancestor-opacity.css')
  },
)

for (const mutation of [
  {
    entrypoint: 'hardcoded-duplicate-value.css',
    id: 'CSR-402-11A',
    property: 'min-height',
    reasonCode: 'canonical-reference-required',
  },
  {
    entrypoint: 'neutral-only-selected.css',
    id: 'CSR-402-11B',
    property: 'color',
    reasonCode: 'selection-token-required',
  },
  {
    entrypoint: 'ancestor-opacity.css',
    id: 'CSR-402-11C',
    property: 'opacity',
    reasonCode: 'ancestor-opacity-disabled',
  },
  {
    entrypoint: 'eleven-pixel-header.css',
    id: 'CSR-402-11D',
    property: 'font-size',
    reasonCode: 'typography-semantic-mismatch',
  },
  {
    entrypoint: 'transition-none.css',
    id: 'CSR-402-11E',
    property: 'transition-duration',
    reasonCode: 'reduced-motion-lifecycle-required',
  },
  {
    entrypoint: 'strong-scale.css',
    id: 'CSR-402-11F',
    property: 'transform',
    reasonCode: 'strong-scale-forbidden',
  },
]) {
  contractTest(
    mutation.id,
    `kills the ${mutation.entrypoint} semantic mutation`,
    async () => {
      const { analysis, registry } = await evaluateFixture({
        mutation: mutation.entrypoint,
      })
      const { ruleId } = await readMutationContract(mutation.entrypoint)
      const failure = findFailure(
        analysis,
        findRule(registry, ruleId),
        mutation.property,
      )
      assert.equal(failure.reasonCode, mutation.reasonCode)
      assert.equal(
        failure.actual.source.path,
        `mutations/${mutation.entrypoint}`,
      )
    },
  )
}

contractTest(
  'CSR-402-12',
  'derives duplicate-value mutations from the production canonical reference',
  async () => {
    const registry = await loadProductionRegistry()
    const contract = await readMutationContract('hardcoded-duplicate-value.css')
    const rule = findRule(registry, contract.ruleId)
    const reference = rule.constraints.geometry[0]
    const canonical = await resolveReference(repositoryRoot, reference)
    const rendered = await renderMutation({
      name: 'hardcoded-duplicate-value.css',
      registry,
      root: repositoryRoot,
    })
    assert.ok(rendered.css.includes(`min-height: ${canonical.value}`))
    assert.ok(!contract.css.includes(canonical.value))
  },
)

contractTest(
  'CSR-402-13',
  'propagates visual requirements verbatim with string field names',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    const unknown = analysis.staticUnknowns.find(
      ({ visualRequirements }) => visualRequirements?.length > 0,
    )
    assert.ok(unknown)
    assert.ok(unknown.fields.every((field) => typeof field === 'string'))
    const rule = registry.rules.find(
      ({ componentId, partId }) =>
        componentId === unknown.componentId && partId === unknown.partId,
    )
    assert.ok(rule)
    assert.deepEqual(
      unknown.visualRequirements,
      rule.verificationPolicy.visualRequirements,
    )
  },
)

contractTest(
  'CSR-402-14',
  'does not let registry exceptions suppress current error mutations',
  async () => {
    for (const mutation of [
      ['hardcoded-duplicate-value.css', 'min-height'],
      ['neutral-only-selected.css', 'color'],
      ['ancestor-opacity.css', 'opacity'],
      ['eleven-pixel-header.css', 'font-size'],
      ['transition-none.css', 'transition-duration'],
      ['strong-scale.css', 'transform'],
    ]) {
      const { analysis, registry } = await evaluateFixture({
        mutation: mutation[0],
      })
      const { ruleId } = await readMutationContract(mutation[0])
      findFailure(analysis, findRule(registry, ruleId), mutation[1])
    }
  },
)

contractTest(
  'CSR-402-15',
  'preserves token focus form and motion gate entrypoints',
  async () => {
    const packageJson = await readJson(join(repositoryRoot, 'package.json'))
    for (const script of [
      'tokens:check',
      'tokens:lint',
      'check:focus-ring-contract',
      'check:form-state-contract',
      'governance:motion',
    ]) {
      assert.equal(
        typeof packageJson.scripts[script],
        'string',
        `${script} missing`,
      )
    }
    for (const path of [
      'scripts/check-focus-ring-contract.mjs',
      'scripts/check-form-state-contract.mjs',
      'scripts/check-motion-governance.mjs',
      'scripts/token-pipeline.mjs',
    ]) {
      assert.ok((await readFile(join(repositoryRoot, path), 'utf8')).length > 0)
    }
  },
)

contractTest(
  'CSR-402-16',
  'does not assign a notification close child radius to its legal outer panel',
  async () => {
    const { analysis, registry } = await evaluateFixture()
    const notification = findRule(registry, 'web.notification.overlay-root')
    const closeChildFalsePositives = analysis.diagnostics.filter(
      (candidate) =>
        candidate.ruleId === notification.id &&
        candidate.property === 'border-radius' &&
        candidate.selector.includes(
          '.el-notification__closeBtn:focus-visible',
        ) &&
        candidate.actual?.value === '999px',
    )
    assert.deepEqual(closeChildFalsePositives, [])
    assert.ok(
      analysis.diagnostics.some(
        (candidate) =>
          candidate.ruleId === notification.id &&
          candidate.property === 'border-radius' &&
          candidate.selector === primaryWebSelector(notification),
      ),
      'the legal notification panel itself was not evaluated',
    )

    const mutationCase = newMutationCases[0]
    const mutated = await evaluateFixture({
      mutation: mutationCase.mutation,
    })
    const contract = await readMutationContract(mutationCase.mutation)
    const row = findRule(mutated.registry, contract.ruleId)
    const failure = findExactFailure(mutated.analysis, row, {
      property: mutationCase.property,
      reasonCode: mutationCase.reasonCode,
      source: `mutations/${mutationCase.mutation}`,
      value: await mutationCase.value(mutated.registry),
    })
    assert.ok(failure.selector.includes(primaryWebSelector(row)))
    assert.ok(
      failure.selector.includes(
        primaryWebSelector(
          findRule(mutated.registry, contract.referenceRuleId),
        ),
      ),
      'descendant row violations must still be evaluated',
    )
  },
)

contractTest(
  'CSR-402-17',
  'requires concrete diagnostics for every registered static family',
  async () => {
    const { analysis, registry } = await evaluateFixture({
      mutations: newMutationCases.map(({ mutation }) => mutation),
    })
    const concreteFamilies = new Set()
    for (const mutationCase of newMutationCases) {
      const contract = await readMutationContract(mutationCase.mutation)
      const rule = findRule(registry, contract.ruleId)
      const properties = mutationCase.properties ?? [mutationCase.property]
      const value = await mutationCase.value(registry)
      for (const property of properties) {
        const failure = findExactFailure(analysis, rule, {
          property,
          reasonCode: mutationCase.reasonCode,
          source: `mutations/${mutationCase.mutation}`,
          value,
        })
        assert.notEqual(failure.reasonCode, 'semantic-rule-executed')
        assert.ok(failure.actual.source)
        assert.notEqual(failure.actual.value, null)
      }
      assert.ok(
        !analysis.diagnostics.some(
          (candidate) =>
            candidate.ruleId === rule.id &&
            candidate.reasonCode === 'semantic-rule-executed' &&
            candidate.actual?.source === null &&
            candidate.actual?.value === null,
        ),
        `${rule.id} used a null synthetic execution record`,
      )
      concreteFamilies.add(mutationCase.family)
    }
    assert.deepEqual(
      concreteFamilies,
      new Set(['geometry', 'stateColor', 'disabled', 'typography', 'motion']),
    )
  },
)

for (const mutationCase of newMutationCases) {
  contractTest(
    mutationCase.id,
    `reports the ${mutationCase.mutation} violation against its exact rule`,
    async () => {
      const { analysis, registry } = await evaluateFixture({
        mutation: mutationCase.mutation,
      })
      const contract = await readMutationContract(mutationCase.mutation)
      const rule = findRule(registry, contract.ruleId)
      const properties = mutationCase.properties ?? [mutationCase.property]
      const value = await mutationCase.value(registry)
      for (const property of properties) {
        const failure = findExactFailure(analysis, rule, {
          property,
          reasonCode: mutationCase.reasonCode,
          source: `mutations/${mutationCase.mutation}`,
          value,
        })
        assert.equal(failure.ruleId, rule.id)
        assert.equal(failure.status, 'fail')
      }
    },
  )
}

contractTest(
  'CSR-402-20',
  'keeps semantic results stable when compiled CSS is renamed',
  async () => {
    const original = await evaluateFixture({
      compiledPath: 'compiled/theme.css',
    })
    const renamed = await evaluateFixture({
      compiledPath: 'assets/renamed-theme.css',
    })

    assert.equal(
      original.analysis.registryDigest,
      renamed.analysis.registryDigest,
    )
    assert.equal(
      original.analysis.diagnostics.length,
      renamed.analysis.diagnostics.length,
    )
    assert.deepEqual(
      original.analysis.diagnostics.map(({ status }) => status),
      renamed.analysis.diagnostics.map(({ status }) => status),
    )
    assert.deepEqual(
      withoutPathFields(original.analysis.diagnostics),
      withoutPathFields(renamed.analysis.diagnostics),
    )
    assert.deepEqual(
      withoutPathFields(original.analysis.staticUnknowns),
      withoutPathFields(renamed.analysis.staticUnknowns),
    )
    assert.ok(
      original.analysis.diagnostics.some(
        ({ actual }) => actual?.source?.path === 'compiled/theme.css',
      ),
    )
    assert.ok(
      renamed.analysis.diagnostics.some(
        ({ actual }) => actual?.source?.path === 'assets/renamed-theme.css',
      ),
    )
  },
)
