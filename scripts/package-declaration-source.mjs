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
  const values = new Map()
  const extraTypes = new Map()
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
        if (
          ts.isIdentifier(declaration.name) &&
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          )
        )
          values.set(declaration.name.text, declaration)
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
          const properties = expression.arguments[1]
          if (properties && ts.isObjectLiteralExpression(properties)) {
            const members = new Map()
            const entries = []
            for (const property of properties.properties) {
              if (
                !ts.isPropertyAssignment(property) &&
                !ts.isShorthandPropertyAssignment(property)
              )
                throw new Error(`Unsupported installed extras in ${fileName}.`)
              const key = property.name.getText(source)
              const value = expressionType(
                ts.isPropertyAssignment(property)
                  ? property.initializer
                  : property.name,
              )
              if (!value)
                throw new Error(
                  `Unsupported installed extra type in ${fileName}.`,
                )
              members.set(key, value)
              const alias = values.get(key)?.initializer
              const direct =
                alias &&
                ts.isPropertyAccessExpression(alias) &&
                ts.isIdentifier(alias.expression) &&
                alias.expression.text === declaration.name.text &&
                alias.name.text === key
              // Root the public extra in its own factory/SFC, not back through
              // the aggregate property that exposes it during serialization.
              entries.push(`${key}: ${direct ? `typeof ${key}` : value}`)
            }
            extraTypes.set(declaration.name.text, members)
            parameters.push(`{ ${entries.join('; ')} }`)
          } else parameters.push(extra)
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
        type =
          extraTypes
            .get(expression.expression.text)
            ?.get(expression.name.text) ?? expressionType(expression)
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
