const foundationElements = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'svg',
  'ul',
])

const selectorElements = (selector) =>
  [...selector.matchAll(/(?:^|[>+~\s])([a-z][a-z0-9-]*)/giu)].map((match) =>
    match[1].toLowerCase(),
  )

const isUnscopedFoundationSelector = (selector) => {
  if (
    selector.includes('.') ||
    selector.includes('#') ||
    selector.includes('[')
  ) {
    return false
  }
  return selectorElements(selector).some((element) =>
    foundationElements.has(element),
  )
}

export const findFoundationStyleBoundaryViolations = (css, source) => {
  const violations = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/gu

  for (const match of css.matchAll(rulePattern)) {
    const declarations = match[2].replaceAll(/\s+/gu, ' ').trim()

    for (const rawSelector of match[1].split(',')) {
      const selector = rawSelector.replaceAll(/\s+/gu, ' ').trim()
      if (!isUnscopedFoundationSelector(selector)) continue

      if (/letter-spacing\s*:\s*-/iu.test(declarations)) {
        violations.push(
          `${source}: global selector "${selector}" must not set negative letter-spacing`,
        )
      }

      if (
        /::(?:before|after)\b/iu.test(selector) &&
        /(?:^|;)\s*content\s*:/iu.test(declarations)
      ) {
        violations.push(
          `${source}: global selector "${selector}" must not inject pseudo-element content`,
        )
      }

      if (
        selectorElements(selector).includes('svg') &&
        /(?:^|;)\s*(?:fill|paint-order|stroke(?:-[a-z-]+)?)\s*:/iu.test(
          declarations,
        )
      ) {
        violations.push(
          `${source}: global selector "${selector}" must not override SVG stroke, fill, or paint order`,
        )
      }

      if (
        selectorElements(selector).some((element) =>
          ['li', 'ol', 'ul'].includes(element),
        ) &&
        /(?:^|;)\s*(?:list-style(?:-[a-z-]+)?|marker)\s*:/iu.test(declarations)
      ) {
        violations.push(
          `${source}: global selector "${selector}" must not replace native list markers`,
        )
      }
    }
  }

  return [...new Set(violations)]
}
