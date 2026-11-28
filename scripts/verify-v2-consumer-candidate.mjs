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
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    minify: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        markdown: 'markdown.html',
      },
    },
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

  writeFileSync(
    path.join(tempRoot, 'markdown.html'),
    `<!doctype html>
<html>
  <head><meta charset="UTF-8" /></head>
  <body><div id="md-app"></div><script type="module" src="/src/markdown.ts"></script></body>
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
    path.join(tempRoot, 'src/markdown.ts'),
    `import { createApp, h } from 'vue'
import { FsusMarkdownRenderer } from '@ozwasyd/fsusui/markdown'
import {
  ensureWasmReady,
  initMarkdownRuntime,
  renderMarkdownResultWithRuntime,
} from '@ozwasyd/fsusui/wasm'
import '@ozwasyd/fsusui/styles/markdown.css'

export async function runWasmSmoke() {
  const coreReady = await ensureWasmReady()
  const mdReady = await initMarkdownRuntime()
  const rendered = await renderMarkdownResultWithRuntime('# Preview baseline')
  return { coreReady, mdReady, rendered }
}

const app = createApp({
  render: () => h(FsusMarkdownRenderer, { content: '# Hello consumer' }),
})
app.mount('#md-app')
`,
  )

  writeFileSync(
    path.join(tempRoot, 'verify-runtime.mjs'),
    `import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

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

// #1143: Verify packed WASM loaders initialize and render Markdown in Node
const wasmMod = await import('@ozwasyd/fsusui/wasm')
const coreReady = await wasmMod.ensureWasmReady()
assert.equal(coreReady.ok, true, \`ensureWasmReady failed: \${JSON.stringify(coreReady)}\`)
const mdReady = await wasmMod.initMarkdownRuntime()
assert.equal(mdReady.ok, true, \`initMarkdownRuntime failed: \${JSON.stringify(mdReady)}\`)
const mdRender = await wasmMod.renderMarkdownResultWithRuntime('# Preview baseline')
assert.equal(mdRender.ok, true, \`renderMarkdownResultWithRuntime failed: \${JSON.stringify(mdRender)}\`)
assert.ok(
  mdRender.value.html.includes('Preview baseline') && mdRender.value.html.includes('<h1'),
  \`Unexpected Markdown HTML: \${mdRender.value.html}\`,
)

// #1144: Verify closed FsusSelect / FsusCascader / FsusDropdown render cleanly in Vue SSR
const ssrHtml = await renderToString(
  createSSRApp({
    render: () =>
      h('div', [
        h(main.FsusSelect, {
          modelValue: 'a',
          options: [{ value: 'a', label: 'Alpha' }],
        }),
        h(main.FsusCascader, {
          modelValue: [],
          options: [{ value: 'a', label: 'Alpha' }],
        }),
        h(main.FsusDropdown, {}, {
          default: () => h('button', 'Menu'),
          dropdown: () => h('div', 'Item'),
        }),
      ]),
  }),
)
assert.ok(ssrHtml.includes('role="combobox"'), 'Closed FsusSelect SSR missing combobox')
assert.ok(ssrHtml.includes('Alpha'), 'Closed FsusSelect SSR missing selected label')

// #1148: Verify canonical FsusMarkdownRenderer policy
const rpMod = await import('@ozwasyd/fsusui/render-pipeline')
const mdPolicy = rpMod.createFsusRenderPipelineComponentPolicy('FsusMarkdownRenderer')
assert.equal(mdPolicy.role, 'chunk-adapter')
assert.equal(mdPolicy.adapterId, 'markdown-renderer')

const cssPath = fileURLToPath(import.meta.resolve('@ozwasyd/fsusui/styles/fsus.css'))
const css = readFileSync(cssPath, 'utf8')
assert.ok(css.includes('--fsus-'), 'fsus.css must expose canonical --fsus-* tokens')
assert.ok(!css.includes('--el-'), 'fsus.css must contain zero --el-* variables')
console.log('[v2-consumer] runtime ESM + WASM + SSR + policy + CSS contract passed')
`,
  )

  console.log(`[v2-consumer] installing tarball into ${tempRoot}`)
  run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'])
  run('node', ['verify-runtime.mjs'])
  run('npm', ['run', 'typecheck'])
  const viteBuildOutput = execFileSync('npm', ['run', 'build'], {
    cwd: tempRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  })
  process.stdout.write(viteBuildOutput)
  assert.ok(
    !viteBuildOutput.includes("doesn't exist at build time"),
    `Vite build emitted unresolved URL warnings:\n${viteBuildOutput}`,
  )

  // Ensure Vite output emitted all WASM & worker assets while keeping main entry free of heavy markdown vendors
  const assetsDir = path.join(tempRoot, 'dist/assets')
  const allAssets = readdirSync(assetsDir)
  for (const expectedPrefix of [
    'ep_wasm',
    'markdown_basic',
    'markdown_simd',
    'markdown-renderer.worker',
    'markdown-parser.worker',
  ]) {
    assert.ok(
      allAssets.some((file) => file.startsWith(expectedPrefix)),
      `Vite build missing expected emitted runtime asset starting with "${expectedPrefix}" in ${allAssets.join(', ')}`,
    )
  }
  const mainHtml = readFileSync(path.join(tempRoot, 'dist/index.html'), 'utf8')
  const mainJsMatches = [...mainHtml.matchAll(/assets\/([^"']+\.js)/g)].map((m) => m[1])
  assert.ok(mainJsMatches.length > 0, 'Vite build produced no main entry JS bundles')
  for (const file of mainJsMatches) {
    const content = readFileSync(path.join(assetsDir, file), 'utf8')
    assert.ok(
      !/\b(katex|mermaid|shiki)\b/.test(content),
      `Heavy markdown vendor leaked into main consumer bundle ${file}`,
    )
  }

  console.log(
    `[v2-consumer] PASSED: npm install, 11 ESM subpaths, live WASM+Markdown init/render, closed Select SSR, policy, CSS boundary, tsc --noEmit, and Vite build (${allAssets.length} asset(s), 0 unresolved URL warnings, 0 heavy leaks)`,
  )
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
