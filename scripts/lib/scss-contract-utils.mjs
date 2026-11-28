import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

export const readRepoFile = (relativePath, root = repoRoot) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const resolveScssPartial = (baseDir, specifier) => {
  const normalized = specifier.endsWith('.scss')
    ? specifier
    : `${specifier}.scss`
  const direct = path.resolve(baseDir, normalized)
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct
  const partial = path.resolve(
    baseDir,
    path.dirname(normalized),
    `_${path.basename(normalized)}`,
  )
  if (fs.existsSync(partial) && fs.statSync(partial).isFile()) return partial
  return null
}

export const readScssBundle = (
  relativePath,
  root = repoRoot,
  visited = new Set(),
) => {
  const absPath = path.resolve(root, relativePath)
  if (visited.has(absPath)) return ''
  visited.add(absPath)

  const source = fs.readFileSync(absPath, 'utf8')
  const baseDir = path.dirname(absPath)
  const localDirectivePattern =
    /^\s*@(?:use|forward)\s+['"](\.\/[^'"]+)['"][^;]*;\s*$/gmu
  const chunks = []
  let hasLocalDirective = false

  for (const match of source.matchAll(localDirectivePattern)) {
    const resolved = resolveScssPartial(baseDir, match[1])
    if (!resolved) continue
    hasLocalDirective = true
    const rel = path.relative(root, resolved)
    chunks.push(
      readScssBundle(rel, root, visited).replace(
        /^\s*@(?:use|forward)\s+['"][^'"]+['"][^;]*;\s*$/gmu,
        '',
      ),
    )
  }

  if (!hasLocalDirective) return source
  const remainder = source.replace(localDirectivePattern, '').trim()
  return [...chunks.filter(Boolean), ...(remainder ? [remainder] : [])].join(
    '\n',
  )
}

export const lineNumberAt = (source, index) =>
  source.slice(0, Math.max(0, index)).split(/\r?\n/u).length

export const withoutLineComments = (source) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n')

export const stripAllComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '')

export const walkScssFiles = (
  relativeDir = 'vue/packages/theme/src',
  root = repoRoot,
) => {
  const results = []
  const visit = (relDir) => {
    const absDir = path.join(root, relDir)
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const nextRel = path.join(relDir, entry.name)
      if (entry.isDirectory()) visit(nextRel)
      else if (entry.isFile() && entry.name.endsWith('.scss')) {
        results.push(nextRel.replaceAll(path.sep, '/'))
      }
    }
  }
  visit(relativeDir)
  return results
}

export const isMainModule = (metaUrl) =>
  Boolean(
    process.argv[1] &&
      path.resolve(process.argv[1]) === fileURLToPath(metaUrl),
  )

export const reportContractResult = ({
  failures,
  failureHeader,
  successMessage,
}) => {
  if (failures.length > 0) {
    console.error([failureHeader, ...failures].join('\n'))
    process.exitCode = 1
    return false
  }
  console.log(successMessage)
  return true
}
