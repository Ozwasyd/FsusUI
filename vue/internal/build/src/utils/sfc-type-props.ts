import { ts } from 'ts-morph'

/** Preserve type-based props at the declaration-only compiler boundary. */
export function preserveSfcTypeProps(setup: string, compiled: string) {
  const source = ts.createSourceFile(
    'setup.ts',
    setup,
    ts.ScriptTarget.Latest,
    true,
  )
  const unwrap = (node: ts.Expression): ts.Expression => {
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      node = node.expression
    return node
  }
  let props: ts.TypeNode | undefined
  for (const statement of source.statements) {
    const expressions = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration) =>
          declaration.initializer ? [declaration.initializer] : [],
        )
      : ts.isExpressionStatement(statement)
        ? [statement.expression]
        : []
    for (const expression of expressions) {
      let call = unwrap(expression)
      if (
        ts.isCallExpression(call) &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'withDefaults' &&
        call.arguments[0]
      ) {
        call = unwrap(call.arguments[0])
      }
      if (
        ts.isCallExpression(call) &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'defineProps' &&
        call.typeArguments?.[0]
      ) {
        if (props) throw new Error('Multiple type-based defineProps calls')
        props = call.typeArguments[0]
      }
    }
  }
  if (!props) return compiled
  const output = ts.createSourceFile(
    'compiled.ts',
    compiled,
    ts.ScriptTarget.Latest,
    true,
  )
  const imports = new Set<string>()
  for (const statement of output.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'vue'
    )
      continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        if ((binding.propertyName || binding.name).text === 'defineComponent')
          imports.add(binding.name.text)
      }
    }
  }
  for (const statement of output.statements) {
    if (!ts.isExportAssignment(statement)) continue
    const call = unwrap(statement.expression)
    if (
      !ts.isCallExpression(call) ||
      !ts.isIdentifier(call.expression) ||
      !imports.has(call.expression.text) ||
      !call.arguments[0] ||
      !ts.isObjectLiteralExpression(call.arguments[0])
    )
      continue
    const options = call.arguments[0]
    if (
      options.properties.some(
        (property) => property.name?.getText(output) === '__typeProps',
      )
    ) {
      throw new Error('Compiled component already declares __typeProps')
    }
    const start = options.getStart(output) + 1
    return `${compiled.slice(0, start)}\n__typeProps: {} as (${props.getText(source)}),${compiled.slice(start)}`
  }
  throw new Error('Missing compiled defineComponent owner for type-based props')
}
