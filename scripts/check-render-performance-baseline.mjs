import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { verifyImpactPlan } from './render-performance-impact.mjs'

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const directory = path.resolve(valueOf('--directory'))
const output = path.resolve(valueOf('--output'))
const plan = verifyImpactPlan(
  JSON.parse(await readFile(path.resolve(valueOf('--plan')), 'utf8')),
)
let available = true
let reason = 'compatible'
try {
  const runner = await readFile(
    path.join(directory, 'scripts/run-render-performance.mjs'),
    'utf8',
  )
  if (!runner.includes("valueOf('--impact-plan'")) {
    available = false
    reason =
      'contract-changed: base runner does not accept the immutable impact plan'
  } else {
    const baseContract = await import(
      pathToFileURL(
        path.join(directory, 'scripts/render-performance-impact.mjs'),
      ).href
    )
    baseContract.verifyImpactPlan(plan)
  }
} catch (error) {
  available = false
  reason = `baseline-unavailable/contract-changed: ${error.code ?? error.message}`
}
const status = {
  schemaVersion: 1,
  kind: 'pr-real-render-baseline-status',
  available,
  reason,
  planDigest: plan.planDigest,
}
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(status, null, 2)}\n`)
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `available=${available}\nreason=${reason}\n`,
  )
console.info(
  `${available ? 'Baseline available' : 'Baseline unavailable'}: ${reason}`,
)
