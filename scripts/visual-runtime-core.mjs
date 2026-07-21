import { createHash } from 'node:crypto'
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const VISUAL_RUNTIME_SCHEMA_VERSION = 1

export async function readVisualRuntimeTools(repositoryRoot) {
  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'),
  )
  let playwright =
    packageJson.devDependencies?.['@playwright/test'] ?? 'unknown'
  try {
    playwright = JSON.parse(
      await readFile(
        resolve(repositoryRoot, 'node_modules/@playwright/test/package.json'),
        'utf8',
      ),
    ).version
  } catch {}
  return {
    node: process.versions.node,
    playwright,
    pnpm: packageJson.packageManager ?? 'unknown',
  }
}

const ignoredDirectoryNames = new Set([
  '.git',
  '.tmp',
  '.vite',
  'dist',
  'node_modules',
])

const posixPath = (value) => value.replaceAll('\\', '/')

async function pathState(file) {
  try {
    return await lstat(file)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function collectPathEntries(base, target, label, entries, missing) {
  const state = await pathState(target)
  if (!state) {
    missing.push(label)
    entries.push({ kind: 'missing', label })
    return
  }

  if (state.isSymbolicLink()) {
    entries.push({ kind: 'link', label, value: await readlink(target) })
    return
  }
  if (state.isFile()) {
    entries.push({ kind: 'file', label, value: await readFile(target) })
    return
  }
  if (!state.isDirectory()) {
    entries.push({ kind: 'other', label })
    return
  }

  entries.push({ kind: 'directory', label })
  const children = (await readdir(target, { withFileTypes: true }))
    .filter(
      (entry) => !entry.isDirectory() || !ignoredDirectoryNames.has(entry.name),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
  for (const child of children) {
    const childTarget = join(target, child.name)
    const childLabel = posixPath(join(label, child.name))
    await collectPathEntries(base, childTarget, childLabel, entries, missing)
  }
}

export async function fingerprintPaths(base, paths) {
  const entries = []
  const missing = []
  for (const path of [...paths].sort()) {
    const target = isAbsolute(path) ? path : resolve(base, path)
    const label = isAbsolute(path) ? posixPath(relative(base, path)) : path
    await collectPathEntries(base, target, posixPath(label), entries, missing)
  }

  const hash = createHash('sha256')
  for (const entry of entries) {
    hash.update(entry.kind)
    hash.update('\0')
    hash.update(entry.label)
    hash.update('\0')
    if (entry.value !== undefined) hash.update(entry.value)
    hash.update('\0')
  }

  return { fingerprint: hash.digest('hex'), missing }
}

const hashJson = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

function normalizedGroup(config, group) {
  return {
    ...group,
    inputPaths: [...group.inputPaths].map(posixPath).sort(),
    runtimePath: posixPath(group.runtimePath),
    sourceArtifactPath: posixPath(group.sourceArtifactPath),
  }
}

function normalizeConfig(config) {
  const repositoryRoot = resolve(config.repositoryRoot)
  const runtimeRoot = resolve(repositoryRoot, config.runtimeRoot)
  const groups = config.groups.map((group) => normalizedGroup(config, group))
  return { ...config, groups, repositoryRoot, runtimeRoot }
}

function configurationFingerprint(config) {
  return hashJson({
    groups: config.groups.map((group) => ({
      command: group.command,
      id: group.id,
      inputPaths: group.inputPaths,
      runtimePath: group.runtimePath,
      sourceArtifactPath: group.sourceArtifactPath,
    })),
    schemaVersion: VISUAL_RUNTIME_SCHEMA_VERSION,
  })
}

function combinedSourceFingerprint(groups) {
  return hashJson(
    groups.map((group) => ({
      id: group.id,
      sourceFingerprint: group.sourceFingerprint,
    })),
  )
}

async function readManifest(manifestPath) {
  try {
    return { manifest: JSON.parse(await readFile(manifestPath, 'utf8')) }
  } catch (error) {
    if (error?.code === 'ENOENT')
      return { error: 'runtime manifest is missing' }
    if (error instanceof SyntaxError) {
      return { error: 'runtime manifest is invalid JSON' }
    }
    throw error
  }
}

async function readText(file) {
  try {
    return (await readFile(file, 'utf8')).trim()
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function inspectVisualRuntime(rawConfig) {
  const config = normalizeConfig(rawConfig)
  const manifestPath = join(config.runtimeRoot, 'manifest.json')
  const manifestResult = await readManifest(manifestPath)
  const manifest = manifestResult.manifest
  const expectedConfigurationFingerprint = configurationFingerprint(config)
  const globalReasons = []

  if (manifestResult.error) globalReasons.push(manifestResult.error)
  if (manifest && manifest.schemaVersion !== VISUAL_RUNTIME_SCHEMA_VERSION) {
    globalReasons.push(
      `runtime manifest schema mismatch: expected ${VISUAL_RUNTIME_SCHEMA_VERSION}, received ${manifest.schemaVersion}`,
    )
  }
  if (
    manifest &&
    manifest.configurationFingerprint !== expectedConfigurationFingerprint
  ) {
    globalReasons.push('runtime manifest configuration fingerprint mismatch')
  }
  if (
    manifest &&
    config.tools &&
    JSON.stringify(manifest.tools) !== JSON.stringify(config.tools)
  ) {
    globalReasons.push('runtime manifest tool versions mismatch')
  }

  const groups = []
  for (const group of config.groups) {
    const source = await fingerprintPaths(
      config.repositoryRoot,
      group.inputPaths,
    )
    const reasons = [...globalReasons]
    const manifestGroup = manifest?.groups?.[group.id]
    const runtimePath = resolve(config.runtimeRoot, group.runtimePath)
    const runtimeState = await pathState(runtimePath)
    const fingerprintPath = join(
      config.runtimeRoot,
      'fingerprints',
      `${group.id}.sha256`,
    )

    if (source.missing.length > 0) {
      reasons.push(`missing ${group.id} inputs: ${source.missing.join(', ')}`)
    }
    if (!manifestGroup) {
      reasons.push(`${group.id} manifest entry is missing`)
    } else if (manifestGroup.sourceFingerprint !== source.fingerprint) {
      reasons.push(`${group.id} source fingerprint changed`)
    }
    if (!runtimeState?.isDirectory()) {
      reasons.push(`${group.id} runtime output is missing`)
    }

    let artifactFingerprint = null
    if (runtimeState?.isDirectory()) {
      artifactFingerprint = (
        await fingerprintPaths(config.runtimeRoot, [group.runtimePath])
      ).fingerprint
      if (
        manifestGroup?.artifactFingerprint &&
        manifestGroup.artifactFingerprint !== artifactFingerprint
      ) {
        reasons.push(`${group.id} runtime artifact fingerprint mismatch`)
      }
    }

    const recordedFingerprint = await readText(fingerprintPath)
    if (recordedFingerprint === null) {
      reasons.push(`${group.id} runtime fingerprint file is missing`)
    } else if (
      artifactFingerprint &&
      recordedFingerprint !== artifactFingerprint
    ) {
      reasons.push(`${group.id} runtime fingerprint file mismatch`)
    }

    groups.push({
      ...group,
      artifactFingerprint,
      fingerprintPath,
      fresh: reasons.length === 0,
      reasons: [...new Set(reasons)],
      runtimeAbsolutePath: runtimePath,
      sourceFingerprint: source.fingerprint,
    })
  }

  return {
    configurationFingerprint: expectedConfigurationFingerprint,
    groups,
    manifest,
    manifestPath,
    ready: groups.every((group) => group.fresh),
    reasons: [...new Set(groups.flatMap((group) => group.reasons))],
    repositoryRoot: config.repositoryRoot,
    runtimeRoot: config.runtimeRoot,
    sourceFingerprint: combinedSourceFingerprint(groups),
  }
}

async function writeRuntimeGroup(config, group) {
  const sourcePath = resolve(config.repositoryRoot, group.sourceArtifactPath)
  const sourceState = await pathState(sourcePath)
  if (!sourceState?.isDirectory()) {
    throw new Error(
      `${group.id} preparation did not produce ${group.sourceArtifactPath}`,
    )
  }

  const runtimePath = resolve(config.runtimeRoot, group.runtimePath)
  await rm(runtimePath, { force: true, recursive: true })
  await mkdir(dirname(runtimePath), { recursive: true })
  await cp(sourcePath, runtimePath, { recursive: true })
  const artifactFingerprint = (
    await fingerprintPaths(config.runtimeRoot, [group.runtimePath])
  ).fingerprint
  const fingerprintPath = join(
    config.runtimeRoot,
    'fingerprints',
    `${group.id}.sha256`,
  )
  await mkdir(dirname(fingerprintPath), { recursive: true })
  await writeFile(fingerprintPath, `${artifactFingerprint}\n`)
  return artifactFingerprint
}

export async function prepareVisualRuntime(rawConfig, options = {}) {
  const config = normalizeConfig(rawConfig)
  const logger = options.logger ?? console
  const before = await inspectVisualRuntime(config)
  const actions = before.groups.map((group) => ({
    id: group.id,
    reasons: group.reasons,
    state: group.fresh ? 'reuse' : 'rebuild',
  }))

  for (const action of actions) {
    logger.info(
      `[visual-runtime] ${action.id} ${action.state}: ${
        action.reasons.join('; ') || 'fingerprints match'
      }`,
    )
  }
  if (options.dryRun) {
    logger.info('[visual-runtime] dry-run: no commands or writes performed')
    return { actions, inspection: before, manifest: before.manifest }
  }

  const artifactFingerprints = new Map()
  for (const group of before.groups) {
    if (group.fresh) {
      artifactFingerprints.set(group.id, group.artifactFingerprint)
      continue
    }

    try {
      await options.buildGroup(group)
    } catch (error) {
      const fallback = group.command?.join(' ') ?? `prepare ${group.id}`
      throw new Error(
        `${group.id} runtime preparation failed: ${
          error instanceof Error ? error.message : String(error)
        }. Local fallback: ${fallback}`,
        { cause: error },
      )
    }
    artifactFingerprints.set(group.id, await writeRuntimeGroup(config, group))
  }

  const groupRecords = Object.fromEntries(
    before.groups.map((group) => [
      group.id,
      {
        artifactFingerprint: artifactFingerprints.get(group.id),
        runtimePath: group.runtimePath,
        sourceFingerprint: group.sourceFingerprint,
      },
    ]),
  )
  const demoGroup = before.groups.find((group) => group.id === 'demo')
  const manifest = {
    configurationFingerprint: before.configurationFingerprint,
    createdAt: (options.clock ?? (() => new Date()))().toISOString(),
    groups: groupRecords,
    paths: {
      demoDist: demoGroup?.runtimePath ?? 'demo-dist',
      runtimeRoot: posixPath(
        relative(config.repositoryRoot, config.runtimeRoot),
      ),
    },
    readiness: {
      groups: before.groups.map((group) => group.id),
      ready: true,
    },
    schemaVersion: VISUAL_RUNTIME_SCHEMA_VERSION,
    sourceFingerprint: before.sourceFingerprint,
    tools: options.tools ?? config.tools ?? {},
  }
  await mkdir(config.runtimeRoot, { recursive: true })
  const manifestPath = join(config.runtimeRoot, 'manifest.json')
  const temporaryManifestPath = `${manifestPath}.new`
  await writeFile(
    temporaryManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  await rename(temporaryManifestPath, manifestPath)

  const inspection = await inspectVisualRuntime(config)
  if (!inspection.ready) {
    throw new Error(
      `visual runtime failed readiness validation: ${inspection.reasons.join('; ')}`,
    )
  }
  logger.info(
    `[visual-runtime] ready manifest=${posixPath(relative(config.repositoryRoot, manifestPath))}`,
  )
  return { actions, inspection, manifest }
}

export function createDefaultVisualRuntimeConfig(
  repositoryRoot,
  runtimeRoot = '.tmp/visual-runtime',
) {
  return {
    groups: [
      {
        command: ['pnpm', 'run', 'ensure:icons'],
        id: 'icons',
        inputPaths: [
          'vue/packages/icons-vue/package.json',
          'vue/packages/icons-vue/src',
          'vue/packages/icons-vue/build',
          'scripts/ensure-icons-artifacts.mjs',
          'scripts/test-artifact-cache.mjs',
        ],
        runtimePath: 'artifacts/icons',
        sourceArtifactPath: 'vue/packages/icons-vue/dist',
      },
      {
        command: ['pnpm', 'run', 'ensure:wasm'],
        id: 'wasm',
        inputPaths: [
          'vue/packages/wasm/package.json',
          'vue/packages/wasm/build.config.ts',
          'vue/packages/wasm/index.ts',
          'vue/packages/wasm/markdown.ts',
          'vue/packages/wasm/markdown-runtime.ts',
          'vue/packages/wasm/runtime',
          'vue/packages/wasm/src',
          'vue/packages/wasm/markdown',
          'scripts/ensure-wasm-artifacts.mjs',
          'scripts/run-wasm-build.mjs',
          'scripts/test-artifact-cache.mjs',
        ],
        runtimePath: 'artifacts/wasm',
        sourceArtifactPath: 'vue/packages/wasm/dist',
      },
      {
        command: ['pnpm', 'run', '-C', 'vue/packages/demo-app', 'build'],
        id: 'demo',
        inputPaths: [
          'package.json',
          'pnpm-lock.yaml',
          'scripts/vite-manual-chunks.mjs',
          'vue/tsconfig.base.json',
          // The preview bundle resolves workspace package sources directly.
          // Fingerprint every package source, not only the Demo app shell, so
          // component and theme changes cannot reuse a stale visual runtime.
          'vue/packages',
        ],
        runtimePath: 'demo-dist',
        sourceArtifactPath: 'vue/packages/demo-app/dist',
      },
    ],
    repositoryRoot,
    runtimeRoot,
  }
}
