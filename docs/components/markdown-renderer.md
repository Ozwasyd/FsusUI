# MarkdownRenderer

A headless component built on the FsusBlog Markdown WASM renderer.

> This component does not include a full article typography theme. After DOM commit, shared feature activation normalizes heading IDs, hash/external-link attributes, CSP nonces, Mermaid/LaTeX placeholders, and code-block highlighting hooks through FsusUI.

## Public Preview

This is an experimental component. See [API stability](../api-stability.md#stability-levels)
for the change policy. Provide heading context for the article container and
retain text fallbacks or errors for Mermaid, LaTeX, and code enhancements. The
component supplies no full article theme; consumers bind the shared [theme and
motion contracts](../theme/tokens.md) to their content. Markdown source HTML
is always rendered as text.

---

## Basic Usage

After receiving `content`, the component asynchronously calls the Markdown runtime from `@element-plus/wasm`. Each generation performs one complete parse; it no longer parses the same content first as HTML-only and then again. Large documents are split into block chunks under the global Render Pipeline budget, commit the first readable section first, fill remaining descriptors within frame budgets, and mount only content near the current viewport so a long Markdown document does not saturate main-thread DOM/layout/paint at once.

```vue
<template>
  <el-markdown-renderer :content="content" />
</template>
```

## Mermaid, KaTeX, and Code Activation

The WASM renderer preserves HTML, MathML, SVG, or placeholder data for Mermaid and LaTeX/KaTeX. After committing DOM, the component calls the public `markdown-runtime` activation layer, lazy-loads Mermaid, KaTeX, and Shiki by default, renders `.markdown-renderer__mermaid`, `.markdown-renderer__latex`, and `language-*` code blocks, and normalizes heading/hash/external-link behavior. Consumers can listen for `features-activated` for stable activation results or `placeholders-ready` for placeholders and the complete render result.

```vue
<template>
  <el-markdown-renderer
    :content="content"
    csp-nonce="request-csp-nonce"
    :features="{ latex: true, mermaid: true, codeHighlight: true }"
    @features-activated="onFeaturesActivated"
    @placeholders-ready="onPlaceholdersReady"
  />
</template>
```

The built-in renderer derives Mermaid themeVariables, KaTeX error colors, Shiki light/dark themes, and permitted dynamic `<style>` nonces from `data-theme-resolved`, Element Plus tokens, and `csp-nonce`. Mermaid, KaTeX, and Shiki activate only when their chunk nears the viewport. The security gateway and each third-party renderer load on demand in parallel, while all three activations share one gateway singleton result; Shiki loads only grammars actually encountered and the current theme. Activations across renderers use bounded concurrency rather than one global Promise lock. Failure does not crash the renderer: the component creates an `el-markdown-renderer__feature-error` node with `textContent` and reports the error in `features-activated.errors`.

Use `features` to disable an activation:

```vue
<template>
  <!-- 完全关闭 Mermaid activation，不扫描也不标记 -->
  <el-markdown-renderer :content="content" :features="{ mermaid: false }" />
</template>
```

Feature renderers no longer accept a consumer DOM adapter. Built-in Mermaid, KaTeX, and Shiki read only immutable source, theme, and controlled tokens, then return a `FeatureRenderOutput` with `kind`. Output is committed only after passing separate FsusUI-owned gateway policies for Mermaid SVG, KaTeX MathML, and Shiki HTML. Mermaid must use native SVG text instead of `foreignObject`, and color tokens are validated against the controlled color grammar before entering a third-party renderer. The three policies do not share a union of tags or attributes; unknown tags, namespaces, attributes, events, executable URLs, and external resources are removed. See [Converging the Markdown feature output gateway](../migration/markdown-feature-output-gateway.md) for migration.

### Test-only XSS differential corpus

`spec/security/markdown-xss-corpus.json` is the sole case source of truth for Markdown security tests; the schema and consumer manifest are in the same directory. Consumers such as FsusBlog may read it only one way from FsusUI using
`node scripts/export-markdown-xss-corpus.mjs --out <test-fixture-directory>`
to copy these three test-only files. Production runtime must not import the corpus, and FsusUI must not depend on consumers. The manifest SHA-256 and static gate make drift in copies detectable.

`pnpm run check:markdown-xss` uses fixed `xorshift32-v1` seed `2662026` and runs at least 2,000 mutations; the release lane `pnpm run check:markdown-xss:release` runs at least 20,000. Reproduce a run with `FSUS_MARKDOWN_XSS_SEED=<reported-seed>` and `FSUS_MARKDOWN_XSS_FUZZ_ITERATIONS=<count>`; failures print the case ID, surface, seed, and minimized input. Both gates make Chromium, Firefox, and WebKit parse the final DOM and cover sync, Wasm, Worker, chunked, SSR/no-DOM, `initialRender` hydration, and Mermaid/KaTeX/Shiki gateways. The corpus, manifest, and six kill controls have no package exports; the static gate also scans production source, ESM/CJS, browser chunks, and Wasm artifacts to keep test-only markers out of release output.

## Raw HTML Security Boundary

The Markdown protocol does not accept raw HTML. Core rendering escapes HTML blocks and inline tags consistently across sync, Worker, chunked, and html-only paths, and rejects dangerous schemes, protocol-relative URLs, control characters, backslash obfuscation, and data URLs when creating link and image attributes. Committable HTML is wrapped in opaque `MarkdownSafeHtml` / `MarkdownSafeRenderResult` types; an ordinary `string` cannot be assigned to them, and the component exposes no second sanitization switch or string-construction entry point.

For SSR or trusted-cache first paint, pass the complete runtime result to `initial-render`. The component reuses a result only when it carries runtime authority and its renderer version, normalized source, and `sourceIdentity` match the current request; any mismatch discards the first paint and rerenders.

Hosts that enable `require-trusted-types-for 'script'` must provide `trusted-html-factory` and `trusted-script-url-factory`. The HTML factory accepts only `MarkdownSafeHtml` and does not sanitize; the worker factory accepts only the built Markdown worker `URL`. The sole feature gateway for built-in Mermaid, KaTeX, and Shiki creates a private, non-default `fsusui-markdown-feature` policy on demand for inert `<template>` parsing only. Parsed DOM must still pass the feature's separate sanitizer and root validation before commit. If CSP `trusted-types` restricts policy names, the host must explicitly allow `fsusui-markdown-feature`; if policy creation is rejected, feature commit fails closed and target DOM is not partially updated. Real Chromium production CSP evidence is fixed by `pnpm run check:markdown-feature-trusted-types`.

## Fsus Explicit Paragraph Groups

Fsus Markdown retains native Markdown's double-newline paragraph rule and adds an explicit paragraph-group syntax for continuous explanation containing block content such as code, tables, lists, or quotes.

````md
::p
那么，在 Rust 中，`Err(E)` 的 `E` 是一个强类型枚举：

```rust
pub enum AppError {
  UserNotFound,
}
```

这句解释仍然属于同一个显式段落组。
::
````

Rules:

- `::p` must occupy its own line and starts an explicit paragraph group.
- `::` must occupy its own line and ends the current explicit paragraph group.
- Group contents are parsed as ordinary Markdown and support code blocks, tables, lists, quotes, Mermaid, and LaTeX.
- Ordinary double-newline paragraphs are unchanged; a group is generated only when `::p ... ::` is written explicitly.
- This syntax is not raw HTML and is always available.
- DOM does not emit invalid `<p><pre>...</pre></p>`; it emits a valid structure:

```html
<section class="markdown-renderer__paragraph" data-fsus-paragraph>
  <p>...</p>
  <pre><code>...</code></pre>
  <p>...</p>
</section>
```

## Technical Text Layout Protection

The Markdown renderer emits stable classes for technical prose so an outer article style using `text-align: justify` does not create abnormal spacing in narrow paragraphs containing inline code.

- Ordinary paragraphs output `markdown-renderer__text`.
- Paragraphs containing inline code additionally output `markdown-renderer__text--inline-code`.
- List items output `markdown-renderer__list-item` and additionally `markdown-renderer__list-item--inline-code` when they contain inline code.
- Explicit paragraph groups output `markdown-renderer__paragraph` and `data-fsus-paragraph`.

The component includes a small layout safeguard: explicit paragraph groups, list items, inline-code paragraphs, and prose in narrow containers fall back to natural start alignment. Ordinary paragraphs, list items, table cells, and links wrap safely so escaped raw-HTML probes or long URLs do not widen the page; code blocks retain horizontal scrolling. Markdown parsing semantics are unchanged.

## Embed Block Size Protection

Mermaid SVG output includes `width`, `height`, `preserveAspectRatio`, and `data-mermaid-width` / `data-mermaid-height`; the component displays the SVG at its natural size instead of filling the row by default. Diagrams are limited by `--fsus-markdown-diagram-max-width` (default `32rem`), while LaTeX block width follows the reader container. Extremely wide content scrolls inside the embed block so it cannot widen the page or enlarge a simple diagram to full-screen size.

## WASM API

The underlying APIs are exported from `@element-plus/wasm`:

```ts
import {
  initMarkdownRuntime,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownSummaryWithRuntime,
  renderMarkdownWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
```

All of these asynchronous APIs return `Promise<FsusResult<T>>`. When `ok: false`, `error` is `FsusErrorDetail`; `null` is not used to represent runtime unavailability.

`renderMarkdownHtmlWithRuntime` returns a `value` containing only HTML and timings; `renderMarkdownSummaryWithRuntime` returns HTML, features, and metadata counts; `renderMarkdownResultWithRuntime` returns `html`, `features`, `placeholders`, `metadata`, timings, and current engine information; `renderMarkdownChunksWithRuntime` additionally returns block-level `chunks` for Render Pipeline virtual mounting; `renderMarkdownWithRuntime` returns only an HTML string.

Chunk boundaries come from the WASM rendering pipeline and include `heading`, `paragraph`, `list`, `table`, `code`, `blockquote`, `latex`, `mermaid`, `footnotes`, `rule`, and `generated`. `generated` means only a renderer-generated block that does not fit another category; it does not indicate raw HTML input capability. The component does not split final HTML with regex in the Vue layer.

## Long-Document Virtual Mount

`ElMarkdownRenderer` uses the nearest scrollable ancestor as its viewport and the page viewport when no such ancestor exists. During chunked rendering, DOM structure remains stable:

- The root carries `data-fsus-render-strategy="chunked-worker"`, `chunked-main`, or `sync`.
- A visible chunk carries `data-fsus-render-unit`, its chunk key, kind, and HTML offset.
- Top and bottom spacers use an incremental height index: one-chunk measurement updates and offset/index queries are O(log N), total-size queries are O(1), and a viewport change does not rebuild the full metadata array.
- Each renderer's virtual window creates one shared `ResizeObserver`; element associations use weak references, measurements submit in frame-level `measureBatch` batches, and historical height cache has a fixed limit.
- Each batch accumulates only height deltas before the anchor and compensates `scrollTop` at most once. Stable chunk keys restore the anchor across consecutive insertions, deletions, or reorders instead of jumping back to earlier prose.
- SSR or environments without `ResizeObserver` create no observer; the first mount still fills estimates from deterministic `offsetHeight`.
- Mermaid, KaTeX, and Shiki activation is driven by an `IntersectionObserver` with a preload boundary. Without that API, compatibility is retained and currently mounted chunks activate immediately.
- A new `content` generation cancels parsing, result transfer, frame commits, activation, and stale cache writes together. Synchronous WASM work inside a Worker actually stops by terminating its parser Worker instead of merely discarding the final result.
- The Worker cache retains one canonical payload per fingerprint from the current WASM runtime. The main-thread component exposes no writable cache or setter and does not accept caller-injected cache results.

Thresholds and budgets are controlled by `ElConfigProvider`'s `render-pipeline` configuration; MarkdownRenderer adds no component-specific switches.

Large documents prefer the Render Pipeline adapter's shared Worker pool. Each pool slot uses a lightweight broker Worker to manage a terminable parser Worker; the Worker handles Markdown chunking, metadata precomputation, and incremental full fingerprints, while the main thread handles virtual mounting, measurement, and anchor retention. Each renderer has its own key/generation; consecutive edits send cancel to the Worker and terminate any parser Worker running synchronous WASM, so an old generation cannot continue transferring, committing, or writing cache. A timeout or crash affects only its slot and other renderer tasks continue. If Worker is unavailable, the component waits for main-thread idle/frame budget and falls back to `chunked-main`; it does not own a private executor.

---

## API

### Attributes

| 属性名                     | 说明                                                                                    | 类型                                            | 默认值                  |
| -------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| content                    | Markdown 源文本                                                                         | `string`                                        | `''`                    |
| content-version            | 可选稳定内容版本；大文档提供后可跳过主线程完整哈希，并参与 generation/cache fingerprint | `string \| number \| null`                      | `null`                  |
| loading-text               | 初次异步渲染期间 `role="status"` 使用的可见文案                                         | `string`                                        | `Rendering markdown...` |
| initial-render             | 同源同版本且持有 runtime authority 的安全结果，用于 SSR 或可信缓存首显                  | `MarkdownSafeRenderResult \| null`              | `null`                  |
| trusted-html-factory       | 将安全 HTML 转为宿主 policy 的 `TrustedHTML`；不承担清洗职责                            | `(html: MarkdownSafeHtml) => object`            | —                       |
| trusted-script-url-factory | 将 Markdown worker URL 转为宿主 policy 的 `TrustedScriptURL`                            | `(url: URL) => unknown`                         | —                       |
| allow-latex                | 是否启用 LaTeX/MathML 输出                                                              | `boolean`                                       | `true`                  |
| allow-mermaid              | 是否启用 Mermaid 输出                                                                   | `boolean`                                       | `true`                  |
| mode                       | 渲染模式元数据                                                                          | `'article' \| 'about' \| 'preview' \| 'editor'` | `article`               |
| base-url                   | 渲染元数据与 link activation 的基础 URL                                                 | `string \| null`                                | `null`                  |
| csp-nonce                  | 写入 renderer 内动态 style 的 CSP nonce                                                 | `string \| null`                                | `null`                  |
| features                   | 内建 feature activation 开关                                                            | `MarkdownFeatureActivationFeatureOptions`       | —                       |

### Events

| 事件名             | 说明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| render-complete    | 渲染完成，参数为完整 `MarkdownSafeRenderResult`                   |
| render-error       | WASM runtime 渲染失败，参数为 `FsusErrorDetail`                   |
| features-activated | DOM feature activation 完成，参数为 activation 结果与完整渲染结果 |
| placeholders-ready | 占位符可用，参数为 `placeholders` 与完整渲染结果                  |
| render-profile     | 渲染阶段耗时可用，参数为 `MarkdownRuntimeProfile`                 |

### Exposes

| Name                           | Description                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| rootEl                         | Render container element.                                                                                                          |
| captureRendererOwnedCheckpoint | Pin actual renderer-owned state and authorized projection on this instance, or return `null`; native recovery remains unavailable. |
| captureLastValidRender         | Return the retained render ref, document identity/epoch and revision, or `null`.                                                   |
| restoreLastValidRender         | Recommit the actual retained projection on the same mounted owner and matching revision, or report a blocked result.               |
| getSessionResourceSourceOffer  | Return the explicitly incomplete census of resources directly held by this renderer.                                               |
| getSessionResourceParticipant  | Return the stable renderer resource participant; its complete lifecycle operations currently refuse.                               |

### Retained renderer projection and resource source offer

These experimental methods are available on the mounted `ElMarkdownRenderer`
instance. Use the documented component ref; the private owner factory and worker
implementation are not public imports. The renderer remains the sole owner of
its retained result and component handles. Shared editor session registration
belongs to [MarkdownEditor](markdown-editor.md#retained-public-editor-session-source-wip).

`captureLastValidRender()` returns a frozen object with this shape:

```ts
{
  ref: string
  documentIdentity: { id: string; epoch: number | string }
  revision: number | string
} | null
```

The opaque ref identifies one actual authorized result retained in this mounted
renderer. A matching runtime-authorized `initialRender`, a completed sync or
chunked render, an authorized worker result, or a safe fallback can establish
that result. It is never reconstructed from HTML or a content digest. The
result's source, renderer version and authority must match the render request;
generation, document identity/epoch and revision are checked at commit boundaries.
The existing feature output gateway remains the authority for feature DOM.

The editor's injected document identity and revision are used unchanged. A
standalone renderer uses its own document key and epoch and uses `contentVersion`
or its request source identity as the revision. An opaque source identity is not
converted into an invented numeric revision. Repeated captures of the same
retained result return the same object; a successful later render supersedes it.
While a newer revision is pending, the last valid result can belong to an earlier
revision of the same document epoch. Consumers must compare the returned revision
before treating it as the current projection. A document key/epoch change clears
the retained result even when the Markdown bytes are identical. Before any valid
result, and after unmount, capture returns `null`.

The ref contains no HTML, Markdown source, history or serializable render payload.
It is an in-memory identity reference, not a disposal checkpoint. Rejected
resource/disposal operations preserve the retained result; ordinary component
unmount releases it.

`captureRendererOwnedCheckpoint()` returns an opaque frozen metadata record:

```ts
{
  ref: string
  lastValidRenderRef: string
  documentIdentity: {
    id: string
    epoch: number | string
  }
  revision: number | string
  scope: 'renderer-owned-state'
  nativeRecovery: 'unavailable'
}
```

The same owner actually pins the authorized result/HTML/chunks/strategy together
with copied activated keys, mounted-chunk references, heavy identity contexts,
sequences/node ids and observed renderer state/metrics. It preserves actual
chunk-result/tracker references rather than synthesizing a checkpoint from an id.
Capture refuses known pending owned timers/frames/jobs, reentry, disposal,
changed generation/identity/revision or a superseded/mismatched live projection.
A failed capture leaves the previous pin intact. The pin remains bounded to one
record and survives a failed release; its actual copied collection entries remain
in logical memory census. After disposal it is historical retained state, not
permission to restore an unmounted renderer.

This covers renderer-owned stores only. It does not capture the Main native panel
textarea, focus/selection/composition, transaction history, editor mode/search,
clipboard/upload/embed/command effects, Vue flush state or provider resources.
Native element references preserve identity, not a frozen DOM subtree. There is
no native checkpoint restore or reversible disposal API yet; `restoreLastValidRender`
keeps its existing same-mounted projection contract and is not an owned-checkpoint
restore. All full checkpoint/recovery and session admission holds remain.

`restoreLastValidRender(ref)` returns a promise of
`{ ref, status: 'restored' | 'blocked', reason: string | null }`. It resolves the
ref through this renderer's sole private retained slot and checks the current
document ID, epoch, revision, request identity and render authority before
mutation. Unknown, superseded, switched, source-modified or busy refs are blocked.
Disposed or paused underlying owners, closed heavy-feature admission, pending
pipeline renders/adapter jobs, retained pipeline admission intent, active control
transitions, and heavy
imports/continuations/tasks
also block restoration. The operation reuses the actual retained HTML/chunk
projection and strategy, waits for Vue/viewport work and feature activation, and
rechecks generation and identity before reporting a restored result. A stale or
failed operation reports blocked; it does not mint a newer retained identity.

Restoration recreates the mounted projection only. Its result does not establish
that all resources stopped, that a session is ready, or that browser/native
rendering qualification passed. There is no restoration after disposal,
cross-instance hydration or crash recovery. A retained pipeline
`workerCallbackFailure` blocks restoration with
`markdown-renderer-worker-callback-failure`; this operation cannot clear or recover
that failure. A real pending failure-notification snapshot also blocks restoration
with `markdown-renderer-worker-callback-failure-notification-pending`, even if a
newer failure replaced the original publication snapshot. Observed disposed
worker scopes with retained slots/tasks/queue entries, or disposed pool context
with retained workers/tasks/queues/retains/timers/listeners, also block restore with
`markdown-renderer-disposed-worker-resource-residue`. These observations do not
infer why cleanup failed or prove workers stopped.
Unknown or absent optional native listener registration also blocks restoration
with `markdown-renderer-worker-listener-registration-unavailable`; it is never
interpreted as no listener.

`getSessionResourceSourceOffer()` returns:

```ts
{
  complete: false
  measuredUsageOnly: true
  missingSourceDependencies: readonly string[]
  sources: {
    rendererNative: {
      renderWatchHandleRetained: boolean
      stoppingRenderWatch: boolean
      capturingOwnedCheckpoint: boolean
      effectCensus: 'unknown'
      flushJobCensus: 'unknown'
    }
    rendererOwnedCheckpoint: object | null // Metadata of the actual pinned record.
    renderPipeline: object // Actual runtime/hardware inspection.
    virtualWindow: object // Actual viewport inspection.
    heavyFeatures: object // Actual active and retired handle inspection.
  }
  diagnostics: {
    renderWatchCleanupFailure: { phase: 'render-watch-stop'; error: unknown } | null
    workerCleanupResidue: { ownedScopes: readonly object[]; poolContext: readonly object[] }
    workerCallbackFailure: object | null // Actual pipeline failure record.
    pendingWorkerCallbackFailureNotification: object | null // Actual pending snapshot.
  }
  unknownUsage: object // Original timer/network/worker/pool and native registration values.
  knownNetworkRequests: number | null // null preserves an unknown heavy count.
  inspection: {
    ownerRef: 'renderer-projection'
    paused: false
    recoverable: false
    retainedListeners: number
    usage: {
      editorInstances: number
      renderers: number
      observers: number
      timers: number
      backgroundTasks: number
      networkRequests: number
      memoryUnits: number
    }
  }
}
```

The measured subtotals describe directly held component timers, RAF handles,
owned scheduled frame descriptors, live asynchronous jobs, abort/theme listeners
and activation observers. Actual runtime/hardware/viewport inspections contribute
measured handles, listeners, promises, observers and collection entries. The
pipeline owner's real pending render admission and active control-transition Set
entries contribute to background tasks and logical retained units. Both block
restoration until the actual intent is cleared or the transition finally settles. Worker
counts come only from the runtime's exact owned task scopes; shared pool totals
remain context and are never attributed to this renderer. The original
inspections remain exposed under `sources`.

The renderer requests heavy-feature admission closure when a document/render
generation changes and reopening for a fresh render through the real owner.
The inherited owner now guards admission again after callbacks and preserves
retired pending work through real settlement. Continuation keys include the
actual bridge capability, and this renderer additionally namespaces them by its
instance identity. Timer/network cancellation remains unavailable, and source
fixes do not establish safe resource suspension, revive disposed runtimes or
establish a fully paused renderer. The heavy
inspection retains retired provider tasks, imports, continuations and handles
until their actual settlement, including work that outlives realm removal or
unmount. Component jobs leave the census only in their actual `finally` blocks.
Cancelling a handle does not erase an unsettled promise. Memory units count
retained logical resources and collection entries, not physical heap bytes.
`diagnostics.workerCallbackFailure` preserves the actual pipeline failure count,
error, phase, event type and worker identity. Its cumulative failure count is not
an active-job count. A retained failure contributes one logical diagnostic record
and adds an explicit missing recovery dependency; it never becomes a success ack.
`diagnostics.pendingWorkerCallbackFailureNotification` preserves the actual
pending snapshot, not an inferred publication status. A distinct pending snapshot
adds one logical retained record; it is never counted as a worker job. A null
pending snapshot does not establish successful delivery or recovery, and the
retained failure continues to block restoration.

`diagnostics.workerCleanupResidue` exposes actual disposed owned-scope
inspections and separately identified pool context. Failed native termination can
retain a real slot and task identity even after its promise settled. Existing
worker/task/listener/deadline census remains intact; logical retained units also
include actual scoped slot entries. Pool totals remain unattributed context and
never enter renderer usage. Diagnostic views do not invent jobs or cleanup acks.
The residue view also preserves a disposed inspection whose actual `queueDepth`
is positive, even when pending tasks and slots are empty. A queue-only pool stays
unattributed context. Queue entries do not establish pending promises or active
worker jobs, and this guard adds no usage counts. Such observed residue blocks
restore through the same cleanup-residue check.
The direct worker cleanup API may rethrow observer errors after continuing its
batch; its explicit disposal retry is terminal cleanup, not resume or recovery.
The composed worker candidate sets quarantine before teardown and prevents
dispatch to that retained slot, including when native termination throws. Its
actual scoped slot inspections expose `quarantined` and `dispatchable` unchanged
through the pipeline source. These booleans are never added to worker/job counts.
The worker owner's optional `abortListenerRegistration` and
`visibilityListenerRegistration` distinguish `none`, `registered` and `unknown`.
The raw fields stay under `sources`; `unknownUsage.workerAbortListenerRegistration`
and `unknownUsage.workerVisibilityListenerRegistration` preserve their values,
including an absent field as `undefined` (unavailable). Unknown or unavailable
registration adds an explicit source dependency and blocks restore. Actual abort
listener counts describe unresolved owned cleanup hooks, including hooks whose
native registration is unknown. Shared visibility counts remain pool context.
No registration state is converted into a native listener count or an aggregate
zero. A settled task contributes background work only when the same inspection
still contains a live slot whose id matches its `workerId` and whose
`activeTaskId` matches the task id. A non-null worker id or a slot now executing
another task does not establish that association. Cleanup-only retained task
entries and hooks stay in memory/listener census; pending promises continue to
contribute actual work entries. The composed producer repair also clears stale
task-to-slot links and matches the active task when exposing a worker id. Its
independent review remains pending, and the source offer preserves that dependency.
Alive does not establish dispatchability, and quarantine does not prove cleanup
or recovery. Independent review source-closes the handlerless-slot dispatch
finding. The worker owner's composed admission repair rechecks actual pending
membership and disposal after cancellation/preemption callbacks, generation and
queue capacity before enqueue, and live task membership before crash retry.
The composed source also rechecks admission after request getters and preserves
actual native cleanup knowledge across synchronous registration/retention/cleanup
windows. Independent review confirms unknown/absent registration refusal and
preservation of the queue-only guard, and source-closes the earlier getter finding.
The composed producer also preserves actual preparation authority, settles
registered tasks when admission raises an exception, retains late/failed handler
cleanup ownership and closes admission before disposal callbacks. Independent
review of these source repairs and the consumer association correction remains
pending. The composed shared-pump repair keeps task-owned exceptions with the
actual failing request and reports pool failures without attributing them to a
different editor's caller. Retained cleanup and error reporting do not establish
successful settlement delivery, recovery or complete qualification. Independent
review source-closes the shared-pump resource-isolation finding. The composed
reporting repair retains original factory/dequeue/settlement causes and uses one
actual callback snapshot with its original receiver. Independent review remains
pending; reporting does not establish resource or recovery qualification.
The source offer preserves the cleanup dependencies and
continues to refuse complete participant operations. This conditional consumer
guard does not establish that the renderer had a reproducible restore bypass.

This source offer is deliberately partial. Adapter internals, worker internals,
shared pool attribution, platform observer callbacks, heavy-runtime timer/network
resources, and activation/gateway loader imports remain explicit gaps.
`unknownUsage` preserves the original unknown/unavailable values; a nullable
`knownNetworkRequests` preserves an unmeasured heavy network count. The integer
`inspection.usage.networkRequests` counts direct component requests only. Other
integer fields are measured subtotals, never complete totals. Neither an unknown
nor a shared pool is converted to an attributed zero. The `inspection` must never
be submitted as total session usage or a successful paused acknowledgment.

`getSessionResourceParticipant()` returns the same `renderer-projection`
participant object on repeat calls. `inspect()`, `pause()` and `resume()` currently
throw `markdown-renderer-session-resource-source-unavailable` with the missing
source dependencies before mutation. `dispose(snapshotRef)` throws
`markdown-renderer-session-checkpoint-not-recoverable` and preserves the retained
result. Do not register this participant as an available session owner while
these refusals remain. Full renderer census and epoch-safe pause/resume require
the real underlying resource owners; recoverable disposal additionally requires
validated renderer restoration. Completing this renderer alone cannot establish
the fixed editor session roster or permit session eviction.

### Source boundary for full checkpoints and reversible control

The following is a checked source boundary and the minimum next implementation
scope. Required APIs below are requirements for the real owners, not implemented
APIs, exported stubs or additional session participants.

The current retained slot contains the actual authorized render result and its
HTML/chunks/strategy with the original document id, epoch and revision. It does
not contain a full renderer/native checkpoint. Activation controller/observer,
mounted chunk elements, activated-key sets, heavy projection contexts, viewport
measurements, queued callbacks and Vue effects have separate live storage.
`resetFeatureActivation()` clears several of those stores. Ordinary unmount
clears the projection and terminalizes hooks, so its disposal cannot be reversed
by the retained render ref. Failed cleanup observations and unsettled jobs must
remain retained; neither a snapshot nor an abort authorizes clearing them.

| Actual source capability                                                                              | Current boundary                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The installed Vue 3.5.32 `WatchHandle` has `pause`, `resume`, and `stop`.                             | The renderer now binds its actual `watch()` return handle into the existing owner. A watcher pause is not a census or pause of the component render effect, Vue flush queue, hook watchers, or an already running asynchronous job.             |
| The existing owner tracks exact timer, RAF, keyed scheduler, abort-cleanup and unsettled-job records. | Timer records do not retain their callback/deadline; cancellation settles frame waits and drops keyed callbacks. They cannot be reconstructed from numeric handles. Failed native cleanup must retain its original record and error.            |
| Runtime and viewport hooks expose actual `inspectResources`, `pause`, and `resume`.                   | Both explicitly report `recoverable:false`. Viewport platform callbacks remain unknown; resume reconnects current state rather than restores a disposed checkpoint.                                                                             |
| Heavy lifecycle exposes real admission pause/resume and retired work census.                          | Timer/network cancellation is unavailable. Admission closure or an aborted signal does not prove native work settled or stopped.                                                                                                                |
| The original shared frame scheduler owns its queue and handle.                                        | Pause cancels queue entries; resume permits newly recreated work. The renderer must not pause the shared scheduler globally or create a second scheduler owner.                                                                                 |
| Native clipboard, upload, embed and command operations live in the editor/provider consumers.         | Clipboard promises have no supplied cancellation signal; upload cancellation changes job phase and requests abort; embed/command signals guard identity but do not establish transport/native stop. These are outside the renderer's ownership. |

The minimum independent renderer change stays in its existing SFC/private owner:
the real render-watch handle is now retained; next, gate renderer admission and each commit with
the existing epoch/generation authority; retain sufficient original owned callback
descriptors for current-state recreation; and record cleanup failures while
attempting the selected owned cleanup batch. Preserve the original authorized
projection/checkpoint pin and every unresolved listener/job record. These can
prepare reversible control of directly owned work. They cannot by themselves
produce a complete paused inspection, full native checkpoint or recoverable
disposal. This source offer now explicitly names the missing Vue effect/flush,
owned event-registration and callback-checkpoint capabilities. Those dependency
entries themselves add no usage counts or execute control transitions.

The watcher binding is a real owned handle, not a new resource participant.
Ordinary unmount calls its native `stop()` and releases that exact reference only
after the call returns. If it throws, the handle and actual error remain under
`sources.rendererNative` and `diagnostics.renderWatchCleanupFailure`; an immediate
watch setup that reentered unmount also uses this same owner cleanup path. A
retained handle/failure each contributes one actual logical memory record, and an
in-progress owned stop contributes one running control entry. These describe
owned records/calls only. `unknownUsage.vueEffects` and `unknownUsage.vueFlushJobs`
stay `unknown`; a null failure means no observed stop failure, not successful
global Vue cleanup. Full renderer controls and recoverable disposal still refuse.
An in-progress owned checkpoint capture likewise contributes its actual running
control entry. Stored checkpoint memory counts the real pin plus its copied
collection entries; it is not a physical heap estimate or a native recovery ack.

For these requirements, `authority` means the actual current
`{documentIdentity:{id,epoch},revision}`; `checkpointRef` means an opaque ref held
by the original owner. `SourceInspection` must preserve actual pending/running
work, native registration knowledge, failures and unknowns. An incomplete source
inspection is never submitted as the session's seven integer totals. An operation
that cannot stop or resume its real resources must retain the evidence and refuse.

| Existing owner/consumer boundary                     | Required reversible APIs and behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Vue component/effect owner                    | `inspectNativeEffects(authority)`, `pauseNativeEffects(authority)`, `resumeNativeEffects(authority)` returning real source inspections; `captureNativeRendererCheckpoint(authority)` and `restoreNativeRendererCheckpoint(checkpointRef, authority)`. Cover the actual render effect, owned watchers, queued/running flush callbacks and mounted view state. One watch handle is insufficient. Restore must reject stale/unmounted identities and wait for the real accepted render/flush completion. |
| Owned DOM/event registrations                        | `inspectOwnedEventRegistrations(authority)`, `detachOwnedEventRegistrations(authority)`, `reattachOwnedEventRegistrations(checkpointRef, authority)`. Retain the exact target, callback, options and native registration knowledge. A failed/uncertain detach keeps its cleanup record; reattach must not duplicate registrations or target a different document/realm.                                                                                                                               |
| Original viewport/frame owners                       | `captureViewportCheckpoint(authority)`, `restoreViewportCheckpoint(checkpointRef, authority)` plus `captureOwnedFrameTasks(ownerKey, authority)`, `pauseOwnedFrameTasks(ownerKey, authority)`, `resumeOwnedFrameTasks(checkpointRef, authority)`. Preserve actual viewport/index/anchor state and owned callback descriptors; reject an active phase or unknown callback queue. Use the original scheduler and reconstruct guarded current-state work rather than replaying stale closures.           |
| Native clipboard consumer                            | `closeClipboardAdmission(authority)`, `inspectClipboardOperations(authority)`, `resumeClipboardAdmission(authority)`. Keep each native read/write promise until its actual settlement. An in-flight noncancelable clipboard effect blocks a complete pause. Resume admission must not replay a read/write or claim to restore the operating-system clipboard.                                                                                                                                         |
| Upload transport consumer under the attachment owner | `inspectUploadAttempt(attemptRef, authority)`, `pauseUploadAttempt(attemptRef, authority)`, `captureUploadCheckpoint(attemptRef, authority)`, `resumeUploadAttempt(checkpointRef, authority)`. Bind actual batch/item/attempt and transport identity, progress, pending promise and cleanup. If the transport has no true continuation/stop API, report that limitation and refuse reversible recovery; abort/retry with a new attempt is not resume.                                                 |
| Embed provider under the attachment/embed owner      | `inspectEmbedRequest(requestId, authority)`, `pauseEmbedRequest(requestId, authority)`, `captureEmbedCheckpoint(requestId, authority)`, `resumeEmbedRequest(checkpointRef, authority)`. Preserve request/node identity, original authorized target version/projection and actual provider work. Do not re-resolve a potentially changed target and call it checkpoint restoration.                                                                                                                    |
| Asynchronous command consumer                        | `inspectCommandAttempt(attemptRef, authority)`, `pauseCommandAttempt(attemptRef, authority)`, `captureCommandCheckpoint(attemptRef, authority)`, `resumeCommandAttempt(checkpointRef, authority)`. Preserve actual pending effects, attempt id, rebased anchor and committed outcome. Abort or a stale-result guard is not native cancellation; resume must not invoke an irreversible command twice.                                                                                                 |

These source offers must bind into the existing closed owner roster through the
original owners. The renderer does not acquire clipboard/upload/embed/command
ownership, add a replacement participant, or edit the common editor contract.
Full checkpoint capture must fail while any required owner is absent or cannot
capture its actual state; a failed capture/release must preserve the last valid
checkpoint and failure residue. Source/static preparation does not lift runtime,
native, security, receipt, renderer/restore or fixed-roster qualification holds.

### Selected ordinary-unmount cleanup batch

The existing renderer owner snapshots real timer/frame/abort/watch cleanup and
the SFC supplies its exact theme/controller/observer/heavy references. Every
selected action is attempted despite earlier exceptions. The batch rethrows the
original single error or an AggregateError containing all caught errors after
completion. Failed handles and original distinct causes remain under
`diagnostics.cleanupFailures`; they are retained proof/memory, never active job
counters or native cleanup success receipts.

Timer/RAF records are removed only after native cancellation returns. Keyed-frame
cancellation and its finalizer are attempted separately; a failed queued handle
or finalizer stays available for retry. Abort cleanup is owned before registration
and late installation is cleaned after return. Theme removal uses the original
retained target, with installation/removal reentry guards. Controller/observer
fields clear only after their own native call returns. Watch failure cannot skip
later theme/abort/observer/heavy cleanup. Underlying heavy retired work and unknown
native state remain exposed.

Disposal closes admission before callbacks. Reentrant disposal cannot recursively
execute the same batch, and repeated calls select remaining actual resources.
View reference release is a separate attempt-all phase after selected native
cleanup returns and known owned residue is empty. Failure preserves original
projection/checkpoint pins and unresolved jobs. Original errors are retained
through retry; no failed reference is cleared merely to report zero. A nested
skip, native call return or heavy-owner disposed flag is not complete cleanup,
recovery, renderer acceptance or an eviction acknowledgment.

These throw/reentry/retry branches were inspected as source only. Original test
entry/import/hook and exact-case review are required before fault-injection runs;
all runtime/test/list/browser/native/worker qualifications remain held.
