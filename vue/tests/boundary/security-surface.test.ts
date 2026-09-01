import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import fg from 'fast-glob'
import * as ts from 'typescript'
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
  'vue/packages/components/markdown-editor/src/markdown-editor-latex.ts': {
    contract: 'mutation fixtures reject consumer innerHTML; no DOM HTML write',
    evidence: [/latex output must not accept consumer innerHTML or DOM/],
  },
  'vue/packages/components/markdown-editor/src/markdown-editor-mermaid.ts': {
    contract: 'mutation fixtures reject consumer innerHTML; no DOM HTML write',
    evidence: [/mermaid output must not accept consumer innerHTML or SVG/],
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

  it('keeps third-party Markdown feature HTML inside the single owned gateway', async () => {
    const featureSources = await fg(
      [
        'vue/packages/wasm/markdown*.ts',
        'vue/packages/components/markdown-renderer/src/*.{ts,vue}',
      ],
      {
        cwd: repoRoot,
        ignore: ignorePatterns,
        onlyFiles: true,
      },
    )
    const parserSink =
      /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|createContextualFragment\s*\(/
    const sinks = featureSources
      .filter((file) => parserSink.test(read(file)))
      .sort()

    expect(sinks).toEqual([
      'vue/packages/wasm/markdown-feature-output-gateway.ts',
    ])

    const gateway = read('vue/packages/wasm/markdown-feature-output-gateway.ts')
    const runtime = read('vue/packages/wasm/markdown-runtime.ts')
    const wasmIndex = read('vue/packages/wasm/index.ts')
    const publicRuntime = read('vue/packages/element-plus/markdown-runtime.ts')
    const rendererProps = read(
      'vue/packages/components/markdown-renderer/src/markdown-renderer.ts',
    )
    expect(gateway).toMatch(/CODE_HIGHLIGHT_OUTPUT_POLICY/)
    expect(gateway).toMatch(/LATEX_OUTPUT_POLICY/)
    expect(gateway).toMatch(/MERMAID_OUTPUT_POLICY/)
    expect(gateway).toMatch(/commitMarkdownFeatureOutput/)
    expect(gateway.match(/trustedTypes\.createPolicy\(/gu)).toHaveLength(1)
    expect(gateway).toMatch(
      /const MARKDOWN_FEATURE_TRUSTED_TYPES_POLICY_NAME = 'fsusui-markdown-feature'/,
    )
    expect(gateway).toMatch(
      /const markdownFeatureTrustedTypesPolicies = new WeakMap<\s*Window,/,
    )
    expect(gateway).not.toMatch(/\bdefaultPolicy\b/)
    expect(gateway).not.toMatch(
      /export\s+(?:const|function|let|var|type|interface)\s+\w*TrustedTypes/,
    )
    expect(gateway).toMatch(/sanitizeMermaidStyleSheet/)
    expect(gateway).toMatch(/sanitizeMermaidRoot/)
    expect(wasmIndex).not.toMatch(/markdown-feature-output-gateway/)
    expect(publicRuntime).not.toMatch(/commitMarkdownFeatureOutput/)

    const runtimeSource = ts.createSourceFile(
      'markdown-runtime.ts',
      runtime,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const staticGatewayImports = runtimeSource.statements.filter(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === './markdown-feature-output-gateway',
    )
    expect(staticGatewayImports).toHaveLength(1)
    expect(staticGatewayImports[0]?.importClause?.isTypeOnly).toBe(true)

    const literalGatewayImports = Array.from(
      runtime.matchAll(
        /\bimport\(\s*(['"])\.\/markdown-feature-output-gateway\1\s*\)/gu,
      ),
    )
    expect(literalGatewayImports).toHaveLength(1)
    const loaderStart = runtime.indexOf(
      'let markdownFeatureOutputGatewayPromise:',
    )
    const loaderEnd = runtime.indexOf(
      '\nconst defaultMarkdownFeatureOptions',
      loaderStart,
    )
    const loader = runtime.slice(loaderStart, loaderEnd)
    expect(loaderStart).toBeGreaterThanOrEqual(0)
    expect(loaderEnd).toBeGreaterThan(loaderStart)
    expect(loader).toMatch(
      /^let markdownFeatureOutputGatewayPromise:\s*Promise<MarkdownFeatureOutputGateway>\s*\|\s*null\s*=\s*null/u,
    )
    expect(loader).toMatch(
      /const loadMarkdownFeatureOutputGateway = \(\) => \{\s*markdownFeatureOutputGatewayPromise \?\?=\s*import\(\s*['"]\.\/markdown-feature-output-gateway['"]\s*\)\s*return markdownFeatureOutputGatewayPromise\s*\}\s*$/u,
    )
    expect(runtime).not.toMatch(
      /export\s+(?:const|function|let|var)\s+(?:loadMarkdownFeatureOutputGateway|markdownFeatureOutputGatewayPromise|commitMarkdownFeatureOutput)\b/u,
    )

    const activationStart = runtime.indexOf(
      'const activateBuiltInFeature = async',
    )
    const activationEnd = runtime.indexOf(
      '\ninterface MarkdownFeatureActivationWork',
      activationStart,
    )
    const activation = runtime.slice(activationStart, activationEnd)
    expect(activationStart).toBeGreaterThanOrEqual(0)
    expect(activationEnd).toBeGreaterThan(activationStart)
    expect(
      activation.match(/loadMarkdownFeatureOutputGateway\(\)/gu),
    ).toHaveLength(3)
    expect(
      activation.match(/gateway\.commitMarkdownFeatureOutput\(/gu),
    ).toHaveLength(3)
    for (const renderer of [
      'renderMermaidFeature',
      'renderLatexFeature',
      'renderCodeHighlightFeature',
    ]) {
      expect(activation).toMatch(
        new RegExp(
          `Promise\\.all\\(\\[\\s*${renderer}\\([\\s\\S]*?\\),\\s*loadMarkdownFeatureOutputGateway\\(\\),\\s*\\]\\)`,
          'u',
        ),
      )
    }
    expect(activation).toMatch(
      /const source = code\.textContent \?\? ''\s*if \(!source\) return false\s*try \{[\s\S]*?loadMarkdownFeatureOutputGateway\(\)/u,
    )
    expect(runtime).not.toMatch(
      /sanitizeFeatureFragment|createSafeFeatureFragment/,
    )
    expect(runtime).not.toMatch(/default(?:CodeHighlight|Latex|Mermaid)Adapter/)
    expect(runtime).toMatch(
      /const toFeatureRenderContext[\s\S]*Object\.freeze\(\{[\s\S]*signal: context\.signal,[\s\S]*theme: context\.theme,[\s\S]*tokens: context\.resolveTokens\(element\)/,
    )
    expect(runtime).toMatch(/code\.textContent = source/)
    expect(rendererProps).not.toMatch(
      /mermaidAdapter|latexAdapter|codeHighlightAdapter|MarkdownFeatureAdapter/,
    )
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
