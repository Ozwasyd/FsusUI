#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TextDecoder, TextEncoder } from 'node:util'
import {
  getMarkdownXssSource,
  getMarkdownXssSourceAttackFragment,
  loadMarkdownXssCorpus,
} from '../../../scripts/markdown-xss-corpus.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readCString(module, ptr, len) {
  if (ptr <= 0 || len <= 0) {
    return ''
  }

  const memory =
    module.memory ?? (module.HEAPU8 ? { buffer: module.HEAPU8.buffer } : null)
  if (!memory) {
    throw new Error('[markdown-wasm-runtime] module memory unavailable')
  }

  const view = new Uint8Array(memory.buffer, ptr, len)
  return new TextDecoder().decode(view)
}

function pickExport(raw, name) {
  const direct = raw[name]
  if (direct) {
    return direct
  }

  const underscored = raw[`_${name}`]
  if (underscored) {
    return underscored
  }

  throw new Error(`wasm_export_missing:${name}`)
}

function resolveMarkdownAsset(kind) {
  const fileBase = kind === 'simd' ? 'markdown_simd' : 'markdown_basic'
  const cwd = process.cwd().replace(/\\/g, '/').replace(/\/+$/, '')
  return {
    moduleUrl: pathToFileURL(`${cwd}/vue/packages/wasm/dist/${fileBase}.js`)
      .href,
    wasmUrl: pathToFileURL(`${cwd}/vue/packages/wasm/dist/${fileBase}.wasm`)
      .href,
  }
}

async function loadMarkdownModule(kind) {
  const asset = resolveMarkdownAsset(kind)
  const wasmBinary = readFileSync(fileURLToPath(asset.wasmUrl))
  const moduleRef = await import(asset.moduleUrl)
  const factory = moduleRef.default ?? moduleRef.createMarkdownModule
  assert(
    typeof factory === 'function',
    `[markdown-wasm-runtime] missing factory: ${kind}`,
  )
  // Emscripten modules compiled with mixed ESM/CJS output may still reference
  // __dirname during Node.js environment setup. Inject it temporarily so the
  // factory can initialise; the wasm binary is pre-loaded via wasmBinary so
  // no filesystem look-up occurs at load time.
  const savedDirname = globalThis.__dirname
  globalThis.__dirname = fileURLToPath(asset.moduleUrl).replace(/\/[^/]+$/, '')
  try {
    return await factory({ wasmBinary, print: () => {}, printErr: () => {} })
  } finally {
    if (savedDirname === undefined) {
      delete globalThis.__dirname
    } else {
      globalThis.__dirname = savedDirname
    }
  }
}

async function renderWithKind(kind) {
  const xssCorpus = await loadMarkdownXssCorpus()
  const module = await loadMarkdownModule(kind)
  const raw = module

  const render = pickExport(raw, 'markdown_render')
  const renderProfile = pickExport(raw, 'markdown_render_profile')
  const getHtmlPtr = pickExport(raw, 'markdown_get_last_html_ptr')
  const getHtmlLen = pickExport(raw, 'markdown_get_last_html_len')
  const getFeaturesPtr = pickExport(raw, 'markdown_get_last_features_ptr')
  const getFeaturesLen = pickExport(raw, 'markdown_get_last_features_len')
  const getPlaceholdersPtr = pickExport(
    raw,
    'markdown_get_last_placeholders_ptr',
  )
  const getPlaceholdersLen = pickExport(
    raw,
    'markdown_get_last_placeholders_len',
  )
  const getRendererVersionPtr = pickExport(
    raw,
    'markdown_get_last_renderer_version_ptr',
  )
  const getRendererVersionLen = pickExport(
    raw,
    'markdown_get_last_renderer_version_len',
  )
  const getMetadataPtr = pickExport(raw, 'markdown_get_last_metadata_ptr')
  const getMetadataLen = pickExport(raw, 'markdown_get_last_metadata_len')
  const alloc = pickExport(raw, 'markdown_alloc_buffer')
  const free = pickExport(raw, 'markdown_free_buffer')

  const source = [
    '# Markdown Wasm',
    '',
    'Paragraph with [link](https://example.com), `code`, **strong**, *emphasis*, ***combo***, inline math \\(x^2\\), and mermaid/latex placeholders.',
    '',
    getMarkdownXssSourceAttackFragment(xssCorpus, 'mxss-raw-script-basic'),
    '',
    getMarkdownXssSourceAttackFragment(xssCorpus, 'mxss-raw-img-onerror'),
    '',
    getMarkdownXssSourceAttackFragment(
      xssCorpus,
      'mxss-raw-details-ontoggle',
    ),
    '',
    getMarkdownXssSourceAttackFragment(
      xssCorpus,
      'mxss-namespace-svg-script',
    ),
    '',
    [
      'mxss-url-javascript-link',
      'mxss-url-vbscript-link',
      'mxss-url-protocol-relative',
      'mxss-url-data-html',
    ]
      .map((id) => getMarkdownXssSource(xssCorpus, id))
      .join(' '),
    'Reference [link][docs], collapsed [docs][], autolink <https://example.com/auto>, ~~removed~~, and ``code ` tick``.',
    '',
    'Setext Heading',
    '--------------',
    '',
    '- item one',
    '- [x] completed task',
    '- [ ] pending task',
    '- 属性验证适配器（`AttributeAdapterBase<TAttribute>` 执行层）不会被两端对齐拉开。',
    '- item two',
    '  - nested child',
    '',
    '    const indented = true;',
    '',
    '```mermaid',
    'flowchart LR;',
    'A[Start Node]-->B(Mid Step)-->C[Finish Node];',
    '```',
    '',
    '$$',
    '\\sum_{i=1}^{n} \\frac{1}{n}',
    '$$',
    '',
    'Footnote reference here.[^fn1] Another reference.[^fn2]',
    '',
    '[^fn1]: This is the first footnote.',
    '[^fn2]: This is the second footnote.',
    '[docs]: https://example.com/docs',
    '[asset]: /images/example.png',
    '![Reference image][asset]',
    '',
    '| 编号 | 语言         | 示例                          |  方向 | 备注              |',
    '',
    '| -: | :--------- | :-------------------------- | :-: | :-------------- |',
    '',
    '|  1 | 中文         | 这是中文                        | LTR | 无空格分词           |',
    '',
    '|  2 | 日本語        | これは日本語です                    | LTR | 汉字与假名混合         |',
    '',
    '::p',
    'Explicit paragraph group before a code sample:',
    '',
    '```rust',
    'pub enum AppError {',
    '    UserNotFound,',
    '}',
    '```',
    '',
    'This closing sentence belongs to the same paragraph group.',
    '::',
  ].join('\n')

  const bytes = new TextEncoder().encode(source)
  const ptr = alloc(bytes.byteLength)
  assert(ptr > 0, `[markdown-wasm-runtime] alloc failed: ${kind}`)

  try {
    module.HEAPU8.set(bytes, ptr)
    const oldAbiOk = render(ptr, bytes.byteLength, 0, 1, 1)
    assert(
      oldAbiOk === 0,
      `[markdown-wasm-runtime] legacy raw-html ABI unexpectedly accepted: ${kind}`,
    )
    const oldAbiError = readCString(
      module,
      pickExport(raw, 'markdown_get_last_error_ptr')(),
      pickExport(raw, 'markdown_get_last_error_len')(),
    )
    assert(
      oldAbiError === 'argument_count_invalid',
      `[markdown-wasm-runtime] legacy ABI did not fail explicitly: ${kind}`,
    )
    const oldProfileAbiOk = renderProfile(ptr, bytes.byteLength, 0, 1, 1, 0)
    assert(
      oldProfileAbiOk === 0,
      `[markdown-wasm-runtime] legacy profile ABI unexpectedly accepted: ${kind}`,
    )

    const ok = render(ptr, bytes.byteLength, 1, 1, 4)
    assert(ok === 1, `[markdown-wasm-runtime] render failed: ${kind}`)

    const html = readCString(module, getHtmlPtr(), getHtmlLen())
    const features = readCString(module, getFeaturesPtr(), getFeaturesLen())
    const placeholders = readCString(
      module,
      getPlaceholdersPtr(),
      getPlaceholdersLen(),
    )
    const rendererVersion = readCString(
      module,
      getRendererVersionPtr(),
      getRendererVersionLen(),
    )
    const metadata = readCString(module, getMetadataPtr(), getMetadataLen())

    assert(
      html.includes('<h1>Markdown Wasm</h1>'),
      `[markdown-wasm-runtime] missing heading: ${kind}`,
    )
    for (const rawProbe of [
      getMarkdownXssSourceAttackFragment(
        xssCorpus,
        'mxss-raw-script-basic',
      ),
      getMarkdownXssSourceAttackFragment(
        xssCorpus,
        'mxss-raw-img-onerror',
      ),
      getMarkdownXssSourceAttackFragment(
        xssCorpus,
        'mxss-raw-details-ontoggle',
      ),
      getMarkdownXssSourceAttackFragment(
        xssCorpus,
        'mxss-namespace-svg-script',
      ),
    ]) {
      const rawTagMatch = rawProbe.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/)
      assert(
        rawTagMatch,
        `[markdown-wasm-runtime] expected raw HTML opening tag (${rawProbe}): ${kind}`,
      )
      const escapedOpening = `&lt;${rawTagMatch[1]}`
      assert(
        !html.includes(rawProbe),
        `[markdown-wasm-runtime] raw HTML element reached output (${rawProbe}): ${kind}`,
      )
      assert(
        html.includes(escapedOpening),
        `[markdown-wasm-runtime] raw HTML was not rendered as text (${rawProbe}): ${kind}`,
      )
    }
    assert(
      html.includes('<a href="https://example.com"'),
      `[markdown-wasm-runtime] missing link: ${kind}`,
    )
    const unsafeUrlLinks = html.match(
      /<a href="#" rel="noopener noreferrer" target="_blank">blocked<\/a>/g,
    )
    assert(
      (unsafeUrlLinks?.length ?? 0) === 4,
      `[markdown-wasm-runtime] unsafe URL did not fail closed (${
        unsafeUrlLinks?.length ?? 0
      }/4): ${kind}`,
    )
    assert(
      html.includes('<code>code</code>'),
      `[markdown-wasm-runtime] missing inline code: ${kind}`,
    )
    assert(
      html.includes('<strong>strong</strong>'),
      `[markdown-wasm-runtime] missing strong emphasis: ${kind}`,
    )
    assert(
      html.includes('<em>emphasis</em>'),
      `[markdown-wasm-runtime] missing em emphasis: ${kind}`,
    )
    assert(
      html.includes('<strong><em>combo</em></strong>'),
      `[markdown-wasm-runtime] missing combined emphasis: ${kind}`,
    )
    assert(
      html.includes('<a href="https://example.com/docs"'),
      `[markdown-wasm-runtime] missing reference link: ${kind}`,
    )
    assert(
      html.includes('<a href="https://example.com/auto"'),
      `[markdown-wasm-runtime] missing autolink: ${kind}`,
    )
    assert(
      html.includes('<del>removed</del>'),
      `[markdown-wasm-runtime] missing strikethrough: ${kind}`,
    )
    assert(
      html.includes('<code>code ` tick</code>'),
      `[markdown-wasm-runtime] missing multi-backtick inline code: ${kind}`,
    )
    assert(
      html.includes('<h2>Setext Heading</h2>'),
      `[markdown-wasm-runtime] missing setext heading: ${kind}`,
    )
    assert(
      html.includes('<input type="checkbox" disabled checked />'),
      `[markdown-wasm-runtime] missing checked task list item: ${kind}`,
    )
    assert(
      html.includes('<input type="checkbox" disabled />'),
      `[markdown-wasm-runtime] missing unchecked task list item: ${kind}`,
    )
    assert(
      html.includes(
        '<ul><li class="markdown-renderer__list-item">nested child</li></ul>',
      ),
      `[markdown-wasm-runtime] missing nested list: ${kind}`,
    )
    assert(
      html.includes('const indented = true;'),
      `[markdown-wasm-runtime] missing indented code block: ${kind}`,
    )
    assert(
      html.includes(
        '<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="/images/example.png" alt="Reference image" />',
      ),
      `[markdown-wasm-runtime] missing reference image: ${kind}`,
    )
    assert(
      html.includes('markdown-renderer__mermaid'),
      `[markdown-wasm-runtime] missing mermaid host: ${kind}`,
    )
    assert(
      html.includes('data-mermaid-rendered="true"'),
      `[markdown-wasm-runtime] missing rendered mermaid marker: ${kind}`,
    )
    assert(
      html.includes('<svg class="mermaid"'),
      `[markdown-wasm-runtime] missing mermaid svg: ${kind}`,
    )
    assert(
      /data-mermaid-width="\d+"/.test(html) &&
        /data-mermaid-height="\d+"/.test(html),
      `[markdown-wasm-runtime] missing mermaid intrinsic size metadata: ${kind}`,
    )
    assert(
      /<svg class="mermaid"[^>]* width="\d+" height="\d+" preserveAspectRatio="xMidYMid meet"/.test(
        html,
      ),
      `[markdown-wasm-runtime] missing mermaid intrinsic svg size: ${kind}`,
    )
    assert(
      !html.includes('data-mermaid-placeholder="true"'),
      `[markdown-wasm-runtime] mermaid unexpectedly fell back to placeholder: ${kind}`,
    )
    assert(
      html.includes('markdown-renderer__latex'),
      `[markdown-wasm-runtime] missing latex host: ${kind}`,
    )
    assert(
      html.includes('data-latex-rendered="mathml"'),
      `[markdown-wasm-runtime] missing rendered latex marker: ${kind}`,
    )
    assert(
      html.includes('<math xmlns="http://www.w3.org/1998/Math/MathML"'),
      `[markdown-wasm-runtime] missing mathml output: ${kind}`,
    )
    assert(
      features.includes('mermaid') &&
        features.includes('latex') &&
        features.includes('emphasis'),
      `[markdown-wasm-runtime] missing feature metadata: ${kind}`,
    )
    assert(
      placeholders.includes('mermaid_block') &&
        placeholders.includes('latex_block'),
      `[markdown-wasm-runtime] missing placeholder metadata: ${kind}`,
    )
    assert(
      rendererVersion.length > 0,
      `[markdown-wasm-runtime] missing renderer version: ${kind}`,
    )
    assert(
      metadata.includes('"mode"'),
      `[markdown-wasm-runtime] missing metadata: ${kind}`,
    )
    assert(
      metadata.includes('"featureCount"'),
      `[markdown-wasm-runtime] missing metadata counts: ${kind}`,
    )
    assert(
      !metadata.includes(['allow', 'Html'].join('')),
      `[markdown-wasm-runtime] raw-html metadata leaked: ${kind}`,
    )
    assert(
      html.includes('<section class="footnotes"'),
      `[markdown-wasm-runtime] missing footnote section: ${kind}`,
    )
    assert(
      html.includes('id="fn-fn1"'),
      `[markdown-wasm-runtime] missing footnote anchor fn1: ${kind}`,
    )
    assert(
      html.includes('id="fn-fn2"'),
      `[markdown-wasm-runtime] missing footnote anchor fn2: ${kind}`,
    )
    assert(
      html.includes('class="footnote-ref"'),
      `[markdown-wasm-runtime] missing footnote reference superscript: ${kind}`,
    )
    assert(
      html.includes('class="footnote-backref"'),
      `[markdown-wasm-runtime] missing footnote back link: ${kind}`,
    )
    assert(
      html.includes('<table><thead>'),
      `[markdown-wasm-runtime] missing loose multilingual table: ${kind}`,
    )
    assert(
      html.includes('<th style="text-align:right">编号</th>'),
      `[markdown-wasm-runtime] missing right-aligned table header: ${kind}`,
    )
    assert(
      html.includes('<th style="text-align:center">方向</th>'),
      `[markdown-wasm-runtime] missing center-aligned table header: ${kind}`,
    )
    assert(
      html.includes('<td style="text-align:left">日本語</td>'),
      `[markdown-wasm-runtime] missing CJK table row: ${kind}`,
    )
    assert(
      html.includes(
        '<section class="markdown-renderer__paragraph" data-fsus-paragraph>',
      ),
      `[markdown-wasm-runtime] missing explicit paragraph group wrapper: ${kind}`,
    )
    assert(
      html.includes(
        'class="markdown-renderer__list-item markdown-renderer__list-item--inline-code"',
      ),
      `[markdown-wasm-runtime] missing inline-code list item class: ${kind}`,
    )
    assert(
      html.includes(
        'class="markdown-renderer__text markdown-renderer__text--inline-code"',
      ),
      `[markdown-wasm-runtime] missing inline-code paragraph class: ${kind}`,
    )
    assert(
      html.includes('pub enum AppError'),
      `[markdown-wasm-runtime] missing code inside explicit paragraph group: ${kind}`,
    )
    assert(
      html.includes(
        '<p class="markdown-renderer__text">This closing sentence belongs to the same paragraph group.</p>',
      ),
      `[markdown-wasm-runtime] missing paragraph after code inside explicit paragraph group: ${kind}`,
    )
    assert(
      !html.includes('::p'),
      `[markdown-wasm-runtime] leaked explicit paragraph marker: ${kind}`,
    )

    for (const payloadMode of [0, 1, 2, 3]) {
      const profileOk = renderProfile(
        ptr,
        bytes.byteLength,
        1,
        1,
        payloadMode,
        5,
      )
      assert(
        profileOk === 1,
        `[markdown-wasm-runtime] profile render failed mode=${payloadMode}: ${kind}`,
      )
      const profileHtml = readCString(module, getHtmlPtr(), getHtmlLen())
      assert(
        profileHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;') &&
          !profileHtml.includes('<script>'),
        `[markdown-wasm-runtime] raw HTML escaped contract failed mode=${payloadMode}: ${kind}`,
      )
    }
  } finally {
    free(ptr)
  }
}

async function main() {
  await renderWithKind('basic')
  await renderWithKind('simd')
  await renderNestedListWithKind('basic')
  await renderNestedListWithKind('simd')
  process.stdout.write('[markdown-wasm-runtime] ok basic+simd\n')
}

async function renderNestedListWithKind(kind) {
  const module = await loadMarkdownModule(kind)
  const raw = module

  const render = pickExport(raw, 'markdown_render')
  const getHtmlPtr = pickExport(raw, 'markdown_get_last_html_ptr')
  const getHtmlLen = pickExport(raw, 'markdown_get_last_html_len')
  const alloc = pickExport(raw, 'markdown_alloc_buffer')
  const free = pickExport(raw, 'markdown_free_buffer')

  function renderSource(source) {
    const bytes = new TextEncoder().encode(source)
    const ptr = alloc(bytes.byteLength)
    assert(ptr > 0, `[markdown-wasm-runtime] alloc failed: ${kind}`)
    try {
      module.HEAPU8.set(bytes, ptr)
      const ok = render(ptr, bytes.byteLength, 0, 0, 4)
      assert(ok === 1, `[markdown-wasm-runtime] render failed: ${kind}`)
      return readCString(module, getHtmlPtr(), getHtmlLen())
    } finally {
      free(ptr)
    }
  }

  // Compact nested list (no blank lines)
  const compact = [
    '* 第三层项目 B.2.a',
    '* 第三层项目 B.2.b',
    '  * 第四层项目 B.2.b.i',
    '  * 第四层项目 B.2.b.ii',
  ].join('\n')
  const compactHtml = renderSource(compact)
  assert(
    compactHtml.includes('第四层项目 B.2.b.i'),
    `[markdown-wasm-runtime] compact nested item i missing: ${kind}`,
  )
  assert(
    compactHtml.includes('第四层项目 B.2.b.ii'),
    `[markdown-wasm-runtime] compact nested item ii missing: ${kind}`,
  )

  // Loose nested list (blank line before sub-items — previously flushed list too early)
  const loose = [
    '* 第三层项目 B.2.a',
    '* 第三层项目 B.2.b',
    '',
    '  * 第四层项目 B.2.b.i',
    '  * 第四层项目 B.2.b.ii',
  ].join('\n')
  const looseHtml = renderSource(loose)
  assert(
    looseHtml.includes('第四层项目 B.2.b.i'),
    `[markdown-wasm-runtime] loose nested item i missing: ${kind}`,
  )
  assert(
    looseHtml.includes('第四层项目 B.2.b.ii'),
    `[markdown-wasm-runtime] loose nested item ii missing after blank line: ${kind}`,
  )

  // Deep nesting (4 levels, some items separated by blank lines)
  const deep = [
    '* A',
    '  * B.1',
    '  * B.2',
    '    * B.2.a',
    '    * B.2.b',
    '',
    '      * B.2.b.i',
    '      * B.2.b.ii',
  ].join('\n')
  const deepHtml = renderSource(deep)
  assert(
    deepHtml.includes('B.2.b.i'),
    `[markdown-wasm-runtime] deep 4th-level item i missing: ${kind}`,
  )
  assert(
    deepHtml.includes('B.2.b.ii'),
    `[markdown-wasm-runtime] deep 4th-level item ii missing: ${kind}`,
  )
}

main().catch((error) => {
  console.error(
    '[markdown-wasm-runtime] fatal:',
    error instanceof Error ? error.message : String(error),
  )
  process.exit(1)
})
