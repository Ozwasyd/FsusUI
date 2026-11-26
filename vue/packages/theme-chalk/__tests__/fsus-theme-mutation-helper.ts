import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileString } from 'sass'

export const compileMutatedFsusTheme = (
  themeSourceDir: string,
  from: string,
  to: string,
): { readonly css: string; readonly mutated: string; readonly shipped: string } => {
  const fsusThemePath = path.join(themeSourceDir, 'fsus-theme.scss')
  const partialsDir = path.join(themeSourceDir, 'fsus-theme')
  const candidateFiles = [
    fsusThemePath,
    ...readdirSync(partialsDir)
      .filter((file) => file.endsWith('.scss'))
      .sort()
      .map((file) => path.join(partialsDir, file)),
  ]

  let targetPath: string | undefined
  let shipped = ''
  for (const candidate of candidateFiles) {
    const content = readFileSync(candidate, 'utf8')
    if (content.includes(from)) {
      targetPath = candidate
      shipped = content
      break
    }
  }

  if (!targetPath) {
    return { css: '', mutated: '', shipped: '' }
  }

  const mutated = shipped.replace(from, to)
  const mutatedUrl = new URL('fsus-mutated:target')
  const partialName = path
    .basename(targetPath, '.scss')
    .replace(/^_/u, '')

  const entrySource =
    targetPath === fsusThemePath
      ? mutated
      : readFileSync(fsusThemePath, 'utf8').replace(
          new RegExp(`(['"])\\.\\/fsus-theme\\/${partialName}\\1`, 'u'),
          `'fsus-mutated:target'`,
        )

  const rewrittenMutated = mutated
    .replace(/@(use|forward)\s+(['"])\.\.\//gu, '@$1 $2')
    .replace(/@(use|forward)\s+(['"])\.\//gu, '@$1 $2fsus-theme/')

  const css = compileString(entrySource, {
    loadPaths: [themeSourceDir],
    style: 'expanded',
    url: pathToFileURL(fsusThemePath),
    importers: [
      {
        canonicalize(specifier) {
          return specifier === 'fsus-mutated:target' ? mutatedUrl : null
        },
        load(canonicalUrl) {
          if (canonicalUrl.href === mutatedUrl.href) {
            return { contents: rewrittenMutated, syntax: 'scss' }
          }
          return null
        },
      },
    ],
  }).css

  return { css, mutated, shipped }
}
