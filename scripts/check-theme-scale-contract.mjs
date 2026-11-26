import {
  isMainModule,
  lineNumberAt,
  readRepoFile,
  reportContractResult,
  stripAllComments,
  walkScssFiles,
} from './lib/scss-contract-utils.mjs'

const forbiddenDuration =
  /\b(?:(?:90|120|160|180|240|250|280|320|400|500)ms|0\.(?:05|15|2)s)\b/g
const nonScaleRadius =
  /border(?:-[a-z]+)?-radius:\s*(?:0\s+)*(?:1|2|3|5|7|8|9|11|13|14|15|16|18|20|22|32)px(?:\s|;|!)/g
const weakFocusRing =
  /(?:a11y-focus-ring\(\s*1px\b|box-shadow:[^;{}]*1\.5px[^;{}]*var\(--fsus-scholarly-blue\))/gs

export const findThemeScaleViolations = () => {
  const violations = []
  for (const relativePath of walkScssFiles()) {
    const source = stripAllComments(readRepoFile(relativePath))
    for (const [kind, pattern] of [
      ['non-scale radius', nonScaleRadius],
      ['non-scale duration fallback', forbiddenDuration],
      ['weak focus ring', weakFocusRing],
    ]) {
      pattern.lastIndex = 0
      for (const match of source.matchAll(pattern)) {
        violations.push(
          `${relativePath}:${lineNumberAt(source, match.index ?? 0)} ${kind}: ${match[0].replace(/\s+/gu, ' ').trim()}`,
        )
      }
    }
  }
  return violations
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: findThemeScaleViolations(),
    failureHeader: 'theme scale contract violations:',
    successMessage: 'theme-scale-contract check passed',
  })
}
