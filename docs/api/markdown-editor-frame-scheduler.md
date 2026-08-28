# Markdown editor frame scheduler contract

The MarkdownEditor surface — the editor component and the live renderer it
embeds — runs all layout-sensitive work through a single editor-owned frame
scheduler (`use-markdown-editor-frame-scheduler`). This is the scheduling
authority for tracking issue #640. It is internal FsusUI infrastructure and
is not public API.

## Frame phase contract

```text
frame N
  measure    -> geometry/layout reads
  mutate     -> DOM/class/style/scroll/virtual mount writes
  post-paint -> non-blocking observation, next-frame requests, evidence sampling
```

- **Single authority.** Feature modules submit keyed tasks; they never create
  their own RAF batching loop. The scheduler requests a frame only while
  tasks are pending, so an idle editor keeps no resident frame loop.
- **Measure before mutate.** All registered layout reads run before any
  registered write in the same frame. A measure request that arrives after
  the mutate phase has started defers to the next frame and increments the
  scheduler's read-after-write violation counter instead of forcing a
  synchronous layout flush.
- **Coalescing.** Tasks are keyed; a repeated key replaces the pending task.
  Compose keys from document identity, revision, and node identity so rapid
  input cannot grow an unbounded backlog. Scheduling beyond the queue budget
  drops the new key and counts it.
- **Stale cancellation.** Tasks carry an optional guard re-evaluated before
  each phase commit; a failing guard cancels the task (fail closed).
  External document resets cancel every pending task and sample one settle
  frame so evidence can observe that no stale task survived.
- **No semantic mutation.** The scheduler only schedules layout and visual
  commits. It never touches Markdown source, transactions, history, selection
  logical state, projection identity, or command semantics.
- **Unmount cleanup.** Disposing the editor cancels the pending frame and all
  queued tasks; no residual RAF, observer callback, or post-paint task
  remains.

## Boundaries

- Projection/render pipeline work (parser, WASM projection, worker commits)
  and the generic shared virtual-window hook keep their existing render
  scheduling; they do not join the frame scheduler and are not forced into
  RAF.
- Selection restore keeps its existing nextTick semantics: selection logical
  state is transaction authority, not scheduler authority.
- The embedded renderer consumes the editor's scheduler instance via provide/
  inject; a standalone `ElMarkdownRenderer` creates an equivalent local
  instance with identical semantics.

## Evidence

The scheduler samples per-frame metrics (frame id, per-phase task counts and
durations, coalesced, stale, cancelled, overflow-dropped, and read-after-write
violation counts) and exposes them on the editor root as
`data-markdown-frame-metrics` after each frame. Mutation fixtures in
`evaluateMarkdownEditorFrameSchedulerMutations` kill mutate-phase measurement,
unbounded input backlog, stale commit, unmount residue, and permanent frame
loop anti-patterns. Chromium layout-count and scheduler evidence is captured
by `vue/tests/markdown-editor/markdown-editor-frame-scheduler.spec.ts`;
Firefox and WebKit keep their cross-browser input and long-task contracts
from the #337 system acceptance.
