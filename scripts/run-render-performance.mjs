import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verifyImpactPlan } from './render-performance-impact.mjs'

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
const impactPlanPath = valueOf('--impact-plan', '')
const impactPlan = impactPlanPath
  ? verifyImpactPlan(
      JSON.parse(await readFile(path.resolve(root, impactPlanPath), 'utf8')),
    )
  : null
if (impactPlan && !impactPlan.run)
  throw new Error(
    'Performance impact plan selected skip; no measurement is needed',
  )
if (impactPlan && profile !== impactPlan.measurement.profile)
  throw new Error(
    `Performance profile ${profile} does not match impact plan ${impactPlan.measurement.profile}`,
  )
const webOnly = impactPlan
  ? impactPlan.platforms.web.run && !impactPlan.platforms.avalonia.run
  : args.includes('--web-only')
const avaloniaOnly = impactPlan
  ? impactPlan.platforms.avalonia.run && !impactPlan.platforms.web.run
  : args.includes('--avalonia-only')
const forwarded = ['--profile', profile]
if (impactPlan)
  forwarded.push(
    '--warmups',
    String(impactPlan.measurement.warmups),
    '--samples',
    String(impactPlan.measurement.samples),
  )
for (const name of [
  '--warmups',
  '--samples',
  '--long-scroll-iterations',
  '--backend',
  '--regression-limit',
]) {
  if (impactPlan && (name === '--warmups' || name === '--samples')) continue
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
if (impactPlan)
  await writeFile(
    path.join(output, 'impact-plan.json'),
    `${JSON.stringify(impactPlan, null, 2)}\n`,
  )
if (!avaloniaOnly) {
  const webArgs = [
    'scripts/web-render-performance.mjs',
    ...forwarded,
    '--output',
    path.join(output, 'web'),
  ]
  const webScenario =
    impactPlan?.platforms.web.scenario ?? valueOf('--scenario', '')
  if (webScenario) webArgs.push('--scenario', webScenario)
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
  const avaloniaScenario =
    impactPlan?.platforms.avalonia.scenario ?? valueOf('--scenario', '')
  if (avaloniaScenario) dotnetArgs.push('--scenario', avaloniaScenario)
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

  // Mirror only validated fields from this completed run, before the gate.
  // Diagnostic failures must not replace the existing checker result.
  try {
    const summary = JSON.parse(
      await readFile(path.join(output, 'avalonia', 'summary.json'), 'utf8'),
    )
    const trees = Array.isArray(summary?.Results)
      ? summary.Results.filter((result) => result?.Id === 'tree-expand-scroll')
      : []
    if (trees.length) {
      const tree = trees[0]
      const environment = summary.Environment
      const runner = summary.Runner
      const finiteNonnegative = (value) =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0
      const positiveCount = (value) => Number.isSafeInteger(value) && value > 0
      if (
        summary.SchemaVersion !== 2 ||
        summary.Kind !== 'real-avalonia-render-measurement' ||
        trees.length !== 1 ||
        !['quick', 'full'].includes(summary.Profile) ||
        !['auto', 'software', 'gpu'].includes(environment?.RequestedBackend) ||
        environment?.RenderingBackend !==
          'Avalonia.Rendering.Composition.CompositingRenderer' ||
        ![
          'software-no-platform-graphics',
          'Avalonia.X11.Glx.GlxPlatformGraphics',
          'Avalonia.OpenGL.Egl.EglPlatformGraphics',
          'Avalonia.X11.Vulkan.VulkanPlatformGraphics',
        ].includes(environment?.PlatformGraphicsBackend) ||
        !Number.isSafeInteger(runner?.Warmups) ||
        runner.Warmups < 0 ||
        !positiveCount(runner?.Samples) ||
        !positiveCount(runner?.LongScrollIterations) ||
        tree.LongScroll?.Iterations !== runner.LongScrollIterations ||
        ![tree.FrameMs, tree.MeasureArrangeMs, tree.DrawMs].every(
          (metric) =>
            finiteNonnegative(metric?.P95) &&
            metric?.Samples === runner.Samples,
        )
      ) {
        throw new Error('Invalid Tree diagnostic fields')
      }
      console.info(
        `Avalonia Tree diagnostic: ${JSON.stringify({
          profile: summary.Profile,
          requestedBackend: environment.RequestedBackend,
          renderingBackend: environment.RenderingBackend,
          platformGraphicsBackend: environment.PlatformGraphicsBackend,
          scenario: 'tree-expand-scroll',
          frameP95Ms: tree.FrameMs.P95,
          layoutP95Ms: tree.MeasureArrangeMs.P95,
          drawP95Ms: tree.DrawMs.P95,
          warmups: runner.Warmups,
          samples: runner.Samples,
          longScrollIterations: runner.LongScrollIterations,
        })}`,
      )
    }
  } catch {
    console.info('Avalonia Tree diagnostic unavailable.')
  }
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
