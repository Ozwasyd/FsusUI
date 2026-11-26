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

export const lineNumberAt = (source, index) =>
  source.slice(0, Math.max(0, index)).split(/\r?\n/u).length

export const withoutLineComments = (source) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n')

export const stripAllComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '')

export const selectorItems = (selector) =>
  selector
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const extractMap = (source, mapName) => {
  const start = source.indexOf(`$${mapName}: map.merge(`)
  if (start === -1) {
    throw new Error(`Missing $${mapName} map in common/var.scss`)
  }
  const endMarker = `\n  $${mapName}\n);`
  const end = source.indexOf(endMarker, start)
  if (end === -1) {
    throw new Error(`Could not find end of $${mapName} map in common/var.scss`)
  }
  return {
    source: source.slice(start, end + endMarker.length),
    startLine: lineNumberAt(source, start),
  }
}

export const extractBlock = (source, selector, openToken = ' {') => {
  const start = source.indexOf(selector)
  if (start === -1) return undefined
  const open = source.indexOf(openToken, start)
  if (open === -1) return undefined
  const braceIndex = open + openToken.indexOf('{')

  let depth = 0
  for (let index = braceIndex; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          body: source.slice(braceIndex + 1, index),
          startLine: lineNumberAt(source, start),
        }
      }
    }
  }
  return undefined
}

export const extractBlockAfter = (source, needle) =>
  extractBlock(source, needle, '{')

export const topLevelBlocks = (
  source,
  { normalizeInterpolations = true } = {},
) => {
  const stripped = withoutLineComments(source)
  const normalizedSource = normalizeInterpolations
    ? stripped.replace(/#\{[^}]+\}/gu, 'NS')
    : stripped
  const blocks = []
  let depth = 0
  let selectorStart = 0

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const char = normalizedSource[index]
    if (char === '{') {
      if (depth === 0) {
        blocks.push({
          selector: normalizedSource.slice(selectorStart, index).trim(),
          bodyStart: index + 1,
          startLine: lineNumberAt(normalizedSource, selectorStart),
        })
      }
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const block = blocks[blocks.length - 1]
        block.body = normalizedSource.slice(block.bodyStart, index)
        selectorStart = index + 1
      }
    }
  }

  return blocks.filter((block) => typeof block.body === 'string')
}

export const walkScssFiles = (
  relativeDir = 'vue/packages/theme-chalk/src',
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
