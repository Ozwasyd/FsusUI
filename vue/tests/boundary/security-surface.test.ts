import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const sourcePatterns = ['vue/packages/components/**/*.{ts,tsx,vue}']
const ignorePatterns = [
  '**/__tests__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
]

type ExpectedSink = {
  contract: string
  evidence: RegExp[]
}

const expectedHtmlSinks: Record<string, ExpectedSink> = {
  'vue/packages/components/cascader-panel/src/menu.vue': {
    contract: 'static svg hover-zone geometry only',
    evidence: [/hoverZone\.value\.innerHTML = `[\s\S]*<path/],
  },
  'vue/packages/components/loading/src/loading.ts': {
    contract: 'explicit custom SVG override only; default spinner is VNode',
    evidence: [/\.\.\.\(svg \? \{ innerHTML: svg \} : \{\}\)/],
  },
  'vue/packages/components/markdown-renderer/src/markdown-renderer.vue': {
    contract: 'only branded runtime HTML or host TrustedHTML reaches v-html',
    evidence: [
      /v-html="resolveCommittedHtml\(item\.unit\.html\)"/,
      /v-html="resolveCommittedHtml\(renderedContent\)"/,
      /html: MarkdownSafeHtml/,
      /props\.trustedHtmlFactory\?\.\(html\)/,
    ],
  },
  'vue/packages/components/message-box/src/index.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'vue/packages/components/message/src/message.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'vue/packages/components/notification/src/notification.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'vue/packages/components/table/src/util.ts': {
    contract: 'overflow tooltip text is escaped before innerHTML placement',
    evidence: [/popperContent = escapeHtml\(popperContent\)/],
  },
  'vue/packages/components/tooltip/src/tooltip.vue': {
    contract: 'raw html requires rawContent opt-in',
    evidence: [/rawContent/, /v-html="content"/],
  },
}

const htmlSinkRe =
  /\bv-html\b|\.innerHTML\s*=|\binnerHTML\s*:|insertAdjacentHTML\s*\(|\.outerHTML\s*=/

const read = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

const listHtmlSinkFiles = async () => {
  const files = await fg(sourcePatterns, {
    cwd: repoRoot,
    ignore: ignorePatterns,
    onlyFiles: true,
  })

  return files.filter((file) => htmlSinkRe.test(read(file))).sort()
}

describe('HTML and injection boundary surface', () => {
  it('keeps every runtime HTML sink registered with an explicit safety contract', async () => {
    const actualSinkFiles = await listHtmlSinkFiles()
    const expectedSinkFiles = Object.keys(expectedHtmlSinks).sort()

    expect(actualSinkFiles).toEqual(expectedSinkFiles)

    for (const [file, sink] of Object.entries(expectedHtmlSinks)) {
      const source = read(file)
      for (const evidence of sink.evidence) {
        expect(
          evidence.test(source),
          `${file} must keep ${sink.contract}`,
        ).toBe(true)
      }
    }
  })

  it('keeps raw HTML escape hatches default-safe', () => {
    const defaultSafeContracts: Record<string, RegExp[]> = {
      'vue/packages/components/message/src/message.ts': [
        /dangerouslyUseHTMLString:\s*false/,
      ],
      'vue/packages/components/message-box/src/index.vue': [
        /dangerouslyUseHTMLString:\s*false/,
      ],
      'vue/packages/components/notification/src/notification.ts': [
        /dangerouslyUseHTMLString:\s*\{[\s\S]*?default:\s*false/,
      ],
      'vue/packages/components/tooltip/src/content.ts': [
        /rawContent:\s*\{[\s\S]*?default:\s*false/,
      ],
    }

    for (const [file, contracts] of Object.entries(defaultSafeContracts)) {
      expect(existsSync(resolve(repoRoot, file)), `${file} must exist`).toBe(
        true,
      )
      const source = read(file)
      for (const contract of contracts) {
        expect(contract.test(source), `${file} must remain default-safe`).toBe(
          true,
        )
      }
    }
  })

  it('keeps Markdown HTML construction inside its branded runtime boundary', () => {
    const markdownTypes = read('vue/packages/wasm/markdown.ts')
    const markdownRuntime = read('vue/packages/wasm/markdown-runtime.ts')
    const rendererProps = read(
      'vue/packages/components/markdown-renderer/src/markdown-renderer.ts',
    )

    expect(markdownTypes).toMatch(/export type MarkdownSafeHtml = string &/)
    expect(markdownTypes).toMatch(/export interface MarkdownSafeRenderResult/)
    expect(
      existsSync(resolve(repoRoot, 'vue/packages/wasm/markdown-safe.ts')),
    ).toBe(false)
    expect(
      existsSync(
        resolve(
          repoRoot,
          'vue/packages/components/markdown-renderer/src/markdown-renderer-cache.ts',
        ),
      ),
    ).toBe(false)
    const removedBuilder = new RegExp(
      `export function buildMarkdown${'RenderResult'}`,
    )
    const removedRendererProps = new RegExp(
      `${['initial', 'Html'].join('')}|${['sanitize', 'Html'].join('')}`,
    )
    expect(markdownTypes).not.toMatch(removedBuilder)
    expect(markdownRuntime).toMatch(/const authorizeMarkdownRuntimeResult/)
    expect(markdownRuntime).toMatch(
      /const markdownRuntimeAuthority = new WeakSet<object>\(\)/,
    )
    expect(markdownRuntime).not.toMatch(
      /export const (?:authorize|brand)Markdown/,
    )
    expect(rendererProps).toMatch(
      /MarkdownTrustedHtmlFactory = \(\s*safeHtml: MarkdownSafeHtml/,
    )
    expect(rendererProps).not.toMatch(removedRendererProps)
  })

  it('does not add SQL execution surfaces to the browser UI package', async () => {
    const files = await fg(sourcePatterns, {
      cwd: repoRoot,
      ignore: ignorePatterns,
      onlyFiles: true,
    })
    const sqlExecutionRe =
      /\b(?:executeSql|prepareStatement|createStatement|openDatabase|postgres|mysql|sqlite|sqlConnection|sqlQuery)\b/i
    const offenders = files
      .filter((file) => sqlExecutionRe.test(read(file)))
      .map((file) => relative(repoRoot, resolve(repoRoot, file)))

    expect(offenders).toEqual([])
  })
})
