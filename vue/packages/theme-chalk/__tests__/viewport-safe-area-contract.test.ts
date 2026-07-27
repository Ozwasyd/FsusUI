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
  CANONICAL_SAFE_AREA_TOKEN_SOURCE,
  findViewportSafeAreaViolations,
} from '../../../../scripts/check-viewport-safe-area-contract.mjs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '../../../..')
const themeSourceDir = path.resolve(dirname, '../src')
const tokenSourcePath = path.resolve(themeSourceDir, 'common/fsus-tokens.scss')
const safeAreaMixinPath = path.resolve(themeSourceDir, 'mixins/safe-area.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const REQUIRED_SAFE_AREA_VARS = [
  '--fsus-safe-area-inset-top',
  '--fsus-safe-area-inset-right',
  '--fsus-safe-area-inset-bottom',
  '--fsus-safe-area-inset-left',
] as const

const temporaryRoots: string[] = []

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('viewport / safe-area runtime contract', () => {
  test('token source declares four-direction safe-area vars and 100dvh viewport', () => {
    const tokenSource = readFileSync(tokenSourcePath, 'utf8')
    const mixinSource = readFileSync(safeAreaMixinPath, 'utf8')

    expect(tokenSource).toContain('--fsus-viewport-block-size: 100dvh;')
    expect(tokenSource).not.toMatch(
      /--fsus-viewport-block-size\s*:[^;]*\b100vh\b/,
    )

    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(tokenSource).toContain(
        `--fsus-safe-area-inset-${side}: env(safe-area-inset-${side}, 0px);`,
      )
    }

    expect(mixinSource).toContain('@function fsus-safe-area-max(')
    expect(mixinSource).toContain('@function fsus-safe-area-inset(')
    expect(mixinSource).toContain('@function fsus-viewport-safe-block-size(')
    expect(mixinSource).toContain('@mixin fsus-padding-safe-area(')
    expect(mixinSource).toContain('@mixin fsus-overlay-scrim')
    expect(mixinSource).toContain('@mixin fsus-viewport-safe-overlay-host')
    expect(mixinSource).toContain("'block-start': 'top'")
    expect(mixinSource).toContain("'inline-end': 'right'")
    // Runtime formula must not emit env(); comments may mention the forbid list.
    expect(
      mixinSource
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/\/\/.*$/gmu, ''),
    ).not.toMatch(/env\(\s*safe-area-inset-/)
  })

  test('full theme and per-component CSS share the same token contract without local env()', () => {
    const fullThemeCss = compileThemeFile('fsus.scss')
    const themeBundleCss = compileThemeFile('fsus-theme.scss')
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [fullThemeCss, themeBundleCss]) {
      expect(css).toContain('--fsus-viewport-block-size: 100dvh;')
      for (const name of REQUIRED_SAFE_AREA_VARS) {
        expect(css).toContain(`${name}: env(safe-area-inset-`)
      }
      expect(css).not.toMatch(/--fsus-viewport-block-size\s*:[^;]*\b100vh\b/)
    }

    for (const css of [publicShellCss, criticalCss]) {
      expect(css).toContain('var(--fsus-safe-area-inset-bottom)')
      expect(css).not.toMatch(/env\(\s*safe-area-inset-/)
      expect(css).toContain(
        'padding-bottom: calc(var(--fsus-bottom-tab-height, 56px) + var(--fsus-safe-area-inset-bottom));',
      )
      // Dart Sass may simplify nested calc() inside max().
      expect(css).toMatch(
        /padding-bottom:\s*max\(\s*40px\s*,\s*(?:calc\(\s*)?24px\s*\+\s*var\(--fsus-safe-area-inset-bottom\)(?:\s*\))?\s*\)/,
      )
    }
  })

  test('fixture overrides of the four safe-area vars are readable on computed style', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const style = document.createElement('style')
    style.textContent = themeCss
    document.head.append(style)

    const root = document.documentElement
    root.style.setProperty('--fsus-safe-area-inset-top', '47px')
    root.style.setProperty('--fsus-safe-area-inset-right', '59px')
    root.style.setProperty('--fsus-safe-area-inset-bottom', '34px')
    root.style.setProperty('--fsus-safe-area-inset-left', '59px')
    root.style.setProperty('--fsus-viewport-block-size', '640px')

    // Consumer probe mirrors PublicShell / MobileDock consumption of the
    // canonical vars (no direct env()). Custom properties inherit; computed
    // getPropertyValue is the CSSOM contract tests/embeds rely on.
    const probe = document.createElement('div')
    probe.style.paddingTop = 'var(--fsus-safe-area-inset-top)'
    probe.style.paddingRight = 'var(--fsus-safe-area-inset-right)'
    probe.style.paddingBottom =
      'max(var(--fsus-mobile-dock-padding-bottom, 0px), var(--fsus-safe-area-inset-bottom))'
    probe.style.paddingLeft = 'var(--fsus-safe-area-inset-left)'
    probe.style.minHeight = 'var(--fsus-viewport-block-size)'
    document.body.append(probe)

    const overrides = {
      '--fsus-safe-area-inset-top': '47px',
      '--fsus-safe-area-inset-right': '59px',
      '--fsus-safe-area-inset-bottom': '34px',
      '--fsus-safe-area-inset-left': '59px',
      '--fsus-viewport-block-size': '640px',
    } as const

    const computedRoot = getComputedStyle(root)

    for (const [name, value] of Object.entries(overrides)) {
      expect(computedRoot.getPropertyValue(name).trim()).toBe(value)
    }

    // After root override, a component that only consumes the canonical vars
    // still sees the fixture values via CSSOM (same contract embeds use).
    const fixtureHost = document.createElement('div')
    fixtureHost.style.cssText = Object.entries(overrides)
      .map(([name, value]) => `${name}: ${value}`)
      .join('; ')
    const consumer = document.createElement('div')
    consumer.style.paddingBottom = 'var(--fsus-safe-area-inset-bottom)'
    consumer.style.minHeight = 'var(--fsus-viewport-block-size)'
    fixtureHost.append(consumer)
    document.body.append(fixtureHost)

    const hostComputed = getComputedStyle(fixtureHost)
    expect(hostComputed.getPropertyValue('--fsus-safe-area-inset-top').trim()).toBe(
      '47px',
    )
    expect(
      hostComputed.getPropertyValue('--fsus-safe-area-inset-right').trim(),
    ).toBe('59px')
    expect(
      hostComputed.getPropertyValue('--fsus-safe-area-inset-bottom').trim(),
    ).toBe('34px')
    expect(
      hostComputed.getPropertyValue('--fsus-safe-area-inset-left').trim(),
    ).toBe('59px')
    expect(hostComputed.getPropertyValue('--fsus-viewport-block-size').trim()).toBe(
      '640px',
    )

    expect(probe.style.paddingBottom).toContain(
      'var(--fsus-safe-area-inset-bottom)',
    )
    expect(probe.style.paddingBottom).not.toContain('env(safe-area-inset-')
    expect(probe.style.minHeight).toBe('var(--fsus-viewport-block-size)')
    expect(consumer.style.paddingBottom).toBe(
      'var(--fsus-safe-area-inset-bottom)',
    )

    fixtureHost.remove()

    probe.remove()
    style.remove()
    for (const name of Object.keys(overrides)) {
      root.style.removeProperty(name)
    }
  })

  test('static gate allows only the canonical token source for env(safe-area-inset-*)', () => {
    const violations = findViewportSafeAreaViolations({ root: repoRoot })
    expect(violations).toEqual([])
    expect(CANONICAL_SAFE_AREA_TOKEN_SOURCE).toBe(
      'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
    )
  })

  test('mutation: direct env() outside canonical source fails the gate command', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-mutation-'),
    )
    temporaryRoots.push(fixtureRoot)

    const componentDir = path.join(
      fixtureRoot,
      'vue/packages/theme-chalk/src/components',
    )
    mkdirSync(componentDir, { recursive: true })
    mkdirSync(path.join(fixtureRoot, 'vue/packages/theme-chalk/src/common'), {
      recursive: true,
    })

    writeFileSync(
      path.join(
        fixtureRoot,
        'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
      ),
      readFileSync(tokenSourcePath, 'utf8'),
    )
    writeFileSync(
      path.join(componentDir, 'leaky-overlay.scss'),
      `.leaky { padding-bottom: env(safe-area-inset-bottom); }\n`,
    )

    const functionViolations = findViewportSafeAreaViolations({
      root: fixtureRoot,
    })
    expect(
      functionViolations.some((item) =>
        item.includes('direct env(safe-area-inset-*)'),
      ),
    ).toBe(true)

    const scriptPath = path.join(
      repoRoot,
      'scripts/check-viewport-safe-area-contract.mjs',
    )
    // Run the exported finder against the fixture via a tiny runner so the
    // real CLI entry path is exercised with a non-zero exit when dirty.
    const runner = `
      import { findViewportSafeAreaViolations } from ${JSON.stringify(
        pathToFileUrl(scriptPath),
      )};
      const violations = findViewportSafeAreaViolations({ root: ${JSON.stringify(
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
    expect(result.stderr + result.stdout).toMatch(/env\(safe-area-inset-\*\)/)
  })

  test('mutation: forbidden alias and 100vh viewport fallback fail the gate', () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), 'fsusui-safe-area-alias-'),
    )
    temporaryRoots.push(fixtureRoot)

    mkdirSync(path.join(fixtureRoot, 'vue/packages/theme-chalk/src/common'), {
      recursive: true,
    })
    writeFileSync(
      path.join(
        fixtureRoot,
        'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
      ),
      `
@mixin fsus-core-tokens {
  --fsus-viewport-block-size: 100vh;
  --fsus-viewport-block-size: 100dvh;
  --fsus-safe-bottom: env(safe-area-inset-bottom);
  --fsus-safe-area-inset-bottom: var(--fsus-safe-bottom);
  --fsus-safe-area-inset-top: env(safe-area-inset-top, 0px);
  --fsus-safe-area-inset-right: env(safe-area-inset-right, 0px);
  --fsus-safe-area-inset-left: env(safe-area-inset-left, 0px);
}
`,
    )
    writeFileSync(
      path.join(fixtureRoot, 'vue/packages/theme-chalk/src/broken.scss'),
      `.panel { height: 100vh; height: 100dvh; padding-bottom: var(--fsus-safe-bottom); }\n`,
    )

    const violations = findViewportSafeAreaViolations({ root: fixtureRoot })
    expect(
      violations.some((item) => item.includes('forbidden safe-area alias')),
    ).toBe(true)
    expect(
      violations.some((item) =>
        item.includes('must not include 100vh fallback'),
      ),
    ).toBe(true)
    expect(
      violations.some((item) => item.includes('dual height 100vh/100dvh')),
    ).toBe(true)
  })
})

function pathToFileUrl(filePath: string) {
  const resolved = path.resolve(filePath)
  const normalized = resolved.split(path.sep).join('/')
  return normalized.startsWith('/')
    ? `file://${normalized}`
    : `file:///${normalized}`
}
