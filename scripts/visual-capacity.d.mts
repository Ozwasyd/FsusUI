export type VisualSuiteMode = 'parallel' | 'serial'

export interface VisualCapacityPlan {
  effectiveCpu: number
  effectiveMemoryMiB: number
  previewWorkers: number
  devWorkers: number
  auditBucketCount: number
  suiteMode: VisualSuiteMode
  limits: Record<string, unknown>
  budgets: Record<string, number>
  reasons: string[]
}

export const VISUAL_CAPACITY_PLAN_ENV: 'FSUS_VISUAL_CAPACITY_PLAN'

export function resolveVisualCapacityPlan(options?: {
  env?: NodeJS.ProcessEnv
}): VisualCapacityPlan

export function serializeVisualCapacityPlan(plan: VisualCapacityPlan): string
