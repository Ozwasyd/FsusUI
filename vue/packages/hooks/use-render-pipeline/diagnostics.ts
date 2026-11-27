import { readRenderPipelineNow } from './config'
import type {
  FsusRenderPipelineDiagnosticEvent,
  FsusRenderPipelineDiagnosticsBuffer,
  FsusRenderPipelineDiagnosticSink,
} from './types'

const DEFAULT_DIAGNOSTICS_BUFFER_LIMIT = 128

export const createFsusRenderPipelineDiagnosticsBuffer = (
  limit = DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
): FsusRenderPipelineDiagnosticsBuffer => {
  const events: FsusRenderPipelineDiagnosticEvent[] = []
  const normalizedLimit = Math.max(
    1,
    Math.floor(
      typeof limit === 'number' && Number.isFinite(limit)
        ? limit
        : DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
    ),
  )

  return {
    clear: () => {
      events.length = 0
    },
    push: (event) => {
      events.push(event)
      if (events.length > normalizedLimit) {
        events.splice(0, events.length - normalizedLimit)
      }
    },
    snapshot: () => events.slice(),
  }
}

export const createFsusRenderPipelineDiagnosticsHub = (
  limit = DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
) => {
  const buffer = createFsusRenderPipelineDiagnosticsBuffer(limit)
  const sinks = new Set<FsusRenderPipelineDiagnosticSink>()

  const emit = (event: FsusRenderPipelineDiagnosticEvent) => {
    const normalized = {
      timestamp: readRenderPipelineNow(),
      ...event,
    }
    buffer.push(normalized)
    for (const sink of Array.from(sinks)) {
      sink(normalized)
    }
  }

  const registerSink = (sink: FsusRenderPipelineDiagnosticSink) => {
    sinks.add(sink)
    return () => {
      sinks.delete(sink)
    }
  }

  const clear = () => {
    buffer.clear()
    sinks.clear()
  }

  return {
    clear,
    emit,
    registerSink,
    snapshot: () => buffer.snapshot(),
  }
}

const defaultDiagnosticEvents: FsusRenderPipelineDiagnosticEvent[] = []
const defaultDiagnosticSinks = new Set<FsusRenderPipelineDiagnosticSink>()

export const emitDefaultFsusRenderPipelineDiagnostic = (
  event: FsusRenderPipelineDiagnosticEvent,
) => {
  const normalized = {
    timestamp: readRenderPipelineNow(),
    ...event,
  }
  defaultDiagnosticEvents.push(normalized)
  if (defaultDiagnosticEvents.length > DEFAULT_DIAGNOSTICS_BUFFER_LIMIT) {
    defaultDiagnosticEvents.splice(
      0,
      defaultDiagnosticEvents.length - DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
    )
  }
  for (const sink of Array.from(defaultDiagnosticSinks)) {
    sink(normalized)
  }
}

export const registerFsusRenderPipelineDiagnosticSink = (
  sink: FsusRenderPipelineDiagnosticSink,
) => {
  defaultDiagnosticSinks.add(sink)
  return () => {
    defaultDiagnosticSinks.delete(sink)
  }
}

export const getFsusRenderPipelineDiagnosticsSnapshot = () =>
  defaultDiagnosticEvents.slice()

export const clearFsusRenderPipelineDiagnostics = () => {
  defaultDiagnosticEvents.length = 0
  defaultDiagnosticSinks.clear()
}
