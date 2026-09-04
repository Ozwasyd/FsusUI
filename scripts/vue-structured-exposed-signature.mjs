import path from 'node:path'
import ts from 'typescript'

const hasTypeFlag = (type, flag) =>
  type.isUnion()
    ? type.types.some((part) => (part.flags & flag) !== 0)
    : (type.flags & flag) !== 0

const unknownType = (type) =>
  hasTypeFlag(type, ts.TypeFlags.Any) || hasTypeFlag(type, ts.TypeFlags.Unknown)

const typeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope

const propertyName = (property, sourceFile) => {
  const name = property.name
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  if (ts.isComputedPropertyName(name)) {
    const value = ts.getConstantValue(name.expression)
    return typeof value === 'string' ? value : null
  }
  return name?.getText(sourceFile) ?? null
}

const exposedValue = (property) => {
  if (ts.isShorthandPropertyAssignment(property)) return property.name
  if (ts.isPropertyAssignment(property)) return property.initializer
  if (ts.isMethodDeclaration(property)) return property
  return null
}

export const extractStructuredExposedSignatures = ({
  root,
  sourceRelativePath,
  scriptContent,
  memberNames,
  sourceOverrides = new Map(),
}) => {
  const requested = new Set(memberNames ?? [])
  if (requested.size === 0) return new Map()

  const configPath = path.join(root, 'vue/tsconfig.web.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(
      `TypeScript config failed for structured exposed extraction: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`,
    )
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  )
  const sourcePath = path.resolve(root, sourceRelativePath)
  // Keep the virtual file adjacent to the SFC so its relative imports resolve
  // exactly as they do in the source module.
  const entryPath = `${sourcePath}.ts`
  const overrides = new Map(
    [...sourceOverrides].map(([file, content]) => [
      path.resolve(root, file),
      content,
    ]),
  )
  overrides.set(entryPath, scriptContent)

  const host = ts.createCompilerHost(parsed.options)
  const readSource = (fileName) =>
    overrides.get(path.resolve(fileName)) ?? ts.sys.readFile(fileName)
  host.readFile = readSource
  host.fileExists = (fileName) =>
    overrides.has(path.resolve(fileName)) || ts.sys.fileExists(fileName)
  host.getSourceFile = (fileName, languageVersion, onError) => {
    const content = readSource(fileName)
    if (content === undefined) {
      onError?.(`Cannot read ${fileName}`)
      return undefined
    }
    return ts.createSourceFile(
      fileName,
      content,
      languageVersion,
      true,
      ts.getScriptKindFromFileName(fileName),
    )
  }

  const program = ts.createProgram({
    rootNames: [entryPath],
    options: parsed.options,
    host,
  })
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(entryPath)
  if (!sourceFile) {
    throw new Error(
      `TypeScript source missing for structured exposed extraction: ${sourceRelativePath}`,
    )
  }

  let exposeObject = null
  let exposeObjectCount = 0
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineExpose' &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      exposeObjectCount += 1
      exposeObject = node.arguments[0]
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!exposeObject || exposeObjectCount !== 1) {
    return new Map(
      [...requested].sort().map((name) => [
        name,
        {
          kind: 'unknown',
          reason: 'exactly one object-literal defineExpose call is required',
          parameters: [],
          returnType: null,
        },
      ]),
    )
  }

  const properties = new Map()
  for (const property of exposeObject.properties) {
    const name = propertyName(property, sourceFile)
    if (name && requested.has(name)) properties.set(name, property)
  }

  const result = new Map()
  for (const memberName of [...requested].sort()) {
    const property = properties.get(memberName)
    const value = property ? exposedValue(property) : null
    if (!value) {
      result.set(memberName, {
        kind: 'unknown',
        reason: 'exposed member is unavailable from the TypeScript checker',
        parameters: [],
        returnType: null,
      })
      continue
    }
    const type = checker.getTypeAtLocation(value)
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call)
    if (signatures.length !== 1) {
      result.set(memberName, {
        kind: 'unknown',
        reason: 'exposed member must have exactly one callable signature',
        parameters: [],
        returnType: null,
      })
      continue
    }

    const signature = signatures[0]
    const returnType = checker.getReturnTypeOfSignature(signature)
    const parameters = signature.getParameters().map((parameter) => {
      const declaration = parameter.valueDeclaration
      const location = declaration ?? value
      const parameterType = checker.getTypeOfSymbolAtLocation(
        parameter,
        location,
      )
      return {
        name: parameter.name,
        type: unknownType(parameterType)
          ? null
          : checker.typeToString(parameterType, location, typeFormatFlags),
        optional:
          (parameter.flags & ts.SymbolFlags.Optional) !== 0 ||
          Boolean(declaration?.questionToken) ||
          Boolean(declaration?.initializer) ||
          hasTypeFlag(parameterType, ts.TypeFlags.Undefined),
        rest: Boolean(declaration?.dotDotDotToken),
      }
    })
    if (
      unknownType(returnType) ||
      parameters.some((parameter) => parameter.type === null)
    ) {
      result.set(memberName, {
        kind: 'unknown',
        reason: 'exposed signature contains an unresolved type',
        parameters: [],
        returnType: null,
      })
      continue
    }
    result.set(memberName, {
      kind: 'callable',
      reason: null,
      parameters,
      returnType: checker.typeToString(returnType, value, typeFormatFlags),
    })
  }
  return result
}
