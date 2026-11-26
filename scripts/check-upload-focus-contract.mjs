import {
  isMainModule,
  readRepoFile,
  reportContractResult,
} from './lib/scss-contract-utils.mjs'

export function checkUploadFocusContract() {
  const source = readRepoFile('vue/packages/theme-chalk/src/upload.scss')
  const failures = []

  for (const [needle, message] of [
    [
      '&:focus-visible {\n    @include a11y-focus-ring(2px, 6px);',
      'upload root must expose a 2px focus-visible ring',
    ],
    [
      '&.is-focus-visible-dragger {\n    .#{$namespace}-upload-dragger {',
      'upload dragger must have a dedicated keyboard-focus selector',
    ],
    [
      '@include a11y-focus-ring(2px, var(--fsus-radius-panel, 12px));',
      'upload dragger focus must use the shared 2px inset ring',
    ],
    [
      '&.is-focus-visible-picture-card,\n    &:focus-visible {',
      'picture-card upload must have explicit focus-visible coverage',
    ],
  ]) {
    if (!source.includes(needle)) failures.push(message)
  }

  if (
    /&:focus\s*\{[\s\S]*?border-color:\s*getCssVar\('color-primary'\)/u.test(
      source,
    )
  ) {
    failures.push(
      'upload must not fall back to generic :focus border-only color',
    )
  }

  return failures
}

if (isMainModule(import.meta.url)) {
  reportContractResult({
    failures: checkUploadFocusContract(),
    failureHeader: 'upload focus contract check failed:',
    successMessage: 'upload-focus-contract check passed',
  })
}
