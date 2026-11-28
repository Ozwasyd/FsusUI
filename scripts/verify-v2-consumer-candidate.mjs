#!/usr/bin/env node
/**
 * Cold consumer verification for the immutable @ozwasyd/fsusui 2.0.0 Pure-ESM tarball.
 *
 * Installs the packed tarball into an isolated temporary consumer project, verifies:
 * 1. Package metadata (Pure ESM, zero Element Plus / workspace protocol leaks, minimal runtime deps)
 * 2. Runtime ESM imports across every documented public subpath
 * 3. Stylesheet exports contain canonical --fsus-* tokens and zero --el-* variables
 * 4. TypeScript declarations resolve cleanly with `tsc --noEmit`
 * 5. Vite production bundle succeeds with zero katex/mermaid/shiki leaks in main entry chunk
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const args = process.argv.slice(2)
const tarballIdx = args.indexOf('--tarball')
const tarballPath = path.resolve(
  tarballIdx !== -1 && args[tarballIdx + 1]
    ? args[tarballIdx + 1]
    : path.join(repoRoot, 'dist/npm-candidate/fsusui-npm-candidate.tgz'),
)

if (!existsSync(tarballPath)) {
  throw new Error(`Tarball not found: ${tarballPath}`)
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fsusui-v2-consumer-'))
const run = (cmd, cmdArgs, cwd = tempRoot) =>
  execFileSync(cmd, cmdArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  })

try {
  // Resolve local vue/vite/typescript versions from root package.json to avoid drift
  const rootPkg = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  )
  const vueVersion = rootPkg.devDependencies.vue
  const viteVersion = rootPkg.devDependencies.vite
  const vuePluginVersion = rootPkg.devDependencies['@vitejs/plugin-vue']
  const tsVersion = rootPkg.devDependencies.typescript

  writeFileSync(
    path.join(tempRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'fsusui-v2-cold-consumer',
        private: true,
        type: 'module',
        scripts: {
          typecheck: 'tsc --noEmit',
          build: 'vite build',
        },
        dependencies: {
          '@ozwasyd/fsusui': `file:${tarballPath}`,
          vue: vueVersion,
        },
        devDependencies: {
          '@vitejs/plugin-vue': vuePluginVersion,
          typescript: tsVersion,
          vite: viteVersion,
        },
      },
      null,
      2,
    ),
  )

  writeFileSync(
    path.join(tempRoot, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          types: ['vite/client'],
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ),
  )

  writeFileSync(
    path.join(tempRoot, 'vite.config.ts'),
    `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022',
    minify: true,
  },
})
`,
  )

  writeFileSync(
    path.join(tempRoot, 'index.html'),
    `<!doctype html>
<html>
  <head><meta charset="UTF-8" /></head>
  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
`,
  )

  mkdirSync(path.join(tempRoot, 'src'), { recursive: true })
  writeFileSync(
    path.join(tempRoot, 'src/main.ts'),
    `import { createApp, h } from 'vue'
import FsusUI, {
  FsusButton,
  FsusTable,
  FsusDatePicker,
  FsusColorPicker,
  FsusTree,
  FsusSelect,
  FsusCascader,
  FsusUpload,
  FsusSlider,
  FsusPagination,
  FsusMenu,
  FsusTabs,
  FsusCarousel,
  type FsusTableColumnDef,
  type FsusDatePickerMode,
  type FsusColorFormat,
} from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'

const columns: FsusTableColumnDef[] = [{ key: 'name', label: 'Name', fixed: 'left' }]
const mode: FsusDatePickerMode = 'datetime'
const colorFormat: FsusColorFormat = 'rgb'

const app = createApp({
  render: () =>
    h('main', [
      h(FsusButton, { variant: 'primary' }, () => 'OK'),
      h(FsusTable, { columns, data: [{ id: 1, name: 'Row' }] }),
      h(FsusDatePicker, { mode }),
      h(FsusColorPicker, { colorFormat, showAlpha: true }),
      h(FsusTree, { data: [{ id: 1, label: 'Node' }], checkable: true }),
      h(FsusSelect, { options: [{ value: 'a', label: 'A' }], allowCreate: true }),
      h(FsusCascader, { options: [{ value: 'a', label: 'A' }], multiple: true }),
      h(FsusUpload, { autoUpload: false, listType: 'picture-card' }),
      h(FsusSlider, { range: true, showStops: true }),
      h(FsusPagination, { total: 50, layout: 'total, sizes, prev, pager, next, jumper' }),
      h(FsusMenu, { mode: 'horizontal', ellipsis: true }),
      h(FsusTabs, { editable: true }),
      h(FsusCarousel, { type: 'card' }),
    ]),
})
app.use(FsusUI)
app.mount('#app')
`,
  )

  writeFileSync(
    path.join(tempRoot, 'verify-runtime.mjs'),
    `import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkgPath = fileURLToPath(import.meta.resolve('@ozwasyd/fsusui/package.json'))
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
assert.equal(pkg.name, '@ozwasyd/fsusui')
assert.equal(pkg.type, 'module')
assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ['@floating-ui/dom'])

const main = await import('@ozwasyd/fsusui')
for (const name of [
  'FsusButton', 'FsusTable', 'FsusDatePicker', 'FsusColorPicker',
  'FsusTree', 'FsusSelect', 'FsusCascader', 'FsusCascaderPanel',
  'FsusUpload', 'FsusSlider', 'FsusPagination', 'FsusMenu',
  'FsusTabs', 'FsusCarousel',
]) {
  assert.ok(main[name], \`Missing export: \${name}\`)
}
for (const retired of ['ElButton', 'ElTable', 'ElInput', 'ElSelect']) {
  assert.equal(main[retired], undefined, \`Retired Element Plus alias must not exist: \${retired}\`)
}

for (const subpath of [
  '@ozwasyd/fsusui/core',
  '@ozwasyd/fsusui/icons',
  '@ozwasyd/fsusui/motion',
  '@ozwasyd/fsusui/markdown',
  '@ozwasyd/fsusui/wasm',
  '@ozwasyd/fsusui/theme',
  '@ozwasyd/fsusui/locale',
  '@ozwasyd/fsusui/result',
  '@ozwasyd/fsusui/render-pipeline',
  '@ozwasyd/fsusui/perception-challenge',
]) {
  const mod = await import(subpath)
  assert.ok(Object.keys(mod).length > 0, \`Empty subpath export: \${subpath}\`)
}

const cssPath = fileURLToPath(import.meta.resolve('@ozwasyd/fsusui/styles/fsus.css'))
const css = readFileSync(cssPath, 'utf8')
assert.ok(css.includes('--fsus-'), 'fsus.css must expose canonical --fsus-* tokens')
assert.ok(!css.includes('--el-'), 'fsus.css must contain zero --el-* variables')
console.log('[v2-consumer] runtime ESM + CSS contract passed')
`,
  )

  console.log(`[v2-consumer] installing tarball into ${tempRoot}`)
  run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'])
  run('node', ['verify-runtime.mjs'])
  run('npm', ['run', 'typecheck'])
  run('npm', ['run', 'build'])

  // Ensure Vite output chunk has zero heavy markdown vendor leaks
  const assetsDir = path.join(tempRoot, 'dist/assets')
  const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
  assert.ok(jsFiles.length > 0, 'Vite build produced no JS bundles')
  for (const file of jsFiles) {
    const content = readFileSync(path.join(assetsDir, file), 'utf8')
    assert.ok(
      !/\b(katex|mermaid|shiki)\b/.test(content),
      `Heavy markdown vendor leaked into main consumer bundle ${file}`,
    )
  }

  console.log(
    `[v2-consumer] PASSED: npm install, 11 ESM subpaths, CSS boundary, tsc --noEmit, and Vite build (${jsFiles.length} chunk(s), 0 heavy leaks)`,
  )
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
