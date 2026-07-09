#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { performance } from 'node:perf_hooks'
import { TextDecoder, TextEncoder } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildMarkdownExtremeCorpus,
  describeMarkdownExtremeCorpus,
  normalizeMarkdownSource,
  normalizeMarkdownExtremeSize,
} from '../support/markdown-extreme-corpus.mjs'

const renderBudgetMs = Number(
  process.env.FSUSUI_MARKDOWN_EXTREME_RENDER_MS || '20000',
)
const targetSize = normalizeMarkdownExtremeSize(
  process.env.FSUSUI_MARKDOWN_EXTREME_SIZE,
)

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
    throw new Error('[markdown-extreme] module memory unavailable')
  }

  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len))
}

function readStructured(raw, fallback, label) {
  if (!raw) {
    return fallback
  }
  try {
    return parseStructuredText(raw)
  } catch (error) {
    throw new Error(
      `[markdown-extreme] invalid ${label} payload: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

function parseStructuredText(raw) {
  let offset = 0
  const source = raw.trim()
  const skipWhitespace = () => {
    while (/\s/u.test(source[offset] ?? '')) offset += 1
  }
  const parseValue = () => {
    skipWhitespace()
    const char = source[offset]
    if (char === '"') return parseString()
    if (char === '[') return parseArray()
    if (char === '{') return parseObject()
    if (source.startsWith('true', offset)) {
      offset += 4
      return true
    }
    if (source.startsWith('false', offset)) {
      offset += 5
      return false
    }
    if (source.startsWith('null', offset)) {
      offset += 4
      return null
    }
    return parseNumber()
  }
  const parseString = () => {
    offset += 1
    let value = ''
    while (offset < source.length) {
      const char = source[offset++]
      if (char === '"') return value
      if (char !== '\\') {
        value += char
        continue
      }
      const escaped = source[offset++]
      if (escaped === 'n') value += '\n'
      else if (escaped === 'r') value += '\r'
      else if (escaped === 't') value += '\t'
      else if (escaped === 'b') value += '\b'
      else if (escaped === 'f') value += '\f'
      else if (escaped === 'u') {
        value += String.fromCharCode(
          Number.parseInt(source.slice(offset, offset + 4), 16),
        )
        offset += 4
      } else {
        value += escaped
      }
    }
    throw new Error('structured_string_unclosed')
  }
  const parseArray = () => {
    offset += 1
    const values = []
    skipWhitespace()
    if (source[offset] === ']') {
      offset += 1
      return values
    }
    while (offset < source.length) {
      values.push(parseValue())
      skipWhitespace()
      if (source[offset] === ']') {
        offset += 1
        return values
      }
      if (source[offset++] !== ',')
        throw new Error('structured_array_separator_invalid')
    }
    throw new Error('structured_array_unclosed')
  }
  const parseObject = () => {
    offset += 1
    const value = {}
    skipWhitespace()
    if (source[offset] === '}') {
      offset += 1
      return value
    }
    while (offset < source.length) {
      const key = parseString()
      skipWhitespace()
      if (source[offset++] !== ':')
        throw new Error('structured_object_separator_invalid')
      value[key] = parseValue()
      skipWhitespace()
      if (source[offset] === '}') {
        offset += 1
        return value
      }
      if (source[offset++] !== ',')
        throw new Error('structured_object_entry_invalid')
      skipWhitespace()
    }
    throw new Error('structured_object_unclosed')
  }
  const parseNumber = () => {
    const start = offset
    while (/[-+0-9.eE]/u.test(source[offset] ?? '')) offset += 1
    const value = Number(source.slice(start, offset))
    if (!Number.isFinite(value)) throw new Error('structured_number_invalid')
    return value
  }
  const value = parseValue()
  skipWhitespace()
  if (offset !== source.length) throw new Error('structured_trailing_data')
  return value
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => deepEqual(item, right[index]))
    )
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && deepEqual(left[key], right[key]),
      )
    )
  }
  return false
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
    `[markdown-extreme] missing factory: ${kind}`,
  )
  const savedDirname = globalThis.__dirname
  globalThis.__dirname = fileURLToPath(asset.moduleUrl).replace(/\/[^/]+$/, '')
  try {
    return await factory({
      wasmBinary,
      print: () => {},
      printErr: () => {},
    })
  } finally {
    if (savedDirname === undefined) {
      delete globalThis.__dirname
    } else {
      globalThis.__dirname = savedDirname
    }
  }
}

async function renderSnapshot(module, kind, source, flags) {
  const raw = module
  const render = pickExport(raw, 'markdown_render')
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
  const getMetadataPtr = pickExport(raw, 'markdown_get_last_metadata_ptr')
  const getMetadataLen = pickExport(raw, 'markdown_get_last_metadata_len')
  const alloc = pickExport(raw, 'markdown_alloc_buffer')
  const free = pickExport(raw, 'markdown_free_buffer')
  const normalized = normalizeMarkdownSource(source)
  const bytes = new TextEncoder().encode(normalized)
  const ptr = alloc(bytes.byteLength)
  assert(ptr > 0, `[markdown-extreme] alloc failed: ${kind}`)

  const startedAt = performance.now()
  try {
    module.HEAPU8.set(bytes, ptr)
    const ok = render(
      ptr,
      bytes.byteLength,
      0,
      flags.allowLatex ? 1 : 0,
      flags.allowMermaid ? 1 : 0,
    )
    const elapsedMs = performance.now() - startedAt
    assert(ok === 1, `[markdown-extreme] render failed: ${kind}/${flags.label}`)
    assert(
      elapsedMs <= renderBudgetMs,
      `[markdown-extreme] ${kind}/${flags.label} exceeded budget ${elapsedMs.toFixed(1)}ms > ${renderBudgetMs}ms`,
    )

    const html = readCString(module, getHtmlPtr(), getHtmlLen())
    const features = readStructured(
      readCString(module, getFeaturesPtr(), getFeaturesLen()),
      [],
      'features',
    )
    const placeholders = readStructured(
      readCString(module, getPlaceholdersPtr(), getPlaceholdersLen()),
      [],
      'placeholders',
    )
    const metadata = readStructured(
      readCString(module, getMetadataPtr(), getMetadataLen()),
      {},
      'metadata',
    )
    return { html, features, placeholders, metadata, elapsedMs }
  } finally {
    free(ptr)
  }
}

function assertSanitized(html, kind, label) {
  assert(
    !html.includes('<script>alert'),
    `[markdown-extreme] unsafe script leaked: ${kind}/${label}`,
  )
  assert(
    !html.includes('<img src=x onerror='),
    `[markdown-extreme] unsafe img leaked: ${kind}/${label}`,
  )
  assert(
    !html.includes('<iframe src="javascript:'),
    `[markdown-extreme] unsafe iframe leaked: ${kind}/${label}`,
  )
  assert(
    html.includes('&lt;script&gt;') || html.includes('&lt;iframe'),
    `[markdown-extreme] dangerous html probes should be escaped: ${kind}/${label}`,
  )
}

function assertSnapshot(snapshot, source, kind, flags) {
  const normalized = normalizeMarkdownSource(source)
  const byteLength = Buffer.byteLength(normalized, 'utf8')
  assert(
    snapshot.metadata.sourceLength === byteLength,
    `[markdown-extreme] sourceLength drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.normalizedSourceLength === byteLength,
    `[markdown-extreme] normalizedSourceLength drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.sourceLineCount === normalized.split('\n').length,
    `[markdown-extreme] lineCount drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.allowLatex === flags.allowLatex,
    `[markdown-extreme] allowLatex drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.allowMermaid === flags.allowMermaid,
    `[markdown-extreme] allowMermaid drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.featureCount === snapshot.features.length,
    `[markdown-extreme] featureCount drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.metadata.placeholderCount === snapshot.placeholders.length,
    `[markdown-extreme] placeholderCount drift: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.features.includes('heading'),
    `[markdown-extreme] heading feature missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.features.includes('latex'),
    `[markdown-extreme] latex feature missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.features.includes('mermaid'),
    `[markdown-extreme] mermaid feature missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.features.includes('table'),
    `[markdown-extreme] table feature missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.features.includes('link'),
    `[markdown-extreme] link feature missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.placeholders.some((item) => item.kind === 'latex_inline'),
    `[markdown-extreme] inline latex placeholder missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.placeholders.some((item) => item.kind === 'latex_block'),
    `[markdown-extreme] block latex placeholder missing: ${kind}/${flags.label}`,
  )
  assert(
    snapshot.placeholders.some((item) => item.kind === 'mermaid_block'),
    `[markdown-extreme] mermaid placeholder missing: ${kind}/${flags.label}`,
  )
  assertSanitized(snapshot.html, kind, flags.label)

  if (flags.allowLatex) {
    assert(
      snapshot.html.includes('data-latex-rendered="mathml"'),
      `[markdown-extreme] rendered latex missing: ${kind}/${flags.label}`,
    )
  } else {
    assert(
      !snapshot.html.includes('data-latex-rendered="mathml"'),
      `[markdown-extreme] disabled latex rendered unexpectedly: ${kind}/${flags.label}`,
    )
  }

  if (flags.allowMermaid) {
    assert(
      snapshot.html.includes('data-mermaid-rendered="true"') ||
        snapshot.html.includes('data-mermaid-placeholder="true"'),
      `[markdown-extreme] mermaid output missing: ${kind}/${flags.label}`,
    )
  } else {
    assert(
      !snapshot.html.includes('data-mermaid-rendered="true"'),
      `[markdown-extreme] disabled mermaid rendered unexpectedly: ${kind}/${flags.label}`,
    )
  }
}

async function assertKind(kind, source) {
  const module = await loadMarkdownModule(kind)
  const enabled = await renderSnapshot(module, kind, source, {
    label: 'enabled',
    allowLatex: true,
    allowMermaid: true,
  })
  const disabled = await renderSnapshot(module, kind, source, {
    label: 'disabled',
    allowLatex: false,
    allowMermaid: false,
  })

  assertSnapshot(enabled, source, kind, {
    label: 'enabled',
    allowLatex: true,
    allowMermaid: true,
  })
  assertSnapshot(disabled, source, kind, {
    label: 'disabled',
    allowLatex: false,
    allowMermaid: false,
  })
  assert(
    deepEqual(enabled.features, disabled.features),
    `[markdown-extreme] feature detection should not depend on enabled flags: ${kind}`,
  )
  assert(
    enabled.placeholders.length === disabled.placeholders.length,
    `[markdown-extreme] placeholder count should not depend on enabled flags: ${kind}`,
  )
  process.stdout.write(
    `[markdown-extreme] ok ${kind} | enabled=${enabled.elapsedMs.toFixed(1)}ms disabled=${disabled.elapsedMs.toFixed(1)}ms`,
  )
  process.stdout.write('\n')
}

async function main() {
  const source = buildMarkdownExtremeCorpus(targetSize)
  const stats = describeMarkdownExtremeCorpus(source)
  assert(
    stats.length >= targetSize,
    `[markdown-extreme] generated corpus too small: ${stats.length}`,
  )
  assert(
    stats.hasMermaid && stats.hasLatex && stats.hasDangerousHtmlProbe,
    '[markdown-extreme] corpus missing required probes',
  )

  await assertKind('basic', source)
  await assertKind('simd', source)
  process.stdout.write(
    `[markdown-extreme] ok | chars=${stats.length} bytes=${stats.byteLength} lines=${stats.lineCount} hash=${stats.hash}`,
  )
  process.stdout.write('\n')
}

main().catch((error) => {
  console.error(
    '[markdown-extreme] fatal:',
    error instanceof Error ? error.message : String(error),
  )
  process.exit(1)
})
