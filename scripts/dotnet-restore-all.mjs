#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dotnetRoot = path.join(root, 'dotnet')
const mode = process.argv[2]

if (!['--locked-mode', '--update-locks'].includes(mode)) {
  console.error(
    'Usage: node scripts/dotnet-restore-all.mjs (--locked-mode|--update-locks)',
  )
  process.exit(2)
}

function projects(directory, output = []) {
  for (const name of readdirSync(directory)) {
    if (['bin', 'obj'].includes(name)) continue
    const absolute = path.join(directory, name)
    if (statSync(absolute).isDirectory()) {
      projects(absolute, output)
    } else if (name.endsWith('.csproj')) {
      output.push(absolute)
    }
  }
  return output
}

const projectPaths = projects(dotnetRoot).sort()
const sdk = spawnSync('dotnet', ['--version'], {
  cwd: dotnetRoot,
  encoding: 'utf8',
})
if (sdk.error || sdk.status !== 0) {
  console.error(sdk.error?.message ?? sdk.stderr)
  process.exit(sdk.status || 1)
}
console.log(
  `[dotnet:restore] sdk=${sdk.stdout.trim()} global-json=dotnet/global.json`,
)
for (const project of projectPaths) {
  const args = ['restore', project]
  if (mode === '--locked-mode') args.push('--locked-mode')
  console.log(`[dotnet:restore] ${args.join(' ')}`)
  const result = spawnSync('dotnet', args, {
    cwd: dotnetRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) {
    console.error(`[dotnet:restore] ${project}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log(
  `[dotnet:restore] ok mode=${mode.slice(2)} projects=${projectPaths.length}`,
)
