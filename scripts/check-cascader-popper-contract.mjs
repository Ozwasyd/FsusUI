import {
  extractBlock,
  extractMap,
  isMainModule,
  readRepoFile,
  readScssBundle,
  reportContractResult,
} from './lib/scss-contract-utils.mjs'

export function checkCascaderPopperContract() {
  const failures = []
  const varFile = 'vue/packages/theme-chalk/src/common/var.scss'
  const cascaderMap = extractMap(readRepoFile(varFile), 'cascader')

  for (const [expected, message] of [
    [
      "'menu-selected-text-color': getCssVar('color', 'scholarly-blue')",
      'Cascader selected text must use the interaction accent token',
    ],
    [
      "'menu-radius': getCssVar('popover-border-radius')",
      'Cascader menu radius must use the shared popover radius',
    ],
    [
      "'menu-shadow': var(--fsus-shadow-panel, none)",
      'Cascader menu shadow must default to border-first panel material',
    ],
  ]) {
    if (!cascaderMap.source.includes(expected)) {
      failures.push(`${varFile}:${cascaderMap.startLine} ${message}`)
    }
  }

  for (const forbidden of [
    "getCssVar('color-primary')",
    "getCssVar('border-radius-small')",
    "getCssVar('box-shadow-light')",
  ]) {
    if (cascaderMap.source.includes(forbidden)) {
      failures.push(
        `${varFile}:${cascaderMap.startLine} Cascader map must not include ${forbidden}`,
      )
    }
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  const dropdownBlock = extractBlock(
    readScssBundle(themeFile),
    '.#{$namespace}-cascader__dropdown',
  )

  if (!dropdownBlock) {
    failures.push(`${themeFile}: Missing Cascader dropdown material override`)
  } else {
    if (dropdownBlock.body.includes('backdrop-filter')) {
      failures.push(
        `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must not restore default backdrop blur`,
      )
    }
    if (
      !dropdownBlock.body.includes('box-shadow: var(--fsus-shadow-panel, none);')
    ) {
      failures.push(
        `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must use border-first panel shadow`,
      )
    }
    if (
      !dropdownBlock.body.includes('border-radius: var(--fsus-radius-popover);')
    ) {
      failures.push(
        `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must use the popover radius token`,
      )
    }
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkCascaderPopperContract(),
    failureHeader: 'cascader popper contract check failed.',
    successMessage: 'cascader-popper-contract check passed',
  })
}
