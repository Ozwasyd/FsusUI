#!/usr/bin/env node
import fs from 'node:fs'
import process from 'node:process'
import { planForProfile, registry, schemaPath, stableStringify, validatePlaywrightRegistry } from './playwright-suites-contract.mjs'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const command = args.shift()
const value = (name, fallback) => {
  const direct = args.indexOf(`--${name}`)
  if (direct >= 0) return args[direct + 1]
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
}
const json = args.includes('--json')

if (command === 'check') {
  if (!fs.existsSync(schemaPath)) throw new Error('Playwright suite JSON schema is missing.')
  validatePlaywrightRegistry(registry)
  const summary = {
    schemaVersion: registry.schemaVersion,
    suites: registry.suites.length,
    cells: registry.suites.reduce((total, suite) => total + suite.cells.length, 0),
    profiles: Object.keys(registry.profiles).sort(),
  }
  console.log(json ? stableStringify(summary) : `[playwright-registry] suites=${summary.suites} cells=${summary.cells} status=valid`)
} else if (command === 'plan') {
  const plan = planForProfile(value('group', 'pr'))
  console.log(JSON.stringify(plan, null, json ? 0 : 2))
} else {
  throw new Error('Usage: playwright-suites.mjs <plan|check> [--group pr|main|nightly|release] [--json]')
}
