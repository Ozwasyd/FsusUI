import { checkCascaderPopperContract } from './check-cascader-popper-contract.mjs'
import { checkFocusRingContract } from './check-focus-ring-contract.mjs'
import { checkFormStateContract } from './check-form-state-contract.mjs'
import { checkMenuPopupContract } from './check-menu-popup-contract.mjs'
import { checkMessageBoxContract } from './check-message-box-contract.mjs'
import { checkMessageContract } from './check-message-contract.mjs'
import { checkNotificationContract } from './check-notification-contract.mjs'
import { checkPopoverSurfaceContract } from './check-popover-surface-contract.mjs'
import { findThemeScaleViolations } from './check-theme-scale-contract.mjs'
import { checkUploadFocusContract } from './check-upload-focus-contract.mjs'
import { isMainModule } from './lib/scss-contract-utils.mjs'

const THEME_SURFACE_SUITES = [
  ['focus-ring-contract', checkFocusRingContract],
  ['theme-scale-contract', () => findThemeScaleViolations()],
  ['form-state-contract', checkFormStateContract],
  ['upload-focus-contract', checkUploadFocusContract],
  ['popover-surface-contract', checkPopoverSurfaceContract],
  ['cascader-popper-contract', checkCascaderPopperContract],
  ['menu-popup-contract', checkMenuPopupContract],
  ['message-box-contract', checkMessageBoxContract],
  ['message-contract', checkMessageContract],
  ['notification-contract', checkNotificationContract],
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
    console.error(['theme-surface-contracts check failed:', ...failures].join('\n'))
    process.exitCode = 1
  } else {
    console.log(
      `theme-surface-contracts check passed (${THEME_SURFACE_SUITES.length} contracts)`,
    )
  }
}
