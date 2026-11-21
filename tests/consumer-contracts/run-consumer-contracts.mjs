#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startContractServer } from './server.mjs'

const REGISTRY_URL = 'https://registry.npmjs.org/'
const PACKAGE_NAME = '@ozwasyd/element-plus'
const SUITE_SPECS = {
  '830': '830-dropdown.spec.ts',
  '831': '831-data-list.spec.ts',
  '832': '832-image-viewer-modal.spec.ts',
  '833': '833-image-viewer-content.spec.ts',
  '834': '834-image-viewer-geometry.spec.ts',
  '835': '835-image-viewer-ssr-csp.spec.ts',
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../..')
const fixtureSourceDir = path.join(currentDir, 'fixture')
const playwrightConfigPath = path.join(currentDir, 'playwright.config.ts')

function writeLine(message) {
  process.stdout.write(`${message}\n`)
}

function parseArgs(argv) {
  const parsed = {
    mode: 'source',
    version: '',
    suite: 'all',
    keepTemp: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--mode') {
      parsed.mode = argv[++i] || ''
    } else if (arg.startsWith('--mode=')) {
      parsed.mode = arg.slice('--mode='.length)
    } else if (arg === '--version') {
      parsed.version = argv[++i] || ''
    } else if (arg.startsWith('--version=')) {
      parsed.version = arg.slice('--version='.length)
    } else if (arg === '--suite') {
      parsed.suite = argv[++i] || 'all'
    } else if (arg.startsWith('--suite=')) {
      parsed.suite = arg.slice('--suite='.length)
    } else if (arg === '--keep-temp') {
      parsed.keepTemp = true
    } else if (arg === '--help' || arg === '-h') {
      writeLine(
        [
          'Usage: node tests/consumer-contracts/run-consumer-contracts.mjs [options]',
          '',
          'Options:',
          '  --mode <source|dist|published>  Target package mode (default: source)',
          '  --version <ver>                 Published npm version (required for --mode published)',
          '  --suite <all|830|831|832|833|834|835>  Suite(s) to run, comma-separated (default: all)',
          '  --keep-temp                     Keep temporary build/install directory for inspection',
        ].join('\n'),
      )
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!['source', 'dist', 'published'].includes(parsed.mode)) {
    throw new Error(
      `Invalid --mode "${parsed.mode}". Expected "source", "dist", or "published".`,
    )
  }
  if (parsed.mode === 'published' && !parsed.version) {
    throw new Error('--version <ver> is required when using --mode published.')
  }
  return parsed
}

function resolveSpecFiles(suiteArg) {
  if (suiteArg === 'all') {
    return Object.values(SUITE_SPECS).map((file) =>
      path.join(currentDir, 'specs', file),
    )
  }
  const tokens = suiteArg
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (tokens.length === 0) {
    throw new Error('Empty --suite value.')
  }
  return tokens.map((token) => {
    const file = SUITE_SPECS[token]
    if (!file) {
      throw new Error(
        `Unknown suite "${token}". Valid suites: all, ${Object.keys(SUITE_SPECS).join(', ')}`,
      )
    }
    return path.join(currentDir, 'specs', file)
  })
}

function downloadSha256(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume()
        downloadSha256(response.headers.location).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(
          new Error(`Failed to fetch tarball ${url} (HTTP ${response.statusCode})`),
        )
        return
      }
      const hash = createHash('sha256')
      response.on('data', (chunk) => hash.update(chunk))
      response.on('end', () => resolve(hash.digest('hex')))
      response.on('error', reject)
    })
    request.on('error', reject)
  })
}

function createSourceAliases(mode) {
  if (mode === 'dist') {
    const distRoot = path.join(repoRoot, 'dist', 'element-plus')
    if (!existsSync(path.join(distRoot, 'es', 'index.mjs'))) {
      throw new Error(
        `Built package not found at ${distRoot}. Run "pnpm run build" first or use --mode source.`,
      )
    }
    return [
      {
        find: `${PACKAGE_NAME}/dist/index.css`,
        replacement: path.join(distRoot, 'dist', 'index.css'),
      },
      {
        find: `${PACKAGE_NAME}/dist/fsus.css`,
        replacement: path.join(distRoot, 'dist', 'fsus.css'),
      },
      {
        find: `${PACKAGE_NAME}/icons-vue`,
        replacement: path.join(distRoot, 'es', 'icons-vue.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/es/locale/lang/zh-cn`,
        replacement: path.join(distRoot, 'es', 'locale', 'lang', 'zh-cn.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/es/locale/lang/en`,
        replacement: path.join(distRoot, 'es', 'locale', 'lang', 'en.mjs'),
      },
      {
        find: new RegExp(`^${PACKAGE_NAME.replace('/', '\\/')}$`),
        replacement: path.join(distRoot, 'es', 'index.mjs'),
      },
    ]
  }

  const packagesRoot = path.join(repoRoot, 'vue', 'packages')
  return [
    {
      find: `${PACKAGE_NAME}/dist/index.css`,
      replacement: path.join(packagesRoot, 'theme-chalk', 'src', 'index.scss'),
    },
    {
      find: `${PACKAGE_NAME}/dist/fsus.css`,
      replacement: path.join(packagesRoot, 'theme-chalk', 'src', 'fsus.scss'),
    },
    {
      find: `${PACKAGE_NAME}/icons-vue`,
      replacement: path.join(packagesRoot, 'icons-vue', 'src', 'index.ts'),
    },
    {
      find: `${PACKAGE_NAME}/es/locale/lang/zh-cn`,
      replacement: path.join(packagesRoot, 'locale', 'lang', 'zh-cn.ts'),
    },
    {
      find: `${PACKAGE_NAME}/es/locale/lang/en`,
      replacement: path.join(packagesRoot, 'locale', 'lang', 'en.ts'),
    },
    {
      find: new RegExp(`^${PACKAGE_NAME.replace('/', '\\/')}$`),
      replacement: path.join(packagesRoot, 'element-plus', 'index.ts'),
    },
    // Internal workspace source resolution for workspace files only;
    // the consumer fixture itself imports ONLY documented @ozwasyd/element-plus paths.
    {
      find: '@element-plus/components',
      replacement: path.join(packagesRoot, 'components'),
    },
    {
      find: '@element-plus/constants',
      replacement: path.join(packagesRoot, 'constants'),
    },
    {
      find: '@element-plus/directives',
      replacement: path.join(packagesRoot, 'directives'),
    },
    {
      find: '@element-plus/hooks',
      replacement: path.join(packagesRoot, 'hooks'),
    },
    {
      find: '@element-plus/locale',
      replacement: path.join(packagesRoot, 'locale'),
    },
    {
      find: '@element-plus/utils',
      replacement: path.join(packagesRoot, 'utils'),
    },
    {
      find: '@element-plus/icons-vue',
      replacement: path.join(packagesRoot, 'icons-vue', 'src', 'index.ts'),
    },
    {
      find: '@element-plus/motion',
      replacement: path.join(packagesRoot, 'motion', 'index.ts'),
    },
    {
      find: '@element-plus/wasm',
      replacement: path.join(packagesRoot, 'wasm', 'index.ts'),
    },
    {
      find: '@element-plus/theme-chalk/src',
      replacement: path.join(packagesRoot, 'theme-chalk', 'src'),
    },
  ]
}

async function buildSourceOrDistFixture(mode, tempDir) {
  const { build } = await import('vite')
  const { default: vue } = await import('@vitejs/plugin-vue')
  const { default: vueJsx } = await import('@vitejs/plugin-vue-jsx')

  const clientDistDir = path.join(tempDir, 'client')
  const serverDistDir = path.join(tempDir, 'server')
  const tempNodeModules = path.join(tempDir, 'node_modules')
  if (!existsSync(tempNodeModules)) {
    symlinkSync(
      path.join(repoRoot, 'node_modules'),
      tempNodeModules,
      'junction',
    )
  }
  const alias = createSourceAliases(mode)

  const sharedConfig = {
    root: fixtureSourceDir,
    configFile: false,
    logLevel: 'warn',
    plugins: [vue(), vueJsx()],
    worker: {
      format: 'es',
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: [
            'legacy-js-api',
            'global-builtin',
            'color-functions',
            'import',
          ],
        },
      },
    },
    resolve: {
      alias,
      dedupe: ['vue'],
    },
  }

  writeLine(`[consumer-contracts] Building client bundle (${mode})...`)
  await build({
    ...sharedConfig,
    build: {
      outDir: clientDistDir,
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input: {
          spa: path.join(fixtureSourceDir, 'index.html'),
          ssrClient: path.join(fixtureSourceDir, 'src', 'entry-ssr-client.ts'),
        },
      },
    },
  })

  writeLine(`[consumer-contracts] Building SSR server bundle (${mode})...`)
  await build({
    ...sharedConfig,
    ssr: {
      noExternal: [
        PACKAGE_NAME,
        /^@ozwasyd\/element-plus/,
        /^@element-plus\//,
        'lodash-unified',
      ],
    },
    build: {
      outDir: serverDistDir,
      emptyOutDir: true,
      ssr: path.join(fixtureSourceDir, 'src', 'entry-ssr-server.ts'),
      rollupOptions: {
        output: {
          format: 'esm',
          entryFileNames: 'entry-ssr-server.mjs',
        },
      },
    },
  })

  const sourcePkg = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'vue', 'packages', 'element-plus', 'package.json'),
      'utf8',
    ),
  )

  return {
    clientDistDir,
    serverEntryPath: path.join(serverDistDir, 'entry-ssr-server.mjs'),
    metadata: {
      mode,
      packageName: PACKAGE_NAME,
      packageVersion: sourcePkg.version,
      resolvedUrl: mode === 'dist' ? 'local:dist/element-plus' : 'local:workspace-source',
      integrity: 'local',
      tarballSha256: 'local',
    },
  }
}

async function buildPublishedFixture(version, tempDir) {
  const workDir = path.join(tempDir, 'published-consumer')
  mkdirSync(workDir, { recursive: true })
  cpSync(fixtureSourceDir, workDir, { recursive: true })

  const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  const consumerPackageJson = {
    name: 'fsusui-consumer-contract-published',
    private: true,
    type: 'module',
    dependencies: {
      [PACKAGE_NAME]: version,
      vue: rootPkg.devDependencies.vue,
    },
    devDependencies: {
      '@vitejs/plugin-vue': rootPkg.devDependencies['@vitejs/plugin-vue'],
      vite: rootPkg.devDependencies.vite,
    },
  }
  writeFileSync(
    path.join(workDir, 'package.json'),
    `${JSON.stringify(consumerPackageJson, null, 2)}\n`,
  )

  const viteConfigSource = `import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ isSsrBuild }) => ({
  root: rootDir,
  plugins: [vue()],
  worker: {
    format: 'es',
  },
  resolve: {
    dedupe: ['vue'],
  },
  ssr: {
    noExternal: ['${PACKAGE_NAME}', /^@ozwasyd\\/element-plus/, 'lodash-unified'],
  },
  build: isSsrBuild
    ? {
        outDir: path.join(rootDir, 'dist', 'server'),
        emptyOutDir: true,
        ssr: path.join(rootDir, 'src', 'entry-ssr-server.ts'),
        rollupOptions: {
          output: {
            format: 'esm',
            entryFileNames: 'entry-ssr-server.mjs',
          },
        },
      }
    : {
        outDir: path.join(rootDir, 'dist', 'client'),
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
          input: {
            spa: path.join(rootDir, 'index.html'),
            ssrClient: path.join(rootDir, 'src', 'entry-ssr-client.ts'),
          },
        },
      },
}))
`
  writeFileSync(path.join(workDir, 'vite.config.mjs'), viteConfigSource)

  writeLine(
    `[consumer-contracts] Installing ${PACKAGE_NAME}@${version} from ${REGISTRY_URL} into ${workDir}...`,
  )
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      `--registry=${REGISTRY_URL}`,
      '--prefer-online',
    ],
    {
      cwd: workDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NO_UPDATE_NOTIFIER: '1',
      },
    },
  )

  const installedPkgPath = path.join(
    workDir,
    'node_modules',
    ...PACKAGE_NAME.split('/'),
    'package.json',
  )
  if (!existsSync(installedPkgPath)) {
    throw new Error(`Published package failed to install at ${installedPkgPath}`)
  }
  const installedPkg = JSON.parse(readFileSync(installedPkgPath, 'utf8'))
  const lockfilePath = path.join(workDir, 'package-lock.json')
  const lockfile = existsSync(lockfilePath)
    ? JSON.parse(readFileSync(lockfilePath, 'utf8'))
    : {}
  const lockEntry =
    lockfile.packages?.[`node_modules/${PACKAGE_NAME}`] ?? {}
  const resolvedUrl = lockEntry.resolved || ''
  const integrity = lockEntry.integrity || ''

  if (!resolvedUrl.startsWith(REGISTRY_URL)) {
    throw new Error(
      `Refusing non-npmjs resolution for ${PACKAGE_NAME}@${version}: resolved="${resolvedUrl}"`,
    )
  }

  writeLine(`[consumer-contracts] Verifying published tarball SHA-256 from ${resolvedUrl}...`)
  const tarballSha256 = await downloadSha256(resolvedUrl)

  const viteBin = path.join(workDir, 'node_modules', '.bin', 'vite')
  writeLine('[consumer-contracts] Building published consumer client bundle...')
  execFileSync(viteBin, ['build', '--config', 'vite.config.mjs'], {
    cwd: workDir,
    stdio: 'inherit',
  })

  writeLine('[consumer-contracts] Building published consumer SSR server bundle...')
  execFileSync(viteBin, ['build', '--ssr', '--config', 'vite.config.mjs'], {
    cwd: workDir,
    stdio: 'inherit',
  })

  return {
    clientDistDir: path.join(workDir, 'dist', 'client'),
    serverEntryPath: path.join(workDir, 'dist', 'server', 'entry-ssr-server.mjs'),
    metadata: {
      mode: 'published',
      packageName: PACKAGE_NAME,
      packageVersion: installedPkg.version,
      resolvedUrl,
      integrity,
      tarballSha256,
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const specFiles = resolveSpecFiles(args.suite)
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-consumer-contracts-'),
  )
  let serverHandle = null

  try {
    const built =
      args.mode === 'published'
        ? await buildPublishedFixture(args.version, tempDir)
        : await buildSourceOrDistFixture(args.mode, tempDir)

    writeLine(
      `[consumer-contracts] Target metadata: ${JSON.stringify(built.metadata)}`,
    )

    serverHandle = await startContractServer({
      clientDistDir: built.clientDistDir,
      serverEntryPath: built.serverEntryPath,
      metadata: built.metadata,
    })

    writeLine(
      `[consumer-contracts] Server listening at ${serverHandle.baseUrl}; running ${specFiles.length} spec file(s)...`,
    )

    const playwrightBin = path.join(repoRoot, 'node_modules', '.bin', 'playwright')
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        playwrightBin,
        ['test', '--config', playwrightConfigPath, ...specFiles],
        {
          cwd: repoRoot,
          stdio: 'inherit',
          env: {
            ...process.env,
            CONSUMER_CONTRACT_BASE_URL: serverHandle.baseUrl,
            CONSUMER_CONTRACT_MODE: args.mode,
            CONSUMER_CONTRACT_VERSION: built.metadata.packageVersion,
          },
        },
      )
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (signal) {
          reject(new Error(`Playwright terminated by signal ${signal}`))
        } else {
          resolve(code ?? 1)
        }
      })
    })

    if (exitCode !== 0) {
      process.exitCode = exitCode
    }
  } finally {
    if (serverHandle) {
      await serverHandle.close()
    }
    if (!args.keepTemp) {
      const tempNodeModules = path.join(tempDir, 'node_modules')
      if (existsSync(tempNodeModules)) {
        try {
          unlinkSync(tempNodeModules)
        } catch {}
      }
      rmSync(tempDir, { recursive: true, force: true })
    } else {
      writeLine(`[consumer-contracts] Kept temporary directory: ${tempDir}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
