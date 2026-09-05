#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative))
const hash = (relative) =>
  crypto.createHash('sha256').update(read(relative)).digest('hex')
const runnerHash = crypto
  .createHash('sha256')
  .update(read('scripts/avalonia-conformance-v2.mjs'))
  .update(read('scripts/native-screen-reader-harness.mjs'))
  .update(read('scripts/conformance-v2-evidence.mjs'))
  .update(read('dotnet/FsusUI.Avalonia.Demo/ConformanceV2Runner.cs'))
  .digest('hex')
const output = path.resolve(
  root,
  process.env.FSUS_CONFORMANCE_V2_AVALONIA_OUTPUT ??
    '.tmp/conformance-v2/avalonia.json',
)
const candidate = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout.trim()

if (!process.env.DISPLAY && process.platform === 'linux') {
  throw new Error(
    'DISPLAY is required; the Avalonia Contract V2 runner never falls back to headless',
  )
}

fs.mkdirSync(path.dirname(output), { recursive: true })
const result = spawnSync(
  'dotnet',
  [
    'run',
    '--project',
    'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj',
    '--',
    '--conformance-v2',
    '--output',
    output,
    '--candidate',
    candidate,
    '--contract-hash',
    hash('spec/components/contracts/v2/contract-v2.json'),
    '--web-baseline-hash',
    hash('spec/baselines/vue-current.json'),
    '--avalonia-baseline-hash',
    hash('spec/avalonia/semantic/FsusUI.Avalonia.semantic.json'),
    '--runner-hash',
    runnerHash,
  ],
  { cwd: root, encoding: 'utf8', env: process.env },
)

process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
if (result.status !== 0) process.exit(result.status ?? 1)

const evidence = JSON.parse(fs.readFileSync(output, 'utf8'))
if (
  evidence.runtime?.realTopLevel !== true ||
  evidence.runtime?.headless !== false
) {
  throw new Error('Avalonia evidence is not bound to a real top-level')
}
if (evidence.identity?.candidate !== candidate) {
  throw new Error('Avalonia evidence candidate drift')
}
if (!Array.isArray(evidence.steps) || evidence.steps.length < 4) {
  throw new Error(
    'Avalonia evidence did not execute the required interaction steps',
  )
}
const atomicActions = evidence.accessibility?.nodes?.filter(
  (node) =>
    node.control === 'FsusMarkdownAtomicAction' &&
    node.action?.invokable === true,
)
if (
  !Array.isArray(atomicActions) ||
  atomicActions.length !==
    evidence.accessibility?.markdown?.atomicActionCount ||
  atomicActions.length < 3
) {
  throw new Error(
    'Avalonia evidence did not expose the real invokable atomic action peers',
  )
}
if (!atomicActions.some((node) => node.action?.sourceEntry === true)) {
  throw new Error('Avalonia evidence did not expose the source entry action')
}
console.log(
  `[conformance-v2] avalonia real-window trace passed steps=${evidence.steps.length} atomicActions=${atomicActions.length} candidate=${candidate}`,
)
