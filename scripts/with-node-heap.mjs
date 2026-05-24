#!/usr/bin/env node
import { spawn } from 'node:child_process'

const DEFAULT_OLD_SPACE_MB = 18_432
const DEFAULT_SEMI_SPACE_MB = 128

const [, , rawCommand, ...rawArgs] = process.argv
const command = rawCommand === '--' ? rawArgs.shift() : rawCommand
const args = rawCommand === '--' ? rawArgs : rawArgs

if (!command) {
  console.error(
    'Usage: node ./scripts/with-node-heap.mjs <command> [...args]',
  )
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

const optionExists = (nodeOptions, dashedName, underscoredName = dashedName) => {
  const pattern = new RegExp(
    `(?:^|\\s)--(?:${dashedName}|${underscoredName})(?:=|\\s|$)`,
  )
  return pattern.test(nodeOptions)
}

const buildNodeOptions = () => {
  const existing = process.env.NODE_OPTIONS?.trim() ?? ''
  if (disabled) return existing

  const options = existing ? [existing] : []
  const oldSpaceMb = readPositiveInteger(
    process.env.FSUS_NODE_HEAP_MB,
    DEFAULT_OLD_SPACE_MB,
  )
  const semiSpaceMb = readPositiveInteger(
    process.env.FSUS_NODE_SEMI_SPACE_MB,
    DEFAULT_SEMI_SPACE_MB,
  )

  if (!optionExists(existing, 'max-old-space-size', 'max_old_space_size')) {
    options.push(`--max-old-space-size=${oldSpaceMb}`)
  }

  if (!optionExists(existing, 'max-semi-space-size', 'max_semi_space_size')) {
    options.push(`--max-semi-space-size=${semiSpaceMb}`)
  }

  return options.join(' ').trim()
}

const env = {
  ...process.env,
  NODE_OPTIONS: buildNodeOptions(),
}

if (process.env.FSUS_NODE_HEAP_TRACE === '1') {
  console.error(`[fsus-node-heap] NODE_OPTIONS=${env.NODE_OPTIONS}`)
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
