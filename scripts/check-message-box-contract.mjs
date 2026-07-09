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

const failures = []
const messageBoxFile = 'vue/packages/theme-chalk/src/message-box.scss'
const source = read(messageBoxFile)

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
  'animation: msgbox-fade-in var(--fsus-motion-panel, 420ms)',
]) {
  if (!source.includes(expected)) {
    failures.push(`${messageBoxFile}: Missing ${expected}`)
  }
}

for (const expected of [
  'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
  'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
]) {
  if (!source.includes(expected)) {
    failures.push(`${messageBoxFile}: Missing ${expected}`)
  }
}

const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)
let hasMessageBoxPanel = false

for (const block of topLevelBlocks(themeSource)) {
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

if (failures.length > 0) {
  console.error(['message-box contract check failed.', ...failures].join('\n'))
  process.exitCode = 1
} else {
  console.log('message-box-contract check passed')
}
