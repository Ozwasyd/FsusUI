#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { findFoundationStyleBoundaryViolations } from './foundation-style-boundary.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const themeRoot = path.join(root, 'vue/packages/theme-chalk/src')
const entries = ['fsus.scss', 'reset.scss']
const violations = entries.flatMap((entry) => {
  const css = compile(path.join(themeRoot, entry), {
    loadPaths: [themeRoot],
    style: 'expanded',
  }).css
  return findFoundationStyleBoundaryViolations(css, entry)
})

if (violations.length > 0) {
  console.error('[foundation-style-boundary] violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  '[foundation-style-boundary] passed: native headings/lists and external SVG remain unscoped.',
)
