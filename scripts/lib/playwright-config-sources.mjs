import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const collectConfigSources = (
  repositoryRoot,
  configRelative,
  seen = new Set(),
) => {
  const absolute = resolve(repositoryRoot, configRelative)
  if (seen.has(absolute) || !existsSync(absolute)) return []
  seen.add(absolute)
  const source = readFileSync(absolute, 'utf8')
  const sources = [source]
  for (const match of source.matchAll(
    /from\s+['"](\.\/[^'"]+\.ts|\.\/[^'"]+\.js|\.\/[^'"]+)['"]/gu,
  )) {
    let relative = match[1]
    if (!relative.endsWith('.ts') && !relative.endsWith('.js')) {
      relative = `${relative}.ts`
    }
    const child = resolve(dirname(absolute), relative)
    const childRelative = child.startsWith(repositoryRoot)
      ? child.slice(repositoryRoot.length + 1)
      : null
    if (childRelative) {
      sources.push(...collectConfigSources(repositoryRoot, childRelative, seen))
    }
  }
  return sources
}
