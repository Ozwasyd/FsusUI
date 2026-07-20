const positiveInteger = (value, label) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

const componentCountValue = (value) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('componentCount must be a non-negative safe integer')
  }
  return value
}

const balancedBucketBounds = (
  componentCount,
  minComponentsPerBucket,
  maxComponentsPerBucket,
) => {
  if (componentCount === 0) return { maximum: 0, minimum: 0 }
  if (componentCount < minComponentsPerBucket) {
    return { maximum: 1, minimum: 1 }
  }

  const minimum = Math.ceil(componentCount / maxComponentsPerBucket)
  const maximum = Math.floor(componentCount / minComponentsPerBucket)
  if (minimum > maximum) {
    throw new RangeError(
      'componentCount cannot satisfy both bucket size boundaries',
    )
  }
  return { maximum, minimum }
}

export function fitVisualAuditBucketCount({
  componentCount,
  desiredBucketCount,
  maxComponentsPerBucket,
  minComponentsPerBucket,
}) {
  const count = componentCountValue(componentCount)
  const desired = positiveInteger(desiredBucketCount, 'desiredBucketCount')
  const minimumSize = positiveInteger(
    minComponentsPerBucket,
    'minComponentsPerBucket',
  )
  const maximumSize = positiveInteger(
    maxComponentsPerBucket,
    'maxComponentsPerBucket',
  )

  if (minimumSize > maximumSize) {
    throw new RangeError(
      'minComponentsPerBucket must not exceed maxComponentsPerBucket',
    )
  }
  if (count === 0) return 0

  const bounds = balancedBucketBounds(count, minimumSize, maximumSize)
  return Math.max(bounds.minimum, Math.min(desired, bounds.maximum))
}

export function resolveVisualAuditBucketCount({
  componentCount,
  maxComponentsPerBucket,
  minComponentsPerBucket,
  selectedProjectCount,
  targetWaves,
  workerBudget,
}) {
  const count = componentCountValue(componentCount)
  const projects = positiveInteger(selectedProjectCount, 'selectedProjectCount')
  const workers = positiveInteger(workerBudget, 'workerBudget')
  const waves = positiveInteger(targetWaves, 'targetWaves')
  const minimumSize = positiveInteger(
    minComponentsPerBucket,
    'minComponentsPerBucket',
  )
  const maximumSize = positiveInteger(
    maxComponentsPerBucket,
    'maxComponentsPerBucket',
  )

  const desiredTaskCount = workers * waves
  if (!Number.isSafeInteger(desiredTaskCount)) {
    throw new RangeError(
      'workerBudget * targetWaves exceeds safe integer range',
    )
  }

  return fitVisualAuditBucketCount({
    componentCount: count,
    desiredBucketCount: Math.ceil(desiredTaskCount / projects),
    maxComponentsPerBucket: maximumSize,
    minComponentsPerBucket: minimumSize,
  })
}

export function partitionVisualAuditComponents(componentIds, bucketCount) {
  if (!Array.isArray(componentIds)) {
    throw new TypeError('componentIds must be an array')
  }
  const ids = [...componentIds]
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('componentIds must contain non-empty strings')
    }
  }
  if (new Set(ids).size !== ids.length) {
    throw new RangeError('componentIds must not contain duplicates')
  }
  if (ids.length === 0) {
    if (bucketCount !== 0) {
      throw new RangeError('bucketCount must be zero without components')
    }
    return []
  }

  positiveInteger(bucketCount, 'bucketCount')
  if (bucketCount > ids.length) {
    throw new RangeError('bucketCount must not exceed component count')
  }

  const baseSize = Math.floor(ids.length / bucketCount)
  const remainder = ids.length % bucketCount
  let offset = 0

  return Array.from({ length: bucketCount }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0)
    const components = ids.slice(offset, offset + size)
    offset += size
    return {
      components,
      index,
      label: `bucket ${index + 1} of ${bucketCount}`,
      number: index + 1,
      total: bucketCount,
    }
  })
}

export function createVisualAuditBucketPlan(options) {
  const componentIds = options.componentIds
  const componentCount = componentCountValue(options.componentCount)
  if (componentIds !== undefined && componentIds.length !== componentCount) {
    throw new RangeError('componentCount must match componentIds.length')
  }

  const bucketCount = resolveVisualAuditBucketCount(options)
  const buckets = partitionVisualAuditComponents(
    componentIds ??
      Array.from({ length: componentCount }, (_, index) => String(index)),
    bucketCount,
  )
  const bucketSizes = buckets.map((bucket) => bucket.components.length)

  return {
    bucketCount,
    buckets,
    componentCount,
    maximumBucketSize: bucketSizes.length === 0 ? 0 : Math.max(...bucketSizes),
    minimumBucketSize: bucketSizes.length === 0 ? 0 : Math.min(...bucketSizes),
    selectedProjectCount: options.selectedProjectCount,
    totalProjectBuckets: bucketCount * options.selectedProjectCount,
  }
}

const encodeNamespaceSegment = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return encodeURIComponent(value).replace(
    /[!'()*.]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export function createVisualAuditPathNamespace({
  componentName,
  projectName,
  stateName,
  suiteName,
}) {
  return [
    `suite-${encodeNamespaceSegment(suiteName, 'suiteName')}`,
    `project-${encodeNamespaceSegment(projectName, 'projectName')}`,
    `state-${encodeNamespaceSegment(stateName, 'stateName')}`,
    `component-${encodeNamespaceSegment(componentName, 'componentName')}`,
  ].join('/')
}
