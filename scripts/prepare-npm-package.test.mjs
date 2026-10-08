import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')

// Exercise the real preparer CLI in collection mode. These intentionally small
// fixtures test reference handling, not release-artifact qualification.
function prepare(files, { strict = false, dependencies = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'fsusui-preparer-test-'))
  const put = (relative, content) => {
    const target = path.join(root, relative)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  try {
    for (const relative of [
      'scripts/prepare-npm-package.mjs',
      'scripts/npm-package-contract.mjs',
      'scripts/npm-authority-lib.mjs',
      'config/dependencies/npm-authority.json',
      'vue/packages/element-plus/package.json',
      'vue/packages/icons-vue/package.json',
      'vue/packages/motion/package.json',
    ]) {
      put(relative, readFileSync(path.join(repoRoot, relative)))
    }
    put(
      'dist/element-plus/package.json',
      JSON.stringify({
        ...JSON.parse(
          readFileSync(
            path.join(repoRoot, 'vue/packages/element-plus/package.json'),
            'utf8',
          ),
        ),
        ...(strict ? {} : { dependencies }),
      }),
    )
    for (const [relative, content] of Object.entries(files)) {
      put(`dist/element-plus/${relative}`, content)
    }
    const result = spawnSync(
      process.execPath,
      ['scripts/prepare-npm-package.mjs', strict ? '--strict' : '--collect'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: 'Ozwasyd/FsusUI',
          NPM_PACKAGE_NAME: '@ozwasyd/element-plus',
        },
      },
    )
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      manifest: JSON.parse(
        readFileSync(path.join(root, 'dist/element-plus/package.json'), 'utf8'),
      ),
      files: Object.fromEntries(
        Object.keys(files).map((relative) => [
          relative,
          readFileSync(path.join(root, 'dist/element-plus', relative), 'utf8'),
        ]),
      ),
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('bundle license attribution is retained without resolving a workspace dependency', () => {
  const content =
    '/*! @element-plus/icons-vue/dist/index.js | MIT */\nconst note = "@element-plus/icons-vue-extra";\n'
  const result = prepare({ 'dist/index.full.js': content })
  assert.equal(result.status, 0, result.output)
  assert.equal(result.files['dist/index.full.js'], content)
  assert.match(result.output, /0 bundled workspace rewrites/)
})

test('rewrites both quote styles in ESM, CommonJS, and declaration files', () => {
  const result = prepare({
    'es/components/probe.mjs':
      'import icons from "@element-plus/icons-vue"; import motion from \'@element-plus/motion\';',
    'lib/components/probe.cjs':
      'const icons = require(\'@element-plus/icons-vue\'); const motion = require("@element-plus/motion");',
    'es/components/probe.d.ts':
      'export * from "@element-plus/icons-vue"; export * from \'@element-plus/motion\';',
    'es/components/probe.d.mts': 'export * from "@element-plus/icons-vue";',
    'lib/components/probe.d.cts': "export * from '@element-plus/motion';",
  })
  assert.equal(result.status, 0, result.output)
  assert.equal(
    result.files['es/components/probe.mjs'],
    'import icons from "../icons-vue/src/index.mjs"; import motion from \'../motion/index.mjs\';',
  )
  assert.equal(
    result.files['lib/components/probe.cjs'],
    'const icons = require(\'../icons-vue/src/index.js\'); const motion = require("../motion/index.js");',
  )
  assert.match(
    result.files['es/components/probe.d.ts'],
    /@ozwasyd\/element-plus\/es\/icons-vue/,
  )
  assert.match(
    result.files['es/components/probe.d.mts'],
    /@ozwasyd\/element-plus\/es\/icons-vue/,
  )
  assert.match(
    result.files['lib/components/probe.d.cts'],
    /@ozwasyd\/element-plus\/es\/motion/,
  )
  assert.match(result.output, /8 bundled workspace rewrites across 5 files/)
})

for (const dependency of ['@element-plus/icons-vue', '@element-plus/motion']) {
  test(`refuses an actual unrewritable ${dependency} root reference in a full bundle`, () => {
    const result = prepare({ 'dist/index.full.js': `require('${dependency}')` })
    assert.notEqual(result.status, 0)
    assert.match(
      result.output,
      /Unable to rewrite bundled workspace dependency reference in dist\/index.full.js/,
    )
  })

  test(`refuses a remaining quoted ${dependency} subpath reference`, () => {
    const result = prepare({
      'es/probe.mjs': `import '${dependency}/dist/index.js';`,
    })
    assert.notEqual(result.status, 0)
    assert.match(
      result.output,
      /Bundled workspace dependency references remain in published files: es\/probe.mjs/,
    )
  })
}

test('strict mode still refuses incomplete release artifacts', () => {
  const result = prepare(
    { 'dist/index.full.js': '/*! @element-plus/icons-vue/dist/index.js */' },
    { strict: true },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.output, /missing|Missing/)
})

test('unresolved workspace dependency versions remain fatal', () => {
  const result = prepare(
    { 'es/probe.mjs': 'export {}' },
    { dependencies: { '@element-plus/unknown': 'workspace:*' } },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.output, /Unable to resolve workspace version/)
})

test('known bundled workspace dependencies are still removed from the manifest', () => {
  const result = prepare(
    { 'es/probe.mjs': 'export {}' },
    {
      dependencies: {
        '@element-plus/icons-vue': 'workspace:*',
        '@element-plus/motion': 'workspace:*',
      },
    },
  )
  assert.equal(result.status, 0, result.output)
  assert.equal(
    Object.hasOwn(result.manifest.dependencies, '@element-plus/icons-vue'),
    false,
  )
  assert.equal(
    Object.hasOwn(result.manifest.dependencies, '@element-plus/motion'),
    false,
  )
  assert.match(result.output, /2 bundled workspace dependencies removed/)
})
