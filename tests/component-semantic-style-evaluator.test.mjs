import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'

import { format, resolveConfig } from 'prettier'
import { compile } from 'sass'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = join(
  repositoryRoot,
  'tests/fixtures/component-semantic-style-evaluator',
)
const registeredTestIds = new Set()
const authorityPaths = [
  'docs/design.md',
  'spec/tokens/tokens.json',
  'spec/components/contracts/v1/vue-public-contracts.json',
]

const contractTest = (id, title, implementation) => {
  assert.match(id, /^CSC-401-\d{2}[A-Z]?$/u)
  assert.ok(!registeredTestIds.has(id), `duplicate test id ${id}`)
  registeredTestIds.add(id)
  test(`${id} ${title}`, implementation)
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const resolveRegistryRoot = async () => {
  const configured = process.env.FSUSUI_400_ROOT
  const root = configured ? join(configured) : repositoryRoot
  try {
    await access(
      join(root, 'scripts/check-component-surface-semantic-registry.mjs'),
    )
    await access(
      join(
        root,
        'spec/components/component-surface-semantic-registry.schema.json',
      ),
    )
  } catch {
    const error = new Error(
      'corrected #400 checker/schema unavailable; set FSUSUI_400_ROOT',
    )
    error.code = 'fsusui-400-integration-required'
    throw error
  }
  return root
}

const loadRegistryValidator = async () => {
  const root = await resolveRegistryRoot()
  const subject = await import(
    pathToFileURL(
      join(root, 'scripts/check-component-surface-semantic-registry.mjs'),
    )
  )
  return { root, subject }
}

const copyAuthorities = async (root, authorityRoot) => {
  for (const path of authorityPaths) {
    const destination = join(root, path)
    await mkdir(dirname(destination), { recursive: true })
    await cp(join(authorityRoot, path), destination)
  }
}

const createRuntimeFixture = async (source = fixtureRoot) => {
  const temporaryParent = await mkdtemp(join(tmpdir(), 'fsusui-401-fixture-'))
  const root = join(temporaryParent, 'fixture')
  await cp(source, root, { recursive: true })
  await copyAuthorities(root, await resolveRegistryRoot())
  return { root, temporaryParent }
}

const loadEngine = async () => {
  const subject =
    await import('../scripts/component-semantic-style-evaluator.mjs')
  assert.deepEqual(Object.keys(subject), ['evaluateSemanticStyles'])
  return subject
}

const candidateIdentity = {
  repository: 'Ozwasyd/FsusUI',
  revision: '700e484b5fb78e934b2d9c702b6951a45047be8a',
}

const analyzeFixture = async ({ entrypoint = 'base.css', root } = {}) => {
  let temporaryParent
  if (!root) ({ root, temporaryParent } = await createRuntimeFixture())
  try {
    const { evaluateSemanticStyles } = await loadEngine()
    assert.equal(typeof evaluateSemanticStyles, 'function')
    return await evaluateSemanticStyles({
      candidateIdentity,
      entrypoint: `entrypoints/${entrypoint}`,
      sourceRoot: root,
    })
  } finally {
    if (temporaryParent) {
      await rm(temporaryParent, { force: true, recursive: true })
    }
  }
}

const assertEnvelope = (analysis) => {
  assert.match(analysis.registryDigest, /^[a-f0-9]{64}$/u)
  assert.match(analysis.compiledCssDigest, /^[a-f0-9]{64}$/u)
  assert.ok(Array.isArray(analysis.diagnostics))
  assert.ok(Array.isArray(analysis.staticUnknowns))
  assert.deepEqual(Object.keys(analysis).sort(), [
    'compiledCssDigest',
    'diagnostics',
    'registryDigest',
    'staticUnknowns',
  ])
}

const findDiagnostic = (analysis, predicate, label) => {
  assertEnvelope(analysis)
  const evaluation = analysis.diagnostics.find(predicate)
  assert.ok(
    evaluation,
    `${label} missing from ${JSON.stringify(analysis.diagnostics, null, 2)}`,
  )
  return evaluation
}

const rowMinHeight = (analysis, extra = () => true) =>
  findDiagnostic(
    analysis,
    (evaluation) =>
      evaluation.componentId === 'web.select' &&
      evaluation.partId === 'option-row' &&
      evaluation.property === 'min-height' &&
      extra(evaluation),
    'Select option-row min-height evaluation',
  )

const semanticLength = (value, expected) => {
  assert.deepEqual(value, {
    kind: 'length',
    unit: 'px',
    value: expected,
  })
}

const synchronizeRegisteredDigest = async (root, sourcePath) => {
  const registryPath = join(root, 'registry.json')
  const registry = await readJson(registryPath)
  const source = Object.values(registry.sourceDigests).find(
    (candidate) => candidate.path === sourcePath,
  )
  assert.ok(source, `${sourcePath} is not registered`)
  source.digest = createHash('sha256')
    .update(await readFile(join(root, sourcePath)))
    .digest('hex')
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
}

const rowStaticUnknown = (analysis, sourcePath) => {
  assertEnvelope(analysis)
  const evaluation = analysis.staticUnknowns.find(
    (candidate) =>
      candidate.componentId === 'web.select' &&
      candidate.partId === 'option-row' &&
      candidate.property === 'min-height' &&
      candidate.actual.source.path === sourcePath,
  )
  assert.ok(evaluation, `${sourcePath} did not produce a static unknown`)
  return evaluation
}

const selectedBackground = (analysis, extra = () => true) =>
  findDiagnostic(
    analysis,
    (evaluation) =>
      evaluation.componentId === 'web.select' &&
      evaluation.partId === 'option-row' &&
      evaluation.property === 'background-color' &&
      extra(evaluation),
    'Select option-row selected background evaluation',
  )

const treeDigest = async (root) => {
  const digest = createHash('sha256')

  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      digest.update(relative(root, path))
      digest.update(await readFile(path))
    }
  }

  await visit(root)
  return digest.digest('hex')
}

contractTest(
  'CSC-401-01',
  'fixtures pass the corrected #400 checker and are real Sass compilations',
  async (t) => {
    const { root, subject } = await loadRegistryValidator()
    const runtime = await createRuntimeFixture()
    t.after(() => rm(runtime.temporaryParent, { force: true, recursive: true }))
    const preflight = await subject.checkComponentSurfaceSemanticRegistry({
      root: runtime.root,
      registryPath: 'registry.json',
      schemaPath: join(
        root,
        'spec/components/component-surface-semantic-registry.schema.json',
      ),
    })
    assert.deepEqual(preflight.violations, [])
    assert.equal(preflight.ruleCount, 2)
    assert.equal(preflight.issueMappingCount, 18)
    assert.deepEqual(preflight.writePaths, [])
    assert.deepEqual(preflight.executedCommands, [])

    for (const name of ['select', 'fsus-theme']) {
      const sourcePath = join(fixtureRoot, `source/${name}.scss`)
      const compiledPath = join(fixtureRoot, `compiled/${name}.css`)
      const compiled = await format(
        compile(sourcePath, {
          loadPaths: [dirname(sourcePath)],
          sourceMap: false,
          style: 'expanded',
        }).css,
        {
          ...(await resolveConfig(compiledPath)),
          parser: 'css',
        },
      )
      assert.equal(compiled, await readFile(compiledPath, 'utf8'))
    }

    const mapping = await readJson(join(fixtureRoot, 'acceptance-mapping.json'))
    const registry = await readJson(join(fixtureRoot, 'registry.json'))
    assert.equal(mapping.issue, 401)
    assert.equal(
      registry.schemaVersion,
      'fsusui.component-surface-semantic-registry.v1',
    )
    assert.equal(
      basename(registry.$schema),
      'component-surface-semantic-registry.schema.json',
    )
    const sourcePaths = Object.values(registry.sourceDigests).map(
      (source) => source.path,
    )
    assert.equal(new Set(sourcePaths).size, sourcePaths.length)
    for (const [sourceId, source] of Object.entries(registry.sourceDigests)) {
      assert.deepEqual(Object.keys(source).sort(), [
        'algorithm',
        'digest',
        'kind',
        'path',
      ])
      assert.equal(source.algorithm, 'sha256')
      assert.match(source.digest, /^[a-f0-9]{64}$/u)
      assert.ok(!isAbsolute(source.path))
      assert.ok(!source.path.split('/').includes('..'))
      if (source.kind === 'authority') {
        assert.ok(!/\.(?:css|scss)$/u.test(source.path))
      } else {
        assert.equal(source.kind, 'implementation')
        assert.match(source.path, /\.(?:css|scss)$/u)
      }
      const sourceRoot = source.kind === 'authority' ? root : fixtureRoot
      const digest = createHash('sha256')
        .update(await readFile(join(sourceRoot, source.path)))
        .digest('hex')
      assert.equal(digest, source.digest, sourceId)
    }
    for (const rule of registry.rules) {
      const sourceIds = new Set(
        rule.canonicalSources.map((source) => source.sourceId),
      )
      for (const required of [
        'design-contract',
        'token-contract',
        'component-contracts',
      ]) {
        assert.ok(sourceIds.has(required), `${rule.id} missing ${required}`)
      }
      for (const source of [
        ...rule.selectorOwnership.selectors.map((entry) => entry.source),
        ...rule.sourceOwnership.sources,
      ]) {
        assert.equal(
          registry.sourceDigests[source.sourceId].kind,
          'implementation',
        )
        assert.equal(source.path, registry.sourceDigests[source.sourceId].path)
      }
      assert.ok(
        rule.selectorOwnership.selectors.every(({ selector }) =>
          selector.startsWith('.el-'),
        ),
      )
      for (const source of rule.canonicalSources) {
        assert.equal(registry.sourceDigests[source.sourceId].kind, 'authority')
        assert.equal(source.path, registry.sourceDigests[source.sourceId].path)
      }
      assert.deepEqual(Object.keys(rule.constraints).sort(), [
        'disabled',
        'geometry',
        'motion',
        'stateColor',
        'surfaceCardMotif',
        'typography',
      ])
      assert.deepEqual(
        new Set([
          ...rule.verificationPolicy.staticFields,
          ...rule.verificationPolicy.visualProbeFields,
        ]),
        new Set(Object.keys(rule.constraints)),
      )
      assert.ok(
        rule.verificationPolicy.staticFields.every(
          (field) => !rule.verificationPolicy.visualProbeFields.includes(field),
        ),
      )
      assert.ok(Array.isArray(rule.verificationPolicy.visualRequirements))
      assert.ok(rule.verificationPolicy.visualRequirements.length > 0)
      assert.ok(rule.verificationPolicy.staticFields.includes('stateColor'))
      assert.deepEqual(rule.verificationPolicy.visualProbeFields, [
        'surfaceCardMotif',
      ])
      for (const requirement of rule.verificationPolicy.visualRequirements) {
        assert.deepEqual(Object.keys(requirement).sort(), [
          'expectedSemanticEvidence',
          'id',
          'inputs',
          'states',
          'themes',
          'viewports',
          'zooms',
        ])
        assert.ok(requirement.id.length > 0)
        for (const axis of ['states', 'themes', 'inputs']) {
          assert.ok(requirement[axis].length > 0)
          assert.ok(
            requirement[axis].every(
              (value) => typeof value === 'string' && value.length > 0,
            ),
          )
        }
        assert.ok(requirement.viewports.length > 0)
        for (const viewport of requirement.viewports) {
          assert.deepEqual(Object.keys(viewport).sort(), [
            'height',
            'id',
            'width',
          ])
          assert.ok(viewport.id.length > 0)
          assert.ok(Number.isInteger(viewport.width) && viewport.width > 0)
          assert.ok(Number.isInteger(viewport.height) && viewport.height > 0)
        }
        assert.ok(requirement.zooms.length > 0)
        assert.ok(
          requirement.zooms.every((zoom) => Number.isInteger(zoom) && zoom > 0),
        )
        assert.ok(requirement.expectedSemanticEvidence.length > 0)
        for (const source of requirement.expectedSemanticEvidence) {
          assert.deepEqual(Object.keys(source).sort(), [
            'path',
            'pointer',
            'sourceId',
          ])
          assert.equal(
            registry.sourceDigests[source.sourceId].kind,
            'authority',
          )
          assert.equal(
            source.path,
            registry.sourceDigests[source.sourceId].path,
          )
        }
      }
      for (const references of Object.values(rule.constraints)) {
        for (const reference of references) {
          assert.deepEqual(Object.keys(reference).sort(), [
            'path',
            'pointer',
            'sourceId',
          ])
          assert.equal(
            reference.path,
            registry.sourceDigests[reference.sourceId].path,
          )
          assert.equal(
            registry.sourceDigests[reference.sourceId].kind,
            'authority',
          )
        }
      }
      for (const dimension of Object.values(rule.scope)) {
        assert.ok(!dimension.includes('*'))
      }
    }
    for (const issueMapping of registry.issueMappings) {
      assert.ok(issueMapping.issue >= 293 && issueMapping.issue <= 310)
      const roles = issueMapping.ruleIds.map(
        (ruleId) =>
          registry.rules.find((rule) => rule.id === ruleId).surfaceRole,
      )
      assert.deepEqual(new Set(issueMapping.semanticRoles), new Set(roles))
    }
    assert.deepEqual(
      mapping.acceptanceCriteria.map((criterion) => criterion.id),
      Array.from({ length: 13 }, (_, index) => `AC-401-${index + 1}`),
    )
    assert.deepEqual(
      mapping.fixedConstraints.map((constraint) => constraint.id),
      ['FC-401-A', 'FC-401-B', 'FC-401-C', 'FC-401-D'],
    )
    for (const entry of [
      ...mapping.acceptanceCriteria,
      ...mapping.fixedConstraints,
    ]) {
      assert.ok(entry.testIds.length > 0, `${entry.id} has no test mapping`)
      for (const id of entry.testIds) {
        assert.ok(registeredTestIds.has(id), `${entry.id} maps unknown ${id}`)
      }
    }
    const mappedTestIds = new Set(
      [...mapping.acceptanceCriteria, ...mapping.fixedConstraints].flatMap(
        ({ testIds }) => testIds,
      ),
    )
    assert.equal(registeredTestIds.size, 30)
    assert.deepEqual(mappedTestIds, registeredTestIds)
  },
)

contractTest(
  'CSC-401-02',
  'detects a compliant Sass source overridden by wrong compiled output',
  async () => {
    const analysis = await analyzeFixture({
      entrypoint: 'source-only-compiled-override.css',
    })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) => candidate.status === 'fail',
    )

    assert.equal(
      evaluation.actual.source.path,
      'mutations/source-only-compiled-override.css',
    )
    assert.equal(evaluation.actual.source.line, 2)
    assert.equal(evaluation.actual.value, 'calc(30px + 2px)')
    semanticLength(evaluation.actual.semanticValue, 32)
  },
)

contractTest(
  'CSC-401-03',
  'reports component role selector source canonical reference and actual cascade',
  async () => {
    const analysis = await analyzeFixture({ entrypoint: 'hidden-cascade.css' })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) => candidate.status === 'fail',
    )

    assert.deepEqual(
      {
        componentId: evaluation.componentId,
        partId: evaluation.partId,
        selector: evaluation.selector,
        source: evaluation.actual.source,
        surfaceRole: evaluation.surfaceRole,
      },
      {
        componentId: 'web.select',
        partId: 'option-row',
        selector: '.el-select-dropdown .el-select-dropdown__item',
        source: {
          column: 3,
          line: 2,
          owner: {
            id: 'fsusui.web.vue',
            kind: 'implementation',
          },
          path: 'mutations/hidden-cascade.css',
        },
        surfaceRole: 'overlay.option-row',
      },
    )
    assert.deepEqual(evaluation.expected.canonicalReference, {
      path: 'spec/tokens/tokens.json',
      pointer: '/tokens/density.select.option.y',
      sourceId: 'token-contract',
    })
    assert.equal(
      evaluation.actual.value,
      'calc(var(--fixture-option-row-height) - 2px)',
    )
    semanticLength(evaluation.actual.semanticValue, 32)
    assert.ok(evaluation.actual.cascade.length >= 2)
    assert.equal(
      evaluation.actual.cascade.at(-1).source.path,
      'mutations/hidden-cascade.css',
    )
  },
)

contractTest(
  'CSC-401-04',
  'keeps panel root and internal option-row semantic ownership separate',
  async () => {
    const analysis = await analyzeFixture({ entrypoint: 'wrong-owner.css' })
    const row = rowMinHeight(analysis)
    const panel = findDiagnostic(
      analysis,
      (evaluation) =>
        evaluation.componentId === 'web.select' &&
        evaluation.partId === 'overlay-root' &&
        evaluation.property === 'border-radius',
      'Select panel border-radius evaluation',
    )

    assert.equal(row.status, 'pass')
    assert.equal(row.surfaceRole, 'overlay.option-row')
    assert.equal(panel.status, 'pass')
    assert.equal(panel.surfaceRole, 'overlay.panel-root')
    assert.notEqual(row.surfaceRole, panel.surfaceRole)
    assert.ok(
      !analysis.diagnostics.some(
        (evaluation) =>
          evaluation.partId === 'option-row' &&
          evaluation.actual.source.path === 'mutations/wrong-owner.css' &&
          evaluation.actual.value === 'calc(30px + 2px)',
      ),
    )
  },
)

contractTest(
  'CSC-401-05',
  'returns visual-evidence-required for a context-dependent static value',
  async () => {
    const analysis = await analyzeFixture({ entrypoint: 'static-unknown.css' })
    assertEnvelope(analysis)
    const evaluation = analysis.staticUnknowns.find(
      (candidate) =>
        candidate.componentId === 'web.select' &&
        candidate.partId === 'option-row' &&
        candidate.property === 'min-height',
    )

    assert.ok(evaluation)
    assert.equal(evaluation.status, 'visual-evidence-required')
    assert.equal(evaluation.reasonCode, 'static-value-unknown')
    assert.equal(evaluation.actual.value, 'clamp(32px, 4cqi, 40px)')
    assert.equal(evaluation.verificationRequirement, 'visual-evidence-required')
    const registry = await readJson(join(fixtureRoot, 'registry.json'))
    const verificationPolicy = registry.rules.find(
      (rule) => rule.id === evaluation.ruleId,
    ).verificationPolicy
    assert.ok(Array.isArray(evaluation.fields))
    assert.ok(
      evaluation.fields.every(
        (field) => typeof field === 'string' && field.length > 0,
      ),
    )
    assert.deepEqual(evaluation.fields, verificationPolicy.visualProbeFields)
    assert.ok(Array.isArray(evaluation.visualRequirements))
    assert.deepEqual(
      evaluation.visualRequirements,
      verificationPolicy.visualRequirements,
    )
    assert.ok(
      !analysis.diagnostics.some(
        (candidate) =>
          candidate.actual.source.path === 'mutations/static-unknown.css' &&
          (candidate.status === 'pass' || candidate.status === 'fail'),
      ),
    )
  },
)

contractTest(
  'CSC-401-06',
  'resolves var calc and color chains across theme density and media scopes',
  async () => {
    const analysis = await analyzeFixture()
    const defaultRow = rowMinHeight(
      analysis,
      (evaluation) =>
        evaluation.scope.theme === 'light' &&
        evaluation.scope.density === 'default' &&
        evaluation.scope.media === 'all',
    )
    const compactRow = rowMinHeight(
      analysis,
      (evaluation) => evaluation.scope.density === 'compact',
    )
    const mobileRow = rowMinHeight(
      analysis,
      (evaluation) => evaluation.scope.media === '(width <= 480px)',
    )
    const selectedColor = findDiagnostic(
      analysis,
      (evaluation) =>
        evaluation.partId === 'option-row' &&
        evaluation.property === 'background-color' &&
        evaluation.scope.theme === 'dark',
      'dark selected option-row color evaluation',
    )

    assert.equal(defaultRow.status, 'pass')
    semanticLength(defaultRow.actual.semanticValue, 34)
    semanticLength(compactRow.actual.semanticValue, 32)
    semanticLength(mobileRow.actual.semanticValue, 34)
    assert.ok(
      defaultRow.actual.cascade.some(
        (entry) =>
          entry.owningSource.path === 'source/select.scss' &&
          entry.owningSource.syntax === 'scss',
      ),
    )
    assert.deepEqual(selectedColor.actual.semanticValue, {
      alpha: 13 / 255,
      blue: 156,
      green: 89,
      kind: 'color',
      red: 42,
    })
    assert.ok(
      selectedColor.actual.cascade.some(
        (entry) =>
          entry.owningSource.path === 'source/fsus-theme.scss' &&
          entry.owningSource.syntax === 'scss',
      ),
    )
  },
)

for (const mutation of [
  {
    id: 'CSC-401-07A',
    entrypoint: 'source-only-compiled-override.css',
    source: 'mutations/source-only-compiled-override.css',
  },
  {
    id: 'CSC-401-07B',
    entrypoint: 'regex-decoy.css',
    source: 'mutations/regex-decoy.css',
  },
  {
    id: 'CSC-401-07C',
    entrypoint: 'wrong-owner.css',
    source: undefined,
  },
  {
    id: 'CSC-401-07D',
    entrypoint: 'hidden-cascade.css',
    source: 'mutations/hidden-cascade.css',
  },
]) {
  contractTest(
    mutation.id,
    `mutation control ${mutation.entrypoint} kills its prohibited shortcut`,
    async () => {
      const analysis = await analyzeFixture({
        entrypoint: mutation.entrypoint,
      })

      if (mutation.id === 'CSC-401-07C') {
        const row = rowMinHeight(analysis)
        assert.equal(row.status, 'pass')
        assert.ok(
          !analysis.diagnostics.some(
            (evaluation) =>
              evaluation.partId === 'option-row' &&
              evaluation.actual.value === 'calc(30px + 2px)',
          ),
        )
        return
      }

      const evaluation = rowMinHeight(
        analysis,
        (candidate) => candidate.status === 'fail',
      )
      assert.equal(evaluation.actual.source.path, mutation.source)
      semanticLength(evaluation.actual.semanticValue, 32)
    },
  )
}

contractTest(
  'CSC-401-08',
  'analysis is read-only and does not mutate or auto-fix fixture CSS',
  async (t) => {
    const temporaryParent = await mkdtemp(join(tmpdir(), 'fsusui-cascade-'))
    const temporaryRoot = join(temporaryParent, 'fixture')
    await cp(fixtureRoot, temporaryRoot, { recursive: true })
    await copyAuthorities(temporaryRoot, await resolveRegistryRoot())
    t.after(() => rm(temporaryParent, { force: true, recursive: true }))
    const before = await treeDigest(temporaryRoot)

    await analyzeFixture({
      entrypoint: 'hidden-cascade.css',
      root: temporaryRoot,
    })

    assert.equal(await treeDigest(temporaryRoot), before)
  },
)

contractTest(
  'CSC-401-09',
  'canonical references remain the only numeric truth and allowlists cannot bypass failures',
  async (t) => {
    const { evaluateSemanticStyles } = await loadEngine()
    await assert.rejects(
      () =>
        evaluateSemanticStyles({
          candidateIdentity,
          entrypoint: 'entrypoints/regex-decoy.css',
          selectorAllowlist: ['*'],
          sourceRoot: fixtureRoot,
        }),
      (error) => error?.code === 'semantic-style-evaluator-input',
    )

    const canonical = await readJson(
      join(await resolveRegistryRoot(), 'spec/tokens/tokens.json'),
    )
    canonical.tokens.find(
      ({ name }) => name === 'density.select.option.y',
    ).value = '36px'
    const temporaryParent = await mkdtemp(
      join(tmpdir(), 'fsusui-cascade-canonical-'),
    )
    const temporaryRoot = join(temporaryParent, 'fixture')
    await cp(fixtureRoot, temporaryRoot, { recursive: true })
    await copyAuthorities(temporaryRoot, await resolveRegistryRoot())
    t.after(() => rm(temporaryParent, { force: true, recursive: true }))
    const registry = await readJson(join(temporaryRoot, 'registry.json'))
    registry.allowlist = ['*']
    await writeFile(
      join(temporaryRoot, 'registry.json'),
      `${JSON.stringify(registry, null, 2)}\n`,
    )
    await assert.rejects(
      () => analyzeFixture({ root: temporaryRoot }),
      (error) => error?.code === 'registry-unbounded-allowlist',
    )

    delete registry.allowlist
    const canonicalSource = `${JSON.stringify(canonical, null, 2)}\n`
    await writeFile(
      join(temporaryRoot, 'spec/tokens/tokens.json'),
      canonicalSource,
    )
    const canonicalDigest = createHash('sha256')
      .update(canonicalSource)
      .digest('hex')
    for (const source of Object.values(registry.sourceDigests)) {
      if (source.path === 'spec/tokens/tokens.json') {
        source.digest = canonicalDigest
      }
    }
    await writeFile(
      join(temporaryRoot, 'registry.json'),
      `${JSON.stringify(registry, null, 2)}\n`,
    )
    const analysis = await analyzeFixture({
      root: temporaryRoot,
    })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) => candidate.status === 'fail',
    )

    assert.deepEqual(evaluation.expected.canonicalReference, {
      path: 'spec/tokens/tokens.json',
      pointer: '/tokens/density.select.option.y',
      sourceId: 'token-contract',
    })
    semanticLength(evaluation.expected.resolvedValue.semantic, 36)
    semanticLength(evaluation.actual.semanticValue, 34)
  },
)

contractTest(
  'CSC-401-10',
  'engine invokes the corrected #400 checker and ignores a weak local schema',
  async (t) => {
    const runtime = await createRuntimeFixture()
    t.after(() => rm(runtime.temporaryParent, { force: true, recursive: true }))
    const registryPath = join(runtime.root, 'registry.json')
    const registry = await readJson(registryPath)
    registry.issueMappings[0].issue = 401
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
    const weakSchemaPath = join(
      runtime.root,
      'spec/components/component-surface-semantic-registry.schema.json',
    )
    await mkdir(dirname(weakSchemaPath), { recursive: true })
    await writeFile(
      weakSchemaPath,
      `${JSON.stringify({ type: 'object' }, null, 2)}\n`,
    )

    const { subject } = await loadRegistryValidator()
    const { evaluateSemanticStyles } = await loadEngine()
    await assert.rejects(
      () =>
        evaluateSemanticStyles({
          candidateIdentity,
          entrypoint: 'entrypoints/base.css',
          sourceRoot: runtime.root,
        }),
      (error) =>
        error instanceof subject.SemanticRegistryContractError &&
        error.code === 'registry-schema-invalid',
    )
  },
)

contractTest(
  'CSC-401-11A',
  'invalid registered Sass fails real compilation even with synchronized digest',
  async (t) => {
    const runtime = await createRuntimeFixture()
    t.after(() => rm(runtime.temporaryParent, { force: true, recursive: true }))
    const invalid = await readJson(
      join(fixtureRoot, 'mutations/invalid-source.json'),
    )
    await writeFile(join(runtime.root, 'source/select.scss'), invalid.source)
    await synchronizeRegisteredDigest(runtime.root, 'source/select.scss')
    assert.throws(() =>
      compile(join(runtime.root, 'source/select.scss'), {
        loadPaths: [join(runtime.root, 'source')],
      }),
    )

    const { evaluateSemanticStyles } = await loadEngine()
    await assert.rejects(
      () =>
        evaluateSemanticStyles({
          candidateIdentity,
          entrypoint: 'entrypoints/base.css',
          sourceRoot: runtime.root,
        }),
      (error) => error?.code === 'semantic-style-sass-compile-failed',
    )
  },
)

contractTest(
  'CSC-401-12A',
  'exact-selector CSS spoof cannot claim Sass owningSource provenance',
  async () => {
    const analysis = await analyzeFixture({
      entrypoint: 'exact-selector-spoof.css',
    })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) =>
        candidate.actual.source.path === 'mutations/exact-selector-spoof.css',
    )
    assert.equal(evaluation.status, 'pass')
    semanticLength(evaluation.actual.semanticValue, 34)
    const spoof = evaluation.actual.cascade.find(
      ({ source }) => source.path === 'mutations/exact-selector-spoof.css',
    )
    assert.ok(spoof)
    assert.equal(spoof.owningSource, null)
  },
)

contractTest(
  'CSC-401-12B',
  'tampered registered compiled CSS cannot retain guessed Sass provenance',
  async (t) => {
    const runtime = await createRuntimeFixture()
    t.after(() => rm(runtime.temporaryParent, { force: true, recursive: true }))
    await cp(
      join(fixtureRoot, 'mutations/compiled-selector-spoof.css'),
      join(runtime.root, 'compiled/select.css'),
    )
    await synchronizeRegisteredDigest(runtime.root, 'compiled/select.css')

    const { evaluateSemanticStyles } = await loadEngine()
    await assert.rejects(
      () =>
        evaluateSemanticStyles({
          candidateIdentity,
          entrypoint: 'entrypoints/base.css',
          sourceRoot: runtime.root,
        }),
      (error) => error?.code === 'semantic-style-compiled-provenance-mismatch',
    )
  },
)

contractTest(
  'CSC-401-12C',
  'selector and source strings in comments or content do not create provenance',
  async () => {
    const analysis = await analyzeFixture({
      entrypoint: 'provenance-decoy.css',
    })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) =>
        candidate.scope.theme === 'light' &&
        candidate.scope.density === 'default' &&
        candidate.scope.media === 'all',
    )
    assert.equal(evaluation.status, 'pass')
    assert.ok(
      !evaluation.actual.cascade.some(
        ({ source }) => source.path === 'mutations/provenance-decoy.css',
      ),
    )
  },
)

contractTest(
  'CSC-401-13A',
  'custom properties resolve in matching theme scope instead of root only',
  async () => {
    const analysis = await analyzeFixture({
      entrypoint: 'scoped-custom-property.css',
    })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) =>
        candidate.scope.theme === 'dark' &&
        candidate.actual.source.path === 'mutations/scoped-custom-property.css',
    )
    assert.equal(evaluation.status, 'fail')
    assert.equal(evaluation.actual.value, 'var(--fixture-option-row-height)')
    semanticLength(evaluation.actual.semanticValue, 32)
    assert.deepEqual(evaluation.actual.source.owner, {
      id: 'fsusui.web.vue',
      kind: 'implementation',
    })
  },
)

contractTest(
  'CSC-401-13B',
  'nested media keeps conjunctive media theme and density scope',
  async () => {
    const analysis = await analyzeFixture({ entrypoint: 'nested-media.css' })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) =>
        candidate.actual.source.path === 'mutations/nested-media.css',
    )
    assert.equal(evaluation.status, 'fail')
    semanticLength(evaluation.actual.semanticValue, 32)
    assert.deepEqual(evaluation.scope, {
      density: 'compact',
      media: '(width >= 320px) and (width <= 480px)',
      theme: 'dark',
    })
  },
)

contractTest(
  'CSC-401-14A',
  'var fallback resolves statically when the custom property is missing',
  async () => {
    const analysis = await analyzeFixture({ entrypoint: 'var-fallback.css' })
    const evaluation = rowMinHeight(
      analysis,
      (candidate) =>
        candidate.actual.source.path === 'mutations/var-fallback.css',
    )
    assert.equal(evaluation.status, 'pass')
    semanticLength(evaluation.actual.semanticValue, 34)
  },
)

for (const mutation of [
  {
    id: 'CSC-401-14B',
    entrypoint: 'var-unresolved.css',
    source: 'mutations/var-unresolved.css',
  },
  {
    id: 'CSC-401-14C',
    entrypoint: 'var-cycle.css',
    source: 'mutations/var-cycle.css',
  },
]) {
  contractTest(
    mutation.id,
    `${mutation.entrypoint} remains visual-evidence-required`,
    async () => {
      const analysis = await analyzeFixture({
        entrypoint: mutation.entrypoint,
      })
      const evaluation = rowStaticUnknown(analysis, mutation.source)
      assert.equal(evaluation.reasonCode, 'static-value-unknown')
      assert.equal(evaluation.status, 'visual-evidence-required')
      assert.equal(
        evaluation.verificationRequirement,
        'visual-evidence-required',
      )
    },
  )
}

for (const probe of [
  {
    id: 'CSC-401-15A',
    entrypoint: 'specificity-is.css',
    selector: '#fixture-select .scope .el-select-dropdown__item',
  },
  {
    id: 'CSC-401-15B',
    entrypoint: 'specificity-not.css',
    selector: '#fixture-select .scope .el-select-dropdown__item',
  },
  {
    id: 'CSC-401-15C',
    entrypoint: 'specificity-where.css',
    selector: '.scope .el-select-dropdown__item',
  },
  {
    id: 'CSC-401-15D',
    entrypoint: 'specificity-equal-order.css',
    selector: '.el-select-dropdown__item',
  },
]) {
  contractTest(
    probe.id,
    `${probe.entrypoint} follows Selectors specificity and source order`,
    async () => {
      const analysis = await analyzeFixture({ entrypoint: probe.entrypoint })
      const evaluation = rowMinHeight(
        analysis,
        (candidate) =>
          candidate.actual.source.path === `mutations/${probe.entrypoint}`,
      )
      assert.equal(evaluation.status, 'pass')
      assert.equal(evaluation.selector, probe.selector)
      assert.equal(evaluation.actual.value, '34px')
      semanticLength(evaluation.actual.semanticValue, 34)
    },
  )
}

for (const probe of [
  {
    id: 'CSC-401-16A',
    entrypoint: 'layer-normal.css',
    layer: 'override',
  },
  {
    id: 'CSC-401-16B',
    entrypoint: 'layer-important.css',
    layer: 'base',
  },
  {
    id: 'CSC-401-16C',
    entrypoint: 'important-specificity-order.css',
    layer: null,
  },
]) {
  contractTest(
    probe.id,
    `${probe.entrypoint} applies CSS layer and important precedence`,
    async () => {
      const analysis = await analyzeFixture({ entrypoint: probe.entrypoint })
      const evaluation = rowMinHeight(
        analysis,
        (candidate) =>
          candidate.actual.source.path === `mutations/${probe.entrypoint}`,
      )
      assert.equal(evaluation.status, 'pass')
      assert.equal(evaluation.actual.value, '34px')
      assert.equal(evaluation.actual.layer, probe.layer)
      semanticLength(evaluation.actual.semanticValue, 34)
    },
  )
}

contractTest(
  'CSC-401-17A',
  'post-theme compiled override fails with exact owner source and actual color',
  async () => {
    const analysis = await analyzeFixture({
      entrypoint: 'post-theme-override.css',
    })
    const evaluation = selectedBackground(
      analysis,
      (candidate) =>
        candidate.scope.theme === 'dark' &&
        candidate.actual.source.path === 'mutations/post-theme-override.css',
    )
    assert.equal(evaluation.status, 'fail')
    assert.equal(evaluation.actual.value, '#ff0000')
    assert.deepEqual(evaluation.actual.semanticValue, {
      alpha: 1,
      blue: 0,
      green: 0,
      kind: 'color',
      red: 255,
    })
    assert.deepEqual(evaluation.actual.source.owner, {
      id: 'fsusui.web.vue',
      kind: 'implementation',
    })
  },
)
