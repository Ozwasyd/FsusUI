export interface VisualAuditBucketCountOptions {
  componentCount: number
  selectedProjectCount: number
  workerBudget: number
  targetWaves: number
  minComponentsPerBucket: number
  maxComponentsPerBucket: number
}

export interface VisualAuditBucket<T extends string = string> {
  components: T[]
  index: number
  label: string
  number: number
  total: number
}

export interface VisualAuditBucketPlanOptions<
  T extends string = string,
> extends VisualAuditBucketCountOptions {
  componentIds?: readonly T[]
}

export interface VisualAuditBucketPlan<T extends string = string> {
  bucketCount: number
  buckets: VisualAuditBucket<T>[]
  componentCount: number
  maximumBucketSize: number
  minimumBucketSize: number
  selectedProjectCount: number
  totalProjectBuckets: number
}

export function fitVisualAuditBucketCount(options: {
  componentCount: number
  desiredBucketCount: number
  minComponentsPerBucket: number
  maxComponentsPerBucket: number
}): number

export function resolveVisualAuditBucketCount(
  options: VisualAuditBucketCountOptions,
): number

export function partitionVisualAuditComponents<T extends string>(
  componentIds: readonly T[],
  bucketCount: number,
): VisualAuditBucket<T>[]

export function createVisualAuditBucketPlan<T extends string>(
  options: VisualAuditBucketPlanOptions<T>,
): VisualAuditBucketPlan<T>

export function createVisualAuditPathNamespace(options: {
  componentName: string
  projectName: string
  stateName: string
  suiteName: string
}): string
