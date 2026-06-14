#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const violations = []

const read = (file) => readFileSync(resolve(root, file), 'utf8')

const addViolation = (file, line, message) => {
  violations.push(`${file}:${line}: ${message}`)
}

const lineNumberOf = (source, index) =>
  source.slice(0, Math.max(index, 0)).split('\n').length

const assertIncludes = (file, source, expected, message) => {
  if (!source.includes(expected)) addViolation(file, 1, message)
}

const numericToken = (source, token) => {
  const match = new RegExp(`${token}:\\s*([0-9.]+)px;`, 'u').exec(source)
  return match ? Number(match[1]) : undefined
}

const assertTokenMax = (file, source, token, max) => {
  const value = numericToken(source, token)
  if (value === undefined) {
    addViolation(file, 1, `${token} must be declared as a px token`)
    return
  }
  if (value > max) {
    addViolation(file, 1, `${token} must be <= ${max}px; found ${value}px`)
  }
}

const checkCoreTokens = () => {
  const file = 'packages/theme-chalk/src/common/fsus-tokens.scss'
  const source = read(file)

  for (const token of [
    '--fsus-backdrop-blur',
    '--fsus-backdrop-blur-soft',
    '--fsus-backdrop-blur-overlay',
  ]) {
    assertIncludes(
      file,
      source,
      `${token}: 0px;`,
      `${token} must default to 0px; glass belongs to opt-in selectors`,
    )
  }

  assertTokenMax(file, source, '--fsus-radius-control', 8)
  assertTokenMax(file, source, '--fsus-radius-control-small', 6)
  assertTokenMax(file, source, '--fsus-radius-panel', 16)
  assertTokenMax(file, source, '--fsus-radius-floating', 16)
  assertTokenMax(file, source, '--fsus-radius-popover', 16)

  assertIncludes(
    file,
    source,
    '--fsus-shadow-panel: none;',
    'ordinary panel surfaces must be border-first by default',
  )
  assertIncludes(
    file,
    source,
    '--fsus-shadow-floating: 0 12px 32px rgba(15, 23, 42, 0.08);',
    'floating shadow must stay below the large SaaS-card baseline',
  )
}

const checkBackdropFilters = () => {
  const files = [
    'packages/theme-chalk/src/dialog.scss',
    'packages/theme-chalk/src/drawer.scss',
    'packages/theme-chalk/src/loading.scss',
    'packages/theme-chalk/src/message.scss',
    'packages/theme-chalk/src/overlay.scss',
    'packages/theme-chalk/src/popover.scss',
    'packages/theme-chalk/src/public-shell.scss',
    'packages/theme-chalk/src/select-dropdown.scss',
    'packages/theme-chalk/src/fsus-theme.scss',
  ]

  for (const file of files) {
    const source = read(file)
    for (const match of source.matchAll(/backdrop-filter:\s*blur\(([0-9.]+)px\)/g)) {
      const blur = Number(match[1])
      if (!Number.isFinite(blur) || blur <= 0) continue

      const index = match.index ?? 0
      const context = source.slice(Math.max(0, index - 800), index + 160)
      const isWhitelistedViewer = context.includes('image-viewer')
      if (!isWhitelistedViewer) {
        addViolation(
          file,
          lineNumberOf(source, index),
          'hardcoded backdrop blur must be opt-in or token-driven',
        )
      }
    }
  }
}

const checkReadingSurface = () => {
  const file = 'packages/theme-chalk/src/fsus-theme.scss'
  const source = read(file)

  for (const expected of [
    "[data-fsus-surface='reading']",
    '--fsus-backdrop-blur: 0px;',
    '--fsus-motion-trail: transparent;',
    '--fsus-motion-slider-trail: transparent;',
    '--fsus-interactive-motion-glow: 0px;',
    '--fsus-interactive-motion-trail-opacity: 0;',
  ]) {
    assertIncludes(
      file,
      source,
      expected,
      `reading surface must include ${expected}`,
    )
  }
}

const checkMarkdownLoading = () => {
  const file = 'packages/theme-chalk/src/markdown-renderer.scss'
  const source = read(file)
  const loadingBlockStart = source.indexOf('.markdown-renderer__loading')
  const loadingBlock = loadingBlockStart >= 0 ? source.slice(loadingBlockStart, loadingBlockStart + 2400) : ''

  if (loadingBlock.includes('linear-gradient')) {
    addViolation(
      file,
      lineNumberOf(source, loadingBlockStart),
      'Markdown loading placeholders must not use accent shimmer gradients by default',
    )
  }
  if (source.includes('markdown-renderer-pulse')) {
    addViolation(
      file,
      1,
      'Markdown loading must not use an accent pulse by default',
    )
  }
}

const checkMotionDocs = () => {
  const file = 'docs/components/motion.md'
  const source = read(file)
  const normalized = source.toLowerCase().replaceAll(/\s+/g, ' ')

  for (const expected of ['motion recipe', 'motion budget']) {
    if (!normalized.includes(expected)) {
      addViolation(file, 1, `motion docs must include ${expected}`)
    }
  }

  for (const expected of [
    /avoid `fade-up` on article bodies/u,
    /avoid `list-stagger` for long lists/u,
  ]) {
    if (!expected.test(normalized)) {
      addViolation(file, 1, `motion docs must include ${expected.source}`)
    }
  }
}

try {
  checkCoreTokens()
  checkBackdropFilters()
  checkReadingSurface()
  checkMarkdownLoading()
  checkMotionDocs()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  violations.push(message)
}

if (violations.length > 0) {
  console.error('Anti-AI visual conformance check failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log('Anti-AI visual conformance check passed.')
