import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/u).length

const extractMap = (source, mapName) => {
  const start = source.indexOf(`$${mapName}: map.merge(`)
  if (start === -1) {
    throw new Error(`Missing $${mapName} map in common/var.scss`)
  }

  const endMarker = `\n  $${mapName}\n);`
  const end = source.indexOf(endMarker, start)
  if (end === -1) {
    throw new Error(`Could not find end of $${mapName} map in common/var.scss`)
  }

  return {
    source: source.slice(start, end + endMarker.length),
    startLine: lineNumberAt(source, start),
  }
}

const extractBlock = (source, selector) => {
  const start = source.indexOf(selector)
  if (start === -1) return undefined

  const open = source.indexOf(' {', start)
  if (open === -1) return undefined

  let depth = 0
  for (let index = open + 1; index < source.length; index += 1) {
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

const failures = []
const varFile = 'vue/packages/theme-chalk/src/common/var.scss'
const varSource = read(varFile)
const cascaderMap = extractMap(varSource, 'cascader')

for (const [expected, message] of [
  [
    "'menu-selected-text-color': getCssVar('color', 'scholarly-blue')",
    'Cascader selected text must use the interaction accent token',
  ],
  [
    "'menu-radius': getCssVar('popover-border-radius')",
    'Cascader menu radius must use the shared popover radius',
  ],
  [
    "'menu-shadow': var(--fsus-shadow-panel, none)",
    'Cascader menu shadow must default to border-first panel material',
  ],
]) {
  if (!cascaderMap.source.includes(expected)) {
    failures.push(`${varFile}:${cascaderMap.startLine} ${message}`)
  }
}

for (const forbidden of [
  "getCssVar('color-primary')",
  "getCssVar('border-radius-small')",
  "getCssVar('box-shadow-light')",
]) {
  if (cascaderMap.source.includes(forbidden)) {
    failures.push(
      `${varFile}:${cascaderMap.startLine} Cascader map must not include ${forbidden}`,
    )
  }
}

const themeFile = 'vue/packages/theme-chalk/src/fsus-theme.scss'
const themeSource = read(themeFile)
const dropdownBlock = extractBlock(
  themeSource,
  '.#{$namespace}-cascader__dropdown',
)

if (!dropdownBlock) {
  failures.push(`${themeFile}: Missing Cascader dropdown material override`)
} else {
  if (dropdownBlock.body.includes('backdrop-filter')) {
    failures.push(
      `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must not restore default backdrop blur`,
    )
  }

  if (
    !dropdownBlock.body.includes('box-shadow: var(--fsus-shadow-panel, none);')
  ) {
    failures.push(
      `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must use border-first panel shadow`,
    )
  }

  if (
    !dropdownBlock.body.includes('border-radius: var(--fsus-radius-popover);')
  ) {
    failures.push(
      `${themeFile}:${dropdownBlock.startLine} Cascader dropdown must use the popover radius token`,
    )
  }
}

if (failures.length > 0) {
  console.error(
    ['cascader popper contract check failed.', ...failures].join('\n'),
  )
  process.exitCode = 1
} else {
  console.log('cascader-popper-contract check passed')
}
