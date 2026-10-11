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

| Name                          | Description                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| rootEl                        | Render container element.                                                                                            |
| captureLastValidRender        | Return the retained render ref, document identity/epoch and revision, or `null`.                                     |
| restoreLastValidRender        | Recommit the actual retained projection on the same mounted owner and matching revision, or report a blocked result. |
| getSessionResourceSourceOffer | Return the explicitly incomplete census of resources directly held by this renderer.                                 |
| getSessionResourceParticipant | Return the stable renderer resource participant; its complete lifecycle operations currently refuse.                 |

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

`getSessionResourceSourceOffer()` returns:

```ts
{
  complete: false
  measuredUsageOnly: true
  missingSourceDependencies: readonly string[]
  sources: {
    renderPipeline: object // Actual runtime/hardware inspection.
    virtualWindow: object // Actual viewport inspection.
    heavyFeatures: object // Actual active and retired handle inspection.
  }
  diagnostics: {
    workerCleanupResidue: { ownedScopes: readonly object[]; poolContext: readonly object[] }
    workerCallbackFailure: object | null // Actual pipeline failure record.
    pendingWorkerCallbackFailureNotification: object | null // Actual pending snapshot.
  }
  unknownUsage: object // Original timer/network/worker/pool unknown values.
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
Alive does not establish dispatchability, and quarantine does not prove cleanup
or recovery. Independent review source-closes the handlerless-slot dispatch
finding. The worker owner's composed admission repair rechecks actual pending
membership and disposal after cancellation/preemption callbacks, generation and
queue capacity before enqueue, and live task membership before crash retry.
Independent review of this increment and the queue-only consumer guard remains
pending. The source offer preserves the cleanup dependency and continues to
refuse complete participant operations. This conditional consumer guard does not
establish that the renderer had a reproducible restore bypass.

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
