import { describe, expect, it } from 'vitest'
import {
  MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG,
  resolveMarkdownEditorTypography,
  type MarkdownEditorTypographyProfile,
} from '../../../element-plus/index'

const standard: MarkdownEditorTypographyProfile = {
  schemaVersion: 1,
  fontFamily: 'system-sans',
  fontSize: 'standard',
  lineHeight: 'standard',
  canvasWidth: 'standard',
  paragraphSpacing: 'standard',
}

describe('public MarkdownEditor closed typography catalog', () => {
  it('parses all 243 closed combinations but supports only 27 declared engineering mappings', () => {
    const choices = MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.choices
    let parsed = 0
    let supported = 0
    for (const fontFamily of choices.fontFamily)
      for (const fontSize of choices.fontSize)
        for (const lineHeight of choices.lineHeight)
          for (const canvasWidth of choices.canvasWidth)
            for (const paragraphSpacing of choices.paragraphSpacing) {
              const result = resolveMarkdownEditorTypography({
                schemaVersion: 1,
                fontFamily,
                fontSize,
                lineHeight,
                canvasWidth,
                paragraphSpacing,
              })
              expect(result.status).not.toBe('invalid')
              parsed += 1
              if (result.status === 'supported') supported += 1
              if (result.status === 'unsupported')
                expect(result.unsupportedDimensions.length).toBeGreaterThan(0)
            }
    expect(parsed).toBe(243)
    expect(supported).toBe(27)
  })

  it('rejects extra fields, symbols, missing dimensions and future schema', () => {
    for (const input of [
      null,
      [],
      {},
      { ...standard, extra: true },
      { ...standard, [Symbol('style')]: true },
      { ...standard, schemaVersion: 2 },
      { ...standard, paragraphSpacing: undefined },
    ]) {
      expect(resolveMarkdownEditorTypography(input).status).toBe('invalid')
    }
  })

  it('rejects numeric, CSS and font URL values without coercion', () => {
    for (const fontFamily of [
      'https://fonts.example/font.woff2',
      'url(font.woff2)',
      'serif',
      18,
    ])
      expect(
        resolveMarkdownEditorTypography({ ...standard, fontFamily }).status,
      ).toBe('invalid')
    for (const fontSize of [18, '18px', 'calc(18px + 1vw)'])
      expect(
        resolveMarkdownEditorTypography({ ...standard, fontSize }).status,
      ).toBe('invalid')
  })

  it('rejects accessors without invoking their getters', () => {
    let reads = 0
    const input = { ...standard }
    Object.defineProperty(input, 'fontSize', {
      get: () => {
        reads += 1
        return 'standard'
      },
    })
    expect(resolveMarkdownEditorTypography(input).status).toBe('invalid')
    expect(reads).toBe(0)
  })

  it('does not mutate input and freezes all public catalog/profile collections', () => {
    const result = resolveMarkdownEditorTypography(standard)
    expect(result.status).toBe('supported')
    expect(Object.isFrozen(MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG)).toBe(true)
    for (const values of Object.values(
      MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.choices,
    ))
      expect(Object.isFrozen(values)).toBe(true)
    for (const values of Object.values(
      MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.supported,
    ))
      expect(Object.isFrozen(values)).toBe(true)
    if (result.status !== 'invalid') {
      expect(result.profile).toEqual(standard)
      expect(result.profile).not.toBe(standard)
      expect(Object.isFrozen(result.profile)).toBe(true)
    }
    expect(MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.baseline.paragraphSpacing).toBe(
      'source-blank-lines',
    )
    expect(MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.baseline.networkPolicy).toBe(
      'no-font-loader',
    )
  })
})
