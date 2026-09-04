import path from 'node:path'
import ts from 'typescript'

const hasTypeFlag = (type, flag) =>
  type.isUnion()
    ? type.types.some((part) => (part.flags & flag) !== 0)
    : (type.flags & flag) !== 0

const sourceObjectShape = ({ checker, type, root, location }) => {
  const nonNullable = checker.getNonNullableType(type)
  const symbol = nonNullable.aliasSymbol ?? nonNullable.getSymbol()
  const declarations = symbol?.declarations ?? []
  const sourceRoot = path.join(root, 'vue/packages')
  const typeName = checker.typeToString(
    nonNullable,
    location,
    ts.TypeFormatFlags.NoTruncation,
  )
  if (
    declarations.length === 0 ||
    declarations.some(
      (declaration) =>
        !path
          .resolve(declaration.getSourceFile().fileName)
          .startsWith(`${sourceRoot}${path.sep}`),
    )
  ) {
    return {
      kind: 'unknown',
      type: typeName,
      reason: 'framework or unresolved payload type',
    }
  }

  const properties = checker.getPropertiesOfType(nonNullable)
  if (properties.length === 0 || properties.length > 64) {
    return {
      kind: 'unknown',
      type: typeName,
      reason:
        properties.length === 0
          ? 'payload type has no readable fields'
          : 'payload type exceeds the 64-field extraction bound',
    }
  }

  return {
    kind: 'object',
    type: typeName,
    fields: properties
      .map((property) => {
        const propertyLocation = property.valueDeclaration ?? location
        const propertyType = checker.getTypeOfSymbolAtLocation(
          property,
          propertyLocation,
        )
        return {
          name: property.name,
          type: checker.typeToString(
            propertyType,
            propertyLocation,
            ts.TypeFormatFlags.NoTruncation,
          ),
          optional:
            (property.flags & ts.SymbolFlags.Optional) !== 0 ||
            hasTypeFlag(propertyType, ts.TypeFlags.Undefined),
          nullable: hasTypeFlag(propertyType, ts.TypeFlags.Null),
        }
      })
      .sort((first, second) => first.name.localeCompare(second.name)),
  }
}

export const extractStructuredEmitPayloads = ({
  root,
  sourceRelativePath,
  objectStart,
  objectEnd,
  eventNames,
  sourceOverrides = new Map(),
}) => {
  const requested = new Set(eventNames ?? [])
  if (requested.size === 0) return new Map()

  const configPath = path.join(root, 'vue/tsconfig.web.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(
      `TypeScript config failed for structured emit extraction: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`,
    )
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  )
  const entryPath = path.resolve(root, sourceRelativePath)
  const overrides = new Map(
    [...sourceOverrides].map(([file, content]) => [
      path.resolve(root, file),
      content,
    ]),
  )
  const host = ts.createCompilerHost(parsed.options)
  const readSource = (fileName) =>
    overrides.get(path.resolve(fileName)) ?? ts.sys.readFile(fileName)
  host.readFile = readSource
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
      `TypeScript source missing for structured emit extraction: ${sourceRelativePath}`,
    )
  }

  let objectNode = null
  const visit = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.getStart(sourceFile) === objectStart &&
      node.end === objectEnd
    ) {
      objectNode = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (!objectNode) {
    throw new Error(
      `TypeScript emit object not found at ${sourceRelativePath}:${objectStart}-${objectEnd}`,
    )
  }

  const objectType = checker.getTypeAtLocation(objectNode)
  const result = new Map()
  for (const eventName of [...requested].sort()) {
    const event = checker.getPropertyOfType(objectType, eventName)
    if (!event) {
      result.set(eventName, {
        kind: 'unknown',
        reason: 'emit property is not available from the TypeScript checker',
        parameters: [],
      })
      continue
    }
    const eventType = checker.getTypeOfSymbolAtLocation(event, objectNode)
    const signatures = checker.getSignaturesOfType(
      eventType,
      ts.SignatureKind.Call,
    )
    if (signatures.length !== 1) {
      result.set(eventName, {
        kind: 'unknown',
        reason: 'emit must expose exactly one callable signature',
        parameters: [],
      })
      continue
    }
    const parameters = signatures[0].getParameters().map((parameter) => {
      const declaration = parameter.valueDeclaration
      const location = declaration ?? objectNode
      const parameterType = checker.getTypeOfSymbolAtLocation(
        parameter,
        location,
      )
      return {
        name: parameter.name,
        type: checker.typeToString(
          parameterType,
          location,
          ts.TypeFormatFlags.NoTruncation,
        ),
        optional:
          (parameter.flags & ts.SymbolFlags.Optional) !== 0 ||
          hasTypeFlag(parameterType, ts.TypeFlags.Undefined),
        rest: Boolean(declaration?.dotDotDotToken),
        nullable: hasTypeFlag(parameterType, ts.TypeFlags.Null),
        shape: sourceObjectShape({
          checker,
          type: parameterType,
          root,
          location,
        }),
      }
    })
    result.set(eventName, { kind: 'callable', parameters })
  }
  return result
}
