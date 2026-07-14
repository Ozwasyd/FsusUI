import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const directory = path.resolve(
  root,
  process.argv[2] ?? '.tmp/performance/current',
)
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const policy = await readJson(
  path.join(root, 'tests/performance/render-performance-policy.json'),
)
const web = await readJson(path.join(directory, 'web', 'summary.json'))
const avalonia = await readJson(
  path.join(directory, 'avalonia', 'summary.json'),
)
const failures = []

if (avalonia.Environment.RenderingBackend === 'unresolved') {
  failures.push('avalonia rendering backend was not resolved')
}
if (avalonia.Environment.WindowPlatform === 'unresolved') {
  failures.push('avalonia native window platform was not resolved')
}

for (const result of web.results) {
  if (result.inputToNextFrameMs.p95 > policy.web.maxP95InputToNextFrameMs) {
    failures.push(`web/${result.id} input p95 exceeded runaway limit`)
  }
  if (result.droppedFrameRate > policy.web.maxDroppedFrameRate) {
    failures.push(`web/${result.id} dropped-frame rate exceeded runaway limit`)
  }
  if (result.longTasks.longestMs > policy.web.maxLongTaskMs) {
    failures.push(`web/${result.id} longest task exceeded runaway limit`)
  }
  if (result.domNodes > policy.web.maxDomNodes) {
    failures.push(`web/${result.id} DOM nodes exceeded runaway limit`)
  }
}
for (const result of avalonia.Results) {
  if (result.FrameMs.P95 > policy.avalonia.maxP95FrameMs) {
    failures.push(`avalonia/${result.Id} frame p95 exceeded runaway limit`)
  }
  if (
    result.AllocatedBytes.Max > policy.avalonia.maxPeakAllocatedBytesPerSample
  ) {
    failures.push(`avalonia/${result.Id} allocation exceeded runaway limit`)
  }
  if (result.RetainedVisuals > policy.avalonia.maxRetainedVisuals) {
    failures.push(
      `avalonia/${result.Id} retained visuals exceeded runaway limit`,
    )
  }
}
if (failures.length)
  throw new Error(
    `Absolute runaway performance limits failed:\n${failures.join('\n')}`,
  )
console.info('Absolute runaway performance limits passed.')
