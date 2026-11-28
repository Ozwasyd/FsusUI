import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import fg from 'fast-glob'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const sourcePatterns = [
  'vue/packages/components/src/**/*.{ts,tsx,vue}',
  'vue/packages/markdown/src/**/*.{ts,tsx,vue}',
]
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
  'vue/packages/markdown/src/markdown-editor/src/markdown-editor-latex.ts': {
    contract: 'mutation fixtures reject consumer innerHTML; no DOM HTML write',
    evidence: [/latex output must not accept consumer innerHTML or DOM/],
  },
  'vue/packages/markdown/src/markdown-editor/src/markdown-editor-mermaid.ts': {
    contract: 'mutation fixtures reject consumer innerHTML; no DOM HTML write',
    evidence: [/mermaid output must not accept consumer innerHTML or SVG/],
  },
  'vue/packages/markdown/src/markdown-renderer/src/markdown-renderer.vue': {
    contract: 'only branded runtime HTML or host TrustedHTML reaches v-html',
    evidence: [
      /v-html="resolveCommittedHtml\(item\.unit\.html\)"/,
      /v-html="resolveCommittedHtml\(renderedContent\)"/,
      /html: MarkdownSafeHtml/,
      /props\.trustedHtmlFactory\?\.\(html\)/,
    ],
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

  it('keeps Markdown HTML construction inside its branded runtime boundary', () => {
    const markdownTypes = read('vue/packages/wasm/markdown.ts')
    const markdownRuntime = read('vue/packages/wasm/markdown-runtime.ts')
    const markdownResultAuthority = read(
      'vue/packages/wasm/runtime/markdown-result-authority.ts',
    )
    const wasmIndex = read('vue/packages/wasm/index.ts')
    const publicMarkdown = read('vue/packages/fsusui/src/markdown.ts')
    const rendererProps = read(
      'vue/packages/markdown/src/markdown-renderer/src/markdown-renderer.ts',
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
          'vue/packages/markdown/src/markdown-renderer/src/markdown-renderer-cache.ts',
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
    expect(markdownResultAuthority).toMatch(
      /const authorizeMarkdownRuntimeResult/,
    )
    expect(markdownResultAuthority).toMatch(
      /const markdownRuntimeAuthority = new WeakSet<object>\(\)/,
    )
    for (const surface of [markdownRuntime, wasmIndex, publicMarkdown]) {
      expect(surface).not.toMatch(
        /export\s+(?:const|function)\s+(?:authorize|brand)Markdown|authorizeMarkdownRuntimeResult/,
      )
    }
    expect(rendererProps).toMatch(
      /MarkdownTrustedHtmlFactory = \(\s*safeHtml: MarkdownSafeHtml/,
    )
    expect(rendererProps).not.toMatch(removedRendererProps)
  })

  it('keeps third-party Markdown feature HTML inside the single owned gateway', async () => {
    const featureSources = await fg(
      [
        'vue/packages/wasm/markdown*.ts',
        'vue/packages/wasm/runtime/*.ts',
        'vue/packages/markdown/src/markdown-renderer/src/*.{ts,vue}',
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
    const featureActivation = read(
      'vue/packages/wasm/runtime/markdown-feature-activation.ts',
    )
    const wasmIndex = read('vue/packages/wasm/index.ts')
    const publicMarkdown = read('vue/packages/fsusui/src/markdown.ts')
    const rendererProps = read(
      'vue/packages/markdown/src/markdown-renderer/src/markdown-renderer.ts',
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
    expect(publicMarkdown).not.toMatch(/commitMarkdownFeatureOutput/)
    expect(runtime).not.toMatch(/markdown-feature-output-gateway/)

    const activationSource = ts.createSourceFile(
      'markdown-feature-activation.ts',
      featureActivation,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const staticGatewayImports = activationSource.statements.filter(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '../markdown-feature-output-gateway',
    )
    expect(staticGatewayImports).toHaveLength(1)
    expect(staticGatewayImports[0]?.importClause?.isTypeOnly).toBe(true)

    const literalGatewayImports = Array.from(
      featureActivation.matchAll(
        /\bimport\(\s*(['"])\.\.\/markdown-feature-output-gateway\1\s*\)/gu,
      ),
    )
    expect(literalGatewayImports).toHaveLength(1)
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
