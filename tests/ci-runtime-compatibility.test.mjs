import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const qualityWorkflows = [
  '.github/workflows/quality.yml',
  '.github/workflows/_quality.yml',
  '.github/workflows/_quality-playwright.yml',
  '.github/workflows/_avalonia-aot-leaf.yml',
]

const assertLinuxRunner = (source) => {
  const labels = [...source.matchAll(/^\s+runs-on:\s+(.+)$/gmu)].flatMap(
    (match) => match[1].match(/ubuntu-(?:latest|\d+\.\d+)/gu) ?? [],
  )
  const matrixLabels = [...source.matchAll(/^\s+os:\s+(ubuntu-\S+)$/gmu)].map(
    (match) => match[1],
  )
  assert.ok(labels.length > 0, 'the quality workflow must retain Linux work')
  assert.ok(
    [...labels, ...matrixLabels].every((label) => label === 'ubuntu-24.04'),
    'quality Linux jobs must use the supported, fixed Ubuntu 24.04 image',
  )
}

const assertSdkPolicy = (sdk) => {
  assert.equal(sdk.version, '10.0.401')
  assert.equal(sdk.rollForward, 'disable')
}

test('the locked Playwright host classifier accepts Ubuntu 24.04 and refuses 26.04', () => {
  const require = createRequire(import.meta.url)
  const packageRoot = path.dirname(
    require.resolve('playwright-core/package.json'),
  )
  const source = readFileSync(
    path.join(packageRoot, 'lib/server/utils/hostPlatform.js'),
    'utf8',
  )
  const classify = (version) => {
    const module = { exports: {} }
    new Script(source).runInNewContext({
      module,
      exports: module.exports,
      process: { env: {} },
      require: (specifier) => {
        if (specifier === 'os')
          return { platform: () => 'linux', arch: () => 'x64' }
        assert.equal(specifier, './linuxUtils')
        return {
          getLinuxDistributionInfoSync: () => ({ id: 'ubuntu', version }),
        }
      },
    })
    return module.exports
  }
  const supported = classify('24.04')
  assert.equal(supported.hostPlatform, 'ubuntu24.04-x64')
  assert.equal(supported.isOfficiallySupportedPlatform, true)
  const unsupported = classify('26.04')
  assert.equal(unsupported.isOfficiallySupportedPlatform, false)
})

test('all quality Linux owners use the fixed compatible runner', () => {
  for (const file of qualityWorkflows) assertLinuxRunner(read(file))
})

test('floating and unsupported Linux runner mutations are rejected', () => {
  const source = read('.github/workflows/_quality-playwright.yml')
  for (const label of ['ubuntu-latest', 'ubuntu-26.04']) {
    assert.throws(
      () => assertLinuxRunner(source.replace('ubuntu-24.04', label)),
      /fixed Ubuntu 24\.04/u,
    )
  }
})

test('the SDK policy stays pinned to the existing locked ILLink graph', () => {
  assertSdkPolicy(JSON.parse(read('dotnet/global.json')).sdk)
  for (const name of [
    'FsusUI.Avalonia',
    'FsusUI.Avalonia.Icons',
    'FsusUI.Avalonia.Themes',
  ]) {
    const lock = JSON.parse(read(`dotnet/${name}/packages.lock.json`))
    const linker = Object.values(lock.dependencies)
      .map((dependencies) => dependencies['Microsoft.NET.ILLink.Tasks'])
      .find(Boolean)
    assert.equal(linker?.requested, '[10.0.12, )')
    assert.equal(linker?.resolved, '10.0.12')
  }
})

test('feature roll-forward and an unreviewed SDK patch are rejected', () => {
  const sdk = JSON.parse(read('dotnet/global.json')).sdk
  assert.throws(() => assertSdkPolicy({ ...sdk, rollForward: 'latestFeature' }))
  assert.throws(() => assertSdkPolicy({ ...sdk, version: '10.0.402' }))
})

test('quality SDK setup keeps the canonical global.json owner', () => {
  let setups = 0
  for (const file of qualityWorkflows) {
    const source = read(file)
    for (const match of source.matchAll(
      /uses: actions\/setup-dotnet@v4\n([\s\S]*?)(?=\n\s+- |$)/gu,
    )) {
      setups += 1
      assert.match(
        match[1],
        /global-json-file: (?:current\/)?dotnet\/global\.json/u,
      )
      assert.doesNotMatch(match[1], /dotnet-version:/u)
    }
  }
  assert.equal(setups, 6)
})

import './ci-performance-provenance.test.mjs'
