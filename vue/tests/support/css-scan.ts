import type { Page } from '@playwright/test'

export interface CssRuleEntry {
  selectorText: string
  cssText: string
}

/**
 * Collect every CSSStyleRule across all stylesheets, descending into nested
 * group rules (@media/@supports/@container). CSS gates must be evaluated
 * selector-scoped against these entries: joining whole-sheet cssText produces
 * cross-rule false positives (e.g. one rule contributes `12px`, an unrelated
 * rule contributes `border: 1px solid`).
 */
export const collectCssRules = (page: Page): Promise<CssRuleEntry[]> =>
  page.evaluate(() => {
    const entries: Array<{ selectorText: string; cssText: string }> = []
    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          entries.push({
            selectorText: rule.selectorText,
            cssText: rule.cssText,
          })
        } else if ('cssRules' in rule) {
          walk((rule as CSSMediaRule).cssRules)
        }
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules)
      } catch {
        // cross-origin stylesheet — skip
      }
    }
    return entries
  })
