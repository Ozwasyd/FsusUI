export type NodeHeapProfile =
  | 'auto'
  | 'small'
  | 'unit'
  | 'typecheck'
  | 'build'
  | 'coverage'
  | 'visual'

export interface CapacityPlan {
  effectiveCpu: number
  effectiveMemoryMiB: number
  nodeHeapMiB: number
  nodeHeapProfile: NodeHeapProfile
  nodeHeapProfilesMiB: Record<NodeHeapProfile, number>
  lanes: {
    typecheck: number
    unit: number
    build: number
    coverage: number
    visual: number
  }
  unitTestFileCount: number
  unitShards: number
  vitestWorkersPerShard: number
  typecheckBatches: string[][]
  suiteBatches: string[][]
  limits: Record<string, unknown>
  overrides: Record<string, string | number | undefined>
  overrideStatus: Record<string, Record<string, boolean | number | undefined>>
  budgets: Record<string, number>
  reasons: string[]
}

export const CAPACITY_PLAN_ENV: 'FSUS_CI_CAPACITY_PLAN'

export function resolveCapacityPlan(options?: {
  env?: NodeJS.ProcessEnv
  unitTestFileCount?: number
}): CapacityPlan

export function resolveNodeHeapMiB(
  plan: CapacityPlan,
  profile?: NodeHeapProfile,
): number
