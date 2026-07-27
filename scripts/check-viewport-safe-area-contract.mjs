import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Sole allowed source of env(safe-area-inset-*) in runtime sources. */
export const CANONICAL_SAFE_AREA_TOKEN_SOURCE =
  'vue/packages/theme-chalk/src/common/fsus-tokens.scss'

const RUNTIME_EXTENSIONS = new Set(['.scss', '.css', '.vue'])

const SAFE_AREA_ENV_PATTERN =
  /env\(\s*safe-area-inset-(?:top|right|bottom|left)\b/giu

const FORBIDDEN_SAFE_AREA_ALIASES = [
  /--fsus-safe-bottom\b/gu,
  /--fsus-safe-top\b/gu,
  /--fsus-safe-left\b/gu,
  /--fsus-safe-right\b/gu,
  /--fsus-safe-area-top\b(?!-)/gu,
  /--fsus-safe-area-right\b(?!-)/gu,
  /--fsus-safe-area-bottom\b(?!-)/gu,
  /--fsus-safe-area-left\b(?!-)/gu,
]

const VIEWPORT_BLOCK_WITH_VH_FALLBACK =
  /--fsus-viewport-block-size\s*:[^;]*\b100vh\b/giu

const DUAL_VH_DVH_HEIGHT =
  /(?:^|[;{])\s*height\s*:\s*100vh\s*;\s*height\s*:\s*100dvh\s*;/giu

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1')
    .replace(/<!--[\s\S]*?-->/gu, '')

const lineForIndex = (source, index) =>
  source.slice(0, index).split(/\r?\n/u).length

const shouldSkipDirectory = (name) =>
  name === 'node_modules' ||
  name === 'dist' ||
  name === '.git' ||
  name === 'coverage' ||
  name === 'test-results' ||
  name === 'screenshots' ||
  name === 'artifacts'

const walkRuntimeFiles = (directory, files = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue
      walkRuntimeFiles(absolutePath, files)
      continue
    }

    if (!entry.isFile()) continue

    const extension = path.extname(entry.name)
    if (!RUNTIME_EXTENSIONS.has(extension)) continue

    files.push(absolutePath)
  }

  return files
}

const relativePosix = (absolutePath, baseRoot) =>
  path.relative(baseRoot, absolutePath).split(path.sep).join('/')

/**
 * Scan runtime .scss/.css/.vue for safe-area / viewport contract violations.
 * @param {{ root?: string }} [options]
 * @returns {string[]}
 */
export const findViewportSafeAreaViolations = (options = {}) => {
  const baseRoot = options.root ? path.resolve(options.root) : root
  const violations = []
  const files = walkRuntimeFiles(baseRoot)

  for (const absolutePath of files) {
    const relativePath = relativePosix(absolutePath, baseRoot)
    const raw = fs.readFileSync(absolutePath, 'utf8')
    const source = stripComments(raw)
    const isCanonical = relativePath === CANONICAL_SAFE_AREA_TOKEN_SOURCE

    SAFE_AREA_ENV_PATTERN.lastIndex = 0
    for (const match of source.matchAll(SAFE_AREA_ENV_PATTERN)) {
      if (isCanonical) continue
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} direct env(safe-area-inset-*) outside canonical token source`,
      )
    }

    for (const pattern of FORBIDDEN_SAFE_AREA_ALIASES) {
      pattern.lastIndex = 0
      for (const match of source.matchAll(pattern)) {
        violations.push(
          `${relativePath}:${lineForIndex(source, match.index ?? 0)} forbidden safe-area alias ${match[0]}`,
        )
      }
    }

    VIEWPORT_BLOCK_WITH_VH_FALLBACK.lastIndex = 0
    for (const match of source.matchAll(VIEWPORT_BLOCK_WITH_VH_FALLBACK)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} --fsus-viewport-block-size must not include 100vh fallback`,
      )
    }

    DUAL_VH_DVH_HEIGHT.lastIndex = 0
    for (const match of source.matchAll(DUAL_VH_DVH_HEIGHT)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} dual height 100vh/100dvh fallback is forbidden`,
      )
    }
  }

  if (
    !files.some(
      (absolutePath) =>
        relativePosix(absolutePath, baseRoot) ===
        CANONICAL_SAFE_AREA_TOKEN_SOURCE,
    )
  ) {
    // When scanning a fixture root that omits the canonical source, still
    // require callers that ship production sources to keep it present.
    const productionCanonical = path.join(root, CANONICAL_SAFE_AREA_TOKEN_SOURCE)
    if (baseRoot === root && !fs.existsSync(productionCanonical)) {
      violations.push(
        `${CANONICAL_SAFE_AREA_TOKEN_SOURCE} missing canonical viewport/safe-area token source`,
      )
    }
  }

  if (baseRoot === root) {
    const canonicalAbsolute = path.join(root, CANONICAL_SAFE_AREA_TOKEN_SOURCE)
    if (fs.existsSync(canonicalAbsolute)) {
      const canonical = stripComments(fs.readFileSync(canonicalAbsolute, 'utf8'))
      for (const name of [
        '--fsus-viewport-block-size',
        '--fsus-safe-area-inset-top',
        '--fsus-safe-area-inset-right',
        '--fsus-safe-area-inset-bottom',
        '--fsus-safe-area-inset-left',
      ]) {
        if (!canonical.includes(name)) {
          violations.push(
            `${CANONICAL_SAFE_AREA_TOKEN_SOURCE} missing required token ${name}`,
          )
        }
      }

      if (!/--fsus-viewport-block-size\s*:\s*100dvh\s*;/u.test(canonical)) {
        violations.push(
          `${CANONICAL_SAFE_AREA_TOKEN_SOURCE} --fsus-viewport-block-size must be 100dvh only`,
        )
      }

      for (const side of ['top', 'right', 'bottom', 'left']) {
        const pattern = new RegExp(
          `--fsus-safe-area-inset-${side}\\s*:\\s*env\\(\\s*safe-area-inset-${side}\\s*,\\s*0px\\s*\\)`,
          'u',
        )
        if (!pattern.test(canonical)) {
          violations.push(
            `${CANONICAL_SAFE_AREA_TOKEN_SOURCE} --fsus-safe-area-inset-${side} must default via env(..., 0px)`,
          )
        }
      }

      const envMatches = [
        ...canonical.matchAll(
          /env\(\s*safe-area-inset-(top|right|bottom|left)\b/giu,
        ),
      ]
      const sides = new Set(envMatches.map((match) => match[1].toLowerCase()))
      if (sides.size !== 4) {
        violations.push(
          `${CANONICAL_SAFE_AREA_TOKEN_SOURCE} must declare env() for all four safe-area sides exactly once each`,
        )
      }
    }
  }

  return violations
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const violations = findViewportSafeAreaViolations()

  if (violations.length > 0) {
    console.error(
      ['viewport/safe-area contract violations:', ...violations].join('\n'),
    )
    process.exitCode = 1
  } else {
    console.log('viewport-safe-area-contract check passed')
  }
}
