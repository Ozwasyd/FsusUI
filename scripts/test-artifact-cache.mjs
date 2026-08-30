import { constants } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const posixPath = (value) => value.replaceAll('\\', '/')

const resolveArtifact = (file, baseRoot = root) => resolve(baseRoot, file)

const iconArtifactFiles = [
  'vue/packages/icons-vue/dist/index.js',
  'vue/packages/icons-vue/dist/index.cjs',
  'vue/packages/icons-vue/dist/global.js',
  'vue/packages/icons-vue/dist/types/index.d.ts',
]

const wasmBundleArtifacts = [
  'vue/packages/wasm/dist/index.mjs',
  'vue/packages/wasm/dist/index.cjs',
  'vue/packages/wasm/dist/index.d.ts',
  'vue/packages/wasm/dist/index.d.mts',
  'vue/packages/wasm/dist/index.d.cts',
]

const wasmNativeArtifacts = [
  'vue/packages/wasm/dist/ep_wasm.mjs',
  'vue/packages/wasm/dist/ep_wasm.wasm',
  'vue/packages/wasm/dist/markdown_basic.js',
  'vue/packages/wasm/dist/markdown_basic.wasm',
  'vue/packages/wasm/dist/markdown_simd.js',
  'vue/packages/wasm/dist/markdown_simd.wasm',
]

export const artifactGroups = {
  icons: {
    id: 'icons',
    label: 'icons-vue',
    scriptName: 'ensure:icons',
    scriptPath: 'scripts/ensure-icons-artifacts.mjs',
    artifactsPath: 'vue/packages/icons-vue/dist',
    fingerprints: [
      {
        id: 'icons',
        fingerprintPath: 'vue/packages/icons-vue/dist/.artifact-fingerprint',
        artifactFiles: iconArtifactFiles,
        inputPatterns: [
          'vue/packages/icons-vue/package.json',
          'vue/packages/icons-vue/src/**/*',
          'vue/packages/icons-vue/build/**/*',
          'scripts/ensure-icons-artifacts.mjs',
          'scripts/prepare-test-artifacts.mjs',
          'scripts/test-artifact-cache.mjs',
        ],
      },
    ],
  },
  wasm: {
    id: 'wasm',
    label: 'wasm',
    scriptName: 'ensure:wasm',
    scriptPath: 'scripts/ensure-wasm-artifacts.mjs',
    artifactsPath: 'vue/packages/wasm/dist',
    fingerprints: [
      {
        id: 'bundle',
        fingerprintPath: 'vue/packages/wasm/dist/.artifact-fingerprint',
        artifactFiles: wasmBundleArtifacts,
        inputPatterns: [
          'vue/packages/wasm/package.json',
          'vue/packages/wasm/build.config.ts',
          'vue/packages/wasm/index.ts',
          'vue/packages/wasm/markdown.ts',
          'vue/packages/wasm/markdown-feature-output-gateway.ts',
          'vue/packages/wasm/markdown-runtime.ts',
          'vue/packages/wasm/runtime/**/*.ts',
          'scripts/ensure-wasm-artifacts.mjs',
          'scripts/prepare-test-artifacts.mjs',
          'scripts/test-artifact-cache.mjs',
        ],
      },
      {
        id: 'native',
        fingerprintPath: 'vue/packages/wasm/dist/.native-artifact-fingerprint',
        artifactFiles: wasmNativeArtifacts,
        inputPatterns: [
          'vue/packages/wasm/build.sh',
          'vue/packages/wasm/CMakeLists.txt',
          'vue/packages/wasm/markdown/CMakeLists.txt',
          'vue/packages/wasm/markdown/include/**/*',
          'vue/packages/wasm/markdown/src/**/*',
          'vue/packages/wasm/src/**/*',
          'scripts/ensure-wasm-artifacts.mjs',
          'scripts/run-wasm-build.mjs',
          'scripts/prepare-test-artifacts.mjs',
          'scripts/test-artifact-cache.mjs',
        ],
      },
    ],
  },
}

export function toRelativePath(file) {
  return posixPath(relative(root, file))
}

export async function exists(file) {
  try {
    await access(file, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function expandInputPatterns(patterns, baseRoot = root) {
  const files = await fg(patterns, {
    cwd: baseRoot,
    dot: true,
    ignore: [
      '**/node_modules/**',
      'vue/packages/icons-vue/dist/**',
      'vue/packages/wasm/build/**',
      'vue/packages/wasm/dist/**',
    ],
    onlyFiles: true,
    unique: true,
  })

  return files.map(posixPath).sort()
}

export async function hashInputPatterns(patterns, baseRoot = root) {
  const files = await expandInputPatterns(patterns, baseRoot)
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update('\0')
    hash.update(await readFile(resolve(baseRoot, file)))
    hash.update('\0')
  }
  return {
    files,
    hash: hash.digest('hex'),
  }
}

export async function readFingerprint(relativePath, baseRoot = root) {
  try {
    const value = (
      await readFile(resolve(baseRoot, relativePath), 'utf8')
    ).trim()
    try {
      const parsed = JSON.parse(value)
      if (
        parsed?.schemaVersion === 1 &&
        typeof parsed.sourceFingerprint === 'string' &&
        typeof parsed.artifactFingerprint === 'string'
      ) {
        return parsed
      }
    } catch {
      // Legacy fingerprints contained only the source hash.
    }
    return {
      schemaVersion: 0,
      sourceFingerprint: value,
      artifactFingerprint: null,
    }
  } catch {
    return null
  }
}

export async function writeFingerprint(fingerprint, baseRoot = root) {
  const artifactFingerprint = await hashArtifactFiles(
    fingerprint.artifactFiles,
    baseRoot,
  )
  if (artifactFingerprint === null) {
    throw new Error(
      `Cannot write ${fingerprint.id} fingerprint with missing artifacts.`,
    )
  }

  const file = resolve(baseRoot, fingerprint.fingerprintPath)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(
    file,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceFingerprint: fingerprint.currentFingerprint,
        artifactFingerprint,
      },
      null,
      2,
    )}\n`,
  )
}

export async function getMissingArtifacts(artifactFiles, baseRoot = root) {
  const missing = []
  for (const file of artifactFiles) {
    const absolute = resolveArtifact(file, baseRoot)
    if (!(await exists(absolute))) missing.push(absolute)
  }
  return missing
}

export async function hashArtifactFiles(artifactFiles, baseRoot = root) {
  if ((await getMissingArtifacts(artifactFiles, baseRoot)).length > 0) {
    return null
  }

  const hash = createHash('sha256')
  for (const file of [...artifactFiles].sort()) {
    hash.update(posixPath(file))
    hash.update('\0')
    hash.update(await readFile(resolveArtifact(file, baseRoot)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export async function inspectFingerprint(fingerprint, baseRoot = root) {
  const { files, hash } = await hashInputPatterns(
    fingerprint.inputPatterns,
    baseRoot,
  )
  const cached = await readFingerprint(fingerprint.fingerprintPath, baseRoot)
  const cachedFingerprint = cached?.sourceFingerprint ?? null
  const cachedArtifactFingerprint = cached?.artifactFingerprint ?? null
  const missingArtifacts = await getMissingArtifacts(
    fingerprint.artifactFiles,
    baseRoot,
  )
  const currentArtifactFingerprint = await hashArtifactFiles(
    fingerprint.artifactFiles,
    baseRoot,
  )
  const staleReasons = []

  if (missingArtifacts.length > 0) {
    staleReasons.push(
      `missing ${fingerprint.id} artifacts: ${missingArtifacts
        .map(toRelativePath)
        .join(', ')}`,
    )
  }

  if (cachedFingerprint === null) {
    staleReasons.push(`${fingerprint.id} artifact fingerprint is missing`)
  } else if (cachedFingerprint !== hash) {
    staleReasons.push(`${fingerprint.id} artifact fingerprint changed`)
  }
  if (cachedFingerprint !== null && cachedArtifactFingerprint === null) {
    staleReasons.push(
      `${fingerprint.id} artifact integrity fingerprint is missing`,
    )
  } else if (
    currentArtifactFingerprint !== null &&
    cachedArtifactFingerprint !== currentArtifactFingerprint
  ) {
    staleReasons.push(`${fingerprint.id} artifact contents changed`)
  }

  return {
    id: fingerprint.id,
    fingerprintPath: fingerprint.fingerprintPath,
    artifactFiles: fingerprint.artifactFiles,
    files,
    currentFingerprint: hash,
    cachedFingerprint,
    currentArtifactFingerprint,
    cachedArtifactFingerprint,
    missingArtifacts,
    staleReasons,
    fresh: staleReasons.length === 0,
  }
}

export async function inspectArtifactGroup(group, baseRoot = root) {
  const fingerprints = []
  for (const fingerprint of group.fingerprints) {
    fingerprints.push(await inspectFingerprint(fingerprint, baseRoot))
  }

  const sourceHash = createHash('sha256')
  for (const fingerprint of fingerprints) {
    sourceHash.update(fingerprint.id)
    sourceHash.update('\0')
    sourceHash.update(fingerprint.currentFingerprint)
    sourceHash.update('\0')
  }

  const staleReasons = fingerprints.flatMap(
    (fingerprint) => fingerprint.staleReasons,
  )

  return {
    id: group.id,
    sourceHash: sourceHash.digest('hex'),
    fingerprints,
    staleReasons,
    fresh: staleReasons.length === 0,
  }
}
