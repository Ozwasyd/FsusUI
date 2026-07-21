import { URLSearchParams } from 'node:url'

const variants = Object.freeze({
  'desktop-light': Object.freeze({
    theme: 'light',
    compact: false,
    viewportClass: 'desktop',
  }),
  'mobile-light': Object.freeze({
    theme: 'light',
    compact: true,
    viewportClass: 'mobile',
  }),
  'desktop-dark': Object.freeze({
    theme: 'dark',
    compact: false,
    viewportClass: 'desktop',
  }),
  'mobile-dark': Object.freeze({
    theme: 'dark',
    compact: true,
    viewportClass: 'mobile',
  }),
})

export const VISUAL_PROJECT_NAMES = Object.freeze(Object.keys(variants))

export const VISUAL_SPEC_OWNERSHIP = Object.freeze({
  desktop: Object.freeze([
    '**/audit.spec.ts',
    '**/character-challenge-zoom.spec.ts',
    '**/empty-illustration.spec.ts',
    '**/public-shell-desktop-search.spec.ts',
    '**/smoke-theme-switch.spec.ts',
    '**/tree-select-row.spec.ts',
  ]),
  mobile: Object.freeze(['**/public-shell-mobile-nav.spec.ts']),
})

export const CROSS_THEME_CONTRACTS = Object.freeze([
  Object.freeze({
    file: 'theme-scale-contract.spec.ts',
    project: 'desktop-light',
    owner: 'theme-scale contract',
    reason:
      'The contract compares both explicit root themes in one browser context so focus and reduced-motion state remain identical.',
  }),
])

export const resolveVisualVariant = (projectName) => {
  const variant = variants[projectName]
  if (!variant) {
    throw new Error(
      `Unknown visual project ${JSON.stringify(projectName)}; expected one of ${VISUAL_PROJECT_NAMES.join(', ')}`,
    )
  }
  return variant
}

export const buildVisualUrl = (visual, projectName, query = {}) => {
  const variant = resolveVisualVariant(projectName)
  const params = new URLSearchParams({
    visual,
    theme: variant.theme,
  })

  if (variant.compact) params.set('compact', '1')
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value))
  }

  return `/?${params.toString()}`
}

export const visualProjectTestIgnore = (projectName) => {
  const variant = resolveVisualVariant(projectName)
  const ignored = [
    ...(variant.viewportClass === 'desktop'
      ? VISUAL_SPEC_OWNERSHIP.mobile
      : VISUAL_SPEC_OWNERSHIP.desktop),
  ]

  for (const contract of CROSS_THEME_CONTRACTS) {
    if (contract.project !== projectName) ignored.push(`**/${contract.file}`)
  }

  return ignored
}
