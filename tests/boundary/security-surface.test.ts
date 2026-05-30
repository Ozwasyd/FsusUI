import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const sourcePatterns = ['packages/components/**/*.{ts,tsx,vue}']
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
  'packages/components/cascader-panel/src/menu.vue': {
    contract: 'static svg hover-zone geometry only',
    evidence: [/hoverZone\.value\.innerHTML = `[\s\S]*<path/],
  },
  'packages/components/loading/src/loading.ts': {
    contract: 'explicit custom SVG override only; default spinner is VNode',
    evidence: [/\.\.\.\(svg \? \{ innerHTML: svg \} : \{\}\)/],
  },
  'packages/components/markdown-renderer/src/markdown-renderer.vue': {
    contract: 'sanitized by default through sanitizeHtml before v-html commit',
    evidence: [
      /v-html="item\.unit\.html"/,
      /v-html="renderedContent"/,
      /sanitizeMarkdownHtml/,
      /props\.sanitizeHtml/,
    ],
  },
  'packages/components/markdown-renderer/src/markdown-sanitize.ts': {
    contract: 'local template parsing only; sanitized output is returned',
    evidence: [
      /template\.innerHTML = html/,
      /sanitizeHtmlWithoutDom/,
      /unsafeElementNames/,
      /isUnsafeUrlValue/,
    ],
  },
  'packages/components/message-box/src/index.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'packages/components/message/src/message.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'packages/components/notification/src/notification.vue': {
    contract: 'raw html requires dangerouslyUseHTMLString opt-in',
    evidence: [/dangerouslyUseHTMLString/, /v-html="message"/],
  },
  'packages/components/table/src/util.ts': {
    contract: 'overflow tooltip text is escaped before innerHTML placement',
    evidence: [/popperContent = escapeHtml\(popperContent\)/],
  },
  'packages/components/tooltip/src/tooltip.vue': {
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

  return files
    .filter((file) => htmlSinkRe.test(read(file)))
    .sort()
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

  it('keeps raw HTML and sanitizer escape hatches default-safe', () => {
    const defaultSafeContracts: Record<string, RegExp[]> = {
      'packages/components/markdown-renderer/src/markdown-renderer.ts': [
        /allowHtml:\s*\{[\s\S]*?default:\s*false/,
        /sanitizeHtml:\s*\{[\s\S]*?default:\s*true/,
      ],
      'packages/components/message/src/message.ts': [
        /dangerouslyUseHTMLString:\s*false/,
      ],
      'packages/components/message-box/src/index.vue': [
        /dangerouslyUseHTMLString:\s*false/,
      ],
      'packages/components/notification/src/notification.ts': [
        /dangerouslyUseHTMLString:\s*\{[\s\S]*?default:\s*false/,
      ],
      'packages/components/tooltip/src/content.ts': [
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
