/* global Response */
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { URL } from 'node:url'

const root = process.cwd()
const wasmBinaryPath = resolve(root, 'vue/packages/wasm/dist/ep_wasm.wasm')
const originalFetch = globalThis.fetch

const getRequestUrl = (input) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

const measure = async (label, fn) => {
  const startedAt = performance.now()
  const value = await fn()
  return {
    label,
    ms: performance.now() - startedAt,
    value,
  }
}

const unwrapResult = (label, result) => {
  if (result?.ok === true) {
    return result.value
  }

  throw new Error(
    `${label} failed: ${result?.error?.message ?? JSON.stringify(result)}`,
  )
}

const assertArrayEqual = (label, actual, expected) => {
  if (actual.length !== expected.length) {
    throw new Error(
      `${label} length mismatch: expected ${expected.length}, got ${actual.length}`,
    )
  }

  for (let index = 0; index < actual.length; index++) {
    if (actual[index] !== expected[index]) {
      throw new Error(
        `${label} mismatch at ${index}: expected ${expected[index]}, got ${actual[index]}`,
      )
    }
  }
}

const formatMs = (value) => `${value.toFixed(2)}ms`

const wasmBinary = await readFile(wasmBinaryPath)
globalThis.fetch = async (input, init) => {
  const requestUrl = getRequestUrl(input)

  if (requestUrl.endsWith('/ep_wasm.wasm')) {
    return new Response(wasmBinary, {
      status: 200,
      headers: {
        'Content-Type': 'application/wasm',
      },
    })
  }

  if (!originalFetch) {
    throw new Error(`Unhandled fetch in wasm performance smoke: ${requestUrl}`)
  }

  return originalFetch(input, init)
}

try {
  const wasm = await import('../vue/packages/wasm/dist/index.mjs')
  unwrapResult('ensureWasmReady', await wasm.ensureWasmReady())

  const numericData = Array.from(
    { length: 100_000 },
    (_, index) => ((index * 48_271) % 104_729) + (index % 7) / 10,
  )
  const jsNumberSort = await measure('js number sort', () =>
    [...numericData].sort((a, b) => a - b),
  )
  const wasmNumberSort = await measure('wasm number sort', () =>
    wasm.sortNumbers(numericData, true).then((result) =>
      unwrapResult('sortNumbers', result),
    ),
  )
  assertArrayEqual('number sort', wasmNumberSort.value, jsNumberSort.value)

  const filterData = Array.from({ length: 50_000 }, (_, index) =>
    index % 4_097 === 0 ? `needle option ${index}` : `option ${index}`,
  )
  const filterKeyword = 'needle'
  const asciiFilterIndex = wasm.createAsciiFilterIndex(filterData)
  const jsFilter = await measure('js string filter', () => {
    const matched = []
    for (let index = 0; index < filterData.length; index++) {
      if (filterData[index].toLowerCase().includes(filterKeyword)) {
        matched.push(index)
      }
    }
    return matched
  })
  const wasmFilter = await measure('wasm ascii filter', () =>
    wasm.filterAsciiIndices(asciiFilterIndex, filterKeyword, false).then(
      (result) => unwrapResult('filterAsciiIndices', result),
    ),
  )
  assertArrayEqual('string filter', wasmFilter.value, jsFilter.value)

  const textLengths = Array.from(
    { length: 100_000 },
    (_, index) => 4 + ((index * 17) % 160),
  )
  const rowWidth = 320
  const charWidth = 14
  const lineHeight = 22
  const padding = 16
  const jsHeights = await measure('js row heights', () => {
    const charsPerLine = Math.max(1, Math.floor(rowWidth / charWidth))
    return textLengths.map(
      (length) => Math.ceil(length / charsPerLine) * lineHeight + padding,
    )
  })
  const wasmHeights = await measure('wasm row heights', () =>
    wasm.estimateRowHeights(
      textLengths,
      rowWidth,
      charWidth,
      lineHeight,
      padding,
    ).then((result) =>
      unwrapResult('estimateRowHeights', result),
    ),
  )
  assertArrayEqual('row heights', wasmHeights.value, jsHeights.value)

  const rows = [
    ['case', 'js', 'wasm'],
    ['number sort', formatMs(jsNumberSort.ms), formatMs(wasmNumberSort.ms)],
    ['ascii filter', formatMs(jsFilter.ms), formatMs(wasmFilter.ms)],
    ['row heights', formatMs(jsHeights.ms), formatMs(wasmHeights.ms)],
  ]

  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length)),
  )
  for (const row of rows) {
    console.info(
      row
        .map((cell, columnIndex) => cell.padEnd(widths[columnIndex]))
        .join('  '),
    )
  }
} finally {
  globalThis.fetch = originalFetch
}
