require('tsx/cjs')

const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const { excludeFiles, shouldExcludeFile } = require('../src/pkg.ts')
const { pkgRoot } = require('../src/paths.ts')

test('worktree parent names do not become package path segments', () => {
  const artificialRoot = path.join(
    path.parse(pkgRoot).root,
    'workspace',
    'test-parent',
    'repository'
  )
  const source = path.join(
    artificialRoot,
    'vue',
    'packages',
    'components',
    'button',
    'src',
    'button.ts'
  )

  assert.equal(shouldExcludeFile(source, artificialRoot), false)
})

test('owned test, mock, build, and dist paths stay excluded', () => {
  const sources = [
    path.join(pkgRoot, 'components', 'button', 'src', 'button.ts'),
    path.join(pkgRoot, 'components', 'button', '__tests__', 'button.test.ts'),
    path.join(pkgRoot, 'components', 'button', 'mocks', 'button.ts'),
    path.join(pkgRoot, 'components', 'button', 'dist', 'index.mjs'),
    path.join(pkgRoot, 'components', 'button', 'build', 'index.ts'),
  ]

  assert.deepEqual(excludeFiles(sources), [sources[0]])
})
