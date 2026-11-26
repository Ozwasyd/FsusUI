import {
  isMainModule,
  lineNumberAt,
  readRepoFile,
  readScssBundle,
  reportContractResult,
  topLevelBlocks,
} from './lib/scss-contract-utils.mjs'

export function checkPopoverSurfaceContract() {
  const failures = []
  const popoverFile = 'vue/packages/theme-chalk/src/popover.scss'
  const popoverSource = readRepoFile(popoverFile)

  for (const match of popoverSource.matchAll(
    /(?:^|\s)(?:-webkit-)?backdrop-filter\s*:/gu,
  )) {
    failures.push(
      `${popoverFile}:${lineNumberAt(
        popoverSource,
        match.index ?? 0,
      )} Popover must not apply backdrop-filter by default`,
    )
  }

  if (!popoverSource.includes('box-shadow: var(--fsus-shadow-panel, none);')) {
    failures.push(
      `${popoverFile}: Popover surface must use the border-first panel shadow token`,
    )
  }
  if (
    !popoverSource.includes(
      "@include a11y-focus-ring(2px, getCssVar('popover-border-radius'));",
    )
  ) {
    failures.push(
      `${popoverFile}: Popover surface must expose a 2px focus-visible ring`,
    )
  }

  const referenceBlock = popoverSource.match(
    /@include e\(reference\)\s*\{(?<body>[\s\S]*?)\n {4}\}/u,
  )
  if (!referenceBlock?.groups?.body) {
    failures.push(`${popoverFile}: Missing popover reference focus block`)
  } else {
    const { body } = referenceBlock.groups
    if (!body.includes(':focus-visible')) {
      failures.push(
        `${popoverFile}: Popover reference must keep a visible keyboard focus path`,
      )
    }
    if (
      !body.includes(
        "@include a11y-focus-ring(2px, getCssVar('border-radius-base'));",
      )
    ) {
      failures.push(
        `${popoverFile}: Popover reference focus ring must use the shared 2px ring`,
      )
    }
  }

  const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
  for (const block of topLevelBlocks(readScssBundle(themeFile), {
    normalizeInterpolations: false,
  })) {
    if (
      block.selector.includes('.#{$namespace}-popover.#{$namespace}-popper') &&
      block.body.includes('backdrop-filter')
    ) {
      failures.push(
        `${themeFile}:${block.startLine} Popover theme overrides must not restore default backdrop blur`,
      )
    }
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkPopoverSurfaceContract(),
    failureHeader: 'popover surface contract check failed.',
    successMessage: 'popover-surface-contract check passed',
  })
}
