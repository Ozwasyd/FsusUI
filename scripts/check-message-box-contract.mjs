import {
  isMainModule,
  readRepoFile,
  reportContractResult,
  topLevelBlocks,
} from './lib/scss-contract-utils.mjs'

export function checkMessageBoxContract() {
  const failures = []
  const messageBoxFile = 'vue/packages/theme-chalk/src/message-box.scss'
  const source = readRepoFile(messageBoxFile)

  if (!source.includes('box-shadow: var(--fsus-shadow-panel, none);')) {
    failures.push(
      `${messageBoxFile}: MessageBox panel must use border-first panel shadow`,
    )
  }
  if (source.includes("box-shadow: getCssVar('box-shadow-light')")) {
    failures.push(
      `${messageBoxFile}: MessageBox panel must not use the light shadow token by default`,
    )
  }
  if (source.includes("getCssVar('transition-duration')")) {
    failures.push(
      `${messageBoxFile}: MessageBox motion must not use generic transition duration`,
    )
  }

  for (const expected of [
    'animation: modal-fade-in var(--fsus-motion-overlay, 300ms)',
    'animation: modal-fade-out var(--fsus-motion-overlay, 300ms)',
    'animation: msgbox-fade-in var(--fsus-motion-panel, 360ms)',
    'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
    'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
  ]) {
    if (!source.includes(expected)) {
      failures.push(`${messageBoxFile}: Missing ${expected}`)
    }
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  let hasMessageBoxPanel = false
  for (const block of topLevelBlocks(readRepoFile(themeFile))) {
    if (!block.selector.includes('.NS-message-box')) continue
    if (block.body.includes('@include fsus-floating')) {
      failures.push(
        `${themeFile}:${block.startLine} MessageBox must not inherit the floating material mixin`,
      )
    }
    if (block.body.includes('backdrop-filter')) {
      failures.push(
        `${themeFile}:${block.startLine} MessageBox panel must not restore default backdrop blur`,
      )
    }
    if (
      block.body.includes('border: 1px solid var(--el-border-color-light);') &&
      block.body.includes('box-shadow: var(--fsus-shadow-panel, none);')
    ) {
      hasMessageBoxPanel = true
    }
  }

  if (!hasMessageBoxPanel) {
    failures.push(
      `${themeFile}: MessageBox needs an explicit border-first panel override`,
    )
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkMessageBoxContract(),
    failureHeader: 'message-box contract check failed.',
    successMessage: 'message-box-contract check passed',
  })
}
