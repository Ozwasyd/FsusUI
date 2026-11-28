import { checkFocusRingContract } from './check-focus-ring-contract.mjs'
import { findThemeScaleViolations } from './check-theme-scale-contract.mjs'
import { isMainModule } from './lib/scss-contract-utils.mjs'

const THEME_SURFACE_SUITES = [
  ['focus-ring-contract', checkFocusRingContract],
  ['theme-scale-contract', () => findThemeScaleViolations()],
]

export function runThemeSurfaceContracts() {
  const failures = []
  for (const [name, checkFn] of THEME_SURFACE_SUITES) {
    const suiteFailures = checkFn()
    for (const item of suiteFailures) {
      failures.push(`[${name}] ${item}`)
    }
  }
  return failures
}

if (isMainModule(import.meta.url)) {
  const failures = runThemeSurfaceContracts()
  if (failures.length > 0) {
    console.error(
      ['theme-surface-contracts check failed:', ...failures].join('\n'),
    )
    process.exitCode = 1
  } else {
    console.log(
      `theme-surface-contracts check passed (${THEME_SURFACE_SUITES.length} contracts)`,
    )
  }
}
