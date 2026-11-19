// Diagnostics only: rAF intervals under load do not establish display refresh rate.
export function describeCadence(requestedHz, intervals) {
  if (!Number.isFinite(requestedHz) || requestedHz <= 0)
    throw new Error('requestedHz must be finite and positive')
  if (
    !Array.isArray(intervals) ||
    intervals.some((value) => !Number.isFinite(value) || value <= 0)
  )
    throw new Error('frame intervals must be finite and positive')
  const sorted = [...intervals].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const medianMs = sorted.length
    ? sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
    : null
  const requestedIntervalMs = 1000 / requestedHz
  // This tolerance labels diagnostics only; it never changes acceptance budgets.
  const toleranceFraction = 0.1
  const status =
    medianMs === null
      ? 'unobserved'
      : Math.abs(medianMs - requestedIntervalMs) / requestedIntervalMs <=
          toleranceFraction
        ? 'consistent-with-request'
        : 'mismatch'
  return {
    requestedHz,
    observedRafMedianMs: medianMs,
    observedRafHz: medianMs === null ? null : 1000 / medianMs,
    sampleCount: intervals.length,
    status,
    toleranceFraction,
    displayRefreshRateVerified: false,
    legacyDroppedFrameRateMeaning: 'fraction-over-requested-interval-times-1.5',
    droppedFrameRateComparableToRequestedHz: status === 'consistent-with-request',
    reportedDroppedFrameRate: null,
    limitation:
      'Loaded rAF cadence cannot distinguish host pacing from workload stalls; no physical dropped-frame rate is established. Legacy droppedFrameRate remains an unchanged gate input, not a verified display statistic.',
  }
}
