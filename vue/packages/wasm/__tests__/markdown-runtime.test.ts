// @vitest-environment jsdom

import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'

const markdownSource = [
  '# Runtime Profile',
  '',
  'Paragraph with **strong** text and inline math \\(a^2+b^2\\).',
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
const runtimeEntryUrl = pathToFileURL(resolve(packageDir, 'dist/index.mjs')).href

interface RuntimeProbeResult {
  engine: string
  htmlOnly: RuntimeHtmlResult | null
  summary: RuntimeSummaryResult | null
  helper: string | null
  full: RuntimeFullResult | null
  chunks: RuntimeChunkResult | null
}

interface RuntimeTimings {
  totalMs: number
  readPlaceholdersMs: number
}

interface RuntimeHtmlResult {
  html: string
  rendererVersion: string
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
  beforeAll(async () => {
    const source = JSON.stringify(markdownSource)
    const entry = JSON.stringify(runtimeEntryUrl)
    const script = `
      const wasm = await import(${entry});
      const source = ${source};
      const request = {
        source,
        allowHtml: false,
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
      process.stdout.write(JSON.stringify({ engine, htmlOnly, summary, helper, full, chunks }));
    `
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--input-type=module', '-e', script],
      { cwd: packageDir, maxBuffer: 1024 * 1024 * 4 }
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

  it('keeps the string helper compatible while using the html-only path', async () => {
    const html = probeResult.helper

    expect(html).toContain('Runtime Profile')
    expect(html).toContain('data-fsus-paragraph')
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
})
