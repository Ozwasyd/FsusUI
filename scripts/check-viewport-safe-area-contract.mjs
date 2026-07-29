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

/**
 * Issue #262: safe-area visual matrix must stay wired into existing boundary
 * infrastructure with real geometry assertions (not screenshot-only).
 *
 * @param {{ root?: string }} [options]
 * @returns {string[]}
 */
export function findSafeAreaVisualMatrixViolations(options = {}) {
  const baseRoot = options.root ? path.resolve(options.root) : root
  const violations = []

  const profilePath = path.join(baseRoot, 'scripts/safe-area-profiles.mjs')
  const assertPath = path.join(
    baseRoot,
    'vue/tests/support/dom-layout-assertions.ts',
  )
  const supportProfilePath = path.join(
    baseRoot,
    'vue/tests/support/safe-area-profile.ts',
  )
  const fixturePath = path.join(
    baseRoot,
    'vue/packages/demo-app/src/AuditFixtures.vue',
  )
  const matrixSpecPath = path.join(
    baseRoot,
    'vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts',
  )
  const boundaryConfigPath = path.join(
    baseRoot,
    'vue/playwright.boundary-audit.config.ts',
  )
  const packageJsonPath = path.join(baseRoot, 'package.json')

  const requiredFiles = {
    'scripts/safe-area-profiles.mjs': profilePath,
    'vue/tests/support/dom-layout-assertions.ts': assertPath,
    'vue/tests/support/safe-area-profile.ts': supportProfilePath,
    'vue/packages/demo-app/src/AuditFixtures.vue': fixturePath,
    'vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts': matrixSpecPath,
    'vue/playwright.boundary-audit.config.ts': boundaryConfigPath,
    'package.json': packageJsonPath,
  }

  for (const [label, filePath] of Object.entries(requiredFiles)) {
    if (!fs.existsSync(filePath)) {
      violations.push(`safe-area visual matrix missing required file: ${label}`)
    }
  }

  if (violations.length > 0) return violations

  const profileSource = fs.readFileSync(profilePath, 'utf8')
  const assertSource = fs.readFileSync(assertPath, 'utf8')
  const supportProfileSource = fs.readFileSync(supportProfilePath, 'utf8')
  const fixtureSource = fs.readFileSync(fixturePath, 'utf8')
  const matrixSpecSource = fs.readFileSync(matrixSpecPath, 'utf8')
  const boundaryConfigSource = fs.readFileSync(boundaryConfigPath, 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  for (const id of [
    'no-inset',
    'portrait-notch',
    'landscape-notch',
    'short-visual',
  ]) {
    if (!profileSource.includes(`'${id}'`)) {
      violations.push(
        `scripts/safe-area-profiles.mjs missing SafeAreaProfile id ${id}`,
      )
    }
  }

  if (
    !profileSource.includes('top: 47') ||
    !profileSource.includes('bottom: 34') ||
    !profileSource.includes('right: 59') ||
    !profileSource.includes('left: 59') ||
    !profileSource.includes('height: 430')
  ) {
    violations.push(
      'scripts/safe-area-profiles.mjs must encode portrait/landscape/short inset geometry from issue #262',
    )
  }

  const assertionNames = [
    'assertScrimCoversViewport',
    'assertControlsInsideSafeRect',
    'assertOverlayActionsReachable',
    'assertNoBodyOverflowLeak',
    'assertDirectionalDrawerSafeInsets',
  ]

  for (const name of assertionNames) {
    if (!assertSource.includes(`export const ${name}`)) {
      violations.push(
        `vue/tests/support/dom-layout-assertions.ts missing shared assertion ${name}`,
      )
    }
    if (!matrixSpecSource.includes(name)) {
      violations.push(
        `safe-area matrix spec must call shared assertion ${name} (geometry, not screenshot-only)`,
      )
    }
  }

  if (
    /toHaveScreenshot|expect\(.*\)\.toMatchSnapshot/.test(matrixSpecSource) &&
    !assertionNames.every((name) => matrixSpecSource.includes(name))
  ) {
    violations.push(
      'safe-area matrix must not degrade to screenshot-only acceptance',
    )
  }

  if (!supportProfileSource.includes('scripts/safe-area-profiles.mjs')) {
    violations.push(
      'vue/tests/support/safe-area-profile.ts must re-export the canonical scripts/safe-area-profiles.mjs source',
    )
  }

  if (!supportProfileSource.includes('applySafeAreaProfile')) {
    violations.push(
      'vue/tests/support/safe-area-profile.ts must expose applySafeAreaProfile (CSS variable override only)',
    )
  }

  if (
    /getBoundingClientRect\s*=|prototype\.getBoundingClientRect/.test(
      matrixSpecSource,
    ) ||
    /getBoundingClientRect\s*=|prototype\.getBoundingClientRect/.test(
      supportProfileSource,
    )
  ) {
    violations.push(
      'safe-area matrix must not mock getBoundingClientRect()',
    )
  }

  if (
    /\.el-overlay\s*\{[^}]*inset\s*:\s*0\s*!important/s.test(fixtureSource) ||
    /audit-floating-overlay/.test(
      fixtureSource.match(
        /data-safe-area-lab[\s\S]*?(?=<div class="audit-grid"|$)/u,
      )?.[0] ?? '',
    )
  ) {
    violations.push(
      'AuditFixtures safe-area lab must not patch overlay geometry with test-only CSS classes',
    )
  }

  const safeAreaOpenBindings = [
    ['openOverlay', 'overlay'],
    ['openDialog', 'dialog'],
    ['openDialogFullscreen', 'dialog-fullscreen'],
    ['openMessageBox', 'message-box'],
    ['openDrawerLtr', 'drawer-ltr'],
    ['openDrawerRtl', 'drawer-rtl'],
    ['openDrawerTtb', 'drawer-ttb'],
    ['openDrawerBtt', 'drawer-btt'],
    ['openImageViewer', 'image-viewer'],
  ]
  const fixtureWithoutComments = stripComments(fixtureSource)
  const scriptStart = fixtureWithoutComments.indexOf('<script')
  const fixtureTemplateSource =
    scriptStart >= 0
      ? fixtureWithoutComments.slice(0, scriptStart)
      : fixtureWithoutComments
  const attributeBagStart = fixtureWithoutComments.indexOf(
    'const safeAreaDataAttributes = {',
  )
  const attributeBagEnd = fixtureWithoutComments.indexOf(
    '} satisfies Record<string, Record<`data-${string}`, string>>',
    attributeBagStart,
  )
  const attributeBagSource =
    attributeBagStart >= 0 && attributeBagEnd > attributeBagStart
      ? fixtureWithoutComments.slice(attributeBagStart, attributeBagEnd + 1)
      : ''

  for (const [owner, surface] of safeAreaOpenBindings) {
    const mappingPattern = new RegExp(
      String.raw`\b${owner}\s*:\s*\{\s*['"]data-safe-area-open['"]\s*:\s*['"]${surface}['"]\s*\}`,
      'gu',
    )
    const ownerBindingPattern = new RegExp(
      String.raw`v-bind\s*=\s*["']safeAreaDataAttributes\.${owner}["']`,
      'gu',
    )
    if ([...attributeBagSource.matchAll(mappingPattern)].length !== 1) {
      violations.push(
        `AuditFixtures.vue safeAreaDataAttributes.${owner} must map exactly once to data-safe-area-open="${surface}"`,
      )
    }
    if ([...fixtureTemplateSource.matchAll(ownerBindingPattern)].length !== 1) {
      violations.push(
        `AuditFixtures.vue must bind safeAreaDataAttributes.${owner} exactly once in the template for ${surface}`,
      )
    }
  }

  if (!/name:\s*['"]safe-area-chromium['"]/.test(boundaryConfigSource)) {
    violations.push(
      'vue/playwright.boundary-audit.config.ts must declare safe-area-chromium project',
    )
  }
  if (!/name:\s*['"]safe-area-webkit['"]/.test(boundaryConfigSource)) {
    violations.push(
      'vue/playwright.boundary-audit.config.ts must declare safe-area-webkit project (Chromium-only is not Safari evidence)',
    )
  }
  if (!/Desktop Safari|webkit/i.test(boundaryConfigSource)) {
    violations.push(
      'vue/playwright.boundary-audit.config.ts safe-area lane must use WebKit/Desktop Safari',
    )
  }

  const scripts = packageJson.scripts ?? {}
  for (const name of Object.keys(scripts)) {
    if (
      /ios-overlay|safe-area-matrix|check:ios/i.test(name) &&
      name !== 'check:viewport-safe-area-contract'
    ) {
      violations.push(
        `package.json must not introduce parallel safe-area command ${name}; use audit:visual-boundaries`,
      )
    }
  }

  if (!scripts['audit:visual-boundaries']?.includes('boundary-audit.config')) {
    violations.push(
      'package.json audit:visual-boundaries must remain the boundary lane entry for the safe-area matrix',
    )
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
    ...findSafeAreaVisualMatrixViolations(),
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
