import {
  extractBlockAfter,
  isMainModule,
  readRepoFile,
  reportContractResult,
  topLevelBlocks,
} from './lib/scss-contract-utils.mjs'

export function checkMenuPopupContract() {
  const failures = []
  const invalidFixtureFile = 'tests/fixtures/release-policy/invalid-cases.json'
  const invalidFixtures = JSON.parse(readRepoFile(invalidFixtureFile))
  const sharedFocusRingPattern =
    /@include\s+a11y-focus-ring\(\s*2px,\s*var\(\s*--fsus-radius-navigation,\s*var\(\s*--el-border-radius-base\s*\)\s*\)\s*\);/u

  if (sharedFocusRingPattern.test(invalidFixtures.menuFocusRing)) {
    failures.push(
      `${invalidFixtureFile}: Menu focus-ring negative fixture must reject a non-2px ring`,
    )
  }

  const menuFile = 'vue/packages/theme-chalk/src/menu.scss'
  const menuSource = readRepoFile(menuFile)
  const popupBlock = extractBlockAfter(menuSource, '@include m(popup)')

  if (!popupBlock) {
    failures.push(`${menuFile}: Missing menu popup block`)
  } else {
    if (
      !popupBlock.body.includes(
        "border-radius: getCssVar('popover-border-radius');",
      )
    ) {
      failures.push(
        `${menuFile}:${popupBlock.startLine} Menu popup radius must use the popover radius contract`,
      )
    }
    if (
      !popupBlock.body.includes('box-shadow: var(--fsus-shadow-panel, none);')
    ) {
      failures.push(
        `${menuFile}:${popupBlock.startLine} Menu popup shadow must default to border-first panel material`,
      )
    }
    for (const forbidden of [
      "getCssVar('border-radius-small')",
      "getCssVar('box-shadow-light')",
    ]) {
      if (popupBlock.body.includes(forbidden)) {
        failures.push(
          `${menuFile}:${popupBlock.startLine} Menu popup block must not include ${forbidden}`,
        )
      }
    }
  }

  const menuItemMixin = extractBlockAfter(menuSource, '@mixin menu-item')
  if (!menuItemMixin) {
    failures.push(`${menuFile}: Missing menu item mixin`)
  } else {
    if (!menuItemMixin.body.includes('&:focus:not(:focus-visible)')) {
      failures.push(
        `${menuFile}:${menuItemMixin.startLine} Menu item focus reset must not hide focus-visible`,
      )
    }
    if (!sharedFocusRingPattern.test(menuItemMixin.body)) {
      failures.push(
        `${menuFile}:${menuItemMixin.startLine} Menu item keyboard focus must use the shared 2px focus ring`,
      )
    }
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  const themeSource = readRepoFile(themeFile)
  let hasMenuPopupSurface = false

  for (const block of topLevelBlocks(themeSource)) {
    if (
      block.selector.includes('.NS-menu:not(') &&
      block.body.includes('@include fsus-panel') &&
      !block.selector.includes('.NS-menu--popup')
    ) {
      failures.push(
        `${themeFile}:${block.startLine} Ordinary menu panel rules must exclude menu popup surfaces`,
      )
    }
    if (!block.selector.includes('.NS-menu--popup')) continue
    if (block.body.includes('backdrop-filter')) {
      failures.push(
        `${themeFile}:${block.startLine} Menu popup theme overrides must not restore default backdrop blur`,
      )
    }
    if (block.body.includes('box-shadow: var(--fsus-shadow-panel-light);')) {
      failures.push(
        `${themeFile}:${block.startLine} Menu popup theme overrides must not restore light shadow`,
      )
    }
    if (
      block.body.includes('border-radius: var(--fsus-radius-popover);') &&
      block.body.includes('box-shadow: var(--fsus-shadow-panel, none);')
    ) {
      hasMenuPopupSurface = true
    }
  }

  if (!hasMenuPopupSurface) {
    failures.push(
      `${themeFile}: Menu popup must have an explicit border-first surface override`,
    )
  }
  if (themeSource.includes('.#{$namespace}-menu-item:not(.is-active):focus,')) {
    failures.push(
      `${themeFile}: Menu item theme focus resets must not hide focus-visible`,
    )
  }
  if (
    !themeSource.includes(
      '.#{$namespace}-menu-item:not(.is-active):focus:not(:focus-visible),',
    )
  ) {
    failures.push(
      `${themeFile}: Menu item theme focus reset must preserve focus-visible`,
    )
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkMenuPopupContract(),
    failureHeader: 'menu popup contract check failed.',
    successMessage: 'menu-popup-contract check passed',
  })
}
