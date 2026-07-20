#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDefaultVisualRuntimeConfig,
  inspectVisualRuntime,
  prepareVisualRuntime,
} from './visual-runtime-core.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const check = args.includes('--check')
const runtimeOption = args.find((arg) => arg.startsWith('--runtime-dir='))
const runtimeRoot = runtimeOption?.slice('--runtime-dir='.length)
const config = createDefaultVisualRuntimeConfig(
  repositoryRoot,
  runtimeRoot || '.tmp/visual-runtime',
)

async function packageMetadata() {
  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'),
  )
  return {
    node: process.versions.node,
    playwright: packageJson.devDependencies?.['@playwright/test'] ?? 'unknown',
    pnpm: packageJson.packageManager ?? 'unknown',
  }
}

function buildGroup(group) {
  const [command, ...commandArgs] = group.command
  console.info(`[visual-runtime] command=${group.command.join(' ')}`)
  const result = spawnSync(command, commandArgs, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`command exited with ${result.status ?? 1}`)
  }
}

if (check) {
  const inspection = await inspectVisualRuntime(config)
  for (const group of inspection.groups) {
    console.info(
      `[visual-runtime] ${group.id} ${group.fresh ? 'ready' : 'invalid'}: ${
        group.reasons.join('; ') || 'fingerprints match'
      }`,
    )
  }
  if (!inspection.ready) process.exitCode = 1
} else {
  const result = await prepareVisualRuntime(config, {
    buildGroup,
    dryRun,
    tools: await packageMetadata(),
  })
  if (!dryRun) {
    console.info(
      `[visual-runtime] demo-dist=${result.manifest.paths.demoDist} source-fingerprint=${result.manifest.sourceFingerprint}`,
    )
  }
}
