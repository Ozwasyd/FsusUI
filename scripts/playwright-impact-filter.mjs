#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function loadPlaywrightImpactPlan(root, impactPlanPath) {
  if (!impactPlanPath) return null
  const absolute = path.resolve(root, impactPlanPath)
  if (!existsSync(absolute)) {
    throw new Error(`playwright impact plan is missing: ${impactPlanPath}`)
  }
  const plan = JSON.parse(readFileSync(absolute, 'utf8'))
  if (plan.schemaVersion !== 1) {
    throw new Error('playwright impact plan schemaVersion must be 1.')
  }
  if (!Array.isArray(plan.decisions)) {
    throw new Error('playwright impact plan must contain decisions.')
  }
  return plan
}

export function filterOwnerPlanByImpact({ root, plan, group, impactPlanPath }) {
  if (group !== 'pr') {
    return { plan, impactPlanDigest: null }
  }
  const impactPlan = loadPlaywrightImpactPlan(root, impactPlanPath)
  if (!impactPlan) {
    throw new Error(`playwright group ${group} requires --impact-plan <path>.`)
  }
  if (!impactPlan.planDigest) {
    throw new Error('playwright impact plan must declare planDigest.')
  }
  const decisions = new Map(
    impactPlan.decisions.map((decision) => [decision.suiteId, decision]),
  )
  const runSuiteIds = new Set(
    [...decisions.entries()]
      .filter(([, decision]) => decision.decision === 'run')
      .map(([suiteId]) => suiteId),
  )
  const cells = plan.cells.filter((cell) => runSuiteIds.has(cell.suiteId))
  return { plan: { ...plan, cells }, impactPlanDigest: impactPlan.planDigest }
}
