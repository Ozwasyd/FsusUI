// @vitest-environment happy-dom
import { webcrypto } from 'node:crypto'
import { mount } from '@vue/test-utils'
import { ElMarkdownEditor } from '@ozwasyd/element-plus'
import { prepareMarkdownEmbedResult } from '@ozwasyd/element-plus/markdown-runtime'
import { afterEach, expect, it, vi } from 'vitest'
import fixture from './markdown-embed-projection-blog-coordinate.json'

afterEach(() => vi.unstubAllGlobals())

// This real public Editor regression remains RED until the reserved owner
// applies the production integration; there are no renderer/provider mocks.
it('presents the materialized reference in the real read-only preview embed', async () => {
  vi.stubGlobal('crypto', webcrypto)
  ;(
    window as unknown as { happyDOM: { setURL: (url: string) => void } }
  ).happyDOM.setURL('http://localhost:3000/')
  const target = fixture.coordinate.target.portableArticleIdentity
  const directive = `::embed[target="${target}" mode="article"]`
  const coordinate = Object.freeze({
    targetIdentity: target,
    resolvedRevision: String(fixture.coordinate.resolvedRevision),
    targetVersionIdentity: fixture.coordinate.targetVersionIdentity,
    projectionIdentity: fixture.projection.projectionIdentity,
    projectionDigest: fixture.projection.contentDigest,
  })
  const wrapper = mount(ElMarkdownEditor, {
    props: {
      modelValue: directive,
      defaultMode: 'preview',
      embedProvider: (request) =>
        prepareMarkdownEmbedResult(
          request,
          {
            ...request,
            status: 'resolved',
            targetVersion: coordinate,
            projection: {
              kind: 'markdown-reference',
              projectionIdentity: fixture.projection.projectionIdentity,
              contentDigest: fixture.projection.contentDigest,
            },
          },
          {
            readTargetVersion: () => coordinate,
            resolveMarkdown: () => fixture.source,
          },
        ),
    },
  })
  try {
    await expect
      .poll(
        () =>
          wrapper.find('.el-markdown-embed .markdown-renderer strong').exists(),
        { timeout: 2000 },
      )
      .toBe(true)
    expect(
      wrapper.find('.el-markdown-embed .markdown-renderer strong').text(),
    ).toBe('controlled')
    expect(
      wrapper
        .find(
          '.el-markdown-embed textarea, .el-markdown-embed [contenteditable="true"]',
        )
        .exists(),
    ).toBe(false)
    expect(wrapper.props('modelValue')).toBe(directive)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  } finally {
    wrapper.unmount()
  }
})
