import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { FsusMarkdownRenderer } from '../index'
import { renderMarkdownFallbackWithRuntime } from '@fsusui/wasm'
import { getMarkdownXssSource } from '../../../../tests/support/markdown-xss-corpus'

describe('@fsusui/markdown & @fsusui/wasm decoupled subpaths', () => {
  it('renders XSS-safe Markdown via WASM/JS fallback using authoritative corpus', () => {
    const safe = renderMarkdownFallbackWithRuntime(
      `# FsusUI 2.0\n\n${getMarkdownXssSource('mxss-raw-script-basic')}`,
    )
    expect(safe.html).toContain('FsusUI 2.0')
    expect(safe.html.toLowerCase()).not.toContain('<script')
  })

  it('mounts FsusMarkdownRenderer with native Fsus* name', () => {
    const w = mount(FsusMarkdownRenderer, { props: { content: 'Hello **FsusUI 2.0**' } })
    expect(w.exists()).toBe(true)
    expect(FsusMarkdownRenderer.name).toBe('FsusMarkdownRenderer')
  })
})
