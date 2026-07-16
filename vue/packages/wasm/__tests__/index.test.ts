// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fsusOk } from '@element-plus/utils'

import {
  clampAndRound,
  createAsciiFilterIndex,
  createWasmDataSession,
  ensureWasmReady,
  estimateRowHeights,
  filterAsciiIndices,
  filterAsciiIndicesSync,
  filterIndices,
  filterIndicesSync,
  getWasmReadiness,
  hexToHsl,
  hslToHex,
  isWasmReady,
  roundToPrecision,
  sortNumbers,
  sortNumbersSync,
  sortAsciiIndices,
  sortNumberIndices,
  sortStrings,
  sortStringsSync,
  warmupWasm,
  wasmVersion,
} from '../index'

const wasmBinaryPath = resolve(
  process.cwd(),
  'vue/packages/wasm/dist/ep_wasm.wasm',
)
const originalFetch = globalThis.fetch

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

describe('@element-plus/wasm', () => {
  beforeAll(async () => {
    const wasmBinary = await readFile(wasmBinaryPath)

    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
      },
    ) as typeof fetch

    warmupWasm()
    const version = await wasmVersion()
    if (version.ok === false) {
      throw new Error(
        `Expected WASM version probe to initialize: ${JSON.stringify(
          version.error,
        )}`,
      )
    }
    expect(version.ok).toBe(true)
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('sorts number arrays through the buffer helper and enables sync reuse after warmup', async () => {
    await expect(ensureWasmReady()).resolves.toEqual(fsusOk(undefined))
    expect(isWasmReady()).toBe(true)
    expect(getWasmReadiness()).toBe('ready')
    await expect(sortNumbers([3, 1, 3, -1], true)).resolves.toEqual(
      fsusOk([-1, 1, 3, 3]),
    )
    expect(sortNumbersSync([3, 1, 3, -1], false)).toEqual([3, 3, 1, -1])
  })

  it('returns stable row indices for duplicate number and ASCII values', async () => {
    await expect(
      sortNumberIndices(Float64Array.from([7, 2, 7, 2]), true),
    ).resolves.toEqual(fsusOk(Uint32Array.from([1, 3, 0, 2])))
    const ascii = createAsciiFilterIndex(['beta', 'alpha', 'beta', 'alpha'])
    await expect(sortAsciiIndices(ascii, false)).resolves.toEqual(
      fsusOk(Uint32Array.from([0, 2, 1, 3])),
    )
  })

  it('reuses persistent buffers and survives memory growth without stale views', async () => {
    const sessionResult = await createWasmDataSession()
    expect(sessionResult.ok).toBe(true)
    if (!sessionResult.ok) return
    const session = sessionResult.value
    const large = Float64Array.from(
      { length: 600_000 },
      (_, index) => 600_000 - index,
    )
    const first = session.sortNumberIndices(large, true)
    expect(first[0]).toBe(599_999)
    const firstStats = session.stats()
    const second = session.sortNumberIndices(Float64Array.from([3, 1, 2]), true)
    expect(second).toEqual(Uint32Array.from([1, 2, 0]))
    const secondStats = session.stats()
    expect(secondStats.allocationCount).toBe(firstStats.allocationCount)
    expect(secondStats.reusedAllocationCount).toBeGreaterThan(
      firstStats.reusedAllocationCount,
    )
    expect(secondStats.memoryGeneration).toBeGreaterThanOrEqual(1)

    const ascii = createAsciiFilterIndex(['alpha', 'alphabet', 'beta'])
    session.setAsciiIndex(ascii)
    const candidates = session.filterLoadedAsciiIndices('alpha', false)
    const filterStats = session.stats()
    expect(
      session.filterLoadedAsciiIndices('alphabet', false, candidates),
    ).toEqual(Uint32Array.from([1]))
    const candidateStats = session.stats()
    expect(candidateStats.allocationCount).toBe(filterStats.allocationCount + 1)
    expect(
      session.filterLoadedAsciiIndices(
        'alphabet',
        false,
        Uint32Array.from([1]),
      ),
    ).toEqual(Uint32Array.from([1]))
    expect(session.stats().allocationCount).toBe(candidateStats.allocationCount)
    const internalBuffers = (
      session as unknown as { buffers: Map<string, unknown> }
    ).buffers
    internalBuffers.delete('labels')
    expect(() => session.filterLoadedAsciiIndices('alpha', false)).toThrow(
      /ASCII index is not loaded/u,
    )
    session.dispose()
    expect(() =>
      session.sortNumberIndices(Float64Array.from([1]), true),
    ).toThrow(/disposed/u)
  })

  it('keeps string sort results stable while ignoring locale compatibility parameter', async () => {
    const baseline = await sortStrings(
      ['beta', 'alpha', 'gamma'],
      true,
      'zh-CN',
    )
    const otherLocale = await sortStrings(
      ['beta', 'alpha', 'gamma'],
      true,
      'en-US',
    )

    expect(baseline).toEqual(fsusOk(['alpha', 'beta', 'gamma']))
    expect(otherLocale).toEqual(baseline)
    expect(sortStringsSync(['beta', 'alpha', 'gamma'], false, 'en-US')).toEqual(
      ['gamma', 'beta', 'alpha'],
    )
  })

  it('filters strings correctly for both case-sensitive and case-insensitive paths', async () => {
    const data = ['Alpha', 'beta', 'ALPINE', 'gamma']

    await expect(filterIndices(data, 'alp', false)).resolves.toEqual(
      fsusOk([0, 2]),
    )
    expect(filterIndicesSync(data, 'Al', true)).toEqual([0])

    const asciiIndex = createAsciiFilterIndex(data)
    await expect(filterAsciiIndices(asciiIndex, 'alp', false)).resolves.toEqual(
      fsusOk([0, 2]),
    )
    expect(filterAsciiIndicesSync(asciiIndex, 'Al', true)).toEqual([0])
  })

  it('estimates row heights with the same formula after the buffer-based rewrite', async () => {
    await expect(estimateRowHeights([0, 3, 4], 20, 10, 5, 2)).resolves.toEqual(
      fsusOk([2, 12, 12]),
    )
  })

  it('keeps cold-path color conversion and numeric helpers compatible', async () => {
    await expect(hexToHsl('#FF0000')).resolves.toEqual(
      fsusOk('hsl(0.0,100.0%,50.0%)'),
    )
    await expect(hexToHsl('bad')).resolves.toEqual(fsusOk(''))
    await expect(hexToHsl('#GGGGGG')).resolves.toMatchObject({
      error: { code: 'infra' },
      ok: false,
    })
    await expect(hslToHex(120, 100, 50)).resolves.toEqual(fsusOk('#00FF00'))
    await expect(roundToPrecision(1.005, 2)).resolves.toEqual(fsusOk(1))
    await expect(clampAndRound(5.678, 0, 5, 1)).resolves.toEqual(fsusOk(5))
  })
})
