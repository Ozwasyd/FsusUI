import { Linter } from 'eslint'
import type { SourceCode } from 'eslint'

export type GeneratedNode =
  SourceCode['scopeManager']['scopes'][number]['block']

// The standard JavaScript parser/binder supplies lexical ownership here. This
// is not a lint gate; the original repository lint and type checks still run.
export const inspectGeneratedCode = (code: string) => {
  const linter = new Linter()
  const messages = linter.verify(code, {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    linterOptions: { noInlineConfig: true },
  })
  const source = linter.getSourceCode()
  if (!source || messages.some((message) => message.fatal))
    throw new Error('Cannot analyze generated JavaScript bindings.')
  const program = source.ast
  const nodes: GeneratedNode[] = []
  const parents = new Map<GeneratedNode, { node: GeneratedNode; key: string }>()
  const pending: GeneratedNode[] = [program]
  while (pending.length) {
    const node = pending.pop()!
    nodes.push(node)
    for (const [key, value] of Object.entries(node)) {
      if (['parent', 'tokens', 'comments', 'range', 'loc'].includes(key))
        continue
      for (const child of Array.isArray(value) ? value : [value]) {
        if (
          child &&
          typeof child === 'object' &&
          typeof child.type === 'string'
        ) {
          parents.set(child, { node, key })
          pending.push(child)
        }
      }
    }
  }
  const scopes = source.scopeManager
  const references = new Map(
    scopes.scopes.flatMap((scope) =>
      scope.references.map(
        (reference) => [reference.identifier, reference] as const,
      ),
    ),
  )
  const hasEval = nodes.some(
    (node) =>
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'eval',
  )
  return { program, nodes, parents, scopes, references, hasEval }
}
