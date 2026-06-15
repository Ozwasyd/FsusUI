import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/u).length

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

const selectorItems = (selector) =>
  selector
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const failures = []
const notificationFile = 'packages/theme-chalk/src/notification.scss'
const source = read(notificationFile)
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

const varFile = 'packages/theme-chalk/src/common/var.scss'
const varSource = read(varFile)

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

const themeFile = 'packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)
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

for (const block of topLevelBlocks(themeSource)) {
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
    block.body.includes('@include fsus-floating') ||
    block.body.includes('box-shadow: var(--fsus-shadow-floating')
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
    `${themeFile}: Notification needs floating material shadow coverage`,
  )
}

if (!hasNotificationFixedPosition) {
  failures.push(
    `${themeFile}: Notification must preserve fixed viewport positioning`,
  )
}

if (failures.length > 0) {
  console.error(['notification contract check failed.', ...failures].join('\n'))
  process.exitCode = 1
} else {
  console.log('notification-contract check passed')
}
