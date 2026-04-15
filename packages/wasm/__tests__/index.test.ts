// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  clampAndRound,
  estimateRowHeights,
  filterIndices,
  filterIndicesSync,
  hexToHsl,
  hslToHex,
  roundToPrecision,
  sortNumbers,
  sortNumbersSync,
  sortStrings,
  sortStringsSync,
  warmupWasm,
  wasmVersion,
} from '../index'

const wasmBinaryPath = resolve(process.cwd(), 'packages/wasm/dist/ep_wasm.wasm')
const originalFetch = globalThis.fetch

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

describe('@element-plus/wasm', () => {
  beforeAll(async () => {
    const wasmBinary = await readFile(wasmBinaryPath)

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
        throw new Error(`Unhandled fetch in wasm test: ${requestUrl}`)
      }

      return originalFetch(input, init)
    }) as typeof fetch

    warmupWasm()
    await wasmVersion()
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('sorts number arrays through the buffer helper and enables sync reuse after warmup', async () => {
    await expect(sortNumbers([3, 1, 3, -1], true)).resolves.toEqual([
      -1, 1, 3, 3,
    ])
    expect(sortNumbersSync([3, 1, 3, -1], false)).toEqual([3, 3, 1, -1])
  })

  it('keeps string sort results stable while ignoring locale compatibility parameter', async () => {
    const baseline = await sortStrings(['beta', 'alpha', 'gamma'], true, 'zh-CN')
    const otherLocale = await sortStrings(['beta', 'alpha', 'gamma'], true, 'en-US')

    expect(baseline).toEqual(['alpha', 'beta', 'gamma'])
    expect(otherLocale).toEqual(baseline)
    expect(sortStringsSync(['beta', 'alpha', 'gamma'], false, 'en-US')).toEqual([
      'gamma',
      'beta',
      'alpha',
    ])
  })

  it('filters strings correctly for both case-sensitive and case-insensitive paths', async () => {
    const data = ['Alpha', 'beta', 'ALPINE', 'gamma']

    await expect(filterIndices(data, 'alp', false)).resolves.toEqual([0, 2])
    expect(filterIndicesSync(data, 'Al', true)).toEqual([0])
  })

  it('estimates row heights with the same formula after the buffer-based rewrite', async () => {
    await expect(
      estimateRowHeights([0, 3, 4], 20, 10, 5, 2),
    ).resolves.toEqual([2, 12, 12])
  })

  it('keeps cold-path color conversion and numeric helpers compatible', async () => {
    await expect(hexToHsl('#FF0000')).resolves.toBe('hsl(0.0,100.0%,50.0%)')
    await expect(hexToHsl('bad')).resolves.toBe('')
    await expect(hexToHsl('#GGGGGG')).rejects.toBeTruthy()
    await expect(hslToHex(120, 100, 50)).resolves.toBe('#00FF00')
    await expect(roundToPrecision(1.005, 2)).resolves.toBe(1)
    await expect(clampAndRound(5.678, 0, 5, 1)).resolves.toBe(5)
  })
})
