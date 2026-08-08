#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

export const BOUNDARY_OWNER = 'playwright-boundary'

export const BOUNDARY_FIXED_CELLS = Object.freeze([
  'visual-boundary-audit/desktop-light',
  'visual-boundary-audit/mobile-light',
  'visual-boundary-audit/tiny-light',
  'visual-boundary-audit/desktop-dark',
  'visual-boundary-audit/mobile-dark',
  'visual-boundary-audit/tiny-dark',
  'visual-boundary-audit/safe-area-chromium',
  'visual-boundary-audit/safe-area-webkit',
])

export const BOUNDARY_FIXED_NAMESPACES = Object.freeze({
  'visual-boundary-audit/desktop-light': 'playwright-boundary-desktop-light',
  'visual-boundary-audit/mobile-light': 'playwright-boundary-mobile-light',
  'visual-boundary-audit/tiny-light': 'playwright-boundary-tiny-light',
  'visual-boundary-audit/desktop-dark': 'playwright-boundary-desktop-dark',
  'visual-boundary-audit/mobile-dark': 'playwright-boundary-mobile-dark',
  'visual-boundary-audit/tiny-dark': 'playwright-boundary-tiny-dark',
  'visual-boundary-audit/safe-area-chromium': 'playwright-boundary-safe-area-chromium',
  'visual-boundary-audit/safe-area-webkit': 'playwright-boundary-safe-area-webkit',
})

export function loadBoundaryOwnerPlan(
  group,
  registry = loadPlaywrightSuiteRegistry(),
  owners = loadPlaywrightOwners(),
) {
  const plan = planOwnerCells(BOUNDARY_OWNER, group, registry, owners)
  if (group === 'main' || group === 'nightly' || group === 'release') {
    assertOwnerFixedCells(plan, [...BOUNDARY_FIXED_CELLS])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) {
    throw new Error(
      `boundary owner plan isolation failed for ${group}: ${isolation.join('; ')}`,
    )
  }
  return plan
}

const fail = (message) => {
  throw new Error(message)
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const hasFlag = (args, name) => args.includes(`--${name}`)

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command === 'owner-plan') {
    const group = option(argv, 'group', 'main')
    const plan = loadBoundaryOwnerPlan(group)
    const json = hasFlag(argv, 'json')
    process.stdout.write(
      json
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
    if (!cellId) fail('cell-command requires --cell')
    const plan = loadBoundaryOwnerPlan(option(argv, 'group', 'main'))
    const cell = plan.cells.find((entry) => entry.id === cellId)
    if (!cell) fail(`unknown boundary cell ${cellId}`)
    process.stdout.write(`FSUS_BOUNDARY_AUDIT_PORT=${option(argv, 'port', '4181')} ${cell.command}\n`)
    return
  }
  fail('Usage: boundary-playwright-plan.mjs <owner-plan|cell-command> [options]')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
