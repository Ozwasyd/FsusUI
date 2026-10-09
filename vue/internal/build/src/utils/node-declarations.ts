import path from 'node:path'
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { PKG_NAME } from '@element-plus/build-constants'
import { ts } from 'ts-morph'

const compilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
}

const importAttributes = () =>
  ts.factory.createImportAttributes(
    ts.factory.createNodeArray([
      ts.factory.createImportAttribute(
        ts.factory.createStringLiteral('resolution-mode'),
        ts.factory.createStringLiteral('import'),
      ),
    ]),
  )

const collectDeclarations = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name)
      return entry.isDirectory()
        ? collectDeclarations(file)
        : Promise.resolve(file.endsWith('.d.ts') ? [file] : [])
    }),
  )
  return files.flat()
}

/** Keep the canonical inferred types; change only their module resolution. */
export function rewriteNodeDeclaration(
  text: string,
  filename: string,
  format: 'esm' | 'cjs',
  declarations: ReadonlySet<string>,
  global = false,
) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  )
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  const importModes = new Map<string, boolean>()
  const commonJsSpecifiers = new Map<string, string>()
  const externalModules = new Map<
    string,
    { checker: ts.TypeChecker; exports: readonly ts.Symbol[] }
  >()
  const names = new Set<string>()
  const collectNames = (node: ts.Node) => {
    if (ts.isIdentifier(node)) names.add(node.text)
    ts.forEachChild(node, collectNames)
  }
  collectNames(source)
  const exportedValues = new Set<string>()
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) {
          exportedValues.add((element.propertyName || element.name).text)
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      const collectExportedValues = (node: ts.Node) => {
        if (ts.isIdentifier(node)) exportedValues.add(node.text)
        ts.forEachChild(node, collectExportedValues)
      }
      collectExportedValues(statement.expression)
    }
  }
  let nextName = 0
  const privateName = () => {
    let name: string
    do name = `__fsusNodeImport${nextName++}`
    while (names.has(name))
    names.add(name)
    return ts.factory.createIdentifier(name)
  }
  const resolveCommonJs = (specifier: string) =>
    ts.resolveModuleName(
      specifier,
      filename,
      compilerOptions,
      ts.sys,
      undefined,
      undefined,
      ts.ModuleKind.CommonJS,
    ).resolvedModule
  const needsImportMode = (specifier: string) => {
    if (specifier === PKG_NAME) return global
    if (specifier.startsWith('.')) return false
    if (importModes.has(specifier)) return importModes.get(specifier)
    const resolved = resolveCommonJs(specifier)
    if (!resolved) {
      throw new Error(
        `Cannot resolve declaration import ${specifier} in ${filename}`,
      )
    }
    const isEsm =
      ts.getImpliedNodeFormatForFile(
        resolved.resolvedFileName,
        undefined,
        ts.sys,
        compilerOptions,
      ) === ts.ModuleKind.ESNext
    importModes.set(specifier, isEsm)
    return isEsm
  }
  const externalModule = (specifier: string) => {
    const cached = externalModules.get(specifier)
    if (cached) return cached
    const resolved = resolveCommonJs(specifier)
    if (!resolved) {
      throw new Error(
        `Cannot resolve declaration import ${specifier} in ${filename}`,
      )
    }
    const program = ts.createProgram(
      [resolved.resolvedFileName],
      compilerOptions,
    )
    const checker = program.getTypeChecker()
    const file = program.getSourceFile(resolved.resolvedFileName)
    const symbol = file && checker.getSymbolAtLocation(file)
    if (!symbol) {
      throw new Error(
        `Cannot inspect declaration exports ${specifier} in ${filename}`,
      )
    }
    const entry = { checker, exports: checker.getExportsOfModule(symbol) }
    externalModules.set(specifier, entry)
    return entry
  }
  const targetSymbol = (checker: ts.TypeChecker, symbol: ts.Symbol) =>
    symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol
  const importedSymbol = (specifier: string, name: string) => {
    const { checker, exports } = externalModule(specifier)
    const symbol = exports.find((entry) => entry.name === name)
    if (!symbol) {
      throw new Error(
        `Cannot resolve declaration export ${name} from ${specifier} in ${filename}`,
      )
    }
    return targetSymbol(checker, symbol)
  }
  const importedType = (
    specifier: string,
    name?: ts.EntityName,
    arguments_?: readonly ts.TypeNode[],
    value = false,
  ) =>
    ts.factory.createImportTypeNode(
      ts.factory.createLiteralTypeNode(
        ts.factory.createStringLiteral(specifier),
      ),
      importAttributes(),
      name,
      arguments_,
      value,
    )
  const typeParameters = (
    specifier: string,
    symbol: ts.Symbol,
    binding: ts.EntityName,
  ) => {
    const declaration = symbol.declarations?.find(
      (node) =>
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node),
    ) as
      | ts.ClassDeclaration
      | ts.InterfaceDeclaration
      | ts.TypeAliasDeclaration
      | undefined
    if (!declaration?.typeParameters) return undefined
    const parameters = declaration.typeParameters
    const { checker, exports } = externalModule(specifier)
    const hasPrivateOwner = (type: ts.TypeNode) => {
      let privateOwner = false
      const visit = (node: ts.Node) => {
        if (ts.isTypeReferenceNode(node) || ts.isTypeQueryNode(node)) {
          const referenced = checker.getSymbolAtLocation(
            ts.isTypeReferenceNode(node) ? node.typeName : node.exprName,
          )
          if (
            referenced &&
            !(referenced.flags & ts.SymbolFlags.TypeParameter) &&
            !exports.some(
              (entry) =>
                targetSymbol(checker, entry) ===
                targetSymbol(checker, referenced),
            ) &&
            targetSymbol(checker, referenced).declarations?.some((owner) =>
              ts.isExternalModule(owner.getSourceFile()),
            )
          ) {
            privateOwner = true
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(type)
      return privateOwner
    }
    const projectParameter = (index: number, defaults: boolean) => {
      const inferred = parameters.map(() => privateName())
      const instance = defaults
        ? ts.factory.createTypeReferenceNode(
            binding,
            index
              ? declaration
                  .typeParameters!.slice(0, index)
                  .map((parameter) =>
                    ts.factory.createTypeReferenceNode(
                      parameter.name,
                      undefined,
                    ),
                  )
              : undefined,
          )
        : ts.isClassDeclaration(declaration)
          ? ts.factory.createTypeReferenceNode('InstanceType', [
              ts.factory.createTypeQueryNode(binding),
            ])
          : ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword)
      return ts.factory.createConditionalTypeNode(
        instance,
        ts.factory.createTypeReferenceNode(
          binding,
          inferred.map((name) =>
            ts.factory.createInferTypeNode(
              ts.factory.createTypeParameterDeclaration(undefined, name),
            ),
          ),
        ),
        ts.factory.createTypeReferenceNode(inferred[index], undefined),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
      )
    }
    const qualifyType = (type: ts.TypeNode) => {
      const result = ts.transform(type, [
        (context) => {
          const qualify: ts.Visitor = (node) => {
            if (ts.isTypeReferenceNode(node) || ts.isTypeQueryNode(node)) {
              const reference = ts.isTypeReferenceNode(node)
                ? node.typeName
                : node.exprName
              const referenced = checker.getSymbolAtLocation(reference)
              const owner =
                referenced &&
                exports.find(
                  (entry) =>
                    targetSymbol(checker, entry) ===
                    targetSymbol(checker, referenced),
                )
              if (owner) {
                return importedType(
                  specifier,
                  ts.factory.createIdentifier(owner.name),
                  node.typeArguments?.map(
                    (argument) =>
                      ts.visitNode(argument, qualify) as ts.TypeNode,
                  ),
                  ts.isTypeQueryNode(node),
                )
              }
            }
            return ts.visitEachChild(node, qualify, context)
          }
          return (node) => ts.visitNode(node, qualify) as ts.TypeNode
        },
      ])
      try {
        return result.transformed[0]
      } finally {
        result.dispose()
      }
    }
    return declaration.typeParameters.map((parameter, index) =>
      ts.factory.createTypeParameterDeclaration(
        parameter.modifiers?.filter(
          (modifier) => modifier.kind !== ts.SyntaxKind.ConstKeyword,
        ),
        parameter.name.text,
        parameter.constraint &&
          (hasPrivateOwner(parameter.constraint)
            ? projectParameter(index, false)
            : qualifyType(parameter.constraint)),
        parameter.default &&
          (hasPrivateOwner(parameter.default)
            ? projectParameter(index, true)
            : qualifyType(parameter.default)),
      ),
    )
  }
  const namespaceTypes = (
    specifier: string,
    symbol: ts.Symbol,
    binding: ts.EntityName,
    seen = new Set<ts.Symbol>(),
  ): ts.Statement[] => {
    const { checker } = externalModule(specifier)
    if (seen.has(symbol)) {
      throw new Error(
        `Cannot materialize recursive namespace types from ${specifier} in ${filename}`,
      )
    }
    const next = new Set(seen).add(symbol)
    return checker.getExportsOfModule(symbol).flatMap((entry) => {
      const member = targetSymbol(checker, entry)
      const name = ts.factory.createIdentifier(entry.name)
      const owner = ts.factory.createQualifiedName(binding, name)
      const statements: ts.Statement[] = []
      if (member.flags & ts.SymbolFlags.Type) {
        const parameters = typeParameters(specifier, member, owner)
        statements.push(
          ts.factory.createTypeAliasDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            name,
            parameters,
            ts.factory.createTypeReferenceNode(
              owner,
              parameters?.map((parameter) =>
                ts.factory.createTypeReferenceNode(parameter.name, undefined),
              ),
            ),
          ),
        )
      }
      if (member.flags & ts.SymbolFlags.Namespace) {
        const body = namespaceTypes(specifier, member, owner, next)
        if (body.length)
          statements.push(
            ts.factory.createModuleDeclaration(
              [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
              name,
              ts.factory.createModuleBlock(body),
              ts.NodeFlags.Namespace,
            ),
          )
      }
      return statements
    })
  }
  const moduleExportName = (name: string) => {
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      name,
    )
    const token = scanner.scan()
    const identifier =
      token === ts.SyntaxKind.Identifier ||
      (token >= ts.SyntaxKind.FirstKeyword &&
        token <= ts.SyntaxKind.LastKeyword)
    return identifier &&
      scanner.getTokenText() === name &&
      scanner.scan() === ts.SyntaxKind.EndOfFileToken
      ? ts.factory.createIdentifier(name)
      : ts.factory.createStringLiteral(name)
  }
  const namespaceBinding = (specifier: string, local: ts.Identifier) => {
    const marker =
      '// Generated by writeNodeDeclarationFormats namespace adapter.\n'
    const digest = createHash('sha256').update(specifier).digest('hex')
    const directory = global
      ? path.join(path.dirname(filename), 'lib')
      : path.dirname(filename)
    const adapter = path.join(directory, `_fsus_node_namespace_${digest}.d.cts`)
    const existing = lstatSync(adapter, { throwIfNoEntry: false })
    if (
      existing &&
      (!existing.isFile() || !readFileSync(adapter, 'utf8').startsWith(marker))
    ) {
      throw new Error(
        `Refusing to replace an unmanaged namespace adapter in ${filename}`,
      )
    }
    const { exports } = externalModule(specifier)
    const declaration = ts.factory.createExportDeclaration(
      undefined,
      false,
      ts.factory.createNamedExports(
        exports.map((entry) =>
          ts.factory.createExportSpecifier(
            false,
            undefined,
            moduleExportName(entry.name),
          ),
        ),
      ),
      ts.factory.createStringLiteral(specifier),
    )
    const adapterSource = printer.printNode(
      ts.EmitHint.Unspecified,
      declaration,
      source,
    )
    const text =
      marker +
      rewriteNodeDeclaration(
        adapterSource,
        adapter,
        'cjs',
        declarations,
        global,
      )
    mkdirSync(directory, { recursive: true })
    writeFileSync(adapter, text)
    const relative = path
      .relative(path.dirname(filename), adapter)
      .replaceAll('\\', '/')
      .replace(/\.d\.cts$/u, '.cjs')
    return ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamespaceImport(local),
      ),
      ts.factory.createStringLiteral(
        relative.startsWith('.') ? relative : `./${relative}`,
      ),
    )
  }
  const valueBinding = (
    specifier: string,
    imported: ts.ModuleExportName,
    local: ts.Identifier,
  ) => {
    const symbol = importedSymbol(specifier, imported.text)
    const binding = privateName()
    const statements: ts.Statement[] = [
      ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
          true,
          undefined,
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
              false,
              ts.isIdentifier(imported)
                ? ts.factory.createIdentifier(imported.text)
                : ts.factory.createStringLiteral(imported.text),
              binding,
            ),
          ]),
        ),
        ts.factory.createStringLiteral(specifier),
        importAttributes(),
      ),
    ]
    // A type-only import can describe both sides of a class without serving as
    // its value export. Merge a local type alias with the exact constructor or
    // callable type, then export that one local symbol (including as default).
    if (symbol.flags & ts.SymbolFlags.Type) {
      const parameters = typeParameters(specifier, symbol, binding)
      statements.push(
        ts.factory.createTypeAliasDeclaration(
          undefined,
          local,
          parameters,
          ts.factory.createTypeReferenceNode(
            binding,
            parameters?.map((parameter) =>
              ts.factory.createTypeReferenceNode(parameter.name, undefined),
            ),
          ),
        ),
      )
    }
    if (symbol.flags & ts.SymbolFlags.Value) {
      statements.push(
        ts.factory.createVariableStatement(
          [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                local,
                undefined,
                ts.factory.createTypeQueryNode(binding),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
      )
    }
    if (symbol.flags & ts.SymbolFlags.Namespace) {
      const body = namespaceTypes(specifier, symbol, binding)
      if (body.length)
        statements.push(
          ts.factory.createModuleDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
            local,
            ts.factory.createModuleBlock(body),
            ts.NodeFlags.Namespace,
          ),
        )
    }
    if (statements.length === 1) {
      throw new Error(
        `Unsupported declaration export ${imported.text} from ${specifier} in ${filename}`,
      )
    }
    return statements
  }
  const rewriteSpecifier = (specifier: string) => {
    if (format === 'cjs') {
      if (!specifier.startsWith(`${PKG_NAME}/es/`)) return specifier
      const cached = commonJsSpecifiers.get(specifier)
      if (cached) return cached
      const candidate = specifier.replace(`${PKG_NAME}/es/`, `${PKG_NAME}/lib/`)
      // Named public facades need not expose a separate /lib facade subpath.
      // Resolve against the existing export contract rather than inventing one.
      const facade = specifier.replace(`${PKG_NAME}/es/`, `${PKG_NAME}/`)
      const rewritten = resolveCommonJs(candidate)
        ? candidate
        : resolveCommonJs(facade)
          ? facade
          : candidate
      commonJsSpecifiers.set(specifier, rewritten)
      return rewritten
    }
    if (!specifier.startsWith('.')) return specifier
    const absolute = path.resolve(path.dirname(filename), specifier)
    const directory =
      specifier.endsWith('/') ||
      ['.', '..'].includes(path.posix.basename(specifier))
    const candidates = directory
      ? [path.join(absolute, 'index.d.ts')]
      : [
          `${absolute}.d.ts`,
          path.join(absolute, 'index.d.ts'),
          absolute.replace(/\.m?js$/u, '.d.ts'),
        ]
    const owner = candidates.find((file) => declarations.has(file))
    if (!owner) {
      throw new Error(
        `Cannot resolve ESM declaration owner ${specifier} in ${filename}`,
      )
    }
    const relative = path
      .relative(path.dirname(filename), owner)
      .replaceAll('\\', '/')
    return `${relative.startsWith('.') ? '' : './'}${relative.replace(/\.d\.ts$/u, '.mjs')}`
  }
  const result = ts.transform(source, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        node = ts.visitEachChild(node, visit, context)
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
          const argument = node.argument.literal
          if (ts.isStringLiteral(argument)) {
            const specifier = rewriteSpecifier(argument.text)
            return ts.factory.updateImportTypeNode(
              node,
              ts.factory.createLiteralTypeNode(
                ts.factory.createStringLiteral(specifier),
              ),
              format === 'cjs' && needsImportMode(specifier)
                ? importAttributes()
                : node.attributes,
              node.qualifier,
              node.typeArguments,
              node.isTypeOf,
            )
          }
        }
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const specifier = rewriteSpecifier(node.moduleSpecifier.text)
          const useImportMode =
            format === 'cjs' &&
            (!ts.isImportDeclaration(node) || !!node.importClause) &&
            needsImportMode(specifier)
          if (ts.isImportDeclaration(node)) {
            if (
              useImportMode &&
              node.importClause &&
              !node.importClause.isTypeOnly &&
              node.importClause.namedBindings &&
              ts.isNamespaceImport(node.importClause.namedBindings) &&
              exportedValues.has(node.importClause.namedBindings.name.text)
            ) {
              return namespaceBinding(
                specifier,
                node.importClause.namedBindings.name,
              )
            }
            if (
              useImportMode &&
              node.importClause &&
              !node.importClause.isTypeOnly &&
              (!node.importClause.namedBindings ||
                ts.isNamedImports(node.importClause.namedBindings))
            ) {
              const clause = node.importClause
              const statements: ts.Statement[] = []
              if (clause.name) {
                if (exportedValues.has(clause.name.text)) {
                  statements.push(
                    ...valueBinding(
                      specifier,
                      ts.factory.createIdentifier('default'),
                      clause.name,
                    ),
                  )
                } else {
                  statements.push(
                    ts.factory.createImportDeclaration(
                      node.modifiers,
                      ts.factory.createImportClause(
                        true,
                        clause.name,
                        undefined,
                      ),
                      ts.factory.createStringLiteral(specifier),
                      importAttributes(),
                    ),
                  )
                }
              }
              if (
                clause.namedBindings &&
                ts.isNamedImports(clause.namedBindings)
              ) {
                for (const element of clause.namedBindings.elements) {
                  const imported = element.propertyName || element.name
                  if (
                    element.isTypeOnly ||
                    !exportedValues.has(element.name.text)
                  ) {
                    statements.push(
                      ts.factory.createImportDeclaration(
                        node.modifiers,
                        ts.factory.createImportClause(
                          true,
                          undefined,
                          ts.factory.createNamedImports([
                            ts.factory.createImportSpecifier(
                              false,
                              element.propertyName,
                              element.name,
                            ),
                          ]),
                        ),
                        ts.factory.createStringLiteral(specifier),
                        importAttributes(),
                      ),
                    )
                  } else
                    statements.push(
                      ...valueBinding(specifier, imported, element.name),
                    )
                }
              }
              return statements
            }
            return ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              useImportMode && node.importClause
                ? ts.factory.updateImportClause(
                    node.importClause,
                    true,
                    node.importClause.name,
                    node.importClause.namedBindings,
                  )
                : node.importClause,
              ts.factory.createStringLiteral(specifier),
              useImportMode ? importAttributes() : node.attributes,
            )
          }
          if (useImportMode && !node.isTypeOnly) {
            if (!node.exportClause || !ts.isNamedExports(node.exportClause)) {
              throw new Error(
                `Unsupported CJS value re-export from ${specifier} in ${filename}`,
              )
            }
            // A declaration value re-export is non-emitting. Keep the exact
            // imported callable/value type while explicitly selecting its ESM types.
            return node.exportClause.elements
              .map((element) => {
                const importedName = element.propertyName || element.name
                const symbol = importedSymbol(specifier, importedName.text)
                if (
                  element.isTypeOnly ||
                  !(symbol.flags & ts.SymbolFlags.Value)
                ) {
                  return ts.factory.createExportDeclaration(
                    node.modifiers,
                    true,
                    ts.factory.createNamedExports([
                      ts.factory.createExportSpecifier(
                        false,
                        element.propertyName,
                        element.name,
                      ),
                    ]),
                    ts.factory.createStringLiteral(specifier),
                    importAttributes(),
                  )
                }
                const local = privateName()
                return [
                  ...valueBinding(specifier, importedName, local),
                  ts.factory.createExportDeclaration(
                    node.modifiers,
                    false,
                    ts.factory.createNamedExports([
                      ts.factory.createExportSpecifier(
                        false,
                        local,
                        element.name,
                      ),
                    ]),
                  ),
                ]
              })
              .flat()
          }
          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(specifier),
            useImportMode ? importAttributes() : node.attributes,
          )
        }
        return node
      }
      return (node) => ts.visitNode(node, visit) as ts.SourceFile
    },
  ])
  try {
    return printer.printFile(result.transformed[0])
  } finally {
    result.dispose()
  }
}

export async function writeNodeDeclarationFormats(packageRoot: string) {
  const esmFiles = await collectDeclarations(path.join(packageRoot, 'es'))
  const declarations = new Set(esmFiles)
  for (const file of esmFiles) {
    const output = file.replace(/\.d\.ts$/u, '.d.mts')
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(
      output,
      rewriteNodeDeclaration(
        await readFile(file, 'utf8'),
        file,
        'esm',
        declarations,
      ),
    )
  }
  for (const file of await collectDeclarations(path.join(packageRoot, 'lib'))) {
    await writeFile(
      file,
      rewriteNodeDeclaration(
        await readFile(file, 'utf8'),
        file,
        'cjs',
        declarations,
      ),
    )
  }
  const globalFile = path.join(packageRoot, 'global.d.ts')
  await writeFile(
    globalFile,
    rewriteNodeDeclaration(
      await readFile(globalFile, 'utf8'),
      globalFile,
      'cjs',
      declarations,
      true,
    ),
  )
}
