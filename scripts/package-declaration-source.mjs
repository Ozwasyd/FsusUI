import ts from 'typescript'

// Name installed component types through their SFC owners before emission. This
// prevents serialization of Vue's internal constructor/mixin implementation.
export function annotateInstallTypes(content, fileName) {
  const source = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
  )
  const helpers = new Map()
  const aliases = new Set()
  const named = new Set()
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.text === '@element-plus/utils'
    ) {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          const name = (binding.propertyName ?? binding.name).text
          if (
            [
              'withInstall',
              'withNoopInstall',
              'withInstallFunction',
              'withInstallDirective',
            ].includes(name)
          )
            helpers.set(binding.name.text, name)
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const fn = declaration.initializer
        if (
          ts.isIdentifier(declaration.name) &&
          fn &&
          ts.isArrowFunction(fn) &&
          fn.typeParameters?.length === 1 &&
          fn.parameters[0]?.type?.getText(source) ===
            fn.typeParameters[0].name.text
        )
          aliases.add(declaration.name.text)
      }
    }
  }
  if (!helpers.size && !fileName.replaceAll('\\', '/').includes('/components/'))
    return content
  const expressionType = (expression) => {
    if (
      ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression)
    )
      return `typeof ${expression.getText(source)}`
    if (ts.isParenthesizedExpression(expression))
      return expressionType(expression.expression)
    if (ts.isAsExpression(expression)) return expression.type.getText(source)
    if (
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      aliases.has(expression.expression.text)
    ) {
      const main =
        expression.arguments[0] && expressionType(expression.arguments[0])
      if (main)
        return `ReturnType<typeof ${expression.expression.text}<${main}>>`
    }
    if (ts.isObjectLiteralExpression(expression)) {
      const properties = []
      for (const property of expression.properties) {
        if (ts.isShorthandPropertyAssignment(property))
          properties.push(`${property.name.text}: typeof ${property.name.text}`)
        else if (ts.isPropertyAssignment(property)) {
          const value = expressionType(property.initializer)
          if (!value) return undefined
          properties.push(`${property.name.getText(source)}: ${value}`)
        } else return undefined
      }
      return `{ ${properties.join('; ')} }`
    }
    return undefined
  }
  const edits = []
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.type ||
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer
      )
        continue
      const expression = declaration.initializer
      let type
      if (
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        helpers.has(expression.expression.text)
      ) {
        const helper = expression.expression.text
        const main =
          expression.arguments[0] && expressionType(expression.arguments[0])
        if (!main)
          throw new Error(
            `Unsupported installed component input in ${fileName}.`,
          )
        const parameters = [main]
        if (helpers.get(helper) === 'withInstall') {
          const extra = expression.arguments[1]
            ? expressionType(expression.arguments[1])
            : `NonNullable<Parameters<typeof ${helper}>[1]>`
          if (!extra)
            throw new Error(
              `Unsupported installed component extras in ${fileName}.`,
            )
          parameters.push(extra)
        }
        type = `ReturnType<typeof ${helper}<${parameters.join(', ')}>>`
      } else if (ts.isAsExpression(expression))
        type = expression.type.getText(source)
      else if (ts.isIdentifier(expression) && named.has(expression.text))
        type = expressionType(expression)
      else if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        named.has(expression.expression.text)
      )
        type = expressionType(expression)
      if (type) {
        edits.push({ position: declaration.name.end, type })
        named.add(declaration.name.text)
      }
    }
  }
  let result = content
  for (const { position, type } of edits.reverse())
    result = `${result.slice(0, position)}: ${type}${result.slice(position)}`
  return result
}
