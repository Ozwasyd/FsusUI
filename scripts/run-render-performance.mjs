import { spawn } from 'node:child_process'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const valueOf = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const profile = valueOf('--profile', 'quick')
const output = path.resolve(
  root,
  valueOf('--output', '.tmp/performance/current'),
)
const baseline = valueOf('--baseline', '')
const webOnly = args.includes('--web-only')
const avaloniaOnly = args.includes('--avalonia-only')
const forwarded = ['--profile', profile]
for (const name of [
  '--warmups',
  '--samples',
  '--long-scroll-iterations',
  '--backend',
  '--scenario',
  '--regression-limit',
]) {
  const value = valueOf(name, '')
  if (value) forwarded.push(name, value)
}

const run = (command, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      ...options,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code ?? signal}`))
    })
  })

await mkdir(output, { recursive: true })
if (!avaloniaOnly) {
  const webArgs = [
    'scripts/web-render-performance.mjs',
    ...forwarded,
    '--output',
    path.join(output, 'web'),
  ]
  if (baseline)
    webArgs.push('--baseline', path.join(baseline, 'web', 'summary.json'))
  await run(process.execPath, webArgs)
}

if (!webOnly) {
  const dotnetArgs = [
    'run',
    '--project',
    'dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj',
    '--configuration',
    'Release',
    '--',
    '--render-performance',
    ...forwarded,
    '--output',
    path.join(output, 'avalonia', 'summary.json'),
  ]
  let command = 'dotnet'
  let commandArgs = dotnetArgs
  if (process.platform === 'linux' && !process.env.DISPLAY) {
    try {
      await access('/usr/bin/xvfb-run')
      command = '/usr/bin/xvfb-run'
      commandArgs = ['-a', 'dotnet', ...dotnetArgs]
    } catch {
      throw new Error(
        'Avalonia real-window runner needs DISPLAY or /usr/bin/xvfb-run',
      )
    }
  }
  await run(command, commandArgs)
}

if (!webOnly && !avaloniaOnly) {
  await run(process.execPath, [
    'scripts/check-render-performance-results.mjs',
    output,
  ])
  if (baseline) {
    await run(process.execPath, [
      'scripts/compare-render-performance.mjs',
      path.resolve(root, baseline),
      output,
      valueOf('--regression-limit', '0.15'),
    ])
  }
}

console.info(
  `Real-render performance artifacts: ${path.relative(root, output)}`,
)
