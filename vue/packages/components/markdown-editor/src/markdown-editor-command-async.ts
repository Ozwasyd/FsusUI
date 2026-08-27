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
  readonly revision: number
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

  if (session.anchor) {
    if (positionMap) {
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
    } else {
      if (context.value.length < session.anchor.end) {
        session.state = "deleted"
        return "deleted"
      }
    }
  }

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
  _context?: MarkdownEditorCommandContext,
) => {
  const activeSession = session ?? {
    key: "bold",
    attemptId: "bold-0-1-1",
    revision: 1,
    documentId: "doc-1",
    epoch: 0,
    state: "pending" as const,
    abort: new AbortController(),
  }

  return Object.freeze({
    authority: activeSession,
    mutations: Object.freeze([
      Object.freeze({
        kind: "naked-offset" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "late-commit" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "duplicate-submit" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "local-pending" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "internal-toast" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "stale-commit" as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: "uncancelled" as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
