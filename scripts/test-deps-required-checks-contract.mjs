#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
assert.ok(packageJson.scripts['deps:check'])
assert.ok(packageJson.scripts['deps:sync'] || packageJson.scripts['deps:freshness'])
const freshness = packageJson.scripts['deps:freshness']
assert.ok(freshness, 'deps:freshness must exist for scheduled freshness')
console.log('Deps required-check and freshness scripts are present for local simulation.')
