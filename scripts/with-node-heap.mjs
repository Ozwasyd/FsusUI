#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  countUnitTestFiles,
  formatCapacitySummary,
  resolveCapacityPlan,
  resolveNodeHeapMiB,
} from './ci-capacity.mjs'

const [, , rawCommand, ...rawArgs] = process.argv
const command = rawCommand === '--' ? rawArgs.shift() : rawCommand
const args = rawCommand === '--' ? rawArgs : rawArgs

if (!command) {
  console.error('Usage: node ./scripts/with-node-heap.mjs <command> [...args]')
  process.exit(1)
}

const disabled = /^(0|false|off|disabled)$/i.test(
  process.env.FSUS_NODE_HEAP ?? '',
)

const readPositiveInteger = (value, fallback) => {
  if (value == null || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const optionExists = (
  nodeOptions,
  dashedName,
  underscoredName = dashedName,
) => {
  const pattern = new RegExp(
    `(?:^|\\s)--(?:${dashedName}|${underscoredName})(?:=|\\s|$)`,
  )
  return pattern.test(nodeOptions)
}

const inferHeapProfile = () => {
  const requested = process.env.FSUS_NODE_HEAP_PROFILE
  if (requested && requested !== 'auto') return requested
  const invocation = [command, ...args].join(' ').toLowerCase()
  if (invocation.includes('coverage')) return 'coverage'
  if (invocation.includes('playwright') || invocation.includes('visual'))
    return 'visual'
  if (invocation.includes('typecheck') || invocation.includes('vue-tsc'))
    return 'typecheck'
  if (invocation.includes('build') || invocation.includes('rollup'))
    return 'build'
  if (invocation.includes('vitest') || invocation.includes('test:unit'))
    return 'unit'
  return requested === 'auto' ? 'auto' : 'small'
}

const buildNodeOptions = () => {
  const existing = process.env.NODE_OPTIONS?.trim() ?? ''
  if (disabled) return existing

  const options = existing ? [existing] : []
  const capacityPlan = resolveCapacityPlan({
    unitTestFileCount: countUnitTestFiles(),
  })
  const heapProfile = inferHeapProfile()
  const oldSpaceMb = resolveNodeHeapMiB(capacityPlan, heapProfile)
  const semiSpaceMb = readPositiveInteger(
    process.env.FSUS_NODE_SEMI_SPACE_MB,
    Math.max(16, Math.min(64, Math.floor(oldSpaceMb / 16))),
  )

  if (!optionExists(existing, 'max-old-space-size', 'max_old_space_size')) {
    options.push(`--max-old-space-size=${oldSpaceMb}`)
  }

  if (!optionExists(existing, 'max-semi-space-size', 'max_semi_space_size')) {
    options.push(`--max-semi-space-size=${semiSpaceMb}`)
  }

  return {
    nodeOptions: options.join(' ').trim(),
    capacityPlan,
    heapProfile,
    oldSpaceMb,
  }
}

const heapSettings = disabled
  ? {
      nodeOptions: process.env.NODE_OPTIONS?.trim() ?? '',
      capacityPlan: undefined,
      heapProfile: 'disabled',
      oldSpaceMb: undefined,
    }
  : buildNodeOptions()

const nodeOptions = heapSettings.nodeOptions
  ? [heapSettings.nodeOptions]
  : []
const usesTokenPipeline = [command, ...args].some((argument) =>
  String(argument).replaceAll('\\', '/').endsWith('scripts/token-pipeline.mjs'),
)
if (usesTokenPipeline) {
  const hook = pathToFileURL(
    path.join(import.meta.dirname, 'avalonia-token-shadow-hook.mjs'),
  ).href
  nodeOptions.push(`--import=${hook}`)
}

const env = {
  ...process.env,
  NODE_OPTIONS: nodeOptions.join(' ').trim(),
}

if (process.env.FSUS_NODE_HEAP_MB) {
  console.error(
    `[fsus-node-heap] manual override requested=${process.env.FSUS_NODE_HEAP_MB} MiB applied=${heapSettings.oldSpaceMb} MiB profile=${heapSettings.heapProfile}`,
  )
}
if (process.env.FSUS_NODE_HEAP_TRACE === '1') {
  console.error(
    `[fsus-node-heap] profile=${heapSettings.heapProfile} NODE_OPTIONS=${env.NODE_OPTIONS}`,
  )
  if (heapSettings.capacityPlan)
    console.error(formatCapacitySummary(heapSettings.capacityPlan))
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

child.on('error', (error) => {
  console.error(`[fsus-node-heap] failed to start ${command}:`, error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
