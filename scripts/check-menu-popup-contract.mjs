import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/u).length

const extractBlockAfter = (source, needle) => {
  const start = source.indexOf(needle)
  if (start === -1) return undefined

  const open = source.indexOf('{', start)
  if (open === -1) return undefined

  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          body: source.slice(open + 1, index),
          startLine: lineNumberAt(source, start),
        }
      }
    }
  }

  return undefined
}

const withoutLineComments = (source) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.replace(/\/\/.*$/u, ''))
    .join('\n')

const topLevelBlocks = (source) => {
  const normalizedSource = withoutLineComments(source).replace(
    /#\{[^}]+\}/gu,
    'NS',
  )
  const blocks = []
  let depth = 0
  let selectorStart = 0

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const char = normalizedSource[index]

    if (char === '{') {
      if (depth === 0) {
        blocks.push({
          selector: normalizedSource.slice(selectorStart, index).trim(),
          bodyStart: index + 1,
          startLine: lineNumberAt(normalizedSource, selectorStart),
        })
      }
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const block = blocks[blocks.length - 1]
        block.body = normalizedSource.slice(block.bodyStart, index)
        selectorStart = index + 1
      }
    }
  }

  return blocks.filter((block) => typeof block.body === 'string')
}

const failures = []
const menuFile = 'vue/packages/theme-chalk/src/menu.scss'
const menuSource = read(menuFile)
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

  if (
    !menuItemMixin.body.includes(
      "@include a11y-focus-ring(2px, getCssVar('border-radius-small'));",
    )
  ) {
    failures.push(
      `${menuFile}:${menuItemMixin.startLine} Menu item keyboard focus must use the shared 2px focus ring`,
    )
  }
}

const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)
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

if (failures.length > 0) {
  console.error(['menu popup contract check failed.', ...failures].join('\n'))
  process.exitCode = 1
} else {
  console.log('menu-popup-contract check passed')
}
