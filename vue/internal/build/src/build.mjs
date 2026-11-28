import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rollup } from 'rollup'
import vue from '@vitejs/plugin-vue'
import esbuild from 'esbuild'
import { buildTheme } from './build-theme.mjs'
import { MarkdownHeavyFeatureFrameUrl } from './plugins/markdown-heavy-feature-frame.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')
const vueRoot = path.join(repoRoot, 'vue')
const packagesDir = path.join(vueRoot, 'packages')
const outRoot = path.join(repoRoot, 'dist/fsusui')
const distDir = path.join(outRoot, 'dist')

const workspaceMap = {
  '@ozwasyd/fsusui': path.join(packagesDir, 'fsusui/src/index.ts'),
  '@fsusui/core': path.join(packagesDir, 'core/src/index.ts'),
  '@fsusui/icons': path.join(packagesDir, 'icons/src/index.ts'),
  '@fsusui/motion': path.join(packagesDir, 'motion/src/index.ts'),
  '@fsusui/components': path.join(packagesDir, 'components/src/index.ts'),
  '@fsusui/markdown': path.join(packagesDir, 'markdown/src/index.ts'),
  '@fsusui/wasm': path.join(packagesDir, 'wasm/index.ts'),
}

const externalDeps = new Set([
  'vue',
  '@floating-ui/dom',
  'katex',
  'mermaid',
  'shiki',
  './ep_wasm.mjs',
])

const isExternal = (id) => {
  if (externalDeps.has(id)) return true
  if (id.endsWith('/ep_wasm.mjs') || id.endsWith('markdown-heavy-feature-frame-url')) return true
  for (const dep of externalDeps) {
    if (id.startsWith(`${dep}/`)) return true
  }
  return false
}

const resolveWorkspacePlugin = () => ({
  name: 'fsusui-workspace-resolve',
  resolveId(source, importer) {
    if (workspaceMap[source]) return workspaceMap[source]
    for (const [pkg, entry] of Object.entries(workspaceMap)) {
      if (source.startsWith(`${pkg}/`)) {
        const sub = source.slice(pkg.length + 1)
        const base = path.join(path.dirname(entry), sub)
        for (const cand of [base, `${base}.ts`, `${base}.vue`, path.join(base, 'index.ts')]) {
          if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
        }
      }
    }
    if (importer && (source.startsWith('.') || source.startsWith('/'))) {
      const base = path.resolve(path.dirname(importer), source)
      for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.vue`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
      }
    }
    return null
  },
})

const esbuildTsPlugin = () => ({
  name: 'fsusui-esbuild-ts',
  async transform(code, id) {
    const cleanId = id.split('?')[0]
    if (!/\.(?:ts|tsx|mts)$/.test(cleanId) && !id.includes('lang.ts')) return null
    const loader = cleanId.endsWith('.tsx') ? 'tsx' : 'ts'
    const result = await esbuild.transform(code, {
      loader,
      target: 'es2022',
      format: 'esm',
      sourcemap: false,
    })
    return { code: result.code, map: null }
  },
})

async function buildPureEsm() {
  fs.rmSync(outRoot, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  const fsusuiSrc = path.join(packagesDir, 'fsusui/src')
  const input = {
    index: path.join(fsusuiSrc, 'index.ts'),
    core: path.join(fsusuiSrc, 'core.ts'),
    icons: path.join(fsusuiSrc, 'icons.ts'),
    motion: path.join(fsusuiSrc, 'motion.ts'),
    theme: path.join(fsusuiSrc, 'theme.ts'),
    locale: path.join(fsusuiSrc, 'locale.ts'),
    result: path.join(fsusuiSrc, 'result.ts'),
  }

  for (const [key, entry] of Object.entries({
    markdown: path.join(fsusuiSrc, 'markdown.ts'),
    wasm: path.join(fsusuiSrc, 'wasm.ts'),
    'render-pipeline': path.join(fsusuiSrc, 'render-pipeline.ts'),
    'perception-challenge': path.join(fsusuiSrc, 'perception-challenge.ts'),
  })) {
    if (fs.existsSync(entry)) input[key] = entry
  }

  const bundle = await rollup({
    input,
    external: isExternal,
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
    },
    plugins: [
      MarkdownHeavyFeatureFrameUrl({
        assetFileName: 'wasm/markdown-heavy-feature-frame.mjs',
      }),
      resolveWorkspacePlugin(),
      vue({ isProduction: true }),
      esbuildTsPlugin(),
    ],
  })

  await bundle.write({
    dir: distDir,
    format: 'esm',
    entryFileNames: '[name].mjs',
    chunkFileNames: 'chunks/[name]-[hash].mjs',
    compact: true,
    minifyInternalExports: true,
  })
  await bundle.close()

  // Build single-layer compressed CSS
  const stylesDir = path.join(distDir, 'styles')
  const themeRes = await buildTheme(stylesDir)

  // Copy single-copy WASM runtime binaries (no 3x es/lib/dist duplication)
  const wasmSrcDist = path.join(packagesDir, 'wasm/dist')
  const wasmOutDir = path.join(distDir, 'wasm')
  const wasmAssetFiles = [
    'ep_wasm.wasm',
    'ep_wasm.mjs',
    'markdown_basic.wasm',
    'markdown_basic.js',
    'markdown_simd.wasm',
    'markdown_simd.js',
  ]
  if (fs.existsSync(wasmSrcDist)) {
    fs.mkdirSync(wasmOutDir, { recursive: true })
    for (const file of wasmAssetFiles) {
      const srcFile = path.join(wasmSrcDist, file)
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(wasmOutDir, file))
      }
    }
  }

  // Build self-contained ESM Markdown worker bundles under dist/workers/
  const workersOutDir = path.join(distDir, 'workers')
  fs.mkdirSync(workersOutDir, { recursive: true })
  const workerEntries = [
    {
      source: path.join(
        packagesDir,
        'markdown/src/markdown-renderer/src/markdown-renderer.worker.ts',
      ),
      outFile: path.join(workersOutDir, 'markdown-renderer.worker.mjs'),
    },
    {
      source: path.join(
        packagesDir,
        'markdown/src/markdown-renderer/src/markdown-parser.worker.ts',
      ),
      outFile: path.join(workersOutDir, 'markdown-parser.worker.mjs'),
    },
  ]
  for (const workerEntry of workerEntries) {
    if (!fs.existsSync(workerEntry.source)) continue
    await esbuild.build({
      entryPoints: [workerEntry.source],
      outfile: workerEntry.outFile,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      sourcemap: false,
      treeShaking: true,
      alias: workspaceMap,
    })
  }

  // Rewrite source-relative WASM & worker URLs in emitted ESM bundles to packaged dist/ targets
  const toRelativeUrlSpecifier = (fromFile, targetAbs) => {
    let rel = path.relative(path.dirname(fromFile), targetAbs).replace(/\\/gu, '/')
    if (!rel.startsWith('.')) rel = `./${rel}`
    return rel
  }
  const wasmUrlTargetByName = new Map(
    wasmAssetFiles.map((file) => [file, path.join(wasmOutDir, file)]),
  )
  const workerUrlTargetBySourceName = new Map([
    [
      'markdown-renderer.worker.ts',
      path.join(workersOutDir, 'markdown-renderer.worker.mjs'),
    ],
    [
      'markdown-parser.worker.ts',
      path.join(workersOutDir, 'markdown-parser.worker.mjs'),
    ],
  ])
  const rewriteRuntimeUrlsInDir = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Leave copied Emscripten runtime glue files in dist/wasm/ untouched here
        if (full === wasmOutDir) continue
        rewriteRuntimeUrlsInDir(full)
        continue
      }
      if (!entry.name.endsWith('.mjs')) continue
      const orig = fs.readFileSync(full, 'utf8')
      let next = orig.replace(
        /new URL\(\s*(['"])\.\.\/dist\/(ep_wasm\.mjs|ep_wasm\.wasm|markdown_basic\.js|markdown_basic\.wasm|markdown_simd\.js|markdown_simd\.wasm)\1\s*,\s*import\.meta\.url\s*\)/gu,
        (_match, quote, fileName) => {
          const target = wasmUrlTargetByName.get(fileName)
          return `new URL(${quote}${toRelativeUrlSpecifier(full, target)}${quote}, import.meta.url)`
        },
      )
      const isWorkerFile = full.startsWith(workersOutDir + path.sep)
      next = next.replace(
        /new URL\(\s*(['"])\.\/(markdown-renderer\.worker\.ts|markdown-parser\.worker\.ts)\1\s*,\s*import\.meta\.url\s*\)/gu,
        (_match, quote, workerFileName) => {
          const target = workerUrlTargetBySourceName.get(workerFileName)
          const relSpec = toRelativeUrlSpecifier(full, target)
          // Prevent Vite's assetsInlineLimit from turning small worker modules into data: URIs
          // (Chromium rejects cross-origin data: URLs in new Worker(...)).
          const suffix = isWorkerFile ? '' : '?no-inline'
          return `new URL(${quote}${relSpec}${suffix}${quote}, import.meta.url)`
        },
      )
      if (next !== orig) {
        fs.writeFileSync(full, next, 'utf8')
      }
    }
  }
  rewriteRuntimeUrlsInDir(distDir)

  // Copy package manifest (stripping internal workspace deps -> bundled ESM)
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packagesDir, 'fsusui/package.json'), 'utf8'),
  )
  const publishedDeps = {}
  for (const [dep, ver] of Object.entries(manifest.dependencies ?? {})) {
    if (!String(ver).startsWith('workspace:')) {
      publishedDeps[dep] = ver
    }
  }
  manifest.dependencies = publishedDeps
  fs.writeFileSync(
    path.join(outRoot, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  if (fs.existsSync(path.join(repoRoot, 'README.md'))) {
    fs.copyFileSync(path.join(repoRoot, 'README.md'), path.join(outRoot, 'README.md'))
  }

  // Emit clean single-copy .d.ts via vue-tsc if tsconfig.dts.json exists
  const dtsConfig = path.join(vueRoot, 'tsconfig.dts.json')
  const typesRoot = path.join(distDir, 'types')
  if (fs.existsSync(dtsConfig)) {
    execFileSync(
      path.join(repoRoot, 'node_modules/.bin/vue-tsc'),
      ['-p', dtsConfig, '--emitDeclarationOnly', '--outDir', typesRoot],
      { cwd: repoRoot, stdio: 'inherit' },
    )

    // Rewrite internal workspace specifiers in emitted .d.ts to relative paths
    const dtsWorkspaceTargets = {
      '@ozwasyd/fsusui': path.join(typesRoot, 'packages/fsusui/src/index'),
      '@fsusui/core': path.join(typesRoot, 'packages/core/src/index'),
      '@fsusui/icons': path.join(typesRoot, 'packages/icons/src/index'),
      '@fsusui/motion': path.join(typesRoot, 'packages/motion/src/index'),
      '@fsusui/components': path.join(typesRoot, 'packages/components/src/index'),
      '@fsusui/markdown': path.join(typesRoot, 'packages/markdown/src/index'),
      '@fsusui/wasm': path.join(typesRoot, 'packages/wasm/index'),
    }
    const toRel = (fromFile, targetAbs) => {
      let rel = path.relative(path.dirname(fromFile), targetAbs).replace(/\\/g, '/')
      if (!rel.startsWith('.')) rel = `./${rel}`
      return rel
    }
    const rewriteDtsDir = (dir) => {
      if (!fs.existsSync(dir)) return
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          rewriteDtsDir(full)
          continue
        }
        if (!/\.d\.[cm]?ts$/u.test(entry.name)) continue
        const orig = fs.readFileSync(full, 'utf8')
        let next = orig
        for (const [pkg, targetBase] of Object.entries(dtsWorkspaceTargets)) {
          const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          // Subpath imports like '@fsusui/core/render-pipeline' or '@fsusui/wasm/markdown-runtime'
          next = next.replace(
            new RegExp(`(['"])${escaped}/([^'"]+)\\1`, 'g'),
            (_m, q, sub) => {
              const subBase = path.join(path.dirname(targetBase), sub)
              const resolved = fs.existsSync(`${subBase}.d.ts`)
                ? subBase
                : fs.existsSync(path.join(subBase, 'index.d.ts'))
                  ? path.join(subBase, 'index')
                  : subBase
              return `${q}${toRel(full, resolved)}${q}`
            },
          )
          next = next.replace(
            new RegExp(`(['"])${escaped}\\1`, 'g'),
            (_m, q) => `${q}${toRel(full, targetBase)}${q}`,
          )
        }
        // Rewrite .ts / .vue extensionless or ?worker&url references in d.ts
        next = next.replace(/(['"])\.\/markdown-heavy-feature-frame\.ts\?worker&url\1/g, '$1./markdown-heavy-feature-frame$1')
        if (next !== orig) fs.writeFileSync(full, next, 'utf8')
      }
    }
    rewriteDtsDir(typesRoot)

    // Emit clean top-level barrel .d.ts entries matching package.json exports
    for (const entryName of Object.keys(input)) {
      const targetRel = `./types/packages/fsusui/src/${entryName}`
      const content =
        entryName === 'index'
          ? `export * from '${targetRel}'\nexport { default } from '${targetRel}'\n`
          : `export * from '${targetRel}'\n`
      fs.writeFileSync(path.join(distDir, `${entryName}.d.ts`), content, 'utf8')
    }

    // Emit global.d.ts for Volar / Vue template global component types
    fs.writeFileSync(
      path.join(distDir, 'global.d.ts'),
      [
        "import type * as Components from './types/packages/components/src/index'",
        "import type { FsusIcon } from './types/packages/icons/src/index'",
        "import type { FsusMarkdownEditor, FsusMarkdownRenderer } from './types/packages/markdown/src/index'",
        '',
        "declare module 'vue' {",
        '  export interface GlobalComponents {',
        '    FsusIcon: typeof FsusIcon',
        '    FsusMarkdownEditor: typeof FsusMarkdownEditor',
        '    FsusMarkdownRenderer: typeof FsusMarkdownRenderer',
        '    FsusButton: typeof Components.FsusButton',
        '    FsusButtonGroup: typeof Components.FsusButtonGroup',
        '    FsusConfigProvider: typeof Components.FsusConfigProvider',
        '    FsusInput: typeof Components.FsusInput',
        '    FsusSelect: typeof Components.FsusSelect',
        '    FsusTable: typeof Components.FsusTable',
        '    FsusDialog: typeof Components.FsusDialog',
        '    FsusDrawer: typeof Components.FsusDrawer',
        '    FsusForm: typeof Components.FsusForm',
        '    FsusFormItem: typeof Components.FsusFormItem',
        '    FsusTooltip: typeof Components.FsusTooltip',
        '    FsusPopover: typeof Components.FsusPopover',
        '    FsusTabs: typeof Components.FsusTabs',
        '    FsusTabPane: typeof Components.FsusTabPane',
        '    FsusTree: typeof Components.FsusTree',
        '    FsusEmptyState: typeof Components.FsusEmptyState',
        '    FsusPageHeader: typeof Components.FsusPageHeader',
        '  }',
        '}',
        '',
        'export {}',
        '',
      ].join('\n'),
      'utf8',
    )
  }

  // Report build footprint
  let totalBytes = 0
  let fileCount = 0
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else {
        totalBytes += fs.statSync(p).size
        fileCount += 1
      }
    }
  }
  walk(outRoot)
  console.log(
    `[fsusui/build] Pure-ESM build complete: ${fileCount} files, ${(totalBytes / 1024).toFixed(1)} KB unpacked (CSS: ${themeRes.count} files / ${(themeRes.totalBytes / 1024).toFixed(1)} KB)`,
  )
}

await buildPureEsm()
