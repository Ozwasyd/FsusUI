import {
  isMainModule,
  lineNumberAt,
  readRepoFile,
  reportContractResult,
  selectorItems,
  topLevelBlocks,
  withoutLineComments,
} from './lib/scss-contract-utils.mjs'

export function checkNotificationContract() {
  const failures = []
  const notificationFile = 'vue/packages/theme-chalk/src/notification.scss'
  const source = readRepoFile(notificationFile)
  const sourceWithoutComments = withoutLineComments(source)

  for (const match of sourceWithoutComments.matchAll(
    /(?:right|left)\s*:\s*16px|calc\((?:-?100%\s*[-+]\s*16px)\)/gu,
  )) {
    failures.push(
      `${notificationFile}:${lineNumberAt(
        sourceWithoutComments,
        match.index ?? 0,
      )} Notification viewport offsets must use safe spacing tokens`,
    )
  }

  for (const expected of [
    'right: var(--fsus-space-3, 12px);',
    'left: var(--fsus-space-3, 12px);',
    'calc(100% + var(--fsus-space-3, 12px))',
    'calc(-100% - var(--fsus-space-3, 12px))',
  ]) {
    if (!source.includes(expected)) {
      failures.push(`${notificationFile}: Missing ${expected}`)
    }
  }

  const varFile = 'vue/packages/theme-chalk/src/common/var.scss'
  const varSource = readRepoFile(varFile)
  if (varSource.includes("'width': 360px")) {
    failures.push(`${varFile}: Notification width must not default to 360px`)
  }
  if (!/'width':\s*var\(\s*--fsus-notification-max-width/u.test(varSource)) {
    failures.push(
      `${varFile}: Notification width must use --fsus-notification-max-width`,
    )
  }
  if (varSource.includes("'shadow': getCssVar('box-shadow', 'dark')")) {
    failures.push(`${varFile}: Notification must not use dark shadow by default`)
  }
  if (!/'shadow':\s*var\(\s*--fsus-shadow-floating/u.test(varSource)) {
    failures.push(
      `${varFile}: Notification shadow must use --fsus-shadow-floating`,
    )
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  const themeSource = readRepoFile(themeFile)
  const normalizedThemeSource = withoutLineComments(themeSource).replace(
    /#\{[^}]+\}/gu,
    'NS',
  )
  let hasNotificationSafeWidth = false
  let hasNotificationFloatingMaterial = false
  let hasNotificationFixedPosition = false

  if (
    /\.NS-message,\s*\.NS-notification\s*\{[^{}]*width:\s*min\(100vw - 16px, 420px\);/u.test(
      normalizedThemeSource,
    ) ||
    /\.NS-notification\s*\{[^{}]*width:\s*min\(100vw - 16px, 420px\);/u.test(
      normalizedThemeSource,
    )
  ) {
    failures.push(
      `${themeFile}: Notification mobile width must not use the legacy 100vw - 16px override`,
    )
  }

  const blocks = topLevelBlocks(themeSource)
  for (const block of blocks) {
    if (!selectorItems(block.selector).includes('.NS-notification')) continue
    if (block.body.includes('width: var(--fsus-floating-max-width);')) {
      failures.push(
        `${themeFile}:${block.startLine} Notification must use the notification safe-width token`,
      )
    }
    if (block.body.includes('width: var(--fsus-notification-max-width);')) {
      hasNotificationSafeWidth = true
    }
    if (block.body.includes('position: fixed;')) {
      hasNotificationFixedPosition = true
    }
    if (
      /box-shadow:\s*var\(--fsus-shadow-panel/u.test(block.body) ||
      /box-shadow:\s*none\b/u.test(block.body)
    ) {
      failures.push(
        `${themeFile}:${block.startLine} Notification must not use panel/no-shadow (depth inversion vs Dialog/Drawer)`,
      )
    }
    if (
      block.body.includes('border: 1px solid') &&
      /box-shadow:\s*var\(--fsus-shadow-floating/u.test(block.body)
    ) {
      hasNotificationFloatingMaterial = true
    }
  }

  if (!hasNotificationSafeWidth) {
    failures.push(
      `${themeFile}: Notification needs a --fsus-notification-max-width override`,
    )
  }
  if (!hasNotificationFloatingMaterial) {
    failures.push(
      `${themeFile}: Notification needs border + --fsus-shadow-floating material coverage`,
    )
  }
  if (!hasNotificationFixedPosition) {
    failures.push(
      `${themeFile}: Notification must preserve fixed viewport positioning`,
    )
  }

  let hasDialogDrawerPanelDepth = false
  for (const block of blocks) {
    const items = selectorItems(block.selector)
    const hasDialog = items.some((item) => item.includes('.NS-dialog'))
    const hasDrawer = items.some((item) => item.includes('.NS-drawer'))
    if (!(hasDialog && hasDrawer)) continue
    if (/box-shadow:\s*var\(--fsus-shadow-floating/u.test(block.body)) {
      failures.push(
        `${themeFile}:${block.startLine} Dialog/Drawer must not use --fsus-shadow-floating by default`,
      )
    }
    if (
      block.body.includes('border: 1px solid') &&
      block.body.includes('box-shadow: var(--fsus-shadow-panel, none)')
    ) {
      hasDialogDrawerPanelDepth = true
    }
  }

  if (!hasDialogDrawerPanelDepth) {
    failures.push(
      `${themeFile}: Dialog/Drawer need border-first panel/no-shadow depth (issue #298)`,
    )
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkNotificationContract(),
    failureHeader: 'notification contract check failed.',
    successMessage: 'notification-contract check passed',
  })
}
