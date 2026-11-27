import path from 'node:path'
import ts from 'typescript'

export const hasTypeFlag = (type, flag) =>
  type.isUnion()
    ? type.types.some((part) => (part.flags & flag) !== 0)
    : (type.flags & flag) !== 0

export function loadStructuredTypeScript({
  root,
  sourceRelativePath,
  sourceOverrides,
  extraction,
  virtualSource,
}) {
  const configPath = path.join(root, 'vue/tsconfig.web.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    throw new Error(
      `TypeScript config failed for structured ${extraction} extraction: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`,
    )
  }
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  )
  const sourcePath = path.resolve(root, sourceRelativePath)
  // A virtual SFC script stays alongside the component so relative imports
  // resolve as they do from the original file.
  const entryPath = virtualSource ? `${sourcePath}.ts` : sourcePath
  const overrides = new Map(
    [...sourceOverrides].map(([file, content]) => [
      path.resolve(root, file),
      content,
    ]),
  )
  const host = ts.createCompilerHost(options)
  if (virtualSource) {
    overrides.set(entryPath, virtualSource.content)
    host.fileExists = (fileName) =>
      overrides.has(path.resolve(fileName)) || ts.sys.fileExists(fileName)
  }
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
  const program = ts.createProgram({ rootNames: [entryPath], options, host })
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(entryPath)
  if (!sourceFile) {
    throw new Error(
      `TypeScript source missing for structured ${extraction} extraction: ${sourceRelativePath}`,
    )
  }
  return { checker, sourceFile }
}
