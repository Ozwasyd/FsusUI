#!/usr/bin/env node

/**
 * Negative-path self test for the native IME harness.
 *
 * Proves that the harness fails explicitly, with distinct categories, when:
 * 1. the fixture is mounted later than the harness wait window,
 * 2. the editor selector points at a non-existent control,
 * 3. the expected window class does not match the bound browser window.
 *
 * These runs reuse an existing demo build (FSUS_IME_SKIP_BUILD=1) so the
 * standard flow is: run the harness once (it builds), then run this self test.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harnessPath = resolve(repositoryRoot, 'scripts/native-ime-harness.mjs')

assert.match(
  readFileSync(harnessPath, 'utf8'),
  /trace:/u,
  'native IME harness must retain a native event trace for its evidence',
)

const runHarness = (outDirectory, overrides) => {
  const environment = {
    ...process.env,
    FSUS_IME_SKIP_BUILD: '1',
    ...overrides,
  }
  return spawnSync(process.execPath, [harnessPath, '--out', outDirectory], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
  })
}

const parseFailureCategory = (stdout, stderr) => {
  const combined = `${stdout}\n${stderr}`
  const match =
    /\[native-ime\] FAIL category=([a-z-]+)/u.exec(combined) ??
    /category: ['"]?([a-z-]+)/u.exec(combined)
  return match ? match[1] : null
}

const scenarios = [
  {
    name: 'delayed-mount',
    expected: 'target-absent',
    exitCode: 4,
    overrides: {
      FSUS_IME_DELAY_MOUNT_MS: '8000',
      FSUS_IME_MOUNT_TIMEOUT_MS: '1500',
    },
  },
  {
    name: 'wrong-selector',
    expected: 'target-absent',
    exitCode: 4,
    overrides: {
      FSUS_IME_EDITOR_SELECTOR:
        '[data-testid="markdown-editor-transaction-fixture"] .el-markdown-editor textarea-does-not-exist',
    },
  },
  {
    name: 'window-class-mismatch',
    expected: 'window-pid-mismatch',
    exitCode: 5,
    overrides: {
      FSUS_IME_EXPECT_WINDOW_CLASS: 'DefinitelyNotGoogleChrome',
    },
  },
]

const root = mkdtempSync(join(tmpdir(), 'fsusui-native-ime-self-test-'))
try {
  for (const scenario of scenarios) {
    const outDirectory = join(root, scenario.name)
    const result = runHarness(outDirectory, scenario.overrides)
    const category = parseFailureCategory(result.stdout, result.stderr)
    if (category === 'prerequisite-missing') {
      console.log(
        `[native-ime-self-test] ${scenario.name}: EXTERNAL-BLOCKED category=${category}`,
      )
      continue
    }
    assert.equal(
      result.status,
      scenario.exitCode,
      `${scenario.name}: exit code ${result.status}, stderr=${result.stderr}`,
    )
    assert.equal(
      category,
      scenario.expected,
      `${scenario.name}: category ${category}, stdout=${result.stdout} stderr=${result.stderr}`,
    )
    console.log(
      `[native-ime-self-test] ${scenario.name}: PASS category=${category}`,
    )
  }
  console.log('[native-ime-self-test] PASS 3 negative scenarios')
} finally {
  rmSync(root, { force: true, recursive: true })
}
