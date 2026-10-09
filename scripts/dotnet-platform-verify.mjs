import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const solution = 'dotnet/FsusUI.Avalonia.slnx'
const dotnetRoot = path.join(root, 'dotnet')
const solutionPath = path.join(root, solution)
const platformNames = { linux: 'linux', win32: 'windows', darwin: 'macos' }
const platform = platformNames[process.platform]
if (!platform)
  throw new Error(`Unsupported local platform: ${process.platform}`)

const option = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}
const positiveInteger = (name, value) => {
  if (!/^[1-9]\d*$/u.test(value ?? ''))
    throw new Error(`${name} must be a positive integer, received ${value}`)
  return Number(value)
}
const maxCpuCount = positiveInteger(
  '--max-cpu-count',
  option('--max-cpu-count', process.env.FSUS_DOTNET_MAX_CPU_COUNT ?? '1'),
)
const maxCpuCountArgument = `--maxcpucount:${maxCpuCount}`
const output = path.resolve(
  root,
  option('--output', `dotnet/artifacts/platform/${platform}/manifest.json`),
)
const resultsRoot = path.join(path.dirname(output), 'test-results')

const run = (args, capture = false) =>
  execFileSync('dotnet', args, {
    cwd: dotnetRoot,
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

const walk = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['bin', 'obj', 'artifacts'].includes(entry.name)) return []
      return walk(full)
    }
    return [full]
  })
}

const fingerprintInputs = walk(path.join(root, 'dotnet'))
  .filter((file) =>
    /(?:\.csproj|\.props|\.targets|\.slnx|packages\.lock\.json|global\.json)$/u.test(
      file,
    ),
  )
  .sort()
const fingerprint = createHash('sha256')
for (const file of fingerprintInputs) {
  fingerprint.update(path.relative(root, file).split(path.sep).join('/'))
  fingerprint.update('\0')
  fingerprint.update(fs.readFileSync(file))
  fingerprint.update('\0')
}

const dotnetSdk = run(['--version'], true).trim()
console.log(`[dotnet-platform] sdk=${dotnetSdk} global-json=dotnet/global.json`)

fs.rmSync(path.dirname(output), { recursive: true, force: true })
fs.mkdirSync(resultsRoot, { recursive: true })

run([
  'restore',
  solutionPath,
  '--locked-mode',
  '--disable-parallel',
  maxCpuCountArgument,
])
run([
  'build',
  solutionPath,
  '--no-restore',
  '--configuration',
  'Release',
  maxCpuCountArgument,
])
run([
  'test',
  solutionPath,
  '--no-build',
  '--configuration',
  'Release',
  '--logger',
  'trx',
  '--results-directory',
  resultsRoot,
  maxCpuCountArgument,
])
run([
  'run',
  '--project',
  path.join(dotnetRoot, 'FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj'),
  '--no-build',
  '--configuration',
  'Release',
  '--',
  '--smoke',
])

const trxFiles = walk(resultsRoot)
  .filter((file) => file.endsWith('.trx'))
  .sort()
const totals = { total: 0, executed: 0, passed: 0, failed: 0, errors: 0 }
const tests = trxFiles.map((file) => {
  const content = fs.readFileSync(file, 'utf8')
  const counters = content.match(/<Counters\s+([^>]+)\/>/u)?.[1] ?? ''
  const value = (name) =>
    Number(counters.match(new RegExp(`${name}="(\\d+)"`, 'u'))?.[1] ?? 0)
  const summary = Object.fromEntries(
    Object.keys(totals).map((name) => [name, value(name)]),
  )
  for (const name of Object.keys(totals)) totals[name] += summary[name]
  const assembly = path.basename(
    content.match(/<TestMethod[^>]+codeBase="([^"]+)"/u)?.[1] ??
      path.basename(file, '.trx'),
  )
  return {
    result: path.relative(path.dirname(output), file).split(path.sep).join('/'),
    assembly,
    ...summary,
  }
})

const gitSha =
  process.env.GITHUB_SHA ??
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
const runtimes = run(['--list-runtimes'], true)
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean)
const manifest = {
  schemaVersion: 1,
  kind: 'dotnet-platform',
  platform,
  os: `${os.type()} ${os.release()}`,
  architecture: process.arch,
  dotnetSdk,
  dotnetRuntimes: runtimes,
  commitSha: gitSha,
  solution,
  concurrency: {
    maxCpuCount,
    restoreDisableParallel: true,
  },
  solutionFingerprint: fingerprint.digest('hex'),
  fingerprintInputs: fingerprintInputs.map((file) =>
    path.relative(root, file).split(path.sep).join('/'),
  ),
  tests,
  testSummary: totals,
  smoke: {
    project: 'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj',
    status: 'passed',
  },
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `[dotnet-platform] manifest=${path.relative(root, output)} tests=${totals.passed}/${totals.total}`,
)
