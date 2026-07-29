import { describe, expect, it } from 'vitest'
import {
  CODE_HIGHLIGHT_OUTPUT_POLICY,
  LATEX_OUTPUT_POLICY,
  MERMAID_OUTPUT_POLICY,
  commitMarkdownFeatureOutput,
} from '../markdown-feature-output-gateway'
import { getMarkdownXssFeatureOutput } from '../../../tests/support/markdown-xss-corpus'

describe('Markdown feature output gateway', () => {
  it('keeps code-highlight, LaTeX, and Mermaid policies independent', () => {
    expect(CODE_HIGHLIGHT_OUTPUT_POLICY).not.toBe(LATEX_OUTPUT_POLICY)
    expect(LATEX_OUTPUT_POLICY).not.toBe(MERMAID_OUTPUT_POLICY)
    expect(Object.keys(CODE_HIGHLIGHT_OUTPUT_POLICY.elements)).toEqual([
      'code',
      'pre',
      'span',
    ])
    expect(CODE_HIGHLIGHT_OUTPUT_POLICY.elements.pre).toEqual([
      'class',
      'style',
      'tabindex',
    ])
    expect(CODE_HIGHLIGHT_OUTPUT_POLICY.classTokens).toEqual(
      expect.objectContaining({
        elements: { code: [], span: ['line'] },
        root: ['github-dark', 'github-light', 'shiki'],
      }),
    )
    expect(Object.keys(LATEX_OUTPUT_POLICY.elements)).toContain('math')
    expect(Object.keys(LATEX_OUTPUT_POLICY.elements)).not.toContain('svg')
    expect(LATEX_OUTPUT_POLICY.styleProperties).toEqual([])
    expect(LATEX_OUTPUT_POLICY.classTokens.root).toEqual(['katex'])
    expect(Object.keys(MERMAID_OUTPUT_POLICY.elements)).toContain('svg')
    expect(Object.keys(MERMAID_OUTPUT_POLICY.elements)).toContain('symbol')
    expect(Object.keys(MERMAID_OUTPUT_POLICY.elements)).not.toContain('math')
    expect(MERMAID_OUTPUT_POLICY.urlAttributes).toEqual({
      href: 'local-fragment',
      'marker-end': 'local-fragment',
      'marker-start': 'local-fragment',
    })
    expect(
      MERMAID_OUTPUT_POLICY.classTokens.descendantForbiddenPrefixes,
    ).toEqual(['el-', 'fsus-', 'is-', 'markdown-renderer'])
  })

  it('removes executable and undeclared Mermaid SVG output', () => {
    for (const id of [
      'mxss-feature-mermaid-script',
      'mxss-feature-mermaid-foreignobject',
      'mxss-feature-mermaid-external-use',
    ]) {
      const target = document.createElement('figure')
      const output = getMarkdownXssFeatureOutput(id)
      commitMarkdownFeatureOutput(target, output, { nonce: 'nonce-1' })
      expect(target.querySelector('script'), id).toBeNull()
      expect(target.querySelector('foreignObject'), id).toBeNull()
      expect(target.querySelector('iframe'), id).toBeNull()
      expect(target.querySelector('[onload],[srcdoc]'), id).toBeNull()
      expect(
        target.querySelector('use')?.hasAttribute('href') ?? false,
        id,
      ).toBe(false)
    }
  })

  it('scopes Mermaid CSS, replaces incoming nonce, and rejects CSS escapes', () => {
    const target = document.createElement('figure')
    const output = getMarkdownXssFeatureOutput(
      'mxss-feature-mermaid-css-escape',
    )
    commitMarkdownFeatureOutput(target, output, {
      nonce: 'controlled-nonce',
    })

    const style = target.querySelector('style')
    expect(style).toBeNull()
    expect(target.querySelector('g')?.getAttribute('style')).toBe(
      'fill:#409eff',
    )
    expect(target.querySelector('path')?.getAttribute('marker-end')).toBe(
      `url(#${output.rootId}_marker)`,
    )
  })

  it('drops an unscoped Mermaid stylesheet and unresolved local references', () => {
    const target = document.createElement('figure')
    const rootId = 'fsus-markdown-mermaid-unscoped'
    commitMarkdownFeatureOutput(target, {
      kind: 'mermaid',
      payload: `
        <svg id="${rootId}" xmlns="http://www.w3.org/2000/svg">
          <style>#${rootId} .node{fill:#409eff}body{background:red}</style>
          <path marker-end="url(#host-marker)"></path>
        </svg>
      `,
      rootId,
    })

    expect(target.querySelector('style')).toBeNull()
    expect(target.querySelector('path')?.hasAttribute('marker-end')).toBe(false)
  })

  it('rejects Mermaid root overlay styles even when the stylesheet is root scoped', () => {
    const target = document.createElement('figure')
    const rootId = 'fsus-markdown-mermaid-overlay'
    commitMarkdownFeatureOutput(target, {
      kind: 'mermaid',
      payload: `
        <svg
          id="${rootId}"
          xmlns="http://www.w3.org/2000/svg"
          width="100vw"
          height="100vh"
          style="position:fixed;inset:0;top:0;right:0;bottom:0;left:0;z-index:2147483647;width:100vw;height:100vh;pointer-events:auto;max-width:100% !important;max-width:450px"
        >
          <style>
            #${rootId} {
              position: fixed;
              inset: 0;
              top: 0;
              right: 0;
              bottom: 0;
              left: 0;
              z-index: 2147483647;
              width: 100vw;
              height: 100vh;
              pointer-events: auto;
              max-width: 100%;
              fill: #409eff;
            }
          </style>
          <text>safe</text>
        </svg>
      `,
      rootId,
    })

    expect(target.querySelector('svg')?.getAttribute('style')).toBe(
      'max-width:450px',
    )
    expect(target.querySelector('svg')?.hasAttribute('width')).toBe(false)
    expect(target.querySelector('svg')?.hasAttribute('height')).toBe(false)
    expect(target.querySelector('style')?.textContent).toBe(
      `#${rootId}{fill:#409eff}`,
    )
  })

  it('removes host classes from Mermaid roots token by token', () => {
    const hostileTarget = document.createElement('figure')
    commitMarkdownFeatureOutput(hostileTarget, {
      kind: 'mermaid',
      payload: `
        <svg
          id="fsus-markdown-mermaid-host-classes"
          xmlns="http://www.w3.org/2000/svg"
          class="el-loading-mask is-fullscreen"
        ></svg>
      `,
      rootId: 'fsus-markdown-mermaid-host-classes',
    })
    expect(hostileTarget.querySelector('svg')?.hasAttribute('class')).toBe(
      false,
    )

    const mixedTarget = document.createElement('figure')
    commitMarkdownFeatureOutput(mixedTarget, {
      kind: 'mermaid',
      payload: `
        <svg
          id="fsus-markdown-mermaid-mixed-classes"
          xmlns="http://www.w3.org/2000/svg"
          class="flowchart el-loading-mask is-fullscreen host-state"
        ></svg>
      `,
      rootId: 'fsus-markdown-mermaid-mixed-classes',
    })
    expect(mixedTarget.querySelector('svg')?.getAttribute('class')).toBe(
      'flowchart',
    )
  })

  it.each(['flowchart', 'classDiagram', 'statediagram', 'erDiagram'])(
    'preserves the Mermaid 11 %s root class',
    (rootClass) => {
      const target = document.createElement('figure')
      const rootId = `fsus-markdown-mermaid-${rootClass.toLowerCase()}`
      commitMarkdownFeatureOutput(target, {
        kind: 'mermaid',
        payload: `<svg id="${rootId}" xmlns="http://www.w3.org/2000/svg" width="100%" height="565" class="${rootClass}"></svg>`,
        rootId,
      })

      expect(target.querySelector('svg')?.getAttribute('class')).toBe(rootClass)
      expect(target.querySelector('svg')?.getAttribute('width')).toBe('100%')
      expect(target.querySelector('svg')?.getAttribute('height')).toBe('565')
    },
  )

  it('removes event, URL, and unknown KaTeX output', () => {
    const target = document.createElement('span')
    commitMarkdownFeatureOutput(
      target,
      getMarkdownXssFeatureOutput('mxss-feature-latex-event'),
    )

    expect(target.querySelector('[onclick],[onload],[onerror]')).toBeNull()
    expect(target.querySelector('img')).toBeNull()
    expect(target.querySelector('math mtext')?.textContent).toBe('x')
  })

  it('keeps only the real KaTeX mathml-only root class', () => {
    const target = document.createElement('span')
    commitMarkdownFeatureOutput(target, {
      kind: 'latex',
      payload: `
        <span class="katex el-loading-mask is-fullscreen">
          <span class="el-dialog is-fullscreen">host child</span>
          <math class="el-loading-mask is-fullscreen" xmlns="http://www.w3.org/1998/Math/MathML">
            <mrow class="el-button"><mi>x</mi></mrow>
          </math>
        </span>
      `,
    })

    const root = target.querySelector(':scope > .katex')
    expect(root?.getAttribute('class')).toBe('katex')
    expect(root?.querySelector('span')?.hasAttribute('class')).toBe(false)
    expect(root?.querySelector('math')?.hasAttribute('class')).toBe(false)
    expect(root?.querySelector('mrow')?.hasAttribute('class')).toBe(false)
  })

  it('removes script, event, undeclared style, and attributes from Shiki output', () => {
    for (const id of [
      'mxss-feature-shiki-event',
      'mxss-feature-shiki-style-url',
    ]) {
      const target = document.createElement('pre')
      const committed = commitMarkdownFeatureOutput(
        target,
        getMarkdownXssFeatureOutput(id),
        { mode: 'replace-element' },
      )
      expect(committed.tagName, id).toBe('PRE')
      expect(committed.querySelector('script,iframe'), id).toBeNull()
      expect(committed.querySelector('[onclick],[srcdoc]'), id).toBeNull()
      expect(committed.getAttribute('style') ?? '', id).not.toContain('url(')
    }
  })

  it.each(['github-light', 'github-dark'])(
    'preserves the locked Shiki %s class shape',
    (theme) => {
      const target = document.createElement('pre')
      const committed = commitMarkdownFeatureOutput(
        target,
        {
          kind: 'code-highlight',
          payload: `<pre class="shiki ${theme}" style="background-color:#fff;color:#24292e" tabindex="0"><code><span class="line"><span style="color:#D73A49">const</span></span></code></pre>`,
        },
        { mode: 'replace-element' },
      )

      expect(committed.getAttribute('class')).toBe(`shiki ${theme}`)
      expect(committed.querySelector('code')?.hasAttribute('class')).toBe(false)
      expect(committed.querySelector('span.line')).toBeTruthy()
    },
  )

  it('removes reserved host classes from Mermaid descendants only', () => {
    const target = document.createElement('figure')
    const rootId = 'fsus-markdown-mermaid-descendant-classes'
    commitMarkdownFeatureOutput(target, {
      kind: 'mermaid',
      payload: `
        <svg id="${rootId}" xmlns="http://www.w3.org/2000/svg" class="flowchart">
          <g class="node user-token el-dialog is-fullscreen fsus-state markdown-renderer__surface">
            <rect class="shape el-button EL-TABLE is-FULLSCREEN FSUS-probe Markdown-Renderer-host"></rect>
          </g>
        </svg>
      `,
      rootId,
    })

    expect(target.querySelector('svg')?.getAttribute('class')).toBe('flowchart')
    expect(target.querySelector('g')?.getAttribute('class')).toBe(
      'node user-token',
    )
    expect(target.querySelector('rect')?.getAttribute('class')).toBe('shape')
    expect(
      target.querySelector(
        '.el-dialog,.el-button,.is-fullscreen,[class*="fsus-"],[class*="markdown-renderer"]',
      ),
    ).toBeNull()
  })

  it('rejects extra roots and kind-specific root shape violations', () => {
    const codeTarget = document.createElement('pre')
    expect(() =>
      commitMarkdownFeatureOutput(
        codeTarget,
        {
          kind: 'code-highlight',
          payload: '<pre><code>ok</code></pre><pre><code>extra</code></pre>',
        },
        { mode: 'replace-element' },
      ),
    ).toThrow('code-highlight_output_root_invalid')

    const latexTarget = document.createElement('span')
    expect(() =>
      commitMarkdownFeatureOutput(latexTarget, {
        kind: 'latex',
        payload:
          '<span class="katex"><span>HTML-only output is not MathML</span></span>',
      }),
    ).toThrow('latex_output_root_invalid')

    const mermaidTarget = document.createElement('figure')
    expect(() =>
      commitMarkdownFeatureOutput(mermaidTarget, {
        kind: 'mermaid',
        payload:
          '<svg id="fsus-markdown-mermaid-other" xmlns="http://www.w3.org/2000/svg"></svg>',
        rootId: 'fsus-markdown-mermaid-expected',
      }),
    ).toThrow('mermaid_output_root_invalid')
  })
})
