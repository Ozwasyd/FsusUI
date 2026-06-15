import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = 'packages/theme-chalk/src/upload.scss'
const source = fs.readFileSync(path.join(root, file), 'utf8')

const assertIncludes = (needle, message, failures) => {
  if (!source.includes(needle)) failures.push(message)
}

const failures = []

assertIncludes(
  '&:focus-visible {\n    @include a11y-focus-ring(2px, 6px);',
  'upload root must expose a 2px focus-visible ring',
  failures,
)
assertIncludes(
  '&.is-focus-visible-dragger {\n    .#{$namespace}-upload-dragger {',
  'upload dragger must have a dedicated keyboard-focus selector',
  failures,
)
assertIncludes(
  '@include a11y-focus-ring(2px, var(--fsus-radius-panel-large, 24px));',
  'upload dragger focus must use the shared 2px inset ring',
  failures,
)
assertIncludes(
  '&.is-focus-visible-picture-card,\n    &:focus-visible {',
  'picture-card upload must have explicit focus-visible coverage',
  failures,
)

if (/&:focus\s*\{[\s\S]*?border-color:\s*getCssVar\('color-primary'\)/u.test(source)) {
  failures.push('upload must not fall back to generic :focus border-only color')
}

if (failures.length > 0) {
  console.error(['upload focus contract check failed:', ...failures].join('\n'))
  process.exitCode = 1
} else {
  console.log('upload-focus-contract check passed')
}
