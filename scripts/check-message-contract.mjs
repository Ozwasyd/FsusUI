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
const messageFile = 'vue/packages/theme-chalk/src/message.scss'
const source = read(messageFile)
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
  'opacity var(--fsus-motion-control-fast, 160ms)',
  'transform var(--fsus-motion-panel, 360ms)',
  'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
  'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
]) {
  if (!source.includes(expected)) {
    failures.push(`${messageFile}: Missing ${expected}`)
  }
}

const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)
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

  if (block.body.includes('@include fsus-floating')) {
    failures.push(
      `${themeFile}:${block.startLine} Message must not inherit the floating blur mixin`,
    )
  }

  if (block.body.includes('backdrop-filter')) {
    failures.push(
      `${themeFile}:${block.startLine} Message theme overrides must not restore default backdrop blur`,
    )
  }

  if (block.body.includes('var(--fsus-shadow-floating)')) {
    failures.push(
      `${themeFile}:${block.startLine} Message must not inherit Notification-level shadow`,
    )
  }

  if (block.body.includes('var(--fsus-radius-floating)')) {
    failures.push(
      `${themeFile}:${block.startLine} Message must use compact toast radius, not floating radius`,
    )
  }

  if (block.body.includes('var(--fsus-notification-max-width)')) {
    failures.push(
      `${themeFile}:${block.startLine} Message must not reuse Notification max-width`,
    )
  }

  if (
    block.body.includes('padding: var(--fsus-space-3) var(--fsus-space-4);')
  ) {
    failures.push(
      `${themeFile}:${block.startLine} Message theme overrides must not replace component padding`,
    )
  }

  if (block.body.includes('border-radius: 12px;')) {
    failures.push(
      `${themeFile}:${block.startLine} Message theme overrides must not hard-code panel radius`,
    )
  }

  if (block.body.includes('&::before')) {
    failures.push(
      `${themeFile}:${block.startLine} Message theme overrides must not add decorative pseudo markers`,
    )
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

if (failures.length > 0) {
  console.error(['message contract check failed.', ...failures].join('\n'))
  process.exitCode = 1
} else {
  console.log('message-contract check passed')
}
