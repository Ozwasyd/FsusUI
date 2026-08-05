import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as csstree from 'css-tree'
import Ajv2020 from 'ajv/dist/2020.js'
import { compileString } from 'sass'
import { SourceMapConsumer } from 'source-map-js'

import {
  checkComponentSurfaceSemanticRegistry,
  SemanticRegistryContractError,
} from './check-component-surface-semantic-registry.mjs'

const ROOT_KEYS = new Set(['candidateIdentity', 'entrypoint', 'sourceRoot'])
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const registrySchema = path.join(
  repositoryRoot,
  'spec/components/component-surface-semantic-registry.schema.json',
)
const productionProvenanceCache = new Map()

const fail = (code, message, cause) =>
  Object.assign(new Error(message, cause ? { cause } : undefined), { code })
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const clone = (value) => JSON.parse(JSON.stringify(value))
const portable = (root, file) =>
  path.relative(root, file).split(path.sep).join('/')
const tupleCompare = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}
const tupleAdd = (left, right) =>
  left.map((value, index) => value + right[index])
const maxTuple = (values) =>
  values.reduce(
    (maximum, value) => (tupleCompare(maximum, value) < 0 ? value : maximum),
    [0, 0, 0],
  )

const parseCss = (css, filename) =>
  csstree.parse(css, {
    context: 'stylesheet',
    filename,
    parseCustomProperty: true,
    positions: true,
  })

const importTarget = (prelude) => {
  const first = prelude?.children?.first
  return first?.type === 'String' || first?.type === 'Url' ? first.value : null
}

const selectorSpecificity = (node) => {
  if (!node) return [0, 0, 0]
  if (node.type === 'IdSelector') return [1, 0, 0]
  if (node.type === 'ClassSelector' || node.type === 'AttributeSelector') {
    return [0, 1, 0]
  }
  if (node.type === 'TypeSelector' || node.type === 'PseudoElementSelector') {
    return [0, 0, 1]
  }
  if (node.type === 'PseudoClassSelector') {
    if (node.name === 'where') return [0, 0, 0]
    if (['is', 'not', 'has'].includes(node.name)) {
      const branches = []
      csstree.walk(node, {
        visit: 'Selector',
        enter(selector) {
          if (selector !== node) branches.push(selectorSpecificity(selector))
        },
      })
      return maxTuple(branches)
    }
    return [0, 1, 0]
  }
  if (!node.children) return [0, 0, 0]
  return [...node.children].reduce(
    (total, child) => tupleAdd(total, selectorSpecificity(child)),
    [0, 0, 0],
  )
}

const selectorFacts = (selector) => {
  const facts = {
    attributes: new Map(),
    classes: new Set(),
    positiveClasses: new Set(),
    specificity: selectorSpecificity(selector),
    terminalClasses: new Set(),
  }
  const visit = (node, negative = false) => {
    if (node.type === 'ClassSelector') {
      facts.classes.add(node.name)
      if (!negative) facts.positiveClasses.add(node.name)
    }
    if (node.type === 'AttributeSelector' && !negative) {
      const value =
        node.value?.type === 'String'
          ? node.value.value
          : node.value?.type === 'Identifier'
            ? node.value.name
            : undefined
      facts.attributes.set(node.name.name, value)
    }
    if (!node.children) return
    for (const child of node.children) {
      visit(
        child,
        negative ||
          (node.type === 'PseudoClassSelector' && node.name === 'not'),
      )
    }
  }
  visit(selector)
  const terminalNodes = []
  for (const child of selector.children ?? []) {
    if (child.type === 'Combinator') terminalNodes.length = 0
    else terminalNodes.push(child)
  }
  const collectTerminalClasses = (node, negative = false) => {
    if (node.type === 'ClassSelector' && !negative) {
      facts.terminalClasses.add(node.name)
    }
    if (!node.children) return
    for (const child of node.children) {
      collectTerminalClasses(
        child,
        negative ||
          (node.type === 'PseudoClassSelector' && node.name === 'not'),
      )
    }
  }
  for (const node of terminalNodes) collectTerminalClasses(node)
  return facts
}

const selectorEntries = (prelude) =>
  prelude
    ? [...prelude.children].map((ast) => ({
        ast,
        facts: selectorFacts(ast),
        text: csstree.generate(ast),
      }))
    : []

const mediaText = (prelude) =>
  csstree.generate(prelude).replaceAll('<=', ' <= ').replaceAll('>=', ' >= ')
const combineMedia = (outer, inner) =>
  outer === 'all' ? inner : inner === 'all' ? outer : `${outer} and ${inner}`

const collectRules = (nodes, state, output) => {
  for (const node of nodes) {
    if (node.type === 'Rule') {
      output.push({ ...state, node })
      continue
    }
    if (node.type !== 'Atrule') continue
    const name = node.name.toLowerCase()
    if (name === 'layer' && !node.block) {
      for (const layer of csstree.generate(node.prelude).split(',')) {
        const trimmed = layer.trim()
        if (trimmed && !state.layerOrder.has(trimmed)) {
          state.layerOrder.set(trimmed, state.layerOrder.size)
        }
      }
      continue
    }
    if (!node.block) continue
    let media = state.media
    let layer = state.layer
    if (name === 'media') media = combineMedia(media, mediaText(node.prelude))
    if (name === 'layer') {
      layer = csstree.generate(node.prelude).trim() || null
      if (layer && !state.layerOrder.has(layer)) {
        state.layerOrder.set(layer, state.layerOrder.size)
      }
    }
    collectRules(node.block.children, { ...state, layer, media }, output)
  }
}

const stylesheetDeclarations = (css, file, root, orderStart = 0) => {
  const ast = parseCss(css, portable(root, file))
  const layerOrder = new Map()
  const rules = []
  collectRules(ast.children, { layer: null, layerOrder, media: 'all' }, rules)
  const declarations = []
  let order = orderStart
  for (const rule of rules) {
    for (const selector of selectorEntries(rule.node.prelude)) {
      for (const node of rule.node.block.children) {
        if (node.type !== 'Declaration') continue
        declarations.push({
          file,
          important: node.important,
          layer: rule.layer,
          layerOrder,
          media: rule.media,
          node,
          order: order++,
          property: node.property,
          selector,
          value: css
            .slice(node.value.loc.start.offset, node.value.loc.end.offset)
            .trim(),
        })
      }
    }
  }
  return { declarations, nextOrder: order }
}

const loadEntrypoint = async (root, entrypoint) => {
  const files = []
  const contents = new Map()
  const visit = async (file) => {
    const css = await readFile(file, 'utf8')
    contents.set(file, css)
    const ast = parseCss(css, portable(root, file))
    for (const node of ast.children) {
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
        const target = importTarget(node.prelude)
        if (!target)
          throw fail(
            'semantic-style-css-parse-failed',
            `Unsupported @import in ${file}`,
          )
        await visit(path.resolve(path.dirname(file), target))
      } else {
        files.push({ css, file, node })
      }
    }
  }
  await visit(path.resolve(root, entrypoint))
  let order = 0
  const declarations = []
  const layerOrder = new Map()
  for (const { css, file, node } of files) {
    const rules = []
    collectRules([node], { layer: null, layerOrder, media: 'all' }, rules)
    for (const rule of rules) {
      for (const selector of selectorEntries(rule.node.prelude)) {
        for (const declaration of rule.node.block.children) {
          if (declaration.type !== 'Declaration') continue
          declarations.push({
            file,
            important: declaration.important,
            layer: rule.layer,
            layerOrder,
            media: rule.media,
            node: declaration,
            order: order++,
            property: declaration.property,
            selector,
            value: css
              .slice(
                declaration.value.loc.start.offset,
                declaration.value.loc.end.offset,
              )
              .trim(),
          })
        }
      }
    }
  }
  return { contents, declarations, files, layerOrder }
}

const signature = (declaration) =>
  JSON.stringify([
    [...declaration.selector.facts.positiveClasses].sort(),
    [...declaration.selector.facts.attributes].sort(),
    declaration.selector.facts.specificity,
    declaration.property,
    csstree.generate(declaration.node.value),
    declaration.important,
    declaration.media,
    declaration.layer,
  ])

const establishProvenance = async (root, registry, cascadeDeclarations) => {
  const sassPaths = new Set()
  const cssPaths = new Set()
  for (const rule of registry.rules) {
    for (const owned of rule.selectorOwnership.selectors) {
      if (owned.source.path.endsWith('.scss')) sassPaths.add(owned.source.path)
      if (owned.source.path.endsWith('.css')) cssPaths.add(owned.source.path)
    }
  }
  const compiledCandidates = new Map()
  for (const cssPath of cssPaths) {
    const file = path.join(root, cssPath)
    const css = await readFile(file, 'utf8')
    compiledCandidates.set(
      cssPath,
      stylesheetDeclarations(css, file, root).declarations,
    )
  }
  const provenance = new Map()
  if (cssPaths.size === 0) {
    const cacheKey = sha256(
      JSON.stringify([
        registry.generated?.sourceRevision,
        [...sassPaths].sort(),
        cascadeDeclarations.map(signature),
      ]),
    )
    const cached = productionProvenanceCache.get(cacheKey)
    if (cached) {
      const restored = new Map()
      cascadeDeclarations.forEach((declaration, index) => {
        const owningSource = cached[index]
        if (!owningSource) return
        restored.set(
          `${portable(root, declaration.file)}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
          owningSource,
        )
      })
      return restored
    }
    const themeEntrypoint = path.join(
      repositoryRoot,
      'vue/packages/theme-chalk/src/index.scss',
    )
    let result
    try {
      result = compileString(await readFile(themeEntrypoint, 'utf8'), {
        loadPaths: [path.dirname(themeEntrypoint)],
        sourceMap: true,
        style: 'expanded',
        url: pathToFileURL(themeEntrypoint),
      })
    } catch (error) {
      throw fail(
        'semantic-style-sass-compile-failed',
        'Sass compilation failed: theme entrypoint',
        error,
      )
    }
    const generated = stylesheetDeclarations(
      result.css,
      themeEntrypoint,
      repositoryRoot,
    ).declarations
    const bySignature = new Map()
    for (const declaration of generated) {
      const key = signature(declaration)
      const queue = bySignature.get(key) ?? []
      queue.push(declaration)
      bySignature.set(key, queue)
    }
    const consumer = await new SourceMapConsumer(result.sourceMap)
    for (const declaration of cascadeDeclarations) {
      const generatedDeclaration = bySignature
        .get(signature(declaration))
        ?.shift()
      if (!generatedDeclaration) continue
      const original = consumer.originalPositionFor({
        column: generatedDeclaration.node.loc.start.column - 1,
        line: generatedDeclaration.node.loc.start.line,
      })
      if (!original.source) continue
      const originalFile = fileURLToPath(original.source)
      const originalPath = path.relative(repositoryRoot, originalFile)
      provenance.set(
        `${portable(root, declaration.file)}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
        {
          path: originalPath.startsWith('..')
            ? portable(root, originalFile)
            : originalPath.split(path.sep).join('/'),
          syntax: 'scss',
        },
      )
    }
    consumer.destroy?.()
    productionProvenanceCache.set(
      cacheKey,
      cascadeDeclarations.map((declaration) =>
        provenance.get(
          `${portable(root, declaration.file)}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
        ),
      ),
    )
    return provenance
  }
  for (const sassPath of sassPaths) {
    const sourceFile = path.join(root, sassPath)
    const relativeSource = path.relative(root, sourceFile)
    const repositorySource = path.join(repositoryRoot, relativeSource)
    let result
    try {
      result = compileString(await readFile(sourceFile, 'utf8'), {
        loadPaths: [
          path.dirname(sourceFile),
          path.dirname(repositorySource),
          path.join(repositoryRoot, 'vue/packages/theme-chalk/src'),
        ],
        sourceMap: true,
        style: 'expanded',
        url: pathToFileURL(repositorySource),
      })
    } catch (error) {
      throw fail(
        'semantic-style-sass-compile-failed',
        `Sass compilation failed: ${sassPath}`,
        error,
      )
    }
    const generated = stylesheetDeclarations(
      result.css,
      sourceFile,
      root,
    ).declarations
    const generatedSignatures = generated.map(signature)
    const matches = [...compiledCandidates].filter(
      ([, declarations]) =>
        JSON.stringify(declarations.map(signature)) ===
        JSON.stringify(generatedSignatures),
    )
    if (matches.length !== 1) {
      throw fail(
        'semantic-style-compiled-provenance-mismatch',
        `Compiled CSS does not uniquely match Sass output: ${sassPath}`,
      )
    }
    const [cssPath, registered] = matches[0]
    compiledCandidates.delete(cssPath)
    const consumer = await new SourceMapConsumer(result.sourceMap)
    registered.forEach((declaration, index) => {
      const generatedDeclaration = generated[index]
      const original = consumer.originalPositionFor({
        column: generatedDeclaration.node.loc.start.column - 1,
        line: generatedDeclaration.node.loc.start.line,
      })
      const originalFile = original.source
        ? fileURLToPath(original.source)
        : repositorySource
      const originalPath = path.relative(repositoryRoot, originalFile)
      provenance.set(
        `${cssPath}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
        {
          path: originalPath.startsWith('..')
            ? portable(root, originalFile)
            : originalPath.split(path.sep).join('/'),
          syntax: 'scss',
        },
      )
    })
    consumer.destroy?.()
  }
  if (compiledCandidates.size) {
    throw fail(
      'semantic-style-compiled-provenance-mismatch',
      `Registered compiled CSS has no Sass provenance: ${[...compiledCandidates.keys()].join(', ')}`,
    )
  }
  return provenance
}

const resolvePointer = (document, pointer) => {
  if (pointer.startsWith('/tokens/')) {
    const name = pointer.slice('/tokens/'.length)
    return document.tokens.find((token) => token.name === name)
  }
  let value = document
  for (const encoded of pointer.split('/').slice(1)) {
    value = value[encoded.replaceAll('~1', '/').replaceAll('~0', '~')]
  }
  return value
}

const contextOf = (declaration) => ({
  density:
    declaration.selector.facts.attributes.get('data-density') ?? 'default',
  media: declaration.media,
  theme: declaration.selector.facts.classes.has('dark') ? 'dark' : 'light',
})

const applies = (declaration, context) => {
  const scope = contextOf(declaration)
  return (
    (scope.theme === 'light' || scope.theme === context.theme) &&
    (scope.density === 'default' || scope.density === context.density) &&
    (scope.media === 'all' || scope.media === context.media)
  )
}

const cascadeCompare = (left, right) => {
  if (left.important !== right.important) return left.important ? 1 : -1
  const leftLayer = left.layer === null ? null : left.layerOrder.get(left.layer)
  const rightLayer =
    right.layer === null ? null : right.layerOrder.get(right.layer)
  if (leftLayer !== rightLayer) {
    if (left.important) {
      if (leftLayer === null) return -1
      if (rightLayer === null) return 1
      return rightLayer - leftLayer
    }
    if (leftLayer === null) return 1
    if (rightLayer === null) return -1
    return leftLayer - rightLayer
  }
  const specificity = tupleCompare(
    left.selector.facts.specificity,
    right.selector.facts.specificity,
  )
  return specificity || left.order - right.order
}

const winner = (declarations) =>
  declarations.reduce(
    (current, candidate) =>
      !current || cascadeCompare(current, candidate) <= 0 ? candidate : current,
    null,
  )

const semanticValue = (
  input,
  variableResolver,
  seen = new Set(),
  allowSequence = false,
) => {
  let ast
  try {
    ast =
      typeof input === 'string'
        ? csstree.parse(input, { context: 'value' })
        : input
  } catch {
    return undefined
  }
  const evaluate = (node) => {
    if (node.type === 'Value') {
      const values = [...node.children]
        .filter(
          (child) => child.type !== 'WhiteSpace' && child.type !== 'Operator',
        )
        .map(evaluate)
      return values.length === 1 ? values[0] : values
    }
    if (node.type === 'Dimension') {
      return {
        kind: 'length',
        unit: node.unit.toLowerCase(),
        value: Number(node.value),
      }
    }
    if (node.type === 'Number') return Number(node.value)
    if (node.type === 'Percentage') return Number(node.value) / 100
    if (node.type === 'Raw') {
      return semanticValue(
        node.value.trim(),
        variableResolver,
        seen,
        allowSequence,
      )
    }
    if (node.type === 'Hash') {
      const hex = node.value
      if (![3, 4, 6, 8].includes(hex.length)) return undefined
      const expanded =
        hex.length <= 4
          ? [...hex].map((character) => character.repeat(2)).join('')
          : hex
      return {
        alpha:
          expanded.length === 8
            ? Number.parseInt(expanded.slice(6, 8), 16) / 255
            : 1,
        blue: Number.parseInt(expanded.slice(4, 6), 16),
        green: Number.parseInt(expanded.slice(2, 4), 16),
        kind: 'color',
        red: Number.parseInt(expanded.slice(0, 2), 16),
      }
    }
    if (node.type !== 'Function') return undefined
    const children = [...node.children].filter(
      (child) => child.type !== 'WhiteSpace',
    )
    if (node.name === 'var') {
      const name = children[0]?.name
      if (!name || seen.has(name)) return fallback(children)
      const variable = variableResolver(name)
      if (variable === undefined) return fallback(children)
      seen.add(name)
      const resolved = semanticValue(variable, variableResolver, seen, true)
      seen.delete(name)
      return resolved ?? fallback(children)
    }
    if (node.name === 'calc') {
      const parts = children.map((child) =>
        child.type === 'Operator' ? child.value.trim() : evaluate(child),
      )
      let value = parts[0]
      for (let index = 1; index < parts.length; index += 2) {
        const operator = parts[index]
        const right = parts[index + 1]
        if (
          operator === '*' &&
          value?.kind === 'length' &&
          typeof right === 'number'
        ) {
          value = { ...value, value: value.value * right }
        } else if (
          ['+', '-'].includes(operator) &&
          value?.kind === 'length' &&
          right?.kind === 'length' &&
          value.unit === right.unit
        ) {
          value = {
            ...value,
            value:
              value.value + (operator === '+' ? right.value : -right.value),
          }
        } else return undefined
      }
      return value
    }
    if (node.name === 'rgb' || node.name === 'rgba') {
      const values = children
        .filter((child) => child.type !== 'Operator')
        .flatMap((child) => {
          const value = evaluate(child)
          return Array.isArray(value) ? value : [value]
        })
        .filter((value) => typeof value === 'number')
      if (values.length < 3) return undefined
      return {
        alpha: values[3] ?? 1,
        blue: values[2],
        green: values[1],
        kind: 'color',
        red: values[0],
      }
    }
    return undefined
  }
  const fallback = (children) => {
    const comma = children.findIndex(
      (child) => child.type === 'Operator' && child.value.trim() === ',',
    )
    if (comma < 0) return undefined
    const value = { type: 'Value', children: new csstree.List() }
    for (const child of children.slice(comma + 1))
      value.children.appendData(child)
    return evaluate(value)
  }
  const result = evaluate(ast)
  return Array.isArray(result) && !allowSequence ? undefined : result
}

const sourceDetails = (root, declaration, owner) => ({
  column: declaration.node.loc.start.column,
  line: declaration.node.loc.start.line,
  owner,
  path: portable(root, declaration.file),
})

const declarationProvenance = (root, declaration, provenance) =>
  provenance.get(
    `${portable(root, declaration.file)}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
  )

const selectorMatchesOwnership = (declaration, ownedSelectors) =>
  ownedSelectors.some(
    (selector) =>
      selector.facts.terminalClasses.size > 0 &&
      [...selector.facts.terminalClasses].every((name) =>
        declaration.selector.facts.terminalClasses.has(name),
      ),
  )

const firstReference = (rule, family) => rule.constraints[family]?.[0]

const semanticRecord = ({
  actual,
  context,
  expected,
  property,
  reasonCode,
  root,
  rule,
  status,
}) => ({
  actual: actual
    ? {
        semanticValue: semanticValue(
          actual.value,
          () => undefined,
          new Set(),
          true,
        ),
        source: sourceDetails(root, actual, rule.owner),
        value: actual.value,
      }
    : { semanticValue: null, source: null, value: null },
  componentId: rule.componentId,
  expected: {
    canonicalReference: expected ? clone(expected) : null,
  },
  partId: rule.partId,
  property,
  reasonCode,
  ruleId: rule.id,
  scope: context,
  selector:
    actual?.selector.text ?? rule.selectorOwnership.selectors[0].selector,
  status,
  surfaceRole: rule.surfaceRole,
})

const externalSemanticViolations = ({
  cascade,
  panelGeometryContracts,
  provenance,
  references,
  reducedMotionContract,
  root,
  rule,
  selectionContract,
  selectors,
}) => {
  const output = []
  const candidates = cascade.declarations.filter(
    (declaration) =>
      !declarationProvenance(root, declaration, provenance) &&
      selectorMatchesOwnership(declaration, selectors),
  )
  const context = (declaration) => contextOf(declaration)
  const push = (declaration, property, family, reasonCode) => {
    const expected =
      firstReference(rule, family) ??
      (family === 'stateColor' ? selectionContract?.reference : undefined) ??
      Object.values(rule.constraints).flat()[0]
    output.push(
      semanticRecord({
        actual: declaration,
        context: context(declaration),
        expected,
        property,
        reasonCode,
        root,
        rule,
        status: 'fail',
      }),
    )
  }

  for (const declaration of candidates) {
    if (
      rule.constraints.geometry.length > 0 &&
      declaration.property === 'min-height'
    ) {
      for (const reference of rule.constraints.geometry) {
        const resolved = references.get(
          `${reference.path}\0${reference.pointer}`,
        )
        if (
          resolved &&
          declaration.value === resolved.resolved.value &&
          !declaration.value.includes('var(')
        ) {
          push(
            declaration,
            declaration.property,
            'geometry',
            'canonical-reference-required',
          )
        }
      }
    }
    if (
      declaration.property === 'border-radius' &&
      /(?:row|item|cell)/u.test(rule.surfaceRole)
    ) {
      const panelAliases = panelGeometryContracts.flatMap(
        ({ resolved }) => resolved.aliases ?? [],
      )
      if (panelAliases.some((alias) => declaration.value.includes(alias))) {
        push(
          declaration,
          'border-radius',
          'geometry',
          'internal-row-panel-geometry-forbidden',
        )
      }
    }
    if (
      (rule.constraints.stateColor.length > 0 || selectionContract) &&
      ['color', 'background-color', 'border-color'].includes(
        declaration.property,
      ) &&
      /(?:selected|checked|current)/u.test(declaration.selector.text)
    ) {
      const aliases = [
        ...references.values(),
        ...(selectionContract ? [selectionContract] : []),
      ].flatMap(({ resolved }) => resolved.aliases ?? [])
      if (
        aliases.length === 0 ||
        !aliases.some((alias) => declaration.value.includes(alias))
      ) {
        push(
          declaration,
          declaration.property,
          'stateColor',
          'selection-token-required',
        )
      }
    }
    if (
      declaration.property === 'background-color' &&
      /(?:hover|\.hover)/u.test(declaration.selector.text) &&
      selectionContract?.resolved.aliases?.some((alias) =>
        declaration.value.includes(alias),
      )
    ) {
      push(
        declaration,
        'background-color',
        'stateColor',
        'hover-selection-token-forbidden',
      )
    }
    if (
      declaration.property === 'color' &&
      rule.surfaceRole.includes('rate') &&
      selectionContract?.resolved.aliases?.some((alias) =>
        declaration.value.includes(alias),
      )
    ) {
      push(declaration, 'color', 'stateColor', 'rate-warning-token-required')
    }
    if (
      declaration.property === 'opacity' &&
      /(?:disabled|aria-disabled)/u.test(declaration.selector.text) &&
      rule.surfaceRole.includes('interactive-root')
    ) {
      push(declaration, 'opacity', 'disabled', 'ancestor-opacity-disabled')
    }
    if (
      ['background-color', 'border-color', 'color'].includes(
        declaration.property,
      ) &&
      /(?:disabled|aria-disabled)/u.test(declaration.selector.text) &&
      rule.constraints.disabled.length > 0 &&
      !declaration.value.includes('var(')
    ) {
      push(
        declaration,
        declaration.property,
        'disabled',
        'disabled-state-token-required',
      )
    }
    if (
      rule.constraints.typography.length > 0 &&
      declaration.property === 'font-size'
    ) {
      const expected = references.get(
        `${firstReference(rule, 'typography').path}\0${firstReference(rule, 'typography').pointer}`,
      )
      if (expected && declaration.value !== expected.resolved.value) {
        push(
          declaration,
          'font-size',
          'typography',
          'typography-semantic-mismatch',
        )
      }
    }
    if (
      rule.constraints.typography.length > 0 &&
      declaration.property === 'font-weight'
    ) {
      const expected = [...references.values()].find(
        ({ resolved }) => resolved.type === 'fontWeight',
      )
      if (expected && declaration.value !== expected.resolved.value) {
        push(
          declaration,
          'font-weight',
          'typography',
          'typography-semantic-mismatch',
        )
      }
    }
    if (
      rule.constraints.motion.length > 0 &&
      declaration.property === 'transition' &&
      declaration.value.trim() === 'none' &&
      declaration.media.includes('prefers-reduced-motion')
    ) {
      push(
        declaration,
        'transition-duration',
        'motion',
        'reduced-motion-lifecycle-required',
      )
    }
    if (
      rule.constraints.motion.length > 0 &&
      declaration.property === 'transition-duration'
    ) {
      const duration =
        [...references.values()].find(
          ({ resolved }) => resolved.type === 'duration',
        ) ?? reducedMotionContract
      const reducedDuration =
        duration?.resolved.modeValues?.motionReduced?.value ??
        duration?.resolved.modeValues?.motionDisabled?.value
      if (
        declaration.media.includes('prefers-reduced-motion') &&
        reducedDuration &&
        declaration.value !== reducedDuration
      ) {
        push(
          declaration,
          'transition-duration',
          'motion',
          'reduced-motion-lifecycle-required',
        )
      } else if (
        duration &&
        !declaration.media.includes('prefers-reduced-motion') &&
        declaration.value !== duration.resolved.value &&
        !duration.resolved.aliases?.some((alias) =>
          declaration.value.includes(alias),
        )
      ) {
        push(
          declaration,
          'transition-duration',
          'motion',
          'motion-duration-semantic-mismatch',
        )
      }
    }
    if (
      rule.constraints.motion.length > 0 &&
      declaration.property === 'transform'
    ) {
      const scale = declaration.value.match(
        /scale(?:X|Y)?\(\s*(-?(?:\d*\.)?\d+)\s*\)/u,
      )
      if (scale && Math.abs(Number(scale[1]) - 1) > 0.2) {
        push(declaration, 'transform', 'motion', 'strong-scale-forbidden')
        continue
      }
      const travel = declaration.value.match(
        /translate[XY]\(\s*(-?(?:\d*\.)?\d+)px\s*\)/u,
      )
      const distanceReference = rule.constraints.motion.find((reference) => {
        const resolved = references.get(
          `${reference.path}\0${reference.pointer}`,
        )
        return resolved?.resolved.type === 'dimension'
      })
      const distance = distanceReference
        ? references.get(
            `${distanceReference.path}\0${distanceReference.pointer}`,
          )?.resolved.value
        : undefined
      if (
        travel &&
        distance &&
        Math.abs(Number(travel[1])) > Math.abs(Number.parseFloat(distance))
      ) {
        push(declaration, 'transform', 'motion', 'list-travel-budget-exceeded')
      }
    }
  }
  return output
}

const stableSort = (values) =>
  values.sort((left, right) =>
    [
      left.componentId,
      left.partId,
      left.property,
      left.scope.theme,
      left.scope.density === 'default' ? '0' : `1-${left.scope.density}`,
      left.scope.media,
    ]
      .join('\0')
      .localeCompare(
        [
          right.componentId,
          right.partId,
          right.property,
          right.scope.theme,
          right.scope.density === 'default' ? '0' : `1-${right.scope.density}`,
          right.scope.media,
        ].join('\0'),
      ),
  )

export const evaluateSemanticStyles = async (options) => {
  if (
    !options ||
    Object.keys(options).some((key) => !ROOT_KEYS.has(key)) ||
    typeof options.sourceRoot !== 'string' ||
    typeof options.entrypoint !== 'string' ||
    !options.candidateIdentity ||
    typeof options.candidateIdentity !== 'object'
  ) {
    throw fail(
      'semantic-style-evaluator-input',
      'Invalid semantic style evaluator input',
    )
  }
  const root = path.resolve(options.sourceRoot)
  const registryText = await readFile(path.join(root, 'registry.json'), 'utf8')
  const registry = JSON.parse(registryText)
  if (registry.allowlist?.some((selector) => selector.includes('*'))) {
    throw fail(
      'registry-unbounded-allowlist',
      'Wildcard selector allowlists are prohibited',
    )
  }
  const schema = JSON.parse(await readFile(registrySchema, 'utf8'))
  const validateRegistry = new Ajv2020({
    allErrors: true,
    strict: false,
  }).compile(schema)
  if (!validateRegistry(registry)) {
    throw new SemanticRegistryContractError(
      'registry-schema-invalid',
      'registry does not satisfy the authoritative schema',
    )
  }
  await checkComponentSurfaceSemanticRegistry({
    registryPath: 'registry.json',
    root,
    schemaPath: registrySchema,
  })
  const authorities = new Map()
  for (const source of Object.values(registry.sourceDigests)) {
    if (source.kind === 'authority') {
      const content = await readFile(path.join(root, source.path), 'utf8')
      authorities.set(
        source.path,
        source.path.endsWith('.json') ? JSON.parse(content) : content,
      )
    }
  }
  const cascade = await loadEntrypoint(root, options.entrypoint)
  const provenance = await establishProvenance(
    root,
    registry,
    cascade.declarations,
  )
  const diagnostics = []
  const staticUnknowns = []
  const selectionReference = registry.rules
    .flatMap((rule) => rule.constraints.stateColor)
    .find((reference) => reference.pointer.includes('selected'))
  const selectionContract = selectionReference
    ? {
        reference: selectionReference,
        resolved: resolvePointer(
          authorities.get(selectionReference.path),
          selectionReference.pointer,
        ),
      }
    : null
  const reducedMotionReference = registry.rules
    .flatMap((rule) => rule.constraints.motion)
    .find((reference) => {
      const resolved = resolvePointer(
        authorities.get(reference.path),
        reference.pointer,
      )
      return (
        resolved?.type === 'duration' &&
        (resolved.modeValues?.motionReduced?.value !== undefined ||
          resolved.modeValues?.motionDisabled?.value !== undefined)
      )
    })
  const reducedMotionContract = reducedMotionReference
    ? {
        reference: reducedMotionReference,
        resolved: resolvePointer(
          authorities.get(reducedMotionReference.path),
          reducedMotionReference.pointer,
        ),
      }
    : null
  const panelGeometryContracts = registry.rules
    .filter(({ surfaceRole }) => /(?:panel|root)/u.test(surfaceRole))
    .flatMap((rule) => rule.constraints.geometry)
    .map((reference) => ({
      reference,
      resolved: resolvePointer(
        authorities.get(reference.path),
        reference.pointer,
      ),
    }))
    .filter(({ resolved }) => resolved?.value !== undefined)

  for (const rule of registry.rules) {
    const recordCountBefore = diagnostics.length + staticUnknowns.length
    const ownedSelectors = rule.selectorOwnership.selectors
      .map((entry) => entry.selector)
      .filter((value, index, values) => values.indexOf(value) === index)
      .map((text) => {
        const ast = csstree.parse(text, { context: 'selector' })
        return { facts: selectorFacts(ast), text }
      })
    const references = new Map()
    for (const reference of Object.values(rule.constraints).flat()) {
      const resolved = resolvePointer(
        authorities.get(reference.path),
        reference.pointer,
      )
      if (resolved?.value !== undefined) {
        references.set(`${reference.path}\0${reference.pointer}`, {
          reference,
          resolved,
        })
      }
    }
    for (const { reference, resolved } of references.values()) {
      const property =
        resolved.type === 'color'
          ? 'background-color'
          : resolved.type === 'radius'
            ? 'border-radius'
            : 'min-height'
      const target =
        ownedSelectors.find(
          (selector) =>
            property !== 'background-color' ||
            selector.facts.classes.has('is-selected'),
        ) ?? ownedSelectors[0]
      const matching = cascade.declarations.filter(
        (declaration) =>
          declaration.property === property &&
          selectorMatchesOwnership(declaration, [target]),
      )
      if (!matching.length) continue
      const contexts = new Map()
      const defaultContext = {
        density: 'default',
        media: 'all',
        theme: 'light',
      }
      contexts.set(JSON.stringify(defaultContext), defaultContext)
      for (const declaration of matching) {
        const context = contextOf(declaration)
        contexts.set(JSON.stringify(context), context)
      }
      for (const context of contexts.values()) {
        const applicable = matching.filter((declaration) =>
          applies(declaration, context),
        )
        const actual = winner(applicable)
        if (!actual) continue
        const variableResolver = (name) => {
          const candidates = cascade.declarations.filter(
            (declaration) =>
              declaration.property === name &&
              applies(declaration, context) &&
              (declaration.selector.text === ':root' ||
                declaration.selector.facts.classes.has('dark') ||
                selectorMatchesOwnership(declaration, [target])),
          )
          return winner(candidates)?.value
        }
        const actualSemantic = semanticValue(actual.value, variableResolver)
        const expectedSemantic = semanticValue(resolved.value, () => undefined)
        const actualCascade = applicable
          .sort((left, right) => left.order - right.order)
          .map((declaration) => {
            const relativePath = portable(root, declaration.file)
            return {
              important: declaration.important,
              layer: declaration.layer,
              owningSource:
                provenance.get(
                  `${relativePath}\0${declaration.node.loc.start.line}\0${declaration.node.loc.start.column}`,
                ) ?? null,
              selector: declaration.selector.text,
              source: sourceDetails(root, declaration, rule.owner),
              value: declaration.value,
            }
          })
        const common = {
          actual: {
            cascade: actualCascade,
            layer: actual.layer,
            semanticValue: actualSemantic,
            source: sourceDetails(root, actual, rule.owner),
            value: actual.value,
          },
          componentId: rule.componentId,
          partId: rule.partId,
          property,
          ruleId: rule.id,
          scope: context,
          selector: actual.selector.text,
          surfaceRole: rule.surfaceRole,
        }
        if (!actualSemantic) {
          staticUnknowns.push({
            ...common,
            fields: [...rule.verificationPolicy.visualProbeFields],
            reasonCode: 'static-value-unknown',
            status: 'visual-evidence-required',
            verificationRequirement: 'visual-evidence-required',
            visualRequirements: clone(
              rule.verificationPolicy.visualRequirements,
            ),
          })
        } else {
          diagnostics.push({
            ...common,
            expected: {
              canonicalReference: clone(reference),
              resolvedValue: {
                raw: resolved.value,
                semantic: expectedSemantic,
              },
            },
            status:
              JSON.stringify(actualSemantic) ===
              JSON.stringify(expectedSemantic)
                ? 'pass'
                : 'fail',
          })
        }
      }
    }
    diagnostics.push(
      ...externalSemanticViolations({
        cascade,
        panelGeometryContracts,
        provenance,
        reducedMotionContract,
        references,
        root,
        rule,
        selectionContract,
        selectors: ownedSelectors,
      }),
    )
    if (
      diagnostics.length + staticUnknowns.length === recordCountBefore &&
      rule.verificationPolicy.staticFields.length > 0
    ) {
      const observed = cascade.declarations.find((declaration) =>
        selectorMatchesOwnership(declaration, ownedSelectors),
      )
      if (observed) {
        diagnostics.push(
          semanticRecord({
            actual: observed,
            context: contextOf(observed),
            expected: Object.values(rule.constraints).flat()[0],
            property: observed.property,
            reasonCode: 'semantic-cascade-observed',
            root,
            rule,
            status: 'observed',
          }),
        )
      }
    }
    if (
      rule.verificationPolicy.visualProbeFields.length > 0 &&
      !staticUnknowns.some(
        ({ componentId, partId }) =>
          componentId === rule.componentId && partId === rule.partId,
      )
    ) {
      staticUnknowns.push({
        componentId: rule.componentId,
        fields: [...rule.verificationPolicy.visualProbeFields],
        partId: rule.partId,
        reasonCode: 'visual-evidence-required',
        ruleId: rule.id,
        scope: {
          density: rule.scope.densities[0],
          media: rule.scope.devices[0],
          theme: rule.scope.themes[0],
        },
        selector: rule.selectorOwnership.selectors[0].selector,
        status: 'visual-evidence-required',
        surfaceRole: rule.surfaceRole,
        verificationRequirement: 'visual-evidence-required',
        visualRequirements: clone(rule.verificationPolicy.visualRequirements),
      })
    }
  }
  return {
    registryDigest: sha256(registryText),
    compiledCssDigest: sha256(
      [...cascade.contents]
        .map(([file, css]) => `${portable(root, file)}\0${css}`)
        .join('\n'),
    ),
    diagnostics: stableSort(diagnostics),
    staticUnknowns: stableSort(staticUnknowns),
  }
}
