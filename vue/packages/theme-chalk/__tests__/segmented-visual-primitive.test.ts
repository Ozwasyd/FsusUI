import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

type CanonicalRef = {
  sourceId: string
  path: string
  pointer: string
  runtimeAlias?: string
  runtimeAliases?: string[]
}

type Contract = {
  sassApi: {
    entry: string
    mixin: string
    requiredParameters: string[]
    optionalParameters: string[]
  }
  canonicalRefs: Record<string, CanonicalRef>
  semanticRegistry: {
    path: string
    rules: Array<{
      id: string
      componentId: string
      partId: string
      surfaceRole: string
    }>
  }
  acceptance: Array<{ id: string; covers: string[] }>
}

type Mutation = {
  id: string
  expectedViolation: string
  replacements: Array<{ from: string; to: string }>
}

type CssRule = {
  selector: string
  declarations: Record<string, string>
}

type RegistryRef = {
  sourceId: string
  path: string
  pointer: string
}

type RegistryRule = {
  id: string
  componentId: string
  partId: string
  surfaceRole: string
  canonicalSources: RegistryRef[]
  constraints: Record<string, RegistryRef[]>
  verificationPolicy: {
    staticFields: string[]
    visualProbeFields: string[]
    visualRequirements: Array<{
      id: string
      states: string[]
      themes: string[]
      viewports: Array<{ id: string; width: number; height: number }>
      zooms: number[]
      inputs: string[]
      expectedSemanticEvidence: RegistryRef[]
    }>
  }
}

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../../../..')
const fixtureRoot = path.join(
  repoRoot,
  'tests/fixtures/segmented-visual-primitive',
)
const sourceRoot = path.join(repoRoot, 'vue/packages/theme-chalk/src')
const contract = JSON.parse(
  readFileSync(path.join(fixtureRoot, 'contract.json'), 'utf8'),
) as Contract
const referenceCss = readFileSync(
  path.join(fixtureRoot, 'reference.css'),
  'utf8',
)
const mutations = JSON.parse(
  readFileSync(path.join(fixtureRoot, 'mutations.json'), 'utf8'),
) as Mutation[]

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '')

const parseCssRules = (source: string): CssRule[] => {
  const rules: CssRule[] = []
  const rulePattern = /([^{}]+)\{([^{}]+)\}/gu

  for (const match of stripComments(source).matchAll(rulePattern)) {
    const selector = match[1]?.trim() ?? ''
    if (!selector || selector.startsWith('@')) continue

    const declarations = Object.fromEntries(
      (match[2] ?? '')
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const separator = declaration.indexOf(':')
          return [
            declaration.slice(0, separator).trim(),
            declaration.slice(separator + 1).trim(),
          ]
        }),
    )
    rules.push({ selector, declarations })
  }

  return rules
}

const findRule = (rules: CssRule[], predicate: (selector: string) => boolean) =>
  rules.find((rule) => predicate(rule.selector))

const includesAlias = (value: string | undefined, alias: string) =>
  value?.includes(`var(${alias}`) ?? false

const validateSegmentedCss = (source: string) => {
  const violations = new Set<string>()
  const rules = parseCssRules(source)
  const refs = contract.canonicalRefs
  const shell = findRule(
    rules,
    (selector) =>
      selector.includes('[data-fsus-segmented-probe]') &&
      !selector.includes('[data-fsus-segment-item]'),
  )
  const item = findRule(
    rules,
    (selector) =>
      selector.includes('[data-fsus-segment-item]') &&
      !selector.includes(':') &&
      !selector.includes('[data-selected') &&
      !selector.includes('+'),
  )
  const adjacent = findRule(rules, (selector) => selector.includes('+'))
  const hover = findRule(rules, (selector) => selector.includes(':hover'))
  const selected = findRule(rules, (selector) =>
    selector.includes('[data-selected'),
  )
  const focus = findRule(rules, (selector) =>
    selector.includes(':focus-visible'),
  )
  const disabled = findRule(rules, (selector) => selector.includes(':disabled'))
  const icon = findRule(rules, (selector) =>
    selector.includes('[data-fsus-segment-icon]'),
  )
  const label = findRule(rules, (selector) =>
    selector.includes('[data-fsus-segment-label]'),
  )

  if (
    !shell ||
    !includesAlias(
      shell.declarations['border-radius'],
      refs.shellRadius.runtimeAlias!,
    )
  ) {
    violations.add('SEG459-E-SHELL-RADIUS')
  }
  if (!shell || !['0', '0px'].includes(shell.declarations.gap ?? '')) {
    violations.add('SEG459-E-GROUP-BOUNDARY')
  }
  if (
    shell?.declarations.overflow === 'hidden' ||
    shell?.declarations.overflow === 'clip' ||
    shell?.declarations['overflow-x'] === 'hidden' ||
    shell?.declarations['overflow-x'] === 'clip'
  ) {
    violations.add('SEG459-E-SHELL-CLIP')
  }
  if (
    !shell ||
    !['none', undefined].includes(shell.declarations['box-shadow']) ||
    shell.declarations.opacity !== '1'
  ) {
    violations.add('SEG459-E-SHELL-SURFACE')
  }
  if (
    !item ||
    !includesAlias(
      item.declarations['min-height'],
      refs.itemHeightMin.runtimeAlias!,
    ) ||
    !includesAlias(
      item.declarations['max-height'],
      refs.itemHeightMax.runtimeAlias!,
    )
  ) {
    violations.add('SEG459-E-ITEM-HEIGHT')
  }
  if (
    !item ||
    item.declarations['border-radius'] !== '0' ||
    item.declarations['box-shadow'] !== 'none' ||
    item.declarations.opacity !== '1' ||
    item.declarations['text-align'] !== 'start' ||
    !adjacent ||
    adjacent.declarations['margin-inline-start'] !== '-1px'
  ) {
    violations.add('SEG459-E-ITEM-SURFACE')
  }
  if (
    !hover ||
    !includesAlias(
      hover.declarations.background,
      refs.hoverBackground.runtimeAlias!,
    )
  ) {
    violations.add('SEG459-E-HOVER')
  }
  if (
    !selected ||
    !includesAlias(
      selected.declarations.background,
      refs.selectedBackground.runtimeAlias!,
    ) ||
    !includesAlias(
      selected.declarations['border-color'],
      refs.selectedBorder.runtimeAlias!,
    ) ||
    !includesAlias(
      selected.declarations.color,
      refs.selectedIndicatorAndText.runtimeAlias!,
    ) ||
    !['none', undefined].includes(selected.declarations['box-shadow'])
  ) {
    violations.add('SEG459-E-SELECTED-SEMANTICS')
  }
  const focusShadow = focus?.declarations['box-shadow']
  if (
    !focus ||
    focus.declarations.outline !== 'none' ||
    !focusShadow?.includes('inset') ||
    !includesAlias(focusShadow, refs.focusWidth.runtimeAlias!) ||
    !includesAlias(focusShadow, refs.selectedIndicatorAndText.runtimeAlias!)
  ) {
    violations.add('SEG459-E-FOCUS-INSET')
  }
  const disabledAliases = refs.disabled.runtimeAliases ?? []
  if (
    !disabled ||
    !includesAlias(disabled.declarations.background, disabledAliases[0]!) ||
    !includesAlias(disabled.declarations.color, disabledAliases[1]!) ||
    !includesAlias(
      disabled.declarations['border-color'],
      disabledAliases[2]!,
    ) ||
    disabled.declarations.opacity !== '1' ||
    disabled.declarations['box-shadow'] !== 'none'
  ) {
    violations.add('SEG459-E-DISABLED')
  }
  if (
    !item ||
    item.declarations.display !== 'inline-flex' ||
    item.declarations['align-items'] !== 'center' ||
    !includesAlias(item.declarations.gap, '--fsus-space-1') ||
    !icon ||
    icon.declarations.flex !== '0 0 auto' ||
    !label ||
    label.declarations['min-inline-size'] !== 'max-content' ||
    label.declarations.overflow === 'hidden' ||
    label.declarations.overflow === 'clip' ||
    label.declarations['text-overflow'] === 'ellipsis' ||
    label.declarations['white-space'] !== 'nowrap'
  ) {
    violations.add('SEG459-E-CONTENT-BIDI')
  }

  return [...violations]
}

const mutateCss = (mutation: Mutation) =>
  mutation.replacements.reduce((source, replacement) => {
    expect(source, `${mutation.id} replacement source must exist`).toContain(
      replacement.from,
    )
    return source.replace(replacement.from, replacement.to)
  }, referenceCss)

const normalizeRefs = (refs: RegistryRef[] | undefined) =>
  [...(refs ?? [])]
    .map((ref) => `${ref.sourceId}|${ref.path}|${ref.pointer}`)
    .sort()

const assertConstraintRefsOnly = (rule: RegistryRule) => {
  for (const refs of Object.values(rule.constraints)) {
    for (const ref of refs) {
      expect(Object.keys(ref).sort()).toEqual(['path', 'pointer', 'sourceId'])
      expect(ref.path).not.toBe('')
      expect(ref.pointer).not.toBe('')
      expect(ref.sourceId).not.toBe('')
    }
  }
}

describe('issue #459 shared segmented visual primitive', () => {
  test('SEG459-A01 resolves every design expectation through canonical references', () => {
    const tokenSource = JSON.parse(
      readFileSync(path.join(repoRoot, 'spec/tokens/tokens.json'), 'utf8'),
    ) as { tokens: Array<{ name: string; aliases?: string[] }> }
    const tokensByName = new Map(
      tokenSource.tokens.map((token) => [token.name, token]),
    )

    for (const ref of Object.values(contract.canonicalRefs)) {
      expect(
        existsSync(path.join(repoRoot, ref.path)),
        `${ref.path} must exist`,
      ).toBe(true)
      if (ref.sourceId !== 'token-contract') continue

      const tokenName = ref.pointer.replace('/tokens/', '')
      const token = tokensByName.get(tokenName)
      expect(
        token,
        `${ref.pointer} must resolve in canonical tokens`,
      ).toBeDefined()
      expect(token?.aliases).toContain(ref.runtimeAlias)
    }
  })

  test('SEG459-A01/A03/A05 compiles the unique Sass entry and satisfies the full state contract', () => {
    const entryPath = path.join(repoRoot, contract.sassApi.entry)
    expect(
      existsSync(entryPath),
      `${contract.sassApi.entry} is the required shared implementation boundary`,
    ).toBe(true)

    const source = readFileSync(entryPath, 'utf8')
    expect(source).toContain(`@mixin ${contract.sassApi.mixin}`)
    expect(source).not.toMatch(
      /\baria-|role\s*=|type\s*=\s*['"](?:radio|checkbox)/u,
    )

    const css = compile(path.join(fixtureRoot, 'probe.scss'), {
      loadPaths: [sourceRoot],
      style: 'expanded',
    }).css
    expect(validateSegmentedCss(css)).toEqual([])
  })

  test('SEG459-A02 keeps component semantics separate from the visual primitive', () => {
    const radio = readFileSync(
      path.join(repoRoot, 'vue/packages/components/radio/src/radio-button.vue'),
      'utf8',
    )
    const checkbox = readFileSync(
      path.join(
        repoRoot,
        'vue/packages/components/checkbox/src/checkbox-button.vue',
      ),
      'utf8',
    )
    const themeMode = readFileSync(
      path.join(
        repoRoot,
        'vue/packages/components/theme-mode-toggle/src/theme-mode-toggle.vue',
      ),
      'utf8',
    )
    const collection = readFileSync(
      path.join(
        repoRoot,
        'vue/packages/components/collection-primitives/src/segmented-control.vue',
      ),
      'utf8',
    )

    expect(radio).toContain('type="radio"')
    expect(checkbox).toContain('type="checkbox"')
    expect(themeMode).toContain('<el-radio-group')
    expect(themeMode).toContain('role="menuitemradio"')
    expect(collection).toContain("role: 'radiogroup'")
    expect(collection).toContain('role="radio"')
  })

  test('SEG459-A02 binds shared visuals to distinct #400 semantic registry roles', () => {
    const registryPath = path.join(repoRoot, contract.semanticRegistry.path)
    expect(
      existsSync(registryPath),
      `${contract.semanticRegistry.path} must be supplied by #400`,
    ).toBe(true)
    const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      rules: RegistryRule[]
    }
    const matched = contract.semanticRegistry.rules.map((expectedRule) => {
      const rule = registry.rules.find(({ id }) => id === expectedRule.id)
      expect(rule, `${expectedRule.id} must exist`).toBeDefined()
      expect(rule).toMatchObject(expectedRule)
      assertConstraintRefsOnly(rule!)
      expect(rule?.verificationPolicy.staticFields).toEqual(
        expect.arrayContaining(['geometry', 'stateColor']),
      )
      expect(rule?.verificationPolicy.visualProbeFields).toEqual(
        expect.arrayContaining(['surfaceCardMotif']),
      )
      expect(rule?.verificationPolicy.visualProbeFields).not.toContain(
        'stateColor',
      )
      expect(
        rule?.verificationPolicy.visualRequirements.length,
        `${expectedRule.id} must retain production-render evidence requirements`,
      ).toBeGreaterThan(0)
      for (const requirement of rule!.verificationPolicy.visualRequirements) {
        expect(requirement.id).not.toBe('')
        expect(requirement.states.length).toBeGreaterThan(0)
        expect(requirement.themes.length).toBeGreaterThan(0)
        expect(requirement.viewports.length).toBeGreaterThan(0)
        expect(requirement.zooms.length).toBeGreaterThan(0)
        expect(requirement.inputs.length).toBeGreaterThan(0)
        expect(requirement.expectedSemanticEvidence.length).toBeGreaterThan(0)
        for (const ref of requirement.expectedSemanticEvidence) {
          expect(Object.keys(ref).sort()).toEqual([
            'path',
            'pointer',
            'sourceId',
          ])
        }
      }
      return rule!
    })

    const sharedGeometryRefs = [
      contract.canonicalRefs.itemHeightMin,
      contract.canonicalRefs.itemHeightMax,
    ].map((ref) => `${ref.sourceId}|${ref.path}|${ref.pointer}`)
    const sharedSelectedRef = contract.canonicalRefs.selectedBackground
    const sharedSelectedRefKey = `${sharedSelectedRef.sourceId}|${sharedSelectedRef.path}|${sharedSelectedRef.pointer}`
    for (const rule of matched) {
      expect(normalizeRefs(rule.constraints.geometry)).toEqual(
        expect.arrayContaining(sharedGeometryRefs),
      )
      expect(normalizeRefs(rule.constraints.stateColor)).toContain(
        sharedSelectedRefKey,
      )
    }
    expect(new Set(matched.map(({ id }) => id)).size).toBe(4)
    expect(new Set(matched.map(({ componentId }) => componentId)).size).toBe(4)
    expect(new Set(matched.map(({ surfaceRole }) => surfaceRole)).size).toBe(4)
    expect(
      matched
        .slice(0, 2)
        .every(({ surfaceRole }) =>
          surfaceRole.startsWith('control-group.form-'),
        ),
    ).toBe(true)
    expect(
      matched
        .slice(2)
        .every(({ surfaceRole }) =>
          surfaceRole.startsWith('control-group.navigation-'),
        ),
    ).toBe(true)
  })

  test('SEG459-A04 accepts the canonical reference fixture', () => {
    expect(validateSegmentedCss(referenceCss)).toEqual([])
  })

  test.each(mutations)('SEG459-A04 $id is killed independently', (mutation) => {
    const violations = validateSegmentedCss(mutateCss(mutation))
    expect(violations).toContain(mutation.expectedViolation)
  })
})
