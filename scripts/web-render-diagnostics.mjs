import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const diagnosticIds = new Set([
  'virtual-list-fixed-100000-60hz-dpr1-enabled',
  'virtual-window-index-legacy-100000-120hz-dpr2-reduced',
])
export const maxTraceEvents = 100_000
export const maxDiagnosticBytes = 8 * 1024 * 1024
export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex')

// Called only after all Web scenarios finish. Never supplies gate metrics.
export function encodeDiagnostic(record, identity, limit = maxDiagnosticBytes) {
  const { raw, anchors, traceEvents, totalTraceEvents } = record
  if (!diagnosticIds.has(raw.id))
    throw new Error('Unexpected diagnostic scenario')
  if (!/^[a-f0-9]{40}$/u.test(identity.gitSha))
    throw new Error('Diagnostics require an exact commit identity')
  if (
    anchors.length !== raw.inputToFrame.length ||
    anchors.length !== identity.samples
  )
    throw new Error('Diagnostic sample count mismatch')
  for (const [index, anchor] of anchors.entries()) {
    if (
      anchor.iteration !== identity.warmups + index ||
      ![
        anchor.started,
        anchor.actionCompleted,
        anchor.frameCompleted,
        anchor.rafTimestamp,
      ].every(Number.isFinite) ||
      anchor.started > anchor.actionCompleted ||
      anchor.actionCompleted > anchor.frameCompleted ||
      Math.abs(
        anchor.frameCompleted - anchor.started - raw.inputToFrame[index],
      ) > 0.000001 ||
      Math.abs(anchor.actionCompleted - anchor.started - raw.frameWork[index]) >
        0.000001
    )
      throw new Error('Diagnostic anchor mismatch')
  }
  const artifact = {
    schemaVersion: 1,
    kind: 'web-render-diagnostic-not-acceptance',
    identity: {
      ...identity,
      scenarioId: raw.id,
      rawSha256: sha256(`${JSON.stringify(raw, null, 2)}\n`),
    },
    clocks: {
      sample: 'document performance.now milliseconds',
      raf: 'requestAnimationFrame callback timestamp milliseconds',
      trace: 'CDP monotonic microseconds',
      navigationStartSeconds: raw.browserMetrics.NavigationStart ?? null,
      metricsTimestampSeconds: raw.browserMetrics.Timestamp ?? null,
      alignment:
        'NavigationStart + sample/1000; conditional on same document; never use worker clock origins',
    },
    anchors,
    traceEvents,
    totalTraceEvents,
    retainedTraceEvents: traceEvents.length,
    truncated: totalTraceEvents !== traceEvents.length,
  }
  let text = JSON.stringify(artifact)
  // Preserve a prefix, explicitly labelled; never imply missing intervals are empty.
  while (Buffer.byteLength(text) > limit && artifact.traceEvents.length) {
    artifact.traceEvents = artifact.traceEvents.slice(
      0,
      Math.floor(artifact.traceEvents.length / 2),
    )
    artifact.retainedTraceEvents = artifact.traceEvents.length
    artifact.truncated = true
    text = JSON.stringify(artifact)
  }
  if (Buffer.byteLength(text) > limit)
    throw new Error('Diagnostic identity/anchors exceed size bound')
  return text
}

export async function writeDiagnostics(output, records, identity) {
  if (!records.length) return
  const directory = path.join(output, 'diagnostics')
  await mkdir(directory, { recursive: true })
  for (const record of records) {
    await writeFile(
      path.join(directory, `${record.raw.id}.diagnostic.json`),
      encodeDiagnostic(record, identity),
    )
  }
}
