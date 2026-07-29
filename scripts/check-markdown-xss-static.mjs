import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import {
  KILL_CONTROL_IDS,
  validateMarkdownXssCorpus,
} from './markdown-xss-corpus.mjs'

const root = resolve(import.meta.dirname, '..')
const mode = process.argv.includes('--artifacts') ? 'artifacts' : 'source'
const productionRoots = [
  'vue/packages/components',
  'vue/packages/element-plus',
  'vue/packages/wasm',
]
const forbiddenMarkers = [
  'markdown-xss-corpus',
  'markdown-xss-consumer-manifest',
  'mxss-raw-script-basic',
  ...KILL_CONTROL_IDS,
]
const ignoredSegments = new Set(['__tests__', 'node_modules'])
const walkFiles = async (path) => {
  try {
    if (!(await stat(path)).isDirectory()) return [path]
  } catch {
    return []
  }
  const files = []
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) continue
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(child)))
    else files.push(child)
  }
  return files
}

const assertNoTestAuthority = async (relativeRoot, requireArtifact = false) => {
  const absoluteRoot = resolve(root, relativeRoot)
  const files = await walkFiles(absoluteRoot)
  if (requireArtifact && files.length === 0) {
    throw new Error(
      `[markdown-xss] expected production artifact root ${relativeRoot}`,
    )
  }
  for (const file of files) {
    if (!/\.(?:[cm]?[jt]sx?|json|wasm)$/iu.test(file)) continue
    const content = await readFile(file)
    const text = file.endsWith('.wasm')
      ? content.toString('latin1')
      : content.toString('utf8')
    for (const marker of forbiddenMarkers) {
      if (text.includes(marker)) {
        throw new Error(
          `[markdown-xss] test-only marker ${marker} leaked into ${relative(root, file)}`,
        )
      }
    }
  }
}

const checkSourceAuthority = async () => {
  const { counts, digest, manifest } = await validateMarkdownXssCorpus()
  for (const path of productionRoots) await assertNoTestAuthority(path)

  const packageManifest = JSON.parse(
    await readFile(
      resolve(root, 'vue/packages/element-plus/package.json'),
      'utf8',
    ),
  )
  for (const exportPath of Object.keys(packageManifest.exports)) {
    if (/xss|security|corpus|test/iu.test(exportPath)) {
      throw new Error(
        `[markdown-xss] test-only package export detected: ${exportPath}`,
      )
    }
  }

  const rgFiles = (pattern, paths, globs = []) => {
    try {
      return execFileSync(
        'rg',
        ['-l', pattern, ...globs.flatMap((glob) => ['-g', glob]), ...paths],
        { cwd: root, encoding: 'utf8' },
      )
        .trim()
        .split('\n')
        .map((path) => path.replace(/^\.\//u, ''))
        .filter(Boolean)
    } catch (error) {
      if (error.status === 1) return []
      throw error
    }
  }
  const corpusOwners = rgFiles(
    '"id"\\s*:\\s*"mxss-',
    ['.'],
    ['*.json', '!node_modules/**', '!.tmp/**', '!dist/**'],
  ).filter((path) => {
    try {
      const parsed = JSON.parse(readFileSync(resolve(root, path), 'utf8'))
      return (
        Array.isArray(parsed?.cases) &&
        parsed.cases.some((entry) => /^mxss-/u.test(entry?.id ?? ''))
      )
    } catch {
      return false
    }
  })
  const securityPattern =
    '<script|onerror\\s*=|javascript\\s*:|foreignObject|srcdoc\\s*='
  const securityFiles = rgFiles(
    securityPattern,
    ['vue/packages', 'vue/tests/wasm'],
    ['*.js', '*.jsx', '*.mjs', '*.ts', '*.tsx'],
  )
  for (const relativeFile of securityFiles) {
    const content = await readFile(resolve(root, relativeFile), 'utf8')
    const securityMatches =
      content.match(
        /<script|onerror\s*=|javascript\s*:|foreignObject|srcdoc\s*=/giu,
      ) ?? []
    if (
      /markdown/iu.test(relativeFile) &&
      /(?:__tests__|vue\/tests\/wasm\/)/u.test(relativeFile) &&
      securityMatches.length >= 1 &&
      !content.includes('getMarkdownXss') &&
      relativeFile !== 'vue/tests/support/markdown-xss-kill-controls.ts'
    ) {
      throw new Error(
        `[markdown-xss] grouped security payloads must use corpus IDs: ${relativeFile}`,
      )
    }
  }
  const randomFiles = rgFiles('Math\\.random', [
    'scripts',
    'vue/tests',
    'vue/packages',
  ])
  for (const relativeFile of randomFiles) {
    if (
      /markdown-xss/iu.test(relativeFile) &&
      relativeFile !== 'scripts/check-markdown-xss-static.mjs'
    ) {
      throw new Error(
        `[markdown-xss] nondeterministic random source: ${relativeFile}`,
      )
    }
  }
  if (
    corpusOwners.length !== 1 ||
    corpusOwners[0] !== 'spec/security/markdown-xss-corpus.json'
  ) {
    throw new Error(
      `[markdown-xss] expected one authoritative corpus, found ${JSON.stringify(
        corpusOwners,
      )}`,
    )
  }
  console.log(
    `[markdown-xss] source OK cases=${manifest.caseCount} categories=${JSON.stringify(
      counts,
    )} sha256=${digest}`,
  )
}

const checkArtifacts = async () => {
  const manifestFile = resolve(
    root,
    '.tmp/markdown-xss-production-artifacts/manifest.json',
  )
  let artifactManifest
  try {
    artifactManifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  } catch {
    throw new Error('[markdown-xss] production artifact manifest is missing')
  }
  const fingerprint = createHash('sha256')
  for (const path of artifactManifest.fingerprintInputs) {
    fingerprint.update(path)
    fingerprint.update(await readFile(resolve(root, path)))
  }
  const currentFingerprint = fingerprint.digest('hex')
  if (artifactManifest.sourceFingerprint !== currentFingerprint) {
    throw new Error('[markdown-xss] production artifact fingerprint is stale')
  }
  const requiredArtifacts = [
    'vue/packages/wasm/dist/index.mjs',
    'vue/packages/wasm/dist/index.cjs',
    'vue/packages/wasm/dist/markdown_basic.js',
    'vue/packages/wasm/dist/markdown_basic.wasm',
    'vue/packages/wasm/dist/markdown_simd.js',
    'vue/packages/wasm/dist/markdown_simd.wasm',
    ...artifactManifest.browserFiles,
  ]
  for (const path of requiredArtifacts) {
    const info = await stat(resolve(root, path)).catch(() => null)
    if (!info?.isFile() || info.size === 0) {
      throw new Error(
        `[markdown-xss] required production artifact missing: ${path}`,
      )
    }
  }
  for (const path of requiredArtifacts) {
    const content = await readFile(resolve(root, path))
    const text = path.endsWith('.wasm')
      ? content.toString('latin1')
      : content.toString('utf8')
    if (
      /index\.(?:mjs|cjs)$/u.test(path) &&
      (text.includes('createJiti') || text.includes('unbuild'))
    ) {
      throw new Error(
        `[markdown-xss] stub artifact is not a production proof: ${path}`,
      )
    }
    for (const marker of forbiddenMarkers) {
      if (text.includes(marker)) {
        throw new Error(
          `[markdown-xss] test-only marker ${marker} leaked into ${path}`,
        )
      }
    }
  }
  console.log(
    `[markdown-xss] artifacts OK fingerprint=${currentFingerprint.slice(
      0,
      16,
    )} esm=1 cjs=1 browser=${artifactManifest.browserFiles.length} wasm=4`,
  )
}

if (mode === 'artifacts') await checkArtifacts()
else await checkSourceAuthority()
