#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import visualCapacity from './visual-capacity.cjs'

export const {
  DEFAULT_VISUAL_CAPACITY_POLICY,
  VISUAL_CAPACITY_PLAN_ENV,
  createVisualCapacityPlan,
  formatVisualCapacitySummary,
  parseCgroupMemoryBytes,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parsePositiveInteger,
  parsePositiveNumber,
  parseVisualCapacityPlan,
  probeVisualCapacityHost,
  resolveVisualCapacityPlan,
  runVisualCapacityCli,
  serializeVisualCapacityPlan,
  validateVisualCapacityPlan,
} = visualCapacity

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runVisualCapacityCli()
}
