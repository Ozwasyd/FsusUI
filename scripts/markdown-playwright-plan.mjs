#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

export const MARKDOWN_OWNER = 'playwright-markdown'

export const MARKDOWN_FIXED_CELLS = Object.freeze([
  'markdown-editor-interaction/chromium',
  'markdown-editor-interaction/firefox',
  'markdown-editor-interaction/webkit',
])

export const MARKDOWN_FIXED_NAMESPACES = Object.freeze({
  'markdown-editor-interaction/chromium': 'playwright-markdown-chromium',
  'markdown-editor-interaction/firefox': 'playwright-markdown-firefox',
  'markdown-editor-interaction/webkit': 'playwright-markdown-webkit',
})

export function loadMarkdownOwnerPlan(
  group,
  registry = loadPlaywrightSuiteRegistry(),
  owners = loadPlaywrightOwners(),
) {
  const plan = planOwnerCells(MARKDOWN_OWNER, group, registry, owners)
  if (group === 'main' || group === 'nightly' || group === 'release') {
    assertOwnerFixedCells(plan, [...MARKDOWN_FIXED_CELLS])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) {
    throw new Error(
      `markdown owner plan isolation failed for ${group}: ${isolation.join('; ')}`,
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
    const plan = loadMarkdownOwnerPlan(group)
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
    const plan = loadMarkdownOwnerPlan(option(argv, 'group', 'main'))
    const cell = plan.cells.find((entry) => entry.id === cellId)
    if (!cell) fail(`unknown markdown cell ${cellId}`)
    process.stdout.write(`${cell.command}\n`)
    return
  }
  fail('Usage: markdown-playwright-plan.mjs <owner-plan|cell-command> [options]')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
