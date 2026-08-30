#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

export const CONFORMANCE_OWNER = 'playwright-conformance'

export const CONFORMANCE_FIXED_CELLS = Object.freeze([
  'web-interaction-conformance/chromium',
  'web-interaction-conformance/firefox',
  'web-interaction-conformance/webkit',
])

export const CONFORMANCE_FIXED_NAMESPACES = Object.freeze({
  'web-interaction-conformance/chromium': 'playwright-conformance-chromium',
  'web-interaction-conformance/firefox': 'playwright-conformance-firefox',
  'web-interaction-conformance/webkit': 'playwright-conformance-webkit',
})

export function loadConformanceOwnerPlan(
  group,
  registry = loadPlaywrightSuiteRegistry(),
  owners = loadPlaywrightOwners(),
) {
  const plan = planOwnerCells(CONFORMANCE_OWNER, group, registry, owners)
  if (group === 'main' || group === 'nightly' || group === 'release') {
    assertOwnerFixedCells(plan, [...CONFORMANCE_FIXED_CELLS])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) {
    throw new Error(
      `conformance owner plan isolation failed for ${group}: ${isolation.join('; ')}`,
    )
  }
  return plan
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}

const hasFlag = (args, name) => args.includes(`--${name}`)

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command === 'owner-plan') {
    const plan = loadConformanceOwnerPlan(option(argv, 'group', 'main'))
    process.stdout.write(
      hasFlag(argv, 'json')
        ? `${JSON.stringify(plan, null, 2)}\n`
        : `${plan.cells
            .map(
              (cell) =>
                `${cell.id}\tproject=${cell.project}\tnamespace=${cell.artifactNamespace}\tcommand=${cell.command}`,
            )
            .join('\n')}\n`,
    )
    return
  }
  if (command === 'cell-command') {
    const cellId = option(argv, 'cell')
    if (!cellId) throw new Error('cell-command requires --cell')
    const cell = loadConformanceOwnerPlan(
      option(argv, 'group', 'main'),
    ).cells.find((entry) => entry.id === cellId)
    if (!cell) throw new Error(`unknown conformance cell ${cellId}`)
    process.stdout.write(`${cell.command}\n`)
    return
  }
  throw new Error(
    'Usage: conformance-playwright-plan.mjs <owner-plan|cell-command> [options]',
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
