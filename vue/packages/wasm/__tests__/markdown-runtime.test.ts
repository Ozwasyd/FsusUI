// @vitest-environment jsdom

import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { reactive, toRaw } from 'vue'
import type {
  MarkdownRenderRequest,
  MarkdownSafeHtml,
  MarkdownSafeRenderResult,
} from '../markdown'
import {
  isMarkdownRuntimeAuthorizedResult,
  renderMarkdownFallbackWithRuntime,
} from '../markdown-runtime'
import {
  getMarkdownXssSource,
  getMarkdownXssSourceAttackFragment,
} from '../../../tests/support/markdown-xss-corpus'

const markdownSource = [
  '# Runtime Profile',
  '',
  'Paragraph with **strong** text and inline math \\(a^2+b^2\\).',
  '',
  getMarkdownXssSourceAttackFragment('mxss-raw-script-basic'),
  '',
  getMarkdownXssSourceAttackFragment('mxss-raw-img-onerror'),
  '',
  getMarkdownXssSourceAttackFragment('mxss-raw-details-ontoggle'),
  '',
  getMarkdownXssSourceAttackFragment('mxss-namespace-svg-script'),
  '',
  [
    'mxss-url-javascript-link',
    'mxss-url-vbscript-link',
    'mxss-url-protocol-relative',
    'mxss-url-data-html',
  ]
    .map(getMarkdownXssSource)
    .join(' '),
  '',
  '```mermaid',
  'flowchart LR;',
  'A --> B;',
  '```',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '```ts',
  'console.log("chunk");',
  '```',
  '',
  '- 属性验证适配器（`AttributeAdapterBase<TAttribute>` 执行层）不会被两端对齐拉开。',
  '',
  '::p',
  'Then `Err(E)` keeps the enum type close to the code sample:',
  '',
  '```rust',
  'pub enum AppError {',
  '  UserNotFound,',
  '}',
  '```',
  '',
  'The following sentence is still part of the same explicit paragraph group.',
  '::',
].join('\n')

const execFileAsync = promisify(execFile)
const testDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testDir, '..')
const runtimeEntryUrl = pathToFileURL(
  resolve(packageDir, 'dist/index.mjs'),
).href

interface RuntimeProbeResult {
  authority: {
    cloned: boolean
    deeplyImmutable: boolean
    runtime: boolean
  }
  engine: string
  htmlOnly: RuntimeHtmlResult | null
  summary: RuntimeSummaryResult | null
  helper: string | null
  full: RuntimeFullResult | null
  chunks: RuntimeChunkResult | null
  modes: Record<string, RuntimeFullResult | null>
}

interface RuntimeTimings {
  totalMs: number
  readPlaceholdersMs: number
}

interface RuntimeHtmlResult {
  html: string
  normalizedSource: string
  rendererVersion: string
  sourceIdentity: string
  timings: RuntimeTimings
}

interface RuntimeSummaryResult extends RuntimeHtmlResult {
  features: string[]
  metadata: {
    placeholderCount: number
  }
}

interface RuntimeFullResult extends RuntimeSummaryResult {
  placeholders: unknown[]
}

interface RuntimeChunkResult extends RuntimeFullResult {
  chunks: Array<{
    estimatedSize: number
    html: string
    kind: string
    key: string
  }>
}

let probeResult: RuntimeProbeResult

describe('markdown runtime fast paths', () => {
  it('deep-seals authorized results and rejects copied result shapes', () => {
    const result = renderMarkdownFallbackWithRuntime(
      '# Current\n\n```mermaid\nflowchart LR\n```',
    )
    const proxy = reactive(result)
    const originalHtml = result.html

    expect(Reflect.set(result, 'html', '<svg onload=alert(1)>')).toBe(false)
    expect(Reflect.set(proxy, 'html', '<svg onload=alert(1)>')).toBe(false)
    expect(toRaw(proxy)).toBe(result)
    expect(
      result.placeholders[0]
        ? Reflect.set(result.placeholders[0], 'label', 'mutated')
        : true,
    ).toBe(false)
    expect(result.html).toBe(originalHtml)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.features)).toBe(true)
    expect(Object.isFrozen(result.placeholders)).toBe(true)
    expect(isMarkdownRuntimeAuthorizedResult(result)).toBe(true)
    expect(isMarkdownRuntimeAuthorizedResult({ ...result })).toBe(false)
    expect(isMarkdownRuntimeAuthorizedResult(structuredClone(result))).toBe(
      false,
    )
  })

  it('does not expose the removed raw HTML request field', () => {
    const removedCapability = `allow${'Html'}` as const
    expectTypeOf<MarkdownRenderRequest>().not.toHaveProperty(removedCapability)
    expectTypeOf<string>().not.toMatchTypeOf<MarkdownSafeHtml>()
    expectTypeOf<{
      html: string
    }>().not.toMatchTypeOf<MarkdownSafeRenderResult>()
  })

  beforeAll(async () => {
    const source = JSON.stringify(markdownSource)
    const entry = JSON.stringify(runtimeEntryUrl)
    const script = `
      const wasm = await import(${entry});
      const source = ${source};
      const request = {
        source,
        allowLatex: true,
        allowMermaid: true,
      };
      const unwrap = (result) => {
        if (!result || typeof result !== 'object' || !('ok' in result)) return result;
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      };
      const engine = unwrap(await wasm.initMarkdownRuntime());
      const htmlOnly = unwrap(await wasm.renderMarkdownHtmlWithRuntime(request));
      const summary = unwrap(await wasm.renderMarkdownSummaryWithRuntime(request));
      const helper = unwrap(await wasm.renderMarkdownWithRuntime(request));
      const full = unwrap(await wasm.renderMarkdownResultWithRuntime(request));
      const chunks = unwrap(await wasm.renderMarkdownChunksWithRuntime(request));
      const authority = {
        runtime: wasm.isMarkdownRuntimeAuthorizedResult(full),
        cloned: wasm.isMarkdownRuntimeAuthorizedResult(structuredClone(full)),
        deeplyImmutable: [
          full, full.features, full.placeholders, ...full.placeholders,
          full.metadata, full.timings, chunks, chunks.chunks, ...chunks.chunks,
        ].every((value) => value == null || Object.isFrozen(value)) &&
          Reflect.set(full.metadata, 'placeholderCount', 999) === false &&
          Reflect.set(chunks.chunks[0], 'html', '<svg onload=alert(1)>') === false,
      };
      const modes = {};
      for (const mode of ['article', 'about', 'preview', 'editor']) {
        modes[mode] = unwrap(await wasm.renderMarkdownResultWithRuntime({ ...request, mode }));
      }
      process.stdout.write(JSON.stringify({ authority, engine, htmlOnly, summary, helper, full, chunks, modes }));
    `
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '-e', script],
      { cwd: packageDir, maxBuffer: 1024 * 1024 * 4 },
    )
    probeResult = JSON.parse(stdout) as RuntimeProbeResult
  })

  it('renders html-only without materializing placeholder payloads', async () => {
    const result = probeResult.htmlOnly

    expect(result).not.toBeNull()
    expect(result?.html).toContain('Runtime Profile')
    expect(result?.html).toContain(
      'class="markdown-renderer__list-item markdown-renderer__list-item--inline-code"',
    )
    expect(result?.html).toContain('data-fsus-paragraph')
    expect(result?.html).toContain(
      'class="markdown-renderer__text markdown-renderer__text--inline-code"',
    )
    expect(result?.html).toMatch(/data-mermaid-width="\d+"/)
    expect(result?.html).toMatch(/data-mermaid-height="\d+"/)
    expect(result?.html).toMatch(
      /<svg class="mermaid"[^>]* width="\d+" height="\d+" preserveAspectRatio="xMidYMid meet"/,
    )
    expect(result?.html).toContain('pub enum AppError')
    expect(result?.html).not.toContain('::p')
    expect(result?.rendererVersion).toContain('markdown-wasm-contract')
    expect(result?.sourceIdentity).toMatch(/^markdown:/)
    expect(result?.timings.totalMs).toBeGreaterThanOrEqual(0)
    expect(result?.timings.readPlaceholdersMs).toBe(0)
    expect(Object.hasOwn(result ?? {}, 'placeholders')).toBe(false)
  })

  it('renders summaries with counts but without full placeholder source arrays', async () => {
    const result = probeResult.summary

    expect(result).not.toBeNull()
    expect(result?.html).toContain('class="markdown-renderer__paragraph"')
    expect(result?.features).toContain('heading')
    expect(result?.features).toContain('mermaid')
    expect(result?.metadata.placeholderCount).toBeGreaterThan(0)
    expect(result?.timings.readPlaceholdersMs).toBe(0)
    expect(Object.hasOwn(result ?? {}, 'placeholders')).toBe(false)
  })

  it('keeps the branded helper compatible while using the html-only path', async () => {
    const html = probeResult.helper

    expect(html).toContain('Runtime Profile')
    expect(html).toContain('data-fsus-paragraph')
  })

  it('keeps every runtime payload on one immutable authority family', () => {
    expect(probeResult.authority).toEqual({
      runtime: true,
      cloned: false,
      deeplyImmutable: true,
    })
    expect(probeResult.summary?.sourceIdentity).toBe(
      probeResult.htmlOnly?.sourceIdentity,
    )
    expect(probeResult.full?.sourceIdentity).toBe(
      probeResult.htmlOnly?.sourceIdentity,
    )
    expect(probeResult.chunks?.sourceIdentity).toBe(
      probeResult.htmlOnly?.sourceIdentity,
    )
  })

  it('fails closed while generating unsafe URL attributes', () => {
    const html = probeResult.full?.html ?? ''
    expect(
      html.match(
        /<a href="#" rel="noopener noreferrer" target="_blank">blocked<\/a>/gu,
      ),
    ).toHaveLength(4)
  })

  it('keeps the full result path available with placeholder details and timings', async () => {
    const result = probeResult.full

    expect(result).not.toBeNull()
    expect(result?.html).toContain('data-fsus-paragraph')
    expect(result?.placeholders.length).toBeGreaterThan(0)
    expect(result?.metadata?.placeholderCount).toBe(result?.placeholders.length)
    expect(result?.timings.readPlaceholdersMs).toBeGreaterThanOrEqual(0)
  })

  it('returns block chunks without changing the rendered html contract', async () => {
    const result = probeResult.chunks

    expect(result).not.toBeNull()
    expect(result?.html).toBe(probeResult.full?.html)
    expect(result?.chunks.length).toBeGreaterThan(4)
    expect(result?.chunks[0]?.kind).toBe('heading')
    expect(result?.chunks.some((chunk) => chunk.kind === 'paragraph')).toBe(
      true,
    )
    expect(result?.chunks.some((chunk) => chunk.kind === 'code')).toBe(true)
    expect(result?.chunks.every((chunk) => chunk.estimatedSize > 0)).toBe(true)
    expect(result?.chunks.map((chunk) => chunk.html).join('')).toBe(
      result?.html,
    )
  })

  it('renders raw HTML as text in every public mode and payload path', () => {
    const results = [
      probeResult.htmlOnly,
      probeResult.summary,
      probeResult.full,
      probeResult.chunks,
      ...Object.values(probeResult.modes),
    ]
    for (const result of results) {
      const template = document.createElement('template')
      template.innerHTML = result?.html ?? ''
      expect(template.content.querySelector('script,img')).toBeNull()
      expect(template.content.textContent).toContain('<script>globalThis.')
      expect(template.content.textContent).toContain('</script>')
      expect(template.content.textContent).toContain('<img src=x onerror=')
      expect(result?.html).toContain(
        '&lt;details open ontoggle=alert(3)&gt;unsafe&lt;/details&gt;',
      )
      expect(result?.html).toContain(
        '&lt;svg&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;/svg&gt;',
      )
      expect(result?.html).not.toContain('<script>')
      expect(result?.html).not.toContain('<img src=x')
      expect(result?.html).not.toContain('<details open')
      expect(result?.html).not.toContain('<svg>')
    }
  })
})
