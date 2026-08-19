#!/usr/bin/env node
/**
 * Run the Linux-local native IME required matrix:
 * ibus libpinyin/chewing/mozc-jp/hangul × Chromium/Firefox/WebKit.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BROWSER_PROFILES,
  ENGINE_PROFILES,
} from './native-ime-profiles.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harnessPath = resolve(repositoryRoot, 'scripts/native-ime-harness.mjs')
const defaultOut = resolve(repositoryRoot, '.tmp/native-ime-matrix')

const parseArguments = (argv) => {
  const options = {
    out: defaultOut,
    skipBuild: false,
    engines: Object.keys(ENGINE_PROFILES),
    browsers: Object.keys(BROWSER_PROFILES),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--out') options.out = resolve(process.cwd(), argv[++index])
    else if (argument === '--skip-build') options.skipBuild = true
    else if (argument === '--engine') options.engines = argv[++index].split(',')
    else if (argument === '--browser') options.browsers = argv[++index].split(',')
  }
  return options
}

const options = parseArguments(process.argv.slice(2))
mkdirSync(options.out, { recursive: true })

const cells = []
let first = true
for (const engine of options.engines) {
  for (const browser of options.browsers) {
    const cellDirectory = join(options.out, `${engine}__${browser}`)
    const args = [
      harnessPath,
      '--engine',
      engine,
      '--browser',
      browser,
      '--out',
      cellDirectory,
    ]
    if (options.skipBuild || !first) args.push('--skip-build')
    first = false
    console.log(`[matrix] ${engine} × ${browser}`)
    const started = Date.now()
    const result = spawnSync(process.execPath, args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: 'inherit',
    })
    cells.push({
      engine,
      browser,
      status: result.status,
      durationMs: Date.now() - started,
      out: cellDirectory,
      required: true,
    })
  }
}

const passed = cells.filter((cell) => cell.status === 0).length
const failed = cells.filter((cell) => cell.status !== 0)
const summary = {
  schemaVersion: 1,
  kind: 'native-ime-linux-local-matrix',
  candidateCommand: 'git rev-parse HEAD',
  requiredCells: cells,
  optionalOffHost: [
    'Windows Microsoft IME',
    'macOS system IME',
    'Safari browser UI',
  ],
  passed,
  failed: failed.length,
  verdict: failed.length === 0 ? 'pass' : 'fail',
}
writeFileSync(
  join(options.out, 'summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
)
console.log(
  `[matrix] ${summary.verdict} passed=${passed}/${cells.length} evidence=${options.out}`,
)
process.exitCode = failed.length === 0 ? 0 : 1
