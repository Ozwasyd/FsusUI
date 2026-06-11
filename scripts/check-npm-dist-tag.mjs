import { resolveNpmDistTag } from './resolve-npm-dist-tag.mjs'

const passingCases = new Map([
  ['1.5.0', 'latest'],
  ['1.5.1-preview.0', 'preview'],
  ['1.5.1-alpha.0', 'next'],
  ['1.5.1-beta.0', 'next'],
  ['1.5.1-rc.0', 'next'],
  ['1.5.1-next.0', 'next'],
])

const failingCases = ['1.5.1-dev.0', '1.5.1-canary.0', 'v1.5.0']

for (const [version, expectedTag] of passingCases) {
  const actualTag = resolveNpmDistTag(version)

  if (actualTag !== expectedTag) {
    throw new Error(
      `Expected ${version} to resolve to ${expectedTag}, got ${actualTag}.`,
    )
  }
}

for (const version of failingCases) {
  let failed = false

  try {
    resolveNpmDistTag(version)
  } catch {
    failed = true
  }

  if (!failed) {
    throw new Error(`Expected ${version} to fail npm dist-tag resolution.`)
  }
}

console.log('npm dist-tag rules passed.')
