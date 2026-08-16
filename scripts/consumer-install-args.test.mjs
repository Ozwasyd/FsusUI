import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

import { parseConsumerInstallArgs } from './consumer-install-args.mjs'

test('requires both --profile and --candidate', () => {
  assert.throws(() => parseConsumerInstallArgs([]), /--profile is required/)
  assert.throws(
    () => parseConsumerInstallArgs(['--profile', 'npm-latest']),
    /--candidate is required/,
  )
  assert.throws(
    () => parseConsumerInstallArgs(['--candidate', '/tmp/pkg.tgz']),
    /--profile is required/,
  )
})

test('rejects unknown profiles and implicit defaults', () => {
  assert.throws(
    () =>
      parseConsumerInstallArgs([
        '--profile',
        'default',
        '--candidate',
        '/tmp/pkg.tgz',
      ]),
    /unknown consumer profile/,
  )
})

test('parses the three frozen profiles', () => {
  for (const profile of ['npm-latest', 'pnpm-latest', 'npm-peer-floor']) {
    const parsed = parseConsumerInstallArgs([
      '--profile',
      profile,
      '--candidate',
      '/tmp/pkg.tgz',
    ])
    assert.equal(parsed.profile, profile)
    assert.equal(parsed.candidate, '/tmp/pkg.tgz')
  }
})

test('env and flag profile must match', () => {
  assert.throws(
    () =>
      parseConsumerInstallArgs(
        ['--profile', 'npm-latest', '--candidate', '/tmp/pkg.tgz'],
        { FSUS_CONSUMER_PROFILE: 'pnpm-latest' },
      ),
    /must resolve to the same profile/,
  )
})

test('env and flag candidate must resolve to the same absolute file', () => {
  assert.throws(
    () =>
      parseConsumerInstallArgs(
        ['--profile', 'npm-latest', '--candidate', '/tmp/a.tgz'],
        { FSUSUI_NPM_CANDIDATE: '/tmp/b.tgz' },
      ),
    /must resolve to the same candidate file/,
  )
})

test('env and flag candidate agree across relative and absolute forms', () => {
  const parsed = parseConsumerInstallArgs(
    ['--profile', 'npm-latest', '--candidate', './a.tgz'],
    { FSUSUI_NPM_CANDIDATE: path.resolve('a.tgz') },
  )
  assert.equal(parsed.profile, 'npm-latest')
  assert.equal(parsed.candidate, './a.tgz')
})
