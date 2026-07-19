import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'

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
const varSource = read('vue/packages/theme-chalk/src/common/var.scss')
const formSource = read('vue/packages/theme-chalk/src/form.scss')
const formCss = compile(
  path.join(root, 'vue/packages/theme-chalk/src/form.scss'),
  {
    loadPaths: [path.join(root, 'vue/packages/theme-chalk/src')],
    style: 'expanded',
  },
).css

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
      `vue/packages/theme-chalk/src/common/var.scss:${
        block.startLine + lineNumberAt(block.source, match.index ?? 0) - 1
      } ($${mapName})`,
    )
  }
}

for (const file of [
  'vue/packages/theme-chalk/src/checkbox.scss',
  'vue/packages/theme-chalk/src/checkbox-button.scss',
  'vue/packages/theme-chalk/src/radio.scss',
  'vue/packages/theme-chalk/src/radio-button.scss',
  'vue/packages/theme-chalk/src/switch.scss',
  'vue/packages/theme-chalk/src/time-select.scss',
]) {
  const source = read(file)

  for (const match of source.matchAll(forbiddenPrimaryPattern)) {
    failures.push(`${file}:${lineNumberAt(source, match.index ?? 0)}`)
  }
}

const timeSelectSource = read('vue/packages/theme-chalk/src/time-select.scss')
const selectedBlock = timeSelectSource.match(
  /\.time-select-item\.selected:not\(\.disabled\)\s*\{(?<body>[\s\S]*?)\n {2}\}/u,
)

if (!selectedBlock?.groups?.body) {
  failures.push(
    'vue/packages/theme-chalk/src/time-select.scss: missing selected state block',
  )
} else {
  const body = selectedBlock.groups.body
  if (!body.includes("color: getCssVar('color', 'scholarly-blue');")) {
    failures.push(
      'vue/packages/theme-chalk/src/time-select.scss: selected state must use Scholarly Blue',
    )
  }

  if (!body.includes('background-color: var(--fsus-state-selected-bg);')) {
    failures.push(
      'vue/packages/theme-chalk/src/time-select.scss: selected state must use selected-state background',
    )
  }

  if (/font-weight:\s*bold/u.test(body)) {
    failures.push(
      'vue/packages/theme-chalk/src/time-select.scss: selected state must not rely on bold only',
    )
  }
}

if (!formSource.includes('@mixin form-invalid-focus-visible-ring')) {
  failures.push(
    'vue/packages/theme-chalk/src/form.scss: missing semantic invalid focus-visible ring mixin',
  )
}

for (const selector of [
  '.el-form-item.is-error .el-textarea__inner:focus-visible',
  '.el-form-item.is-error .el-select-v2__wrapper:has(input:focus-visible)',
  '.el-form-item.is-error .el-input__wrapper:has(.el-input__inner:focus-visible)',
]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const rulePattern = new RegExp(
    `${escapedSelector}[^{}]*\\{[^{}]*box-shadow:\\s*0 0 0 2px var\\(--el-color-danger\\) inset !important;`,
    'u',
  )

  if (!rulePattern.test(formCss)) {
    failures.push(
      `vue/packages/theme-chalk/src/form.scss: ${selector} must use a 2px inset danger ring`,
    )
  }
}

if (
  /focus-visible[^{}]*\{[^{}]*box-shadow:\s*0 0 0 1px var\(--el-color-danger\) inset/gu.test(
    formCss,
  )
) {
  failures.push(
    'vue/packages/theme-chalk/src/form.scss: invalid focus-visible must not regress to the idle 1px danger ring',
  )
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
