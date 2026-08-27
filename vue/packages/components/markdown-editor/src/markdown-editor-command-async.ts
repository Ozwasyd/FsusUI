import type {
  MarkdownEditorCommandContext,
  MarkdownEditorPositionMap,
} from "./markdown-editor"

export type MarkdownEditorCommandPendingState =
  | "idle"
  | "pending"
  | "resolved-current"
  | "rejected"
  | "aborted"
  | "stale"
  | "deleted"

export interface MarkdownEditorCommandAnchor {
  readonly start: number
  readonly end: number
  readonly nodeId?: string
}

export interface MarkdownEditorCommandSession {
  readonly key: string
  readonly attemptId: string
  revision: number
  readonly documentId: string
  readonly epoch: number
  anchor?: MarkdownEditorCommandAnchor
  readonly concurrent?: boolean
  state: MarkdownEditorCommandPendingState
  error?: unknown
  readonly abort: AbortController
}

export interface CreateCommandSessionOptions {
  readonly anchor?: MarkdownEditorCommandAnchor
  readonly concurrent?: boolean
  readonly activeSessions?: ReadonlyMap<string, MarkdownEditorCommandSession>
}

let attemptCounter = 0

export const createMarkdownEditorCommandSession = (
  key: string,
  context: MarkdownEditorCommandContext,
  options?: CreateCommandSessionOptions,
): MarkdownEditorCommandSession => {
  if (
    options?.activeSessions &&
    !options.concurrent &&
    options.activeSessions.get(key)?.state === "pending"
  ) {
    throw new Error(`Command "${key}" is already pending and does not allow concurrent execution.`)
  }

  attemptCounter += 1
  return {
    key,
    attemptId: `${key}-${context.documentIdentity.epoch}-${context.revision}-${attemptCounter}`,
    revision: context.revision,
    documentId: context.documentIdentity.id,
    epoch: context.documentIdentity.epoch,
    anchor: options?.anchor ? Object.freeze({ ...options.anchor }) : undefined,
    concurrent: options?.concurrent ?? false,
    state: "pending",
    abort: new AbortController(),
  }
}

export const rebaseMarkdownEditorCommandSession = (
  session: MarkdownEditorCommandSession,
  context: MarkdownEditorCommandContext,
  positionMap?: MarkdownEditorPositionMap,
): MarkdownEditorCommandPendingState => {
  if (session.abort.signal.aborted) {
    session.state = "aborted"
    return "aborted"
  }

  if (
    session.documentId !== context.documentIdentity.id ||
    session.epoch !== context.documentIdentity.epoch
  ) {
    session.abort.abort()
    session.state = "aborted"
    return "aborted"
  }

  if (session.revision === context.revision) {
    return session.state
  }

  if (!positionMap) {
    session.state = "stale"
    return "stale"
  }

  if (session.anchor) {
    const rebased = positionMap.rebase({
      start: session.anchor.start,
      end: session.anchor.end,
    })
    if (!rebased || rebased.end <= rebased.start) {
      session.state = "deleted"
      return "deleted"
    }
    session.anchor = {
      start: rebased.start,
      end: rebased.end,
      nodeId: session.anchor.nodeId,
    }
  }

  session.revision = context.revision
  return session.state
}

export const resolveMarkdownEditorCommandSession = (
  session: MarkdownEditorCommandSession,
  context: MarkdownEditorCommandContext,
  outcome: "resolved-current" | "rejected" | "aborted",
  error?: unknown,
): MarkdownEditorCommandPendingState => {
  if (session.abort.signal.aborted) {
    session.state = "aborted"
    return "aborted"
  }

  if (
    session.revision !== context.revision ||
    session.documentId !== context.documentIdentity.id ||
    session.epoch !== context.documentIdentity.epoch
  ) {
    session.state = "stale"
    return "stale"
  }

  if (outcome === "rejected" && error !== undefined) {
    session.error = error
  }

  session.state = outcome
  return outcome
}

export const abortMarkdownEditorCommandSessions = (
  sessions: Iterable<MarkdownEditorCommandSession>,
  reason?: string,
): void => {
  for (const session of sessions) {
    if (session.state === "pending") {
      session.abort.abort(reason)
      session.state = "aborted"
    }
  }
}

export type MarkdownEditorCommandAsyncMutationKind =
  | "naked-offset"
  | "late-commit"
  | "duplicate-submit"
  | "local-pending"
  | "internal-toast"
  | "stale-commit"
  | "uncancelled"

export const evaluateMarkdownEditorCommandAsyncMutations = (
  session?: MarkdownEditorCommandSession,
  suppliedContext?: MarkdownEditorCommandContext,
) => {
  const context: MarkdownEditorCommandContext = suppliedContext ?? {
    dispatch: {
      dispatch: () => ({
        accepted: true,
        history: {
          canRedo: false,
          canUndo: false,
          redoDepth: 0,
          retainedUnits: 0,
          undoDepth: 0,
        },
        revision: 1,
        selection: { direction: "none", end: 4, start: 0 },
        value: "text",
      }),
    },
    documentIdentity: { epoch: 0, id: "doc-1" },
    mode: "source",
    readonly: false,
    revision: 1,
    selection: { end: 4, start: 0 },
    signal: new AbortController().signal,
    value: "text",
  }
  const activeSession =
    session ??
    createMarkdownEditorCommandSession("bold", context, {
      anchor: { end: 4, start: 0 },
    })
  const changedContext = { ...context, revision: context.revision + 1 }
  const nakedOffset = createMarkdownEditorCommandSession("naked", context, {
    anchor: { end: 4, start: 0 },
  })
  const nakedOffsetState = rebaseMarkdownEditorCommandSession(
    nakedOffset,
    changedContext,
  )
  const late = createMarkdownEditorCommandSession("late", context)
  const lateState = resolveMarkdownEditorCommandSession(
    late,
    changedContext,
    "resolved-current",
  )
  let duplicateGuarded = false
  try {
    createMarkdownEditorCommandSession("duplicate", context, {
      activeSessions: new Map([
        [
          "duplicate",
          createMarkdownEditorCommandSession("duplicate", context),
        ],
      ]),
    })
  } catch {
    duplicateGuarded = true
  }
  const sharedState = new Map([[activeSession.key, activeSession]])
  const staleDocument = createMarkdownEditorCommandSession("stale", context)
  const staleDocumentState = resolveMarkdownEditorCommandSession(
    staleDocument,
    {
      ...context,
      documentIdentity: {
        ...context.documentIdentity,
        epoch: context.documentIdentity.epoch + 1,
      },
    },
    "resolved-current",
  )
  const aborted = createMarkdownEditorCommandSession("cancel", context)
  abortMarkdownEditorCommandSessions([aborted], "mutation")

  return Object.freeze({
    authority: activeSession,
    mutations: Object.freeze([
      Object.freeze({
        kind: "naked-offset" as const,
        equivalent: nakedOffsetState !== "stale",
        accepted: false,
      }),
      Object.freeze({
        kind: "late-commit" as const,
        equivalent: lateState === "resolved-current",
        accepted: false,
      }),
      Object.freeze({
        kind: "duplicate-submit" as const,
        equivalent: !duplicateGuarded,
        accepted: false,
      }),
      Object.freeze({
        kind: "local-pending" as const,
        equivalent: !sharedState.has(activeSession.key),
        accepted: false,
      }),
      Object.freeze({
        kind: "internal-toast" as const,
        equivalent: "toast" in activeSession,
        accepted: false,
      }),
      Object.freeze({
        kind: "stale-commit" as const,
        equivalent: staleDocumentState === "resolved-current",
        accepted: false,
      }),
      Object.freeze({
        kind: "uncancelled" as const,
        equivalent: !aborted.abort.signal.aborted,
        accepted: false,
      }),
    ]),
  })
}
