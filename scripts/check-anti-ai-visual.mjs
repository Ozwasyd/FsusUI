#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = process.cwd()
const violations = []
const themeSourceRoot = 'vue/packages/theme-chalk/src'
const radiusBudgetPx = 12
const pillRadiusPx = new Set([100, 999])
const radiusLiteralPattern =
  /\b(border(?:-(?:top|bottom)-(?:left|right))?-radius)\s*:\s*([0-9.]+)px\b/g
const allowedRadiusLiterals = [
  {
    file: 'vue/packages/theme-chalk/src/image-viewer.scss',
    property: 'border-radius',
    value: 22,
    contextIncludes: '@include e(actions)',
    reason:
      'image viewer media chrome toolbar is an immersive control surface, not an ordinary card or panel',
  },
]
const hoverScaleMax = 1.1
const hoverTranslateMaxPx = 1
const hoverTransformAllowlist = []

const read = (file) => readFileSync(resolve(root, file), 'utf8')

const addViolation = (file, line, message) => {
  violations.push(`${file}:${line}: ${message}`)
}

const lineNumberOf = (source, index) =>
  source.slice(0, Math.max(index, 0)).split('\n').length

const scssFiles = (directory) => {
  const absoluteDirectory = resolve(root, directory)
  const files = []

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absoluteEntry = join(absoluteDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...scssFiles(relative(root, absoluteEntry)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.scss')) {
      files.push(relative(root, absoluteEntry).split('\\').join('/'))
    }
  }

  return files
}

const isAllowedRadiusLiteral = (file, property, value, context) =>
  allowedRadiusLiterals.some(
    (entry) =>
      entry.file === file &&
      entry.property === property &&
      entry.value === value &&
      entry.reason.trim().length > 0 &&
      context.includes(entry.contextIncludes),
  )

const findMatchingBrace = (source, openIndex) => {
  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

const selectorHasHoverState = (selector) =>
  selector.replaceAll(/:not\(\s*:hover\s*\)/g, '').includes(':hover')

const hoverBlocks = (source) => {
  const ranges = []

  for (const hoverMatch of source.matchAll(/:hover/g)) {
    const hoverIndex = hoverMatch.index ?? 0
    const blockOpen = source.indexOf('{', hoverIndex)
    if (blockOpen < 0) continue

    const selectorStart =
      Math.max(
        source.lastIndexOf('{', hoverIndex),
        source.lastIndexOf('}', hoverIndex),
        source.lastIndexOf(';', hoverIndex),
      ) + 1
    const selector = source.slice(selectorStart, blockOpen).trim()
    if (!selectorHasHoverState(selector)) continue

    const blockClose = findMatchingBrace(source, blockOpen)
    if (blockClose < 0) continue

    ranges.push({ start: blockOpen + 1, end: blockClose, selector })
  }

  return ranges
}

const isAllowedHoverTransform = (file, selector, transform) =>
  hoverTransformAllowlist.some(
    (entry) =>
      entry.file === file &&
      entry.reason.trim().length > 0 &&
      selector.includes(entry.selectorIncludes) &&
      transform.includes(entry.transformIncludes),
  )

const numericArgs = (args) =>
  args
    .split(',')
    .map((arg) => Number(/-?[0-9.]+/.exec(arg)?.[0]))
    .filter((value) => Number.isFinite(value))

const pxArgs = (args) =>
  [...args.matchAll(/(-?[0-9.]+)px/g)].map((match) => Number(match[1]))

const transformViolations = (transform) => {
  const messages = []

  for (const match of transform.matchAll(/\bscale(?:3d|X|Y)?\(([^)]*)\)/g)) {
    const maxScale = Math.max(...numericArgs(match[1]))
    if (Number.isFinite(maxScale) && maxScale >= hoverScaleMax) {
      messages.push(
        `hover scale must stay below ${hoverScaleMax}; found ${match[0]}`,
      )
    }
  }

  for (const match of transform.matchAll(
    /\btranslate(?:3d|X|Y)?\(([^)]*)\)/g,
  )) {
    const maxOffset = Math.max(
      ...pxArgs(match[1]).map((value) => Math.abs(value)),
    )
    if (Number.isFinite(maxOffset) && maxOffset > hoverTranslateMaxPx) {
      messages.push(
        `hover translation must stay within ${hoverTranslateMaxPx}px; found ${match[0]}`,
      )
    }
  }

  return messages
}

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
  const file = 'vue/packages/theme-chalk/src/common/fsus-tokens.scss'
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
    'vue/packages/theme-chalk/src/dialog.scss',
    'vue/packages/theme-chalk/src/drawer.scss',
    'vue/packages/theme-chalk/src/loading.scss',
    'vue/packages/theme-chalk/src/message.scss',
    'vue/packages/theme-chalk/src/overlay.scss',
    'vue/packages/theme-chalk/src/popover.scss',
    'vue/packages/theme-chalk/src/public-shell.scss',
    'vue/packages/theme-chalk/src/select-dropdown.scss',
    'vue/packages/theme-chalk/src/fsus-theme.scss',
  ]

  for (const file of files) {
    const source = read(file)
    for (const match of source.matchAll(
      /backdrop-filter:\s*blur\(([0-9.]+)px\)/g,
    )) {
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

const checkScatteredRadiusLiterals = () => {
  for (const file of scssFiles(themeSourceRoot)) {
    const source = read(file)

    for (const match of source.matchAll(radiusLiteralPattern)) {
      const property = match[1]
      const value = Number(match[2])
      if (!Number.isFinite(value) || value <= radiusBudgetPx) continue
      if (pillRadiusPx.has(value)) continue

      const index = match.index ?? 0
      const context = source.slice(Math.max(0, index - 400), index + 240)
      if (isAllowedRadiusLiteral(file, property, value, context)) continue

      addViolation(
        file,
        lineNumberOf(source, index),
        `${property}: ${value}px exceeds ${radiusBudgetPx}px; reduce it or add an allowlist entry with a reason`,
      )
    }
  }
}

const checkHoverTransforms = () => {
  for (const file of scssFiles(themeSourceRoot)) {
    const source = read(file)
    const reportedTransforms = new Set()

    for (const block of hoverBlocks(source)) {
      const blockSource = source.slice(block.start, block.end)
      for (const match of blockSource.matchAll(/transform\s*:\s*([^;]+);/g)) {
        const transform = match[1].replaceAll(/\s+/g, ' ').trim()
        const index = block.start + (match.index ?? 0)
        if (reportedTransforms.has(index)) continue
        reportedTransforms.add(index)

        if (isAllowedHoverTransform(file, block.selector, transform)) continue

        for (const message of transformViolations(transform)) {
          addViolation(file, lineNumberOf(source, index), message)
        }
      }
    }
  }
}

const checkReadingSurface = () => {
  const file = 'vue/packages/theme-chalk/src/fsus-theme.scss'
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
  const file = 'vue/packages/theme-chalk/src/markdown-renderer.scss'
  const source = read(file)
  const loadingBlockStart = source.indexOf('.markdown-renderer__loading')
  const loadingBlock =
    loadingBlockStart >= 0
      ? source.slice(loadingBlockStart, loadingBlockStart + 2400)
      : ''

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
  checkScatteredRadiusLiterals()
  checkHoverTransforms()
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
