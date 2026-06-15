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

const forbiddenPrimaryPattern = /getCssVar\('color-primary'\)/g
const failures = []
const varSource = read('packages/theme-chalk/src/common/var.scss')

for (const mapName of [
  'checkbox',
  'checkbox-button',
  'radio',
  'radio-button',
  'radio-checked',
  'input',
  'cascader',
  'switch',
]) {
  const block = extractMap(varSource, mapName)

  for (const match of block.source.matchAll(forbiddenPrimaryPattern)) {
    failures.push(
      `packages/theme-chalk/src/common/var.scss:${
        block.startLine + lineNumberAt(block.source, match.index ?? 0) - 1
      } ($${mapName})`,
    )
  }
}

for (const file of [
  'packages/theme-chalk/src/checkbox.scss',
  'packages/theme-chalk/src/checkbox-button.scss',
  'packages/theme-chalk/src/radio.scss',
  'packages/theme-chalk/src/radio-button.scss',
  'packages/theme-chalk/src/switch.scss',
  'packages/theme-chalk/src/time-select.scss',
]) {
  const source = read(file)

  for (const match of source.matchAll(forbiddenPrimaryPattern)) {
    failures.push(`${file}:${lineNumberAt(source, match.index ?? 0)}`)
  }
}

const timeSelectSource = read('packages/theme-chalk/src/time-select.scss')
const selectedBlock = timeSelectSource.match(
  /\.time-select-item\.selected:not\(\.disabled\)\s*\{(?<body>[\s\S]*?)\n {2}\}/u,
)

if (!selectedBlock?.groups?.body) {
  failures.push('packages/theme-chalk/src/time-select.scss: missing selected state block')
} else {
  const body = selectedBlock.groups.body
  if (!body.includes("color: getCssVar('color', 'scholarly-blue');")) {
    failures.push(
      'packages/theme-chalk/src/time-select.scss: selected state must use Scholarly Blue',
    )
  }

  if (!body.includes('background-color: var(--fsus-state-selected-bg);')) {
    failures.push(
      'packages/theme-chalk/src/time-select.scss: selected state must use selected-state background',
    )
  }

  if (/font-weight:\s*bold/u.test(body)) {
    failures.push(
      'packages/theme-chalk/src/time-select.scss: selected state must not rely on bold only',
    )
  }
}

if (failures.length > 0) {
  console.error(
    [
      'form state feedback must use interaction/state tokens, not generic color-primary.',
      ...failures,
    ].join('\n'),
  )
  process.exitCode = 1
} else {
  console.log('form-state-contract check passed')
}
