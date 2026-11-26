import {
  isMainModule,
  lineNumberAt,
  readRepoFile,
  readScssBundle,
  reportContractResult,
  selectorItems,
  topLevelBlocks,
  withoutLineComments,
} from './lib/scss-contract-utils.mjs'

export function checkMessageContract() {
  const failures = []
  const messageFile = 'vue/packages/theme-chalk/src/message.scss'
  const source = readRepoFile(messageFile)
  const sourceWithoutComments = withoutLineComments(source)

  for (const match of sourceWithoutComments.matchAll(
    /(?:^|\s)(?:-webkit-)?backdrop-filter\s*:/gu,
  )) {
    failures.push(
      `${messageFile}:${lineNumberAt(
        sourceWithoutComments,
        match.index ?? 0,
      )} Message must not apply backdrop-filter by default`,
    )
  }

  if (source.includes("box-shadow: getCssVar('box-shadow', 'light')")) {
    failures.push(
      `${messageFile}: Message must not use the legacy light shadow by default`,
    )
  }
  if (source.includes('var(--fsus-shadow-floating)')) {
    failures.push(
      `${messageFile}: Message must stay lighter than Notification and not use --fsus-shadow-floating`,
    )
  }
  if (!source.includes("box-shadow: getCssVar('message', 'shadow');")) {
    failures.push(
      `${messageFile}: Message must use the component shadow token by default`,
    )
  }
  if (!source.includes('max-width: min(420px, calc(100% - 32px));')) {
    failures.push(`${messageFile}: Message must keep a compact toast max-width`)
  }
  if (sourceWithoutComments.includes('&::before')) {
    failures.push(
      `${messageFile}: Message must not add decorative pseudo markers`,
    )
  }
  if (source.includes("getCssVar('transition-duration')")) {
    failures.push(
      `${messageFile}: Message motion must not use generic transition duration`,
    )
  }

  for (const expected of [
    'opacity var(--fsus-motion-control-fast, 140ms)',
    'transform var(--fsus-motion-panel, 360ms)',
    'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
    'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
  ]) {
    if (!source.includes(expected)) {
      failures.push(`${messageFile}: Missing ${expected}`)
    }
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  const themeSource = readScssBundle(themeFile)
  const themeWithoutComments = withoutLineComments(themeSource)
  let hasMessageToastSurface = false

  if (themeWithoutComments.includes('.#{$namespace}-message__content')) {
    failures.push(
      `${themeFile}: Message content typography must stay owned by message.scss`,
    )
  }
  if (themeWithoutComments.includes('.#{$namespace}-message--')) {
    failures.push(
      `${themeFile}: Message status variants must stay owned by message.scss`,
    )
  }

  for (const block of topLevelBlocks(themeSource)) {
    if (!selectorItems(block.selector).includes('.NS-message')) continue
    for (const [forbidden, message] of [
      [
        '@include fsus-floating',
        'Message must not inherit the floating blur mixin',
      ],
      [
        'backdrop-filter',
        'Message theme overrides must not restore default backdrop blur',
      ],
      [
        'var(--fsus-shadow-floating)',
        'Message must not inherit Notification-level shadow',
      ],
      [
        'var(--fsus-radius-floating)',
        'Message must use compact toast radius, not floating radius',
      ],
      [
        'var(--fsus-notification-max-width)',
        'Message must not reuse Notification max-width',
      ],
      [
        'padding: var(--fsus-space-3) var(--fsus-space-4);',
        'Message theme overrides must not replace component padding',
      ],
      [
        'border-radius: 12px;',
        'Message theme overrides must not hard-code panel radius',
      ],
      [
        '&::before',
        'Message theme overrides must not add decorative pseudo markers',
      ],
    ]) {
      if (block.body.includes(forbidden)) {
        failures.push(`${themeFile}:${block.startLine} ${message}`)
      }
    }

    if (
      block.body.includes(
        'background: var(--fsus-message-bg, var(--el-bg-color));',
      ) &&
      block.body.includes(
        'border: 1px solid var(--fsus-message-border, var(--el-border-color-lighter));',
      ) &&
      block.body.includes(
        'border-radius: var(--fsus-message-radius, var(--el-message-border-radius));',
      ) &&
      block.body.includes('box-shadow: var(--fsus-shadow-panel-light);')
    ) {
      hasMessageToastSurface = true
    }
  }

  if (!hasMessageToastSurface) {
    failures.push(
      `${themeFile}: Message needs an explicit compact toast surface override`,
    )
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkMessageContract(),
    failureHeader: 'message contract check failed.',
    successMessage: 'message-contract check passed',
  })
}
