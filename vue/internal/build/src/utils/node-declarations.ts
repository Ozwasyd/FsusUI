import path from 'node:path'
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
    const owner = [
      `${absolute}.d.ts`,
      path.join(absolute, 'index.d.ts'),
      absolute.replace(/\.m?js$/u, '.d.ts'),
    ].find((file) => declarations.has(file))
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
            return node.exportClause.elements.map((element) => {
              if (element.isTypeOnly) {
                return ts.factory.createExportDeclaration(
                  node.modifiers,
                  true,
                  ts.factory.createNamedExports([element]),
                  ts.factory.createStringLiteral(specifier),
                  importAttributes(),
                )
              }
              if (!ts.isIdentifier(element.name)) {
                throw new Error(`Unsupported CJS export name in ${filename}`)
              }
              const importedName = element.propertyName || element.name
              if (!ts.isIdentifier(importedName)) {
                throw new Error(`Unsupported CJS import name in ${filename}`)
              }
              return ts.factory.createVariableStatement(
                [
                  ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
                  ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
                ],
                ts.factory.createVariableDeclarationList(
                  [
                    ts.factory.createVariableDeclaration(
                      element.name,
                      undefined,
                      ts.factory.createImportTypeNode(
                        ts.factory.createLiteralTypeNode(
                          ts.factory.createStringLiteral(specifier),
                        ),
                        importAttributes(),
                        importedName,
                        undefined,
                        true,
                      ),
                    ),
                  ],
                  ts.NodeFlags.Const,
                ),
              )
            })
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
