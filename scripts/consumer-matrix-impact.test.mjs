import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'

test('pre-install planner produces exact canonical plans with no dependencies installed', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'consumer-impact-no-deps-'))
  const env = { ...process.env, NODE_PATH: '' }
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  try {
    mkdirSync(path.join(root, 'scripts'))
    for (const file of [
      'consumer-matrix-impact.mjs',
      'consumer-matrix-lib.mjs',
    ])
      copyFileSync(
        new URL(file, import.meta.url),
        path.join(root, 'scripts', file),
      )
    run(process.execPath, [
      '--no-global-search-paths',
      '--input-type=module',
      '-e',
      "import {createRequire} from 'node:module'; import assert from 'node:assert/strict'; const require=createRequire(process.cwd()+'/scripts/consumer-matrix-lib.mjs'); assert.throws(()=>require.resolve('semver'), {code:'MODULE_NOT_FOUND'});",
    ])
    run('git', ['init'])
    const commit = () => {
      run('git', ['add', '.'])
      run('git', [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-m',
        'Synthetic impact fixture',
      ])
      return run('git', ['rev-parse', 'HEAD'])
    }
    const base = commit()
    const check = (baseValue, action, paths, reason) => {
      const output = path.join(root, '.consumer-matrix', 'impact-plan.json')
      run(process.execPath, [
        '--no-global-search-paths',
        'scripts/consumer-matrix-impact.mjs',
        '--output',
        output,
        ...(baseValue ? ['--base', baseValue] : []),
      ])
      // Independent fixed key ordering, not the production canonicalizer.
      const unsigned = {
        action,
        base: baseValue,
        paths,
        reason,
        schema: 'fsusui.consumer-matrix-impact.v1',
      }
      const digest = createHash('sha256')
        .update(`${JSON.stringify(unsigned)}\n`)
        .digest('hex')
      assert.equal(
        readFileSync(output, 'utf8'),
        `${JSON.stringify({ action, base: baseValue, digest, paths, reason, schema: unsigned.schema })}\n`,
      )
      // Outputs must not become inputs to the next synthetic commit.
      rmSync(path.join(root, '.consumer-matrix'), { recursive: true })
    }
    check(null, 'run', [], 'base-unavailable:conservative-run')
    check(base, 'run', [], 'empty-diff:conservative-run')
    writeFileSync(path.join(root, 'README.md'), 'fixture documentation\n')
    commit()
    check(base, 'skip', ['README.md'], 'no-package-impact:documentation-only')
    writeFileSync(
      path.join(root, 'component.ts'),
      'export const fixture = true\n',
    )
    commit()
    check(
      base,
      'run',
      ['README.md', 'component.ts'],
      'package-impact:conservative-run',
    )
    check('missing-base', 'run', [], 'diff-unavailable:conservative-run:128')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('consumer evidence upload explicitly includes its hidden directory and remains mandatory', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/_quality.yml', import.meta.url),
    'utf8',
  )
  const upload = workflow
    .split('      - name: Upload consumer matrix receipts\n')[1]
    ?.split('      - name:')[0]
  assert.ok(upload)
  assert.match(upload, /if: always\(\)/u)
  assert.match(
    upload,
    /path: \.consumer-matrix\n\s+include-hidden-files: true\n\s+if-no-files-found: error/u,
  )
})
