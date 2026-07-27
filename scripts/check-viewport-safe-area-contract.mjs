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

/** Overlay/Dialog/MessageBox/Drawer/ImageViewer geometry sources (issue #261). */
export const VIEWPORT_OVERLAY_GEOMETRY_SOURCES = [
  'vue/packages/theme-chalk/src/overlay.scss',
  'vue/packages/theme-chalk/src/dialog.scss',
  'vue/packages/theme-chalk/src/message-box.scss',
  'vue/packages/theme-chalk/src/drawer.scss',
  'vue/packages/theme-chalk/src/image-viewer.scss',
]

/** Scrim roots that must stay full-viewport (never safe-area shrunk). */
export const VIEWPORT_OVERLAY_SCRIM_SOURCES = [
  'vue/packages/theme-chalk/src/overlay.scss',
]

const SCRIM_SAFE_AREA_EDGE =
  /(?:^|[;{])\s*(?:top|right|bottom|left)\s*:\s*[^;]*var\(\s*--fsus-safe-area-inset-/giu

const OVERLAY_HEIGHT_100_PERCENT =
  /(?:^|[;{])\s*height\s*:\s*100%\s*;/giu

const BARE_100VH =
  /(?:^|[;{])\s*(?:height|min-height|max-height|block-size|min-block-size|max-block-size)\s*:\s*100vh\s*;/giu

const COMPONENT_DIRECT_ENV =
  /env\(\s*safe-area-inset-(?:top|right|bottom|left)\b/giu

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

/**
 * Fail closed on overlay geometry regressions (issue #261):
 * - scrim must not be inset by safe-area tokens
 * - overlay.scss must not reintroduce height: 100%
 * - overlay geometry sources must not use bare 100vh or direct env()
 * @param {{ root?: string }} [options]
 * @returns {string[]}
 */
export const findViewportOverlayGeometryViolations = (options = {}) => {
  const baseRoot = options.root ? path.resolve(options.root) : root
  const violations = []

  for (const relativePath of VIEWPORT_OVERLAY_SCRIM_SOURCES) {
    const absolutePath = path.join(baseRoot, relativePath)
    if (!fs.existsSync(absolutePath)) {
      // Fixture roots may omit production files; skip missing scrim sources.
      continue
    }
    const source = stripComments(fs.readFileSync(absolutePath, 'utf8'))

    OVERLAY_HEIGHT_100_PERCENT.lastIndex = 0
    for (const match of source.matchAll(OVERLAY_HEIGHT_100_PERCENT)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} overlay scrim must not use height: 100%`,
      )
    }

    SCRIM_SAFE_AREA_EDGE.lastIndex = 0
    for (const match of source.matchAll(SCRIM_SAFE_AREA_EDGE)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} overlay scrim must not shrink edges with safe-area tokens`,
      )
    }
  }

  for (const relativePath of VIEWPORT_OVERLAY_GEOMETRY_SOURCES) {
    const absolutePath = path.join(baseRoot, relativePath)
    if (!fs.existsSync(absolutePath)) continue
    const source = stripComments(fs.readFileSync(absolutePath, 'utf8'))

    BARE_100VH.lastIndex = 0
    for (const match of source.matchAll(BARE_100VH)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} bare 100vh viewport coverage is forbidden`,
      )
    }

    COMPONENT_DIRECT_ENV.lastIndex = 0
    for (const match of source.matchAll(COMPONENT_DIRECT_ENV)) {
      violations.push(
        `${relativePath}:${lineForIndex(source, match.index ?? 0)} direct env(safe-area-inset-*) outside canonical token source`,
      )
    }

    // Reject per-component formula copy that bypasses the shared helper:
    // hard-coded max(Npx, var(--fsus-safe-area-inset-*)) outside safe-area.scss
    // is allowed in compiled CSS, but source should use fsus-* helpers.
    // Enforce that sources still call the shared mixins rather than only raw
    // max() with safe-area vars without helper usage.
    if (
      /max\(\s*[^)]*var\(\s*--fsus-safe-area-inset-/.test(source) &&
      !/fsus-(?:safe-area-max|padding-safe-area|inset-safe-area|viewport-safe-overlay-host|overlay-scrim|viewport-safe-block-size)/.test(
        source,
      )
    ) {
      violations.push(
        `${relativePath}: component copies safe-area max() formula without unique helper`,
      )
    }
  }

  return violations
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const violations = [
    ...findViewportSafeAreaViolations(),
    ...findViewportOverlayGeometryViolations(),
  ]

  if (violations.length > 0) {
    console.error(
      ['viewport/safe-area contract violations:', ...violations].join('\n'),
    )
    process.exitCode = 1
  } else {
    console.log('viewport-safe-area-contract check passed')
  }
}
