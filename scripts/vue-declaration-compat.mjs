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
  const unalias = (symbol) =>
    symbol?.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol

  const parameters = (moduleName, name, file) => {
    const resolution = ts.resolveModuleName(
      moduleName,
      file.fileName,
      program.getCompilerOptions(),
      ts.sys,
    ).resolvedModule
    const key = `${resolution?.resolvedFileName}:${name}`
    if (signatures.has(key)) return signatures.get(key)
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
    symbol = unalias(symbol)
    const declaration = symbol?.declarations?.find(ts.isTypeAliasDeclaration)
    if (!declaration?.typeParameters)
      throw new Error(
        `Cannot verify installed Vue defaults for ${moduleName}.${name}.`,
      )
    const signature = { symbol, parameters: declaration.typeParameters }
    signatures.set(key, signature)
    return signature
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
    let location =
      program.getSourceFile(file.fileName) ?? ts.getOriginalNode(file)
    const referenceSymbol = (name) => {
      const original = checker.getSymbolAtLocation(ts.getOriginalNode(name))
      if (original) return unalias(original)
      // Inferred declaration types are synthetic. Resolve their names in the
      // nearest original compiler scope, rather than the file's import map.
      const root = ts.isIdentifier(name) ? name : name.left
      if (!ts.isIdentifier(root)) return undefined
      const symbol = unalias(
        checker.resolveName(
          ts.unescapeLeadingUnderscores(root.escapedText),
          location,
          ts.SymbolFlags.Type | ts.SymbolFlags.Namespace,
          false,
        ),
      )
      return ts.isIdentifier(name)
        ? symbol
        : symbol &&
            unalias(
              checker
                .getExportsOfModule(symbol)
                .find((item) => item.escapedName === name.right.escapedText),
            )
    }
    const visit = (node) => {
      const previousLocation = location
      const original = ts.getOriginalNode(node)
      const source = original.getSourceFile?.()
      if (source && program.getSourceFile(source.fileName) === source)
        location = original
      try {
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
          const signature = parameters(moduleName, name, file)
          // An import spelling is only a candidate hint. Local type/namespace
          // bindings, including unresolved references, must remain untouched.
          if (
            ts.isTypeReferenceNode(node) &&
            referenceSymbol(node.typeName) !== signature.symbol
          )
            return ts.visitEachChild(node, visit, context)
          const actual = [...node.typeArguments]
          const declared = signature.parameters
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
            node = ts.factory.updateTypeReferenceNode(
              node,
              node.typeName,
              actual,
            )
        }
        return ts.visitEachChild(node, visit, context)
      } finally {
        location = previousLocation
      }
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
