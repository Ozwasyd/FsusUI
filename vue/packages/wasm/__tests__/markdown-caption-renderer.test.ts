import { describe, expect, it } from 'vitest'

import { getMarkdownXssSourceAttackFragment } from '../../../tests/support/markdown-xss-corpus'
import {
  evaluateMarkdownCaptionRendererMutations,
  renderMarkdownCaptionFigure,
} from '../markdown-caption-renderer'

describe('markdown caption figure renderer', () => {
  it('rejects the canonical raw-script corpus payload as caption syntax', () => {
    const scriptAttack = getMarkdownXssSourceAttackFragment(
      'mxss-raw-script-basic',
    )
    expect(
      renderMarkdownCaptionFigure(
        `![photo](a.png)\n::caption[${scriptAttack}]\n`,
      ),
    ).toEqual([])
  })

  it('emits safe figure/figcaption from parser groups without copying alt or title', () => {
    const source = '![photo](a.png "unused")\n::caption[hello & world]\n'
    const [figure] = renderMarkdownCaptionFigure(source)
    expect(figure).toBeTruthy()
    expect(figure!.tag).toBe('figure')
    expect(figure!.caption).toBe('hello &amp; world')
    expect(figure!.label.text).toBe('hello & world')
    expect(figure!.label.html).toBe('hello &amp; world')
    expect(figure!.visibleCopy).toBe('hello & world')
    expect(figure!.visibleCopy).not.toContain('::caption')
    expect(figure!.sourceDirective).toContain('::caption[hello & world]')
    expect(figure!.media.alt).toBe('photo')
    expect(figure!.media.title).toBe('unused')
    expect(figure!.label.text).not.toBe(figure!.media.alt)
    expect(figure!.label.text).not.toBe(figure!.media.title)
    expect(figure!.html).toContain('<figure>')
    expect(figure!.html).toContain('<figcaption tabindex="-1"')
    expect(figure!.html).not.toContain('<script')
    expect(figure!.label.tabIndex).toBe(-1)
  })

  it('keeps caption and source fallback when media is broken', () => {
    const [figure] = renderMarkdownCaptionFigure('![gone](#)\n::caption[Still here]\n')
    expect(figure).toBeTruthy()
    expect(figure!.media.broken).toBe(true)
    expect(figure!.html).toContain('data-markdown-media-fallback')
    expect(figure!.label.text).toBe('Still here')
    expect(figure!.visibleCopy).toBe('Still here')
  })

  it('kills title-caption, DOM regroup, arbitrary HTML, alt copy, and tab stops', () => {
    const report = evaluateMarkdownCaptionRendererMutations(
      '![photo](a.png "unused")\n::caption[Visible]\n',
    )
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'title-caption',
      'dom-regroup',
      'arbitrary-html',
      'alt-copy',
      'permanent-tab-stop',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
