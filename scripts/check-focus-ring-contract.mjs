import {
  isMainModule,
  readRepoFile,
  reportContractResult,
  walkScssFiles,
} from './lib/scss-contract-utils.mjs'

const weakFocusRingPattern =
  /(?:box-shadow:\s*inset 0 0 0 1px var\(--fsus-scholarly-blue\b|@include\s+a11y-focus-ring\(\s*1px\b)/

export function checkFocusRingContract() {
  const failures = []
  for (const file of walkScssFiles()) {
    readRepoFile(file)
      .split(/\r?\n/u)
      .forEach((line, index) => {
        if (weakFocusRingPattern.test(line)) {
          failures.push(`${file}:${index + 1}`)
        }
      })
  }
  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkFocusRingContract(),
    failureHeader:
      'production SCSS must not use 1px Scholarly Blue focus rings.',
    successMessage: 'focus-ring-contract check passed',
  })
}
