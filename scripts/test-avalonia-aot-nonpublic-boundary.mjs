#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicNames = new Set([
  'FsusUI.Avalonia.csproj',
  'FsusUI.Avalonia.Themes.csproj',
  'FsusUI.Avalonia.Icons.csproj',
])

const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'bin' && entry.name !== 'obj') out.push(...walk(next))
    else if (entry.name.endsWith('.csproj')) out.push(next)
  }
  return out
}

for (const file of walk(path.join(root, 'dotnet'))) {
  const name = path.basename(file)
  const text = readFileSync(file, 'utf8')
  if (publicNames.has(name)) {
    assert.doesNotMatch(text, /PublishAot/)
    continue
  }
  assert.doesNotMatch(text, /<IsAotCompatible>\s*true/i, `${name} must not claim library AOT`)
}

const inventory = JSON.parse(
  readFileSync(path.join(root, 'spec/avalonia/aot-library-findings.json'), 'utf8'),
)
assert.equal(inventory.ownerIssue, 358)
console.log('Non-public Avalonia projects stay outside the library AOT boundary.')
