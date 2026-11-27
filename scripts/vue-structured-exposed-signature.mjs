import ts from 'typescript'

import {
  hasTypeFlag,
  loadStructuredTypeScript,
} from './lib/structured-typescript.mjs'

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

  const { checker, sourceFile } = loadStructuredTypeScript({
    root,
    sourceRelativePath,
    sourceOverrides,
    extraction: 'exposed',
    virtualSource: { content: scriptContent },
  })

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
