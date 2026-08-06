import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')
const fsusThemePath = path.join(themeSourceDir, 'fsus-theme.scss')
const dialogPath = path.join(themeSourceDir, 'dialog.scss')
const drawerPath = path.join(themeSourceDir, 'drawer.scss')
const notificationPath = path.join(themeSourceDir, 'notification.scss')
const messageBoxPath = path.join(themeSourceDir, 'message-box.scss')
const varPath = path.join(themeSourceDir, 'common/var.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const cssRules = (css: string, selector: string) => {
  const rules: string[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g

  for (const match of css.matchAll(rulePattern)) {
    const selectorList = match[1].replace(/\s+/g, ' ').trim()
    if (selectorList.includes(selector)) {
      rules.push(match[2].replace(/\s+/g, ' ').trim())
    }
  }

  return rules
}

const expectCssRule = (
  css: string,
  selector: string,
  declarations: string[],
) => {
  const rules = cssRules(css, selector)
  expect(rules, `No CSS rule found for "${selector}"`).not.toHaveLength(0)
  expect(
    rules.some((rule) =>
      declarations.every((declaration) => rule.includes(declaration)),
    ),
    `No CSS rule for "${selector}" contains ${declarations.join(', ')}`,
  ).toBe(true)
}

/**
 * Issue #298 overlay depth contract:
 * - Dialog / Drawer / MessageBox: paper panel → --fsus-shadow-panel (none)
 * - Notification: high-level floating → --fsus-shadow-floating
 * Depth roles must not invert.
 */
const assertOverlayDepthContract = (css: string, label: string) => {
  for (const selector of ['.el-dialog', '.el-drawer']) {
    expectCssRule(css, selector, [
      'border: 1px solid var(--el-border-color-light);',
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
  }

  expectCssRule(css, '.el-message-box', [
    'border: 1px solid var(--el-border-color-light);',
    'box-shadow: var(--fsus-shadow-panel, none);',
  ])

  expectCssRule(css, '.el-notification', [
    'border: 1px solid var(--el-border-color-light);',
    'border-radius: var(--fsus-radius-popover);',
    'box-shadow: var(--fsus-shadow-floating);',
  ])

  for (const selector of ['.el-dialog', '.el-drawer', '.el-message-box']) {
    const rules = cssRules(css, selector)
    for (const rule of rules) {
      if (!rule.includes('box-shadow:')) continue
      expect(
        rule,
        `${label}: ${selector} must not use floating shadow`,
      ).not.toMatch(/box-shadow:\s*var\(--fsus-shadow-floating/)
      expect(
        rule,
        `${label}: ${selector} must not hardcode floating elevation`,
      ).not.toMatch(/box-shadow:\s*0\s+12px\s+32px/)
    }
  }

  // Notification must expose floating elevation (theme override and/or token).
  const notificationRules = cssRules(css, '.el-notification').filter(
    (rule) =>
      // Prefer surface rules (border/radius + shadow), not chrome/title only.
      rule.includes('box-shadow:') &&
      (rule.includes('border:') || rule.includes('border-radius:')),
  )
  expect(
    notificationRules.length,
    `${label}: notification surface must declare box-shadow`,
  ).toBeGreaterThan(0)

  const hasFloatingShadow = notificationRules.some((rule) =>
    /box-shadow:\s*var\(--fsus-shadow-floating/.test(rule),
  )
  const hasTokenShadow = notificationRules.some((rule) =>
    /box-shadow:\s*var\(--el-notification-shadow/.test(rule),
  )
  expect(
    hasFloatingShadow || hasTokenShadow,
    `${label}: notification surface must use floating or notification-shadow token`,
  ).toBe(true)

  for (const rule of notificationRules) {
    expect(
      rule,
      `${label}: notification surface must not use panel shadow`,
    ).not.toMatch(/box-shadow:\s*var\(--fsus-shadow-panel/)
    expect(
      rule,
      `${label}: notification surface must not use none shadow`,
    ).not.toMatch(/box-shadow:\s*none\b/)
    expect(
      rule,
      `${label}: notification must not use colored glow`,
    ).not.toMatch(/box-shadow:[^;]*0\s+0\s+\d+px\s+(?:var\(--el-color|#|rgb)/)
  }
}

const fsusThemeMutations = [
  {
    id: 'dialog-drawer-regain-floating-shadow',
    from: `box-shadow: var(--fsus-shadow-panel, none);
}

.#{$namespace}-message-box {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-panel);
  box-shadow: var(--fsus-shadow-panel, none);
}

.#{$namespace}-notification {
  /* fsus-surface: high-level floating overlay [notification]
   * Short-lived, cross-content toast: popover radius + floating shadow.
   * Must not share Dialog/Drawer panel/no-shadow depth (#298).
   */
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-popover);
  box-shadow: var(--fsus-shadow-floating);
}`,
    to: `box-shadow: var(--fsus-shadow-floating);
}

.#{$namespace}-message-box {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-panel);
  box-shadow: var(--fsus-shadow-panel, none);
}

.#{$namespace}-notification {
  /* fsus-surface: high-level floating overlay [notification]
   * Short-lived, cross-content toast: popover radius + floating shadow.
   * Must not share Dialog/Drawer panel/no-shadow depth (#298).
   */
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-popover);
  box-shadow: var(--fsus-shadow-panel, none);
}`,
  },
  {
    id: 'notification-lose-floating-shadow',
    from: `.#{$namespace}-notification {
  /* fsus-surface: high-level floating overlay [notification]
   * Short-lived, cross-content toast: popover radius + floating shadow.
   * Must not share Dialog/Drawer panel/no-shadow depth (#298).
   */
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-popover);
  box-shadow: var(--fsus-shadow-floating);
}`,
    to: `.#{$namespace}-notification {
  /* fsus-surface: high-level floating overlay [notification]
   * Short-lived, cross-content toast: popover radius + floating shadow.
   * Must not share Dialog/Drawer panel/no-shadow depth (#298).
   */
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--fsus-radius-popover);
  box-shadow: var(--fsus-shadow-panel, none);
}`,
  },
  {
    id: 'dialog-drawer-hardcoded-floating-elevation',
    from: `border-radius: var(--fsus-radius-panel);
  box-shadow: var(--fsus-shadow-panel, none);
}

.#{$namespace}-message-box {`,
    to: `border-radius: var(--fsus-radius-panel);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

.#{$namespace}-message-box {`,
  },
] as const

describe('issue #298 overlay depth contract (Dialog/Drawer/Notification)', () => {
  test('theme ships panel/no-shadow panels and floating Notification', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const shippedCss = compileThemeFile('fsus.scss')
    const dialogCss = compileThemeFile('dialog.scss')
    const drawerCss = compileThemeFile('drawer.scss')
    const notificationCss = compileThemeFile('notification.scss')
    const messageBoxCss = compileThemeFile('message-box.scss')

    assertOverlayDepthContract(themeCss, 'fsus-theme')
    assertOverlayDepthContract(shippedCss, 'fsus.scss bundle')

    expectCssRule(dialogCss, '.el-dialog', [
      '--el-dialog-box-shadow: var(--fsus-shadow-panel, none);',
      'box-shadow: var(--el-dialog-box-shadow);',
    ])
    expectCssRule(drawerCss, '.el-drawer', [
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
    expectCssRule(messageBoxCss, '.el-message-box', [
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
    expectCssRule(notificationCss, '.el-notification', [
      'box-shadow: var(--el-notification-shadow);',
    ])
    expect(notificationCss).toMatch(
      /--el-notification-shadow:\s*var\(--fsus-shadow-floating/,
    )

    expect(themeCss).toMatch(
      /\.el-dialog,\s*\.el-drawer\s*\{[^}]*box-shadow:\s*var\(--fsus-shadow-panel,\s*none\)/s,
    )
  })

  test.each(fsusThemeMutations)(
    'mutation $id fails the overlay depth contract',
    ({ from, to, id }) => {
      const shipped = readFileSync(fsusThemePath, 'utf8')
      expect(shipped, `${id}: mutation target must exist in source`).toContain(
        from,
      )
      const mutated = shipped.replace(from, to)
      expect(mutated, `${id}: mutation must change source`).not.toBe(shipped)

      const css = compileString(mutated, {
        loadPaths: [themeSourceDir],
        style: 'expanded',
        url: pathToFileURL(fsusThemePath),
      }).css

      expect(
        () => assertOverlayDepthContract(css, id),
        `${id} must fail the overlay depth contract`,
      ).toThrow()
    },
  )

  test('component sources and vars keep canonical shadow tokens', () => {
    const dialogSource = readFileSync(dialogPath, 'utf8')
    const drawerSource = readFileSync(drawerPath, 'utf8')
    const notificationSource = readFileSync(notificationPath, 'utf8')
    const messageBoxSource = readFileSync(messageBoxPath, 'utf8')
    const varSource = readFileSync(varPath, 'utf8')

    expect(dialogSource).toContain(
      "box-shadow: getCssVar('dialog', 'box-shadow');",
    )
    expect(drawerSource).toContain(
      'box-shadow: var(--fsus-shadow-panel, none);',
    )
    expect(messageBoxSource).toContain(
      'box-shadow: var(--fsus-shadow-panel, none);',
    )
    expect(notificationSource).toContain(
      "box-shadow: getCssVar('notification-shadow');",
    )
    expect(varSource).toMatch(
      /\$notification:[\s\S]*?'shadow':\s*var\(--fsus-shadow-floating/,
    )
    expect(varSource).toMatch(
      /\$dialog:[\s\S]*?'box-shadow':\s*var\(--fsus-shadow-panel,\s*none\)/,
    )

    // Negative checks scoped to the first shadow entry of each map (avoid
    // matching later maps / panel-light token name prefixes).
    const dialogMap = varSource.match(/\$dialog:\s*\(\)\s*!default;[\s\S]*?\$dialog:\s*map\.merge\(\s*\(([\s\S]*?)\),\s*\$dialog\s*\)/u)
    const notificationMap = varSource.match(
      /\$notification:\s*\(\)\s*!default;[\s\S]*?\$notification:\s*map\.merge\(\s*\(([\s\S]*?)\),\s*\$notification\s*\)/u,
    )
    expect(dialogMap?.[1] ?? '').toMatch(
      /'box-shadow':\s*var\(--fsus-shadow-panel,\s*none\)/,
    )
    expect(dialogMap?.[1] ?? '').not.toMatch(
      /'box-shadow':\s*var\(--fsus-shadow-floating/,
    )
    expect(notificationMap?.[1] ?? '').toMatch(
      /'shadow':\s*var\(--fsus-shadow-floating/,
    )
    expect(notificationMap?.[1] ?? '').not.toMatch(
      /'shadow':\s*var\(--fsus-shadow-panel(?!-)/,
    )
  })
})
