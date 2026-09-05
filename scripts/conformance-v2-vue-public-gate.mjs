#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const VUE_BASELINE_PATH = 'spec/baselines/vue-current.json'
const CONTRACT_V2_PATH = 'spec/components/contracts/v2/contract-v2.json'
const MEMBER_STATUSES = ['aligned-candidate', 'partial', 'missing', 'web-only']
const MEMBER_SECTIONS = [
  {
    kind: 'input',
    contractSection: 'inputs',
    baselineMembers: (component) =>
      (component.semantic?.props ?? []).map((prop) => prop.name),
  },
  {
    kind: 'output',
    contractSection: 'outputs',
    baselineMembers: (component) =>
      (component.semantic?.emits ?? []).length > 0
        ? component.semantic.emits.map((emit) => emit.name)
        : (component.emits ?? []),
  },
  {
    kind: 'operation',
    contractSection: 'operations',
    baselineMembers: (component) =>
      (component.semantic?.exposed ?? []).length > 0
        ? component.semantic.exposed.map((exposed) => exposed.name)
        : (component.exposed ?? []),
  },
  {
    kind: 'contentRegion',
    contractSection: 'contentRegions',
    baselineMembers: (component) =>
      (component.slots ?? []).map((slot) =>
        typeof slot === 'string' ? slot : slot.name,
      ),
  },
]

const duplicates = (values) => {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated].sort()
}

export const validateVuePublicCoverage = ({ baseline, registry }) => {
  const errors = []
  const components = baseline.components ?? []
  const contracts = registry.contracts ?? []
  const baselineNames = components.map((component) => component.name)
  const contractNames = contracts.map((contract) => contract.component?.name)

  for (const name of duplicates(baselineNames)) {
    errors.push(`Vue baseline has duplicate component ${name}`)
  }
  for (const name of duplicates(contractNames)) {
    errors.push(`Contract V2 has duplicate component ${name}`)
  }

  const contractsByComponent = new Map(
    contracts.map((contract) => [contract.component?.name, contract]),
  )
  const baselineNameSet = new Set(baselineNames)
  let auditedMembers = 0
  let webOnlyMembers = 0

  for (const component of components) {
    const contract = contractsByComponent.get(component.name)
    if (!contract) {
      errors.push(`Vue component ${component.name} is missing from Contract V2`)
      continue
    }
    if (contract.component?.module !== component.module) {
      errors.push(
        `${component.name} module mismatch: baseline ${component.module} vs Contract V2 ${contract.component?.module}`,
      )
    }
    if (contract.component?.classification !== component.classification) {
      errors.push(
        `${component.name} classification mismatch: baseline ${component.classification} vs Contract V2 ${contract.component?.classification}`,
      )
    }

    for (const section of MEMBER_SECTIONS) {
      const expectedNames = section.baselineMembers(component)
      const members = contract[section.contractSection] ?? []
      const actualNames = members.map((member) => member.name)
      auditedMembers += expectedNames.length

      for (const name of duplicates(expectedNames)) {
        errors.push(
          `${component.name} Vue baseline has duplicate ${section.kind} ${name}`,
        )
      }
      for (const name of duplicates(actualNames)) {
        errors.push(
          `${component.name} Contract V2 has duplicate ${section.kind} ${name}`,
        )
      }

      const expectedSet = new Set(expectedNames)
      const actualSet = new Set(actualNames)
      for (const name of expectedSet) {
        if (!actualSet.has(name)) {
          errors.push(
            `${component.name} ${section.kind} ${name} is missing from Contract V2`,
          )
        }
      }
      for (const name of actualSet) {
        if (!expectedSet.has(name)) {
          errors.push(
            `${component.name} Contract V2 has extra ${section.kind} ${name}`,
          )
        }
      }

      for (const member of members) {
        const context = `${component.name} ${section.kind} ${member.name ?? '<unknown>'}`
        if (member.kind !== section.kind) {
          errors.push(
            `${context} has kind ${member.kind ?? '<unknown>'}, expected ${section.kind}`,
          )
        }
        if (member.web?.member !== member.name) {
          errors.push(
            `${context} web member ${member.web?.member ?? '<unknown>'} does not match its Contract V2 name`,
          )
        }
        if (member.web?.baseline !== VUE_BASELINE_PATH) {
          errors.push(`${context} is not bound to the Vue compiler baseline`)
        }
        if (section.kind === 'input') {
          const prop = (component.semantic?.props ?? []).find(
            (candidate) => candidate.name === member.name,
          )
          for (const [field, expected, actual] of [
            ['values', prop?.values ?? null, member.web?.values ?? null],
            [
              'valuesKnown',
              typeof prop?.valuesKnown === 'boolean' ? prop.valuesKnown : null,
              member.web?.valuesKnown ?? null,
            ],
            [
              'deprecated',
              typeof prop?.deprecated === 'boolean' ? prop.deprecated : null,
              member.web?.deprecated ?? null,
            ],
            [
              'deprecationMessage',
              prop?.deprecationMessage ?? null,
              member.web?.deprecationMessage ?? null,
            ],
          ]) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              errors.push(
                `${context} stale compiler ${field}: baseline ${JSON.stringify(expected)} vs Contract V2 ${JSON.stringify(actual)}`,
              )
            }
          }
        }
        if (section.kind === 'contentRegion') {
          const slot = (component.slots ?? []).find(
            (candidate) => candidate.name === member.name,
          )
          const expectedPayload = (slot?.payload ?? []).map((field) => ({
            name: field.name,
            expression: field.expression ?? null,
            type: field.type ?? null,
          }))
          const actualPayload = member.web?.payload ?? []
          for (const [field, expected, actual] of [
            ['nameKnown', slot?.nameKnown === true, member.web?.nameKnown],
            ['scoped', slot?.scoped === true, member.web?.scoped],
            [
              'payloadComplete',
              slot?.payloadComplete === true,
              member.web?.payloadComplete,
            ],
            ['contentType', slot?.contentType ?? null, member.web?.contentType],
          ]) {
            if (actual !== expected) {
              errors.push(
                `${context} stale compiler ${field}: baseline ${JSON.stringify(expected)} vs Contract V2 ${JSON.stringify(actual)}`,
              )
            }
          }
          if (
            JSON.stringify(actualPayload) !== JSON.stringify(expectedPayload)
          ) {
            errors.push(`${context} stale compiler scoped payload fields`)
          }
          if (
            member.avalonia != null &&
            member.bindingBasis !== 'explicit-semantic'
          ) {
            errors.push(
              `${context} claims an Avalonia content region without an explicit semantic binding`,
            )
          }
          if (
            member.status === 'aligned-candidate' &&
            (slot?.nameKnown !== true ||
              slot?.payloadComplete !== true ||
              (slot?.scoped === true && !slot?.contentType))
          ) {
            // Unscoped Vue slots deliver untyped content, which is the
            // compatible counterpart of an object-typed native content
            // property; only scoped regions carry a compiler-known value
            // type (issue #285).
            errors.push(
              `${context} claims aligned-candidate with unknown compiler content metadata`,
            )
          }
        }
        if (!MEMBER_STATUSES.includes(member.status)) {
          errors.push(`${context} has invalid status ${member.status}`)
        }
        if (component.classification === 'web-only') {
          webOnlyMembers += 1
          if (member.status !== 'web-only') {
            errors.push(
              `${context} must be uniquely registered as web-only, got ${member.status}`,
            )
          }
        } else if (member.status === 'web-only') {
          webOnlyMembers += 1
          if (
            member.dispositionBasis !== 'explicit-member-disposition' ||
            !member.platformAlternative ||
            !member.governance?.reason ||
            !member.governance?.owner ||
            !member.governance?.testPolicy ||
            !member.governance?.reviewPolicy
          ) {
            errors.push(
              `${context} claims web-only without an exact governed member disposition`,
            )
          }
        }
      }
    }
  }

  for (const contract of contracts) {
    const name = contract.component?.name
    if (!baselineNameSet.has(name)) {
      errors.push(
        `Contract V2 component ${name ?? '<unknown>'} has no Vue baseline export`,
      )
    }
  }

  return {
    errors,
    auditedComponents: components.length,
    auditedMembers,
    webOnlyMembers,
  }
}

const propertyName = (property, source) =>
  property.name
    ?.getText(source)
    .replace(/^\[|\]$/gu, (token) => (token === '[' ? '[' : ']'))
    .replace(/^['"]|['"]$/gu, '') ?? null
const unwrap = (node) => {
  let current = node
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression
  }
  return current
}
const objectMembers = (sourceText, variableName, filename) => {
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  let result = null
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === variableName &&
      node.initializer
    ) {
      const initializer = unwrap(
        ts.isCallExpression(node.initializer)
          ? node.initializer.arguments[0]
          : node.initializer,
      )
      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        result = initializer.properties
          .map((property) => propertyName(property, source))
          .filter(Boolean)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!result) throw new Error(`${variableName} AST declaration missing`)
  return result.sort()
}
const exposedMembers = () => {
  const sfc = parse(
    read('vue/packages/components/markdown-editor/src/markdown-editor.vue'),
  ).descriptor.scriptSetup?.content
  if (!sfc) throw new Error('MarkdownEditor script setup missing')
  const source = ts.createSourceFile(
    'markdown-editor.vue.ts',
    sfc,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  let result = null
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'defineExpose' &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      result = node.arguments[0].properties
        .map((property) => propertyName(property, source))
        .filter(Boolean)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!result) throw new Error('defineExpose AST declaration missing')
  return result.sort()
}
const main = () => {
  const baseline = JSON.parse(read(VUE_BASELINE_PATH))
  const registry = JSON.parse(read(CONTRACT_V2_PATH))
  const coverage = validateVuePublicCoverage({ baseline, registry })
  if (coverage.errors.length > 0) {
    throw new Error(
      `Vue public Contract V2 coverage failed:\n${coverage.errors.join('\n')}`,
    )
  }

  const expected = baseline.components.find(
    (component) => component.name === 'ElMarkdownEditor',
  )
  if (!expected) throw new Error('ElMarkdownEditor Vue baseline missing')
  const source = read(
    'vue/packages/components/markdown-editor/src/markdown-editor.ts',
  )
  const actual = {
    props: objectMembers(source, 'markdownEditorProps', 'markdown-editor.ts'),
    emits: objectMembers(source, 'markdownEditorEmits', 'markdown-editor.ts'),
    exposed: exposedMembers(),
  }
  for (const field of ['props', 'emits', 'exposed']) {
    const wanted = [...expected[field]].sort()
    if (JSON.stringify(actual[field]) !== JSON.stringify(wanted)) {
      throw new Error(
        `Vue public ${field} drift expected=${JSON.stringify(wanted)} actual=${JSON.stringify(actual[field])}`,
      )
    }
  }
  console.log(
    `Contract V2 Vue public gate passed: ${coverage.auditedComponents} components, ${coverage.auditedMembers} members, ${coverage.webOnlyMembers} web-only members`,
  )
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main()
}
