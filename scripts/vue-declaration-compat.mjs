// Only arguments added after the declared Vue 3.5.0 floor are candidates.
// Each omitted argument must equal its real, installed Vue declaration default.
const floorArity = new Map([
  ['DefineComponent', 19],
  ['ComponentPublicInstance', 14],
  ['ShallowRef', 1],
])
const vueModules = new Set(['vue', '@vue/runtime-core', '@vue/reactivity'])

export function createVueDefaultArgumentTransform(
  ts,
  program,
  counts = new Map(),
) {
  const checker = program.getTypeChecker()
  const signatures = new Map()
  const printer = ts.createPrinter({ removeComments: true })

  const parameters = (moduleName, name, file) => {
    const key = `${moduleName}:${name}`
    if (signatures.has(key)) return signatures.get(key)
    const resolution = ts.resolveModuleName(
      moduleName,
      file.fileName,
      program.getCompilerOptions(),
      ts.sys,
    ).resolvedModule
    const source =
      resolution &&
      (program.getSourceFile(resolution.resolvedFileName) ??
        program.getSourceFile(ts.sys.realpath(resolution.resolvedFileName)))
    const module = source && checker.getSymbolAtLocation(source)
    let symbol =
      module &&
      checker
        .getExportsOfModule(module)
        .find((item) => String(item.escapedName) === name)
    if (symbol?.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol)
    const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration)
    if (!declaration?.typeParameters)
      throw new Error(
        `Cannot verify installed Vue defaults for ${moduleName}.${name}.`,
      )
    signatures.set(key, declaration.typeParameters)
    return declaration.typeParameters
  }

  return (context) => (file) => {
    const imports = new Map()
    const namespaces = new Map()
    for (const statement of file.statements ?? []) {
      if (
        !ts.isImportDeclaration(statement) ||
        !vueModules.has(statement.moduleSpecifier.text)
      )
        continue
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings))
        for (const entry of bindings.elements)
          imports.set(String(entry.name.escapedText), [
            statement.moduleSpecifier.text,
            String((entry.propertyName ?? entry.name).escapedText),
          ])
      else if (bindings && ts.isNamespaceImport(bindings))
        namespaces.set(
          String(bindings.name.escapedText),
          statement.moduleSpecifier.text,
        )
    }
    const render = (node) =>
      printer.printNode(ts.EmitHint.Unspecified, node, file)
    const visit = (node) => {
      let moduleName, name
      if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal) &&
        node.qualifier &&
        ts.isIdentifier(node.qualifier)
      ) {
        moduleName = node.argument.literal.text
        name = String(node.qualifier.escapedText)
      } else if (ts.isTypeReferenceNode(node)) {
        if (ts.isIdentifier(node.typeName))
          [moduleName, name] =
            imports.get(String(node.typeName.escapedText)) ?? []
        else if (ts.isIdentifier(node.typeName.left)) {
          moduleName = namespaces.get(String(node.typeName.left.escapedText))
          name = String(node.typeName.right.escapedText)
        }
      }
      const cap = vueModules.has(moduleName) && floorArity.get(name)
      if (cap && node.typeArguments?.length > cap) {
        const actual = [...node.typeArguments]
        const declared = parameters(moduleName, name, file)
        if (actual.length > declared.length)
          throw new Error(`Unexpected Vue argument count for ${name}.`)
        while (actual.length > cap) {
          const index = actual.length - 1
          const fallback = declared[index].default
          const argument = actual[index]
          let matches =
            fallback?.kind === ts.SyntaxKind.AnyKeyword &&
            argument.kind === ts.SyntaxKind.AnyKeyword
          if (
            fallback &&
            ts.isTypeReferenceNode(fallback) &&
            ts.isIdentifier(fallback.typeName) &&
            !fallback.typeArguments
          ) {
            const earlier = declared.findIndex(
              (parameter) =>
                String(parameter.name.escapedText) ===
                String(fallback.typeName.escapedText),
            )
            matches =
              earlier >= 0 &&
              earlier < index &&
              render(argument) === render(actual[earlier])
          }
          if (!matches)
            throw new Error(
              `Non-default Vue ${name} argument ${index + 1} cannot target the 3.5.0 floor.`,
            )
          actual.pop()
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        if (ts.isImportTypeNode(node))
          node = ts.factory.updateImportTypeNode(
            node,
            node.argument,
            node.attributes,
            node.qualifier,
            actual,
            node.isTypeOf,
          )
        else
          node = ts.factory.updateTypeReferenceNode(node, node.typeName, actual)
      }
      return ts.visitEachChild(node, visit, context)
    }
    return ts.visitNode(file, visit)
  }
}

export function withVueDeclarationDefaults(ts, program) {
  const original = program.emit
  program.emit = function (...args) {
    const counts = new Map()
    const transforms = args[4] ?? {}
    args[4] = {
      ...transforms,
      afterDeclarations: [
        ...(transforms.afterDeclarations ?? []),
        createVueDefaultArgumentTransform(ts, program, counts),
      ],
    }
    const result = Reflect.apply(original, this, args)
    if (counts.size)
      console.log(
        `[vue-declaration-defaults] ${JSON.stringify(Object.fromEntries(counts))}`,
      )
    return result
  }
  return program
}
