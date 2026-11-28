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
import { fileURLToPath, URL } from 'node:url'
import { startContractServer } from './server.mjs'

const REGISTRY_URL = 'https://npm.pkg.github.com/'
const REGISTRY_HOST = 'npm.pkg.github.com'
const PACKAGE_NAME = '@ozwasyd/fsusui'
const PACKAGE_SCOPE = '@ozwasyd'
const SUITE_SPECS = {
  core: '01-core-and-dropdown.spec.ts',
  overlays: '02-overlays-and-image-viewer.spec.ts',
  ssr: '03-ssr-hydration-and-csp.spec.ts',
  markdown: '04-wasm-and-markdown-worker.spec.ts',
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
    reportOut: '',
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
    } else if (arg === '--report-out') {
      parsed.reportOut = argv[++i] || ''
    } else if (arg.startsWith('--report-out=')) {
      parsed.reportOut = arg.slice('--report-out='.length)
    } else if (arg === '--keep-temp') {
      parsed.keepTemp = true
    } else if (arg === '--help' || arg === '-h') {
      writeLine(
        [
          'Usage: node tests/consumer-contracts/run-consumer-contracts.mjs [options]',
          '',
          'Options:',
          '  --mode <source|dist|published>  Target package mode (default: source)',
          '  --version <ver>                 Published package version (required for --mode published)',
          '  --suite <all|core|overlays|ssr> Suite(s) to run, comma-separated (default: all)',
          '  --report-out <path>             Write structured run metadata JSON to <path>',
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

function downloadSha256(url, authToken = '') {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const headers =
      authToken && parsedUrl.hostname === REGISTRY_HOST
        ? { Authorization: `Bearer ${authToken}` }
        : {}
    const request = https.get(url, { headers }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume()
        downloadSha256(
          new URL(response.headers.location, url).href,
          authToken,
        ).then(resolve, reject)
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
    const distRoot = path.join(repoRoot, 'dist', 'fsusui')
    if (!existsSync(path.join(distRoot, 'dist', 'index.mjs'))) {
      throw new Error(
        `Built package not found at ${distRoot}. Run "pnpm run build:npm-package" first or use --mode source.`,
      )
    }
    return [
      {
        find: `${PACKAGE_NAME}/styles/fsus.css`,
        replacement: path.join(distRoot, 'dist', 'styles', 'fsus.css'),
      },
      {
        find: `${PACKAGE_NAME}/styles/markdown.css`,
        replacement: path.join(distRoot, 'dist', 'styles', 'markdown.css'),
      },
      {
        find: `${PACKAGE_NAME}/icons`,
        replacement: path.join(distRoot, 'dist', 'icons.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/locale`,
        replacement: path.join(distRoot, 'dist', 'locale.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/core`,
        replacement: path.join(distRoot, 'dist', 'core.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/markdown`,
        replacement: path.join(distRoot, 'dist', 'markdown.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/wasm`,
        replacement: path.join(distRoot, 'dist', 'wasm.mjs'),
      },
      {
        find: `${PACKAGE_NAME}/render-pipeline`,
        replacement: path.join(distRoot, 'dist', 'render-pipeline.mjs'),
      },
      {
        find: new RegExp(`^${PACKAGE_NAME.replace('/', '\\/')}$`),
        replacement: path.join(distRoot, 'dist', 'index.mjs'),
      },
    ]
  }

  const packagesRoot = path.join(repoRoot, 'vue', 'packages')
  return [
    {
      find: `${PACKAGE_NAME}/styles/fsus.css`,
      replacement: path.join(packagesRoot, 'theme', 'src', 'fsus.scss'),
    },
    {
      find: `${PACKAGE_NAME}/styles/markdown.css`,
      replacement: path.join(packagesRoot, 'theme', 'src', 'markdown.scss'),
    },
    {
      find: `${PACKAGE_NAME}/icons`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'icons.ts'),
    },
    {
      find: `${PACKAGE_NAME}/locale`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'locale.ts'),
    },
    {
      find: `${PACKAGE_NAME}/core`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'core.ts'),
    },
    {
      find: `${PACKAGE_NAME}/markdown`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'markdown.ts'),
    },
    {
      find: `${PACKAGE_NAME}/wasm`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'wasm.ts'),
    },
    {
      find: `${PACKAGE_NAME}/render-pipeline`,
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'render-pipeline.ts'),
    },
    {
      find: new RegExp(`^${PACKAGE_NAME.replace('/', '\\/')}$`),
      replacement: path.join(packagesRoot, 'fsusui', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/components',
      replacement: path.join(packagesRoot, 'components', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/core',
      replacement: path.join(packagesRoot, 'core', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/icons',
      replacement: path.join(packagesRoot, 'icons', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/motion',
      replacement: path.join(packagesRoot, 'motion', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/markdown',
      replacement: path.join(packagesRoot, 'markdown', 'src', 'index.ts'),
    },
    {
      find: '@fsusui/wasm',
      replacement: path.join(packagesRoot, 'wasm', 'index.ts'),
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
    resolve: {
      alias,
      dedupe: ['vue'],
    },
  }

  writeLine(`[consumer-contracts] Building client and SSR server bundles in parallel (${mode})...`)
  await Promise.all([
    build({
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
    }),
    build({
      ...sharedConfig,
      ssr: {
        noExternal: [
          PACKAGE_NAME,
          /^@ozwasyd\/fsusui/,
          /^@fsusui\//,
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
    }),
  ])

  const sourcePkg = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'vue', 'packages', 'fsusui', 'package.json'),
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
      resolvedUrl: mode === 'dist' ? 'local:dist/fsusui' : 'local:workspace-source',
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
    noExternal: ['${PACKAGE_NAME}', /^@ozwasyd\\/fsusui/],
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

  const authToken = process.env.NODE_AUTH_TOKEN?.trim() || ''
  if (!authToken) {
    throw new Error(
      `NODE_AUTH_TOKEN (with read:packages scope) is required to install ${PACKAGE_NAME}@${version} from ${REGISTRY_URL}.`,
    )
  }

  writeFileSync(
    path.join(workDir, '.npmrc'),
    `${PACKAGE_SCOPE}:registry=${REGISTRY_URL}\n//${REGISTRY_HOST}/:_authToken=\${NODE_AUTH_TOKEN}\n`,
  )

  writeLine(
    `[consumer-contracts] Installing ${PACKAGE_NAME}@${version} from ${REGISTRY_URL} into ${workDir}...`,
  )
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--prefer-online',
    ],
    {
      cwd: workDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_AUTH_TOKEN: authToken,
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
      `Refusing non-GitHub-Packages resolution for ${PACKAGE_NAME}@${version}: resolved="${resolvedUrl}"`,
    )
  }

  const runViteBuild = (label, args) =>
    new Promise((resolve, reject) => {
      const child = spawn(viteBin, args, {
        cwd: workDir,
        stdio: 'inherit',
      })
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (signal) reject(new Error(`${label} terminated by signal ${signal}`))
        else if (code !== 0) reject(new Error(`${label} failed with exit code ${code}`))
        else resolve()
      })
    })

  const viteBin = path.join(workDir, 'node_modules', '.bin', 'vite')
  writeLine(
    `[consumer-contracts] Verifying published tarball SHA-256 and building client + SSR bundles in parallel...`,
  )
  const [tarballSha256] = await Promise.all([
    downloadSha256(resolvedUrl, authToken),
    runViteBuild('published client build', ['build', '--config', 'vite.config.mjs']),
    runViteBuild('published SSR build', [
      'build',
      '--config',
      'vite.config.mjs',
      '--ssr',
      'src/entry-ssr-server.ts',
    ]),
  ])

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

    if (args.reportOut) {
      const reportPath = path.resolve(repoRoot, args.reportOut)
      mkdirSync(path.dirname(reportPath), { recursive: true })
      writeFileSync(
        reportPath,
        `${JSON.stringify(
          {
            ...built.metadata,
            exitCode,
            suite: args.suite,
            specCount: specFiles.length,
            completedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      )
    }

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
