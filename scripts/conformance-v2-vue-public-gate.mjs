#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const baseline = JSON.parse(read('spec/baselines/vue-current.json'))
const expected = baseline.components.find(
  (component) => component.name === 'ElMarkdownEditor',
)
if (!expected) throw new Error('ElMarkdownEditor Vue baseline missing')

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
console.log('Contract V2 Vue public AST gate passed')
