import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { compile } from 'sass'
import {
  findSafeAreaVisualMatrixViolations,
  findViewportOverlayGeometryViolations,
  findViewportSafeAreaViolations,
} from '../../../../scripts/check-viewport-safe-area-contract.mjs'
import {
  SAFE_AREA_PROFILES,
  profileCssVariableOverrides,
} from '../../../../scripts/safe-area-profiles.mjs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../../../..')
const themeSourceDir = path.resolve(dirname, '../src')
const safeAreaMixinPath = path.resolve(themeSourceDir, 'mixins/safe-area.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

/** Canonical profiles from scripts/safe-area-profiles.mjs (#262). */
const VIEWPORT_PROFILES = Object.fromEntries(
  Object.entries(SAFE_AREA_PROFILES).map(([id, profile]) => [
    id,
    {
      width: profile.viewport.width,
      height: profile.viewport.height,
      top: `${profile.insets.top}px`,
      right: `${profile.insets.right}px`,
      bottom: `${profile.insets.bottom}px`,
      left: `${profile.insets.left}px`,
    },
  ]),
) as Record<
  string,
  {
    width: number
    height: number
    top: string
    right: string
    bottom: string
    left: string
  }
>

const temporaryRoots: string[] = []

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

const pathToFileUrl = (filePath: string) => {
  const resolved = path.resolve(filePath)
  const normalized = resolved.split(path.sep).join('/')
  return normalized.startsWith('/')
    ? `file://${normalized}`
    : `file:///${normalized}`
}

const applyProfileVars = (
  element: HTMLElement,
  profileId: keyof typeof SAFE_AREA_PROFILES,
) => {
  const overrides = profileCssVariableOverrides(SAFE_AREA_PROFILES[profileId])
  for (const [name, value] of Object.entries(overrides)) {
    element.style.setProperty(name, value)
  }
}

describe('viewport-safe overlay geometry (#261)', () => {
  test('safe-area mixin owns unique scrim/host/block-size helpers', () => {
    const mixinSource = readFileSync(safeAreaMixinPath, 'utf8')
    expect(mixinSource).toContain('@mixin fsus-overlay-scrim')
    expect(mixinSource).toContain('@mixin fsus-viewport-safe-overlay-host')
    expect(mixinSource).toContain('@function fsus-viewport-safe-block-size')
    expect(mixinSource).toContain('@mixin fsus-inset-safe-area')
    expect(mixinSource).toContain('@mixin fsus-padding-safe-area-box')
    expect(
      mixinSource
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/\/\/.*$/gmu, ''),
    ).not.toMatch(/env\(\s*safe-area-inset-/)
  })

  test('Overlay scrim is fixed inset 0 without height 100% or safe-area edges', () => {
    const css = compileThemeFile('overlay.scss')
    const source = readFileSync(
      path.resolve(themeSourceDir, 'overlay.scss'),
      'utf8',
    )

    expect(source).toContain('fsus-overlay-scrim')
    expect(source).not.toMatch(/height\s*:\s*100%/)
    expect(css).toMatch(/\.el-overlay\s*\{[^}]*position:\s*fixed/s)
    expect(css).toMatch(/\.el-overlay\s*\{[^}]*inset:\s*0/s)
    expect(css).not.toMatch(/\.el-overlay\s*\{[^}]*height:\s*100%/s)
    expect(css).not.toMatch(
      /\.el-overlay\s*\{[^}]*(?:top|right|bottom|left):\s*var\(--fsus-safe-area-inset-/s,
    )
    expect(css).not.toMatch(/\b100vh\b/)
  })

  test('Dialog host uses shared helper; normal max-block-size and fullscreen chrome', () => {
    const css = compileThemeFile('dialog.scss')
    const source = readFileSync(
      path.resolve(themeSourceDir, 'dialog.scss'),
      'utf8',
    )

    expect(source).toContain('fsus-viewport-safe-overlay-host')
    expect(source).toContain('fsus-viewport-safe-block-size')
    expect(source).not.toMatch(
      /\.el-overlay-dialog[^{]*\{[^}]*top:\s*0/s,
    )

    expect(css).toMatch(
      /\.el-overlay-dialog\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s,
    )
    expect(css).toMatch(
      /padding-top:\s*max\(\s*16px\s*,\s*var\(--fsus-safe-area-inset-top\)\s*\)/,
    )
    expect(css).toMatch(
      /max-block-size:\s*calc\(\s*var\(--fsus-viewport-block-size\)\s*-\s*max\(\s*16px\s*,\s*var\(--fsus-safe-area-inset-top\)\s*\)\s*-\s*max\(\s*16px\s*,\s*var\(--fsus-safe-area-inset-bottom\)\s*\)\s*\)/,
    )
    expect(css).toMatch(
      /\.el-dialog\.is-fullscreen\s+\.el-dialog__header\s*\{[^}]*padding-top:\s*max\(\s*var\(--fsus-space-4\)\s*,\s*var\(--fsus-safe-area-inset-top\)\s*\)/s,
    )
    expect(css).toMatch(
      /\.el-overlay-dialog:has\(\.el-dialog\.is-fullscreen\)\s*\{[^}]*padding:\s*0/s,
    )
    expect(css).not.toMatch(/\b100vh\b/)
  })

  test('MessageBox drops ::after centering and uses shared host helper', () => {
    const css = compileThemeFile('message-box.scss')
    const source = readFileSync(
      path.resolve(themeSourceDir, 'message-box.scss'),
      'utf8',
    )
    const sourceNoComments = source
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '')

    expect(source).toContain('fsus-viewport-safe-overlay-host')
    expect(sourceNoComments).not.toMatch(
      /\.el-overlay-message-box[^{]*\{[^}]*::after|::after\s*\{[^}]*height:\s*100%/s,
    )
    expect(css).not.toMatch(
      /\.el-overlay-message-box::after|\.el-overlay-message-box\s+::after/,
    )
    expect(css).toMatch(
      /\.el-overlay\.is-message-box\s+\.el-overlay-message-box\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s,
    )
    expect(css).toMatch(
      /\.el-overlay\.is-message-box\s+\.el-overlay-message-box\s*\{[^}]*display:\s*flex/s,
    )
    expect(css).toMatch(
      /\.el-message-box\s*\{[^}]*max-block-size:\s*calc\(\s*var\(--fsus-viewport-block-size\)/s,
    )
    expect(css).not.toMatch(/\b100vh\b/)
  })

  test('Drawer four-direction matrix consumes edge-relevant safe-area only', () => {
    const css = compileThemeFile('drawer.scss')
    const source = readFileSync(
      path.resolve(themeSourceDir, 'drawer.scss'),
      'utf8',
    )

    const sourceNoComments = source
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '')

    expect(source).toContain('fsus-padding-safe-area')
    expect(sourceNoComments).not.toMatch(/height\s*:\s*100%/)
    expect(css).not.toMatch(/\.el-drawer\.ltr[^{]*\{[^}]*height:\s*100%/s)
    expect(css).not.toMatch(/\.el-drawer\.rtl[^{]*\{[^}]*height:\s*100%/s)

    // ltr → top/bottom/left
    expect(css).toMatch(
      /\.el-drawer\.ltr\s+\.el-drawer__header\s*\{[^}]*padding-top:\s*max\([^;]*--fsus-safe-area-inset-top/s,
    )
    expect(css).toMatch(
      /\.el-drawer\.ltr\s+\.el-drawer__header\s*\{[^}]*padding-left:\s*max\([^;]*--fsus-safe-area-inset-left/s,
    )
    expect(css).toMatch(
      /\.el-drawer\.ltr\s+\.el-drawer__footer\s*\{[^}]*padding-bottom:\s*max\([^;]*--fsus-safe-area-inset-bottom/s,
    )

    // rtl → top/bottom/right
    expect(css).toMatch(
      /\.el-drawer\.rtl\s+\.el-drawer__header\s*\{[^}]*padding-right:\s*max\([^;]*--fsus-safe-area-inset-right/s,
    )

    // ttb → top/left/right
    expect(css).toMatch(
      /\.el-drawer\.ttb\s+\.el-drawer__header\s*\{[^}]*padding-top:\s*max\([^;]*--fsus-safe-area-inset-top/s,
    )
    expect(css).toMatch(
      /\.el-drawer\.ttb\s+\.el-drawer__body\s*\{[^}]*padding-left:\s*max\([^;]*--fsus-safe-area-inset-left/s,
    )
    expect(css).toMatch(
      /\.el-drawer\.ttb\s+\.el-drawer__body\s*\{[^}]*padding-right:\s*max\([^;]*--fsus-safe-area-inset-right/s,
    )

    // btt → bottom/left/right
    expect(css).toMatch(
      /\.el-drawer\.btt\s+\.el-drawer__footer\s*\{[^}]*padding-bottom:\s*max\([^;]*--fsus-safe-area-inset-bottom/s,
    )
    expect(css).not.toMatch(/\b100vh\b/)
  })

  test('ImageViewer wrapper/mask cover viewport; controls use safe offsets', () => {
    const css = compileThemeFile('image-viewer.scss')
    const source = readFileSync(
      path.resolve(themeSourceDir, 'image-viewer.scss'),
      'utf8',
    )

    expect(source).toContain('fsus-overlay-scrim')
    expect(source).toContain('fsus-inset-safe-area')
    expect(css).toMatch(
      /\.el-image-viewer__wrapper\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__mask\s*\{[^}]*inset:\s*0/s,
    )
    expect(css).not.toMatch(
      /\.el-image-viewer__mask\s*\{[^}]*height:\s*100%/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__close\s*\{[^}]*top:\s*max\(\s*40px\s*,\s*var\(--fsus-safe-area-inset-top\)\s*\)/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__close\s*\{[^}]*right:\s*max\(\s*40px\s*,\s*var\(--fsus-safe-area-inset-right\)\s*\)/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__prev\s*\{[^}]*left:\s*max\(\s*40px\s*,\s*var\(--fsus-safe-area-inset-left\)\s*\)/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__next\s*\{[^}]*right:\s*max\(\s*40px\s*,\s*var\(--fsus-safe-area-inset-right\)\s*\)/s,
    )
    expect(css).toMatch(
      /\.el-image-viewer__actions\s*\{[^}]*bottom:\s*max\(\s*30px\s*,\s*var\(--fsus-safe-area-inset-bottom\)\s*\)/s,
    )
    expect(css).not.toMatch(/\b100vh\b/)
  })

  test('fixture profiles override canonical vars for light geometry probes', () => {
    const overlayCss = compileThemeFile('overlay.scss')
    const dialogCss = compileThemeFile('dialog.scss')
    const imageViewerCss = compileThemeFile('image-viewer.scss')

    const style = document.createElement('style')
    style.textContent = [overlayCss, dialogCss, imageViewerCss].join('\n')
    document.head.append(style)

    for (const name of Object.keys(SAFE_AREA_PROFILES) as Array<
      keyof typeof SAFE_AREA_PROFILES
    >) {
      const profile = VIEWPORT_PROFILES[name]
      const host = document.createElement('div')
      applyProfileVars(host, name)
      host.style.position = 'relative'
      document.body.append(host)

      const scrim = document.createElement('div')
      scrim.className = 'el-overlay'
      host.append(scrim)

      const dialogHost = document.createElement('div')
      dialogHost.className = 'el-overlay-dialog'
      host.append(dialogHost)

      const closeBtn = document.createElement('div')
      closeBtn.className = 'el-image-viewer__close'
      host.append(closeBtn)

      const computedRoot = getComputedStyle(host)
      expect(
        computedRoot.getPropertyValue('--fsus-safe-area-inset-top').trim(),
        name,
      ).toBe(profile.top)
      expect(
        computedRoot.getPropertyValue('--fsus-safe-area-inset-right').trim(),
        name,
      ).toBe(profile.right)
      expect(
        computedRoot.getPropertyValue('--fsus-safe-area-inset-bottom').trim(),
        name,
      ).toBe(profile.bottom)
      expect(
        computedRoot.getPropertyValue('--fsus-safe-area-inset-left').trim(),
        name,
      ).toBe(profile.left)

      // Scrim contract is CSSOM fixed + inset 0 (no safe-area edge shrink).
      const scrimStyle = getComputedStyle(scrim)
      expect(scrimStyle.position, `${name} scrim`).toBe('fixed')
      // jsdom may not resolve `inset`; assert the declared stylesheet contract.
      expect(overlayCss).toMatch(/inset:\s*0/)

      const dialogHostStyle = getComputedStyle(dialogHost)
      expect(dialogHostStyle.position, `${name} dialog host`).toBe('fixed')
      expect(dialogCss).toContain('var(--fsus-safe-area-inset-top)')
      expect(dialogCss).toContain('var(--fsus-viewport-block-size)')

      expect(imageViewerCss).toContain(
        'max(40px, var(--fsus-safe-area-inset-top))',
      )
      expect(imageViewerCss).toContain(
        'max(40px, var(--fsus-safe-area-inset-left))',
      )
      expect(imageViewerCss).toContain(
        'max(40px, var(--fsus-safe-area-inset-right))',
      )
      expect(imageViewerCss).toContain(
        'max(30px, var(--fsus-safe-area-inset-bottom))',
      )

      host.remove()
    }

    style.remove()
  })

  test('production geometry gate passes', () => {
    expect(findViewportSafeAreaViolations({ root: repoRoot })).toEqual([])
    expect(findViewportOverlayGeometryViolations({ root: repoRoot })).toEqual(
      [],
    )
  })

  test('mutation: scrim safe-area top shrink fails the geometry gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-overlay-scrim-'),
    )
    temporaryRoots.push(fixtureRoot)

    const overlayDir = path.join(
      fixtureRoot,
      'vue/packages/theme-chalk/src',
    )
    mkdirSync(overlayDir, { recursive: true })
    writeFileSync(
      path.join(overlayDir, 'overlay.scss'),
      `
.el-overlay {
  position: fixed;
  inset: 0;
  top: var(--fsus-safe-area-inset-top);
}
`,
    )
    writeFileSync(
      path.join(overlayDir, 'dialog.scss'),
      `@include fsus-viewport-safe-overlay-host(16px);\n`,
    )
    writeFileSync(
      path.join(overlayDir, 'message-box.scss'),
      `@include fsus-viewport-safe-overlay-host(16px);\n`,
    )
    writeFileSync(
      path.join(overlayDir, 'drawer.scss'),
      `@include fsus-padding-safe-area(left, 16px);\n`,
    )
    writeFileSync(
      path.join(overlayDir, 'image-viewer.scss'),
      `@include fsus-overlay-scrim;\n`,
    )

    const violations = findViewportOverlayGeometryViolations({
      root: fixtureRoot,
    })
    expect(
      violations.some((item) =>
        item.includes('must not shrink edges with safe-area'),
      ),
    ).toBe(true)
  })

  test('mutation: height 100%, bare 100vh, and direct env() fail the gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-overlay-height-'),
    )
    temporaryRoots.push(fixtureRoot)

    const overlayDir = path.join(
      fixtureRoot,
      'vue/packages/theme-chalk/src',
    )
    mkdirSync(overlayDir, { recursive: true })
    writeFileSync(
      path.join(overlayDir, 'overlay.scss'),
      `
.el-overlay {
  position: fixed;
  inset: 0;
  height: 100%;
}
`,
    )
    writeFileSync(
      path.join(overlayDir, 'dialog.scss'),
      `
.el-overlay-dialog {
  height: 100vh;
  padding-top: env(safe-area-inset-top);
}
`,
    )
    writeFileSync(
      path.join(overlayDir, 'message-box.scss'),
      `.el-overlay-message-box { padding-top: max(16px, var(--fsus-safe-area-inset-top)); }\n`,
    )
    writeFileSync(path.join(overlayDir, 'drawer.scss'), `.el-drawer {}\n`)
    writeFileSync(
      path.join(overlayDir, 'image-viewer.scss'),
      `.el-image-viewer__wrapper {}\n`,
    )

    const violations = findViewportOverlayGeometryViolations({
      root: fixtureRoot,
    })
    expect(
      violations.some((item) => item.includes('must not use height: 100%')),
    ).toBe(true)
    expect(
      violations.some((item) => item.includes('bare 100vh')),
    ).toBe(true)
    expect(
      violations.some((item) =>
        item.includes('direct env(safe-area-inset-*)'),
      ),
    ).toBe(true)
    expect(
      violations.some((item) =>
        item.includes('copies safe-area max() formula without unique helper'),
      ),
    ).toBe(true)

    const scriptPath = path.join(
      repoRoot,
      'scripts/check-viewport-safe-area-contract.mjs',
    )
    const runner = `
      import { findViewportOverlayGeometryViolations } from ${JSON.stringify(
        pathToFileUrl(scriptPath),
      )};
      const violations = findViewportOverlayGeometryViolations({ root: ${JSON.stringify(
        fixtureRoot,
      )} });
      if (violations.length === 0) {
        console.log('unexpected pass');
        process.exit(0);
      }
      console.error(violations.join('\\n'));
      process.exit(1);
    `
    const runnerPath = path.join(fixtureRoot, 'run-mutation.mjs')
    writeFileSync(runnerPath, runner)
    const result = spawnSync(process.execPath, [runnerPath], {
      encoding: 'utf8',
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(
      /height: 100%|100vh|env\(safe-area-inset-\*\)/,
    )
  })

  test('safe-area visual matrix gate passes on the repository', () => {
    expect(findSafeAreaVisualMatrixViolations({ root: repoRoot })).toEqual([])
  })

  test('mutation: deleting WebKit project fails the matrix gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-webkit-'),
    )
    temporaryRoots.push(fixtureRoot)

    const copyRelative = (relativePath: string, mutate?: (source: string) => string) => {
      const sourcePath = path.join(repoRoot, relativePath)
      const targetPath = path.join(fixtureRoot, relativePath)
      mkdirSync(path.dirname(targetPath), { recursive: true })
      const source = readFileSync(sourcePath, 'utf8')
      writeFileSync(targetPath, mutate ? mutate(source) : source)
    }

    copyRelative('scripts/safe-area-profiles.mjs')
    copyRelative('vue/tests/support/dom-layout-assertions.ts')
    copyRelative('vue/tests/support/safe-area-profile.ts')
    copyRelative('vue/packages/demo-app/src/AuditFixtures.vue')
    copyRelative('vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts')
    copyRelative('package.json')
    copyRelative('vue/playwright.boundary-audit.config.ts', (source) =>
      source
        .replace(/\{\s*name:\s*'safe-area-webkit'[\s\S]*?\},/u, '')
        .replace(/Desktop Safari/gu, 'Desktop Chrome'),
    )

    const violations = findSafeAreaVisualMatrixViolations({ root: fixtureRoot })
    expect(
      violations.some((item) =>
        item.includes('safe-area-webkit project'),
      ),
    ).toBe(true)
  })

  test('mutation: screenshot-only matrix without shared asserts fails the gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-screenshot-'),
    )
    temporaryRoots.push(fixtureRoot)

    const copyRelative = (relativePath: string, mutate?: (source: string) => string) => {
      const sourcePath = path.join(repoRoot, relativePath)
      const targetPath = path.join(fixtureRoot, relativePath)
      mkdirSync(path.dirname(targetPath), { recursive: true })
      const source = readFileSync(sourcePath, 'utf8')
      writeFileSync(targetPath, mutate ? mutate(source) : source)
    }

    copyRelative('scripts/safe-area-profiles.mjs')
    copyRelative('vue/tests/support/dom-layout-assertions.ts')
    copyRelative('vue/tests/support/safe-area-profile.ts')
    copyRelative('vue/packages/demo-app/src/AuditFixtures.vue')
    copyRelative('vue/playwright.boundary-audit.config.ts')
    copyRelative('package.json')
    copyRelative(
      'vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts',
      () => `
import { expect, test } from '@playwright/test'
test('screenshot only', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('safe-area.png')
})
`,
    )

    const violations = findSafeAreaVisualMatrixViolations({ root: fixtureRoot })
    expect(
      violations.some((item) =>
        item.includes('shared assertion assertScrimCoversViewport'),
      ),
    ).toBe(true)
  })

  test('mutation: changing a lab surface attribute bag mapping fails the gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-fixture-'),
    )
    temporaryRoots.push(fixtureRoot)

    const copyRelative = (relativePath: string, mutate?: (source: string) => string) => {
      const sourcePath = path.join(repoRoot, relativePath)
      const targetPath = path.join(fixtureRoot, relativePath)
      mkdirSync(path.dirname(targetPath), { recursive: true })
      const source = readFileSync(sourcePath, 'utf8')
      writeFileSync(targetPath, mutate ? mutate(source) : source)
    }

    copyRelative('scripts/safe-area-profiles.mjs')
    copyRelative('vue/tests/support/dom-layout-assertions.ts')
    copyRelative('vue/tests/support/safe-area-profile.ts')
    copyRelative('vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts')
    copyRelative('vue/playwright.boundary-audit.config.ts')
    copyRelative('package.json')
    copyRelative('vue/packages/demo-app/src/AuditFixtures.vue', (source) =>
      source
        .replace(
          "openImageViewer: { 'data-safe-area-open': 'image-viewer' }",
          "openImageViewer: { 'data-open': 'image' }",
        )
        .replace(
          'const active = computed',
          "const detachedSafeAreaMapping = \"openImageViewer: { 'data-safe-area-open': 'image-viewer' }\"\nvoid detachedSafeAreaMapping\nconst active = computed",
        ),
    )

    const violations = findSafeAreaVisualMatrixViolations({ root: fixtureRoot })
    expect(
      violations.some((item) => item.includes('image-viewer')),
    ).toBe(true)
  })

  test('mutation: disconnecting a lab surface attribute bag from its template owner fails the gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-fixture-owner-'),
    )
    temporaryRoots.push(fixtureRoot)

    const copyRelative = (
      relativePath: string,
      mutate?: (source: string) => string,
    ) => {
      const sourcePath = path.join(repoRoot, relativePath)
      const targetPath = path.join(fixtureRoot, relativePath)
      mkdirSync(path.dirname(targetPath), { recursive: true })
      const source = readFileSync(sourcePath, 'utf8')
      writeFileSync(targetPath, mutate ? mutate(source) : source)
    }

    copyRelative('scripts/safe-area-profiles.mjs')
    copyRelative('vue/tests/support/dom-layout-assertions.ts')
    copyRelative('vue/tests/support/safe-area-profile.ts')
    copyRelative('vue/tests/visual-boundary/safe-area-overlay-matrix.spec.ts')
    copyRelative('vue/playwright.boundary-audit.config.ts')
    copyRelative('package.json')
    copyRelative('vue/packages/demo-app/src/AuditFixtures.vue', (source) =>
      source
        .replace(
          'v-bind="safeAreaDataAttributes.openImageViewer"',
          'v-bind="safeAreaDataAttributes.openOverlay"',
        )
        .replace(
          'const active = computed',
          "const detachedSafeAreaBinding = 'v-bind=\"safeAreaDataAttributes.openImageViewer\"'\nvoid detachedSafeAreaBinding\nconst active = computed",
        ),
    )

    const violations = findSafeAreaVisualMatrixViolations({ root: fixtureRoot })
    expect(
      violations.some((item) =>
        item.includes('safeAreaDataAttributes.openImageViewer'),
      ),
    ).toBe(true)
  })
})
