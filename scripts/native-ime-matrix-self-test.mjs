#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  REQUIRED_LINUX_IME_CELLS,
  cellFromHarnessEvidence,
  validateManifest,
} from './native-ime-matrix.mjs'
import {
  BROWSER_PROFILES,
  ENGINE_PROFILES,
  computeX11Target,
  resolveOfficialFirefox,
} from './native-ime-profiles.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = resolve(root, 'tests/fixtures/native-ime-matrix')
const candidate = 'c2e4b80738ccb54ad21a2d13883a12f6fb11c8c2'
const load = (name) => JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'))

assert.equal(validateManifest(load('valid-manifest.json'), candidate).valid, true)
assert.equal(
  validateManifest(load('valid-manifest.json'), candidate, { requireSuccess: true })
    .valid,
  false,
  'external-blocked fixtures must not satisfy requireSuccess',
)
for (const name of [
  'invalid-manifest-missing-trace.json',
  'invalid-manifest-synthetic-only.json',
  'invalid-manifest-wrong-candidate.json',
]) {
  assert.equal(validateManifest(load(name), candidate).valid, false, name)
}

const synthetic = validateManifest(load('invalid-manifest-synthetic-only.json'), candidate)
assert.match(synthetic.errors.join('\n'), /synthetic/)

const firefoxTarget = computeX11Target({
  windowGeometry: [320, 20, 1280, 1185],
  innerWidth: 1280,
  innerHeight: 1100,
  rect: { x: 25, y: 346, width: 1230, height: 185.6 },
})
assert.equal(firefoxTarget.x, 960)
assert.equal(firefoxTarget.y, 544)

const chromiumTarget = computeX11Target({
  windowGeometry: [80, 0, 1288, 1231],
  innerWidth: 1280,
  innerHeight: 1100,
  rect: { x: 25, y: 345, width: 1215, height: 185.5625 },
})
assert.equal(chromiumTarget.x, 721)
assert.equal(chromiumTarget.y, 569)

const webkitTarget = computeX11Target({
  windowGeometry: [448, 20, 1280, 1138],
  innerWidth: 1280,
  innerHeight: 1100,
  rect: { x: 25, y: 345, width: 1230, height: 185.5625 },
})
assert.equal(webkitTarget.x, 1088)
assert.equal(webkitTarget.y, 496)

const hidpiChromiumTarget = computeX11Target({
  windowGeometry: [160, 26, 2576, 2226],
  innerWidth: 1280,
  innerHeight: 1100,
  devicePixelRatio: 2,
  rect: { x: 25, y: 345, width: 1215, height: 185.5625 },
})
assert.equal(hidpiChromiumTarget.x, 1441)
assert.equal(hidpiChromiumTarget.y, 928)

const compositorScaledChromiumTarget = computeX11Target({
  windowGeometry: [160, 26, 2576, 2226],
  innerWidth: 1280,
  innerHeight: 1100,
  devicePixelRatio: 1,
  rect: { x: 25, y: 345, width: 1215, height: 185.5625 },
})
assert.deepEqual(compositorScaledChromiumTarget, hidpiChromiumTarget)

assert.equal(BROWSER_PROFILES.webkit.windowClass, 'MiniBrowser')
assert.equal(typeof resolveOfficialFirefox(), 'string')
assert.equal(BROWSER_PROFILES.firefox.firefoxUserPrefs['security.sandbox.content.level'], 0)
assert.equal(BROWSER_PROFILES.firefox.firefoxUserPrefs['focusmanager.testmode'], false)
assert.equal(BROWSER_PROFILES.firefox.gtkImModule, 'ibus')
assert.deepEqual(ENGINE_PROFILES.hangul.activateKeys, [])
assert.ok(ENGINE_PROFILES.hangul.cancelKeys.includes('BackSpace'))

const derived = cellFromHarnessEvidence({
  engine: 'libpinyin',
  browser: 'chromium',
  harnessManifest: {
    verdict: 'pass',
    candidateSha: candidate,
    os: { name: 'Linux' },
    browser: { userAgent: 'Chrome/1' },
    ime: { engine: 'libpinyin', enginePid: 11 },
    locale: { pageLocale: 'zh-CN' },
    fixture: { testId: 'markdown-editor-transaction-fixture' },
    steps: [
      {
        name: 'commit',
        trace: [{ name: 'compositionstart' }, { name: 'compositionend' }],
      },
    ],
  },
})
assert.equal(derived.id, 'libpinyin__chromium')
assert.equal(derived.status, 'success')
assert.equal(derived.synthetic, false)
assert.equal(derived.operations[0], 'commit')
assert.match(derived.traceDigest, /^[0-9a-f]{64}$/u)

const latinBlocked = cellFromHarnessEvidence({
  engine: 'hangul',
  browser: 'chromium',
  harnessManifest: {
    verdict: 'fail',
    failure: { category: 'prerequisite-missing', message: 'DISPLAY is not set' },
    candidateSha: candidate,
    os: { name: 'Linux' },
    browser: { userAgent: 'Chrome/1' },
    ime: { engine: 'hangul', enginePid: 11 },
    locale: { pageLocale: 'ko-KR' },
    fixture: { testId: 'markdown-editor-transaction-fixture' },
    steps: [],
  },
})
assert.equal(latinBlocked.status, 'external-blocked')
assert.equal(latinBlocked.synthetic, false)

assert.equal(REQUIRED_LINUX_IME_CELLS.length, 12)
assert.ok(REQUIRED_LINUX_IME_CELLS.includes('hangul__webkit'))

const session = readFileSync(resolve(root, 'scripts/native-ime-session.sh'), 'utf8')
assert.match(session, /initial-input-mode hangul/)
assert.match(session, /IBUS_ADDRESS/)
assert.match(session, /IBUS_ENABLE_SYNC_MODE=1/)
assert.match(session, /gtk-im-module=ibus/)
assert.match(session, /disable-latin-mode true/)
assert.match(session, /preedit-mode word/)
assert.match(session, /if ! ibus engine/)
assert.match(session, /IBUS_USE_PORTAL=0/)

console.log('[native-ime-matrix-self-test] PASS manifest integrity cases')
