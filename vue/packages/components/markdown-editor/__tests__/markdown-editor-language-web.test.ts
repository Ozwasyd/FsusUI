import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_WEB_LANGUAGE_BROWSERS,
  applyMarkdownSpellReplacement,
  bindMarkdownWebLanguageTools,
  driveMarkdownWebLanguageTrace,
  evaluateMarkdownWebLanguageMutations,
  planMarkdownWebReplacement,
  resolveMarkdownWebLanguageCoordinates,
} from '../src/markdown-editor-language-web'

describe('markdown web language tools integration', () => {
  it('binds spellcheck, lang, and attributes to textarea element', () => {
    const textarea = {
      spellcheck: false,
      value: 'Some prose text',
      selectionStart: 0,
      selectionEnd: 4,
    }
    const controller = bindMarkdownWebLanguageTools(textarea, {
      config: { spellcheck: true, lang: 'zh-CN', autocorrect: true },
    })

    expect(textarea.spellcheck).toBe(true)
    expect(textarea.lang).toBe('zh-CN')
    expect(textarea.autocorrect).toBe('on')
    expect(controller.spellcheck).toBe(true)
    expect(controller.lang).toBe('zh-CN')
  })

  it('runs correction, autocorrect, and dictation across Chromium, Firefox, and WebKit', () => {
    for (const browser of MARKDOWN_WEB_LANGUAGE_BROWSERS) {
      // 1. Spellcheck correction via context menu / beforeinput
      const spellTrace = driveMarkdownWebLanguageTrace(browser, 'spellcheck-correction')
      expect(spellTrace.some((e) => e.accepted && e.transaction?.origin === 'input')).toBe(true)

      // 2. Autocorrect
      const autoTrace = driveMarkdownWebLanguageTrace(browser, 'autocorrect')
      expect(autoTrace.some((e) => e.accepted && e.transaction?.origin === 'input')).toBe(true)

      // 3. Dictation
      const dictTrace = driveMarkdownWebLanguageTrace(browser, 'dictation')
      expect(dictTrace.some((e) => e.accepted && e.transaction?.origin === 'input')).toBe(true)

      // 4. Context menu
      const ctxTrace = driveMarkdownWebLanguageTrace(browser, 'context-menu')
      expect(ctxTrace.some((e) => e.accepted && e.transaction?.origin === 'input')).toBe(true)
    }
  })

  it('strictly protects CJK composition against language tool interleaving', () => {
    for (const browser of MARKDOWN_WEB_LANGUAGE_BROWSERS) {
      const trace = driveMarkdownWebLanguageTrace(browser, 'cjk-composition-spellcheck')
      expect(trace.every((e) => e.accepted === false)).toBe(true)
      expect(trace[0]?.reason).toBe('composition-active')
    }
  })

  it('keeps capability and does not disable spellcheck globally on source/live mode switch', () => {
    for (const browser of MARKDOWN_WEB_LANGUAGE_BROWSERS) {
      const trace = driveMarkdownWebLanguageTrace(browser, 'mode-switch-source-live')
      expect(trace.every((e) => e.accepted === true)).toBe(true)
    }
  })

  it('locally suppresses code/URL without permanently disabling spellcheck globally', () => {
    for (const browser of MARKDOWN_WEB_LANGUAGE_BROWSERS) {
      const trace = driveMarkdownWebLanguageTrace(browser, 'code-url-suppression')
      expect(trace.every((e) => e.accepted === true)).toBe(true)
      expect(trace[0]?.reason).toBe('code-block')
    }
  })

  it('rejects stale browser replacement after revision change', () => {
    for (const browser of MARKDOWN_WEB_LANGUAGE_BROWSERS) {
      const trace = driveMarkdownWebLanguageTrace(browser, 'stale-revision-rejected')
      expect(trace.every((e) => e.accepted === false)).toBe(true)
      expect(trace[0]?.reason).toBe('stale-revision')
    }
  })

  it('resolves coordinates without drift for hidden markers and atomic nodes', () => {
    const source = '# Heading\n```js\nconst x = 1\n```\nVisit [site](https://test.dev)\n'
    const headingCoords = resolveMarkdownWebLanguageCoordinates({ offset: 0, source })
    expect(headingCoords.inMarker).toBe(true)

    const codeCoords = resolveMarkdownWebLanguageCoordinates({ offset: 15, source })
    expect(codeCoords.inCode).toBe(true)

    const urlCoords = resolveMarkdownWebLanguageCoordinates({ offset: source.indexOf('https://') + 2, source })
    expect(urlCoords.inUrl).toBe(true)

    const proseCoords = resolveMarkdownWebLanguageCoordinates({ offset: source.indexOf('Visit'), source })
    expect(proseCoords.inCode).toBe(false)
    expect(proseCoords.inMarker).toBe(false)
    expect(proseCoords.inUrl).toBe(false)
  })

  it('kills all forbidden web mutation kinds in evaluation fixture', () => {
    const report = evaluateMarkdownWebLanguageMutations()
    expect(report.mutations.length).toBeGreaterThanOrEqual(5)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
    }
  })
})
