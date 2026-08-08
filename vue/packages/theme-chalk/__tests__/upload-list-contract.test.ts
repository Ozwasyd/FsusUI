import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')
const uploadSourcePath = path.join(themeSourceDir, 'upload.scss')
const fsusThemePath = path.join(themeSourceDir, 'fsus-theme.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const stripScssComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

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

/**
 * Ordinary text upload-list contract for issue #456.
 * Flat rows, always-visible actions, public motion budgets, no ribbon/panel.
 */
const assertUploadListContract = (css: string, label: string) => {
  const textItemRules = cssRules(
    css,
    '.el-upload-list--text .el-upload-list__item',
  )
  expect(
    textItemRules.length,
    `${label}: expected text list item rules`,
  ).toBeGreaterThan(0)

  const flatGeometry = textItemRules.some((rule) =>
    rule.includes('border-radius: 0'),
  )
  expect(flatGeometry, `${label}: text items must be flat (radius 0)`).toBe(
    true,
  )

  for (const rule of textItemRules) {
    expect(rule, `${label}: no 12px panel radius on text item`).not.toMatch(
      /border-radius:\s*12px/,
    )
    expect(rule, `${label}: no fsus-radius-panel on text item`).not.toMatch(
      /border-radius:\s*var\(--fsus-radius-panel/,
    )
  }

  // Always-visible close: non-hover selectors under text list must use inline-flex.
  // Hover-only regressions set display:none on the base rule and only show on :hover.
  const closeRuleEntries: Array<{ selector: string; body: string }> = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  for (const match of css.matchAll(rulePattern)) {
    const selector = match[1].replace(/\s+/g, ' ').trim()
    const body = match[2].replace(/\s+/g, ' ').trim()
    const isTextClose =
      selector.includes('.el-upload-list--text') &&
      (selector.includes('.el-icon--close') ||
        selector.includes('.el-upload-list__item-delete'))
    if (isTextClose) closeRuleEntries.push({ selector, body })
  }
  expect(
    closeRuleEntries.length,
    `${label}: expected text close/delete rules`,
  ).toBeGreaterThan(0)

  const baseCloseRules = closeRuleEntries.filter(
    ({ selector }) =>
      !selector.includes(':hover') && !selector.includes(':focus-within'),
  )
  expect(
    baseCloseRules.length,
    `${label}: expected base (non-hover) text close rules`,
  ).toBeGreaterThan(0)
  expect(
    baseCloseRules.some((r) => /display:\s*inline-flex/.test(r.body)),
    `${label}: base text close/delete must be display:inline-flex (not hover-only)`,
  ).toBe(true)
  expect(
    baseCloseRules.some((r) => /display:\s*none/.test(r.body)),
    `${label}: base text close must not be display:none`,
  ).toBe(false)

  expect(css, `${label}: list enter uses control/fast tokens`).toMatch(
    /\.el-upload-list-enter-active[\s\S]{0,200}?var\(--fsus-motion-control/,
  )
  expect(css, `${label}: list leave uses control tokens`).toMatch(
    /\.el-upload-list-leave-active[\s\S]{0,200}?var\(--fsus-motion-control/,
  )
  expect(css, `${label}: enter offset ≤8px`).toMatch(
    /\.el-upload-list-enter-from[\s\S]{0,120}?translateY\(\s*-?8px\s*\)/,
  )
  expect(css, `${label}: no 500ms item travel`).not.toMatch(
    /\.el-upload-list__item\s*\{[^}]*transition:[^}]*0\.5s/s,
  )
  expect(css, `${label}: no 30px list travel`).not.toMatch(
    /\.el-upload-list-enter-from[\s\S]{0,80}?translateY\(\s*-?30px\s*\)/,
  )

  expect(css, `${label}: reduced motion 1ms`).toMatch(
    /prefers-reduced-motion:\s*reduce[\s\S]{0,400}?\.el-upload-list-enter-active[\s\S]{0,200}?transition-duration:\s*1ms/s,
  )
  expect(css, `${label}: reduced motion zero transform`).toMatch(
    /prefers-reduced-motion:\s*reduce[\s\S]{0,500}?\.el-upload-list-enter-from[\s\S]{0,120}?transform:\s*none/s,
  )

  // Ribbon kill for ordinary text rows: status-label under --text must not rotate.
  const textStatusRules = cssRules(
    css,
    '.el-upload-list--text .el-upload-list__item-status-label',
  )
  expect(
    textStatusRules.length,
    `${label}: text status-label rules present`,
  ).toBeGreaterThan(0)
  for (const rule of textStatusRules) {
    expect(rule, `${label}: no rotate(45deg) ribbon on text status`).not.toMatch(
      /rotate\(\s*45deg\s*\)/,
    )
    expect(rule, `${label}: no absolute corner ribbon right offset`).not.toMatch(
      /right:\s*-1[5-7]px/,
    )
  }

  // Contract requires opacity:1 on disabled items outside of picture-card
  // (picture-card has its own independent disabled surface rules).
  expect(css, `${label}: disabled independent opacity`).toMatch(
    /(?<!picture-card\s)\.el-upload-list__item\.is-disabled[\s\S]{0,120}?opacity:\s*1/,
  )
}

const uploadMutations = [
  {
    id: 'reintroduce-success-ribbon',
    from: `// No rotated success ribbon / corner badge on ordinary rows.
    .#{bem('upload-list', 'item-status-label')} {
      background: transparent;
      width: auto;
      height: auto;
    }`,
    to: `// MUTATION: success ribbon
    .#{bem('upload-list', 'item-status-label')} {
      position: absolute;
      right: -15px;
      top: -6px;
      width: 40px;
      height: 24px;
      background: getCssVar('color-success');
      transform: rotate(45deg);
    }`,
  },
  {
    id: 'reintroduce-card-row-panel',
    from: `display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 8px;
      row-gap: 4px;
      min-height: var(--fsus-control-height-compact, 40px);
      padding: 8px 0;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
      border: none;
      border-bottom: 1px solid getCssVar('border-color', 'lighter');
      background: transparent;
      overflow: visible;`,
    to: `display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 8px;
      row-gap: 4px;
      min-height: var(--fsus-control-height-compact, 40px);
      padding: 10px 12px;
      margin: 0 0 8px;
      border-radius: 12px;
      box-shadow: var(--fsus-shadow-panel);
      border: 1px solid getCssVar('border-color');
      background: getCssVar('fill-color', 'blank');
      overflow: hidden;`,
  },
  {
    id: 'reintroduce-hover-only-actions',
    from: `.#{bem('icon', '', 'close')},
    .#{bem('upload-list', 'item-delete')} {
      @include ghost-icon-button(
        var(--fsus-icon-target-small, 32px),
        999px,
        0,
        true
      );
      position: static;
      display: inline-flex;
      transform: none;
      opacity: 1;
      top: auto;
      right: auto;
      color: getCssVar('text-color', 'regular');`,
    to: `.#{bem('icon', '', 'close')},
    .#{bem('upload-list', 'item-delete')} {
      @include ghost-icon-button(
        var(--fsus-icon-target-small, 32px),
        999px,
        0,
        true
      );
      position: static;
      display: none;
      transform: none;
      opacity: 0;
      top: auto;
      right: auto;
      color: getCssVar('text-color', 'regular');`,
  },
  {
    id: 'reintroduce-500ms-30px-motion',
    from: `&-enter-active,
  &-leave-active {
    transition:
      opacity var(--fsus-motion-control, 220ms)
        var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)),
      transform var(--fsus-motion-control-fast, 140ms)
        var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }`,
    to: `&-enter-active,
  &-leave-active {
    transition:
      opacity 0.5s cubic-bezier(0.55, 0, 0.1, 1),
      transform 0.5s cubic-bezier(0.55, 0, 0.1, 1);
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
    transform: translateY(-30px);
  }`,
  },
  {
    id: 'reintroduce-ancestor-opacity-disabled',
    from: `@include when(disabled) {
      color: var(--el-disabled-text-color);
      background: transparent;
      opacity: 1;
      cursor: not-allowed;

      .#{bem('upload-list', 'item-name')} {
        color: var(--el-disabled-text-color);
        cursor: not-allowed;
      }
    }`,
    to: `@include when(disabled) {
      color: var(--el-disabled-text-color);
      background: transparent;
      opacity: 0.5;
      cursor: not-allowed;

      .#{bem('upload-list', 'item-name')} {
        color: var(--el-disabled-text-color);
        cursor: not-allowed;
      }
    }`,
  },
] as const

const fsusThemeMutations = [
  {
    id: 'reintroduce-fsus-panel-on-text-item',
    from: `// Upload ordinary file rows are flat document rows (#456) — not per-item panels.
// picture / picture-card keep their own surface rules in upload.scss.
.#{$namespace}-upload-list--text .#{$namespace}-upload-list__item {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
  padding: 8px 0;
  margin: 0;`,
    to: `// MUTATION: panel chrome on text items
.#{$namespace}-upload-list--text .#{$namespace}-upload-list__item {
  @include fsus-control(panel);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 0 0 8px;`,
  },
] as const

describe('issue #456 upload-list flat row contract', () => {
  test('shipped upload.scss and fsus-theme pass the text list contract', () => {
    const uploadSource = stripScssComments(
      readFileSync(uploadSourcePath, 'utf8'),
    )
    expect(uploadSource).toContain('var(--fsus-motion-control, 220ms)')
    expect(uploadSource).toContain('translateY(-8px)')
    expect(uploadSource).not.toMatch(
      /upload-list__item[^{]*\{[^}]*0\.5s cubic-bezier/s,
    )

    const uploadCss = compileThemeFile('upload.scss')
    assertUploadListContract(uploadCss, 'upload.scss')

    const themeCss = compileThemeFile('fsus-theme.scss')
    expect(themeCss).toMatch(
      /\.el-upload-list--text\s+\.el-upload-list__item\s*\{[^}]*border-radius:\s*0/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-upload-list--text\s+\.el-upload-list__item\s*\{[^}]*border-radius:\s*12px/s,
    )
    expect(themeCss).not.toMatch(
      /^\.el-upload-list__item\s*\{[^}]*border-radius:\s*var\(--fsus-radius-panel/m,
    )
  })

  test.each(uploadMutations)(
    'mutation $id fails the upload-list contract',
    ({ from, to, id }) => {
      const shipped = readFileSync(uploadSourcePath, 'utf8')
      expect(shipped, `${id}: mutation target must exist in source`).toContain(
        from,
      )
      const mutated = shipped.replace(from, to)
      expect(mutated, `${id}: mutation must change source`).not.toBe(shipped)

      const css = compileString(mutated, {
        loadPaths: [themeSourceDir],
        style: 'expanded',
        url: pathToFileURL(uploadSourcePath),
      }).css

      expect(
        () => assertUploadListContract(css, id),
        `${id} must fail the contract`,
      ).toThrow()
    },
  )

  test.each(fsusThemeMutations)(
    'fsus-theme mutation $id reintroduces card panel and is rejected',
    ({ from, to, id }) => {
      const shipped = readFileSync(fsusThemePath, 'utf8')
      expect(shipped, `${id}: mutation target must exist`).toContain(from)
      const mutated = shipped.replace(from, to)
      expect(mutated).not.toBe(shipped)

      const css = compileString(mutated, {
        loadPaths: [themeSourceDir],
        style: 'expanded',
        url: pathToFileURL(fsusThemePath),
      }).css

      expect(
        css,
        `${id}: mutated theme must contain 12px panel radius on text item`,
      ).toMatch(
        /\.el-upload-list--text\s+\.el-upload-list__item\s*\{[^}]*border-radius:\s*12px/s,
      )

      const clean = compileThemeFile('fsus-theme.scss')
      expect(clean).toMatch(
        /\.el-upload-list--text\s+\.el-upload-list__item\s*\{[^}]*border-radius:\s*0/s,
      )
      expect(clean).not.toMatch(
        /\.el-upload-list--text\s+\.el-upload-list__item\s*\{[^}]*border-radius:\s*12px/s,
      )
    },
  )
})
