import path from 'node:path'
import ts from 'typescript'

import {
  hasTypeFlag,
  loadStructuredTypeScript,
} from './lib/structured-typescript.mjs'

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

  const { checker, sourceFile } = loadStructuredTypeScript({
    root,
    sourceRelativePath,
    sourceOverrides,
    extraction: 'emit',
  })

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
