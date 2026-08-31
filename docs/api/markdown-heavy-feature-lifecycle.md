# Markdown heavy-feature lifecycle contract

MarkdownEditor routes fenced-code highlighting, Mermaid, and inline/block LaTeX
through one internal lifecycle authority. This contract changes resource and
cache behavior only; Markdown grammar, source, transactions, selection,
diagnostics, atomic interaction, and the safe feature-output gateway remain the
authorities documented by the Markdown component contracts.

## States and activation

Each projected technical node moves through the same states:

```text
unmounted -> static-mounted -> active-work -> static-mounted -> unmounted
```

- `active-work` exists only while a current render/highlight request is needed.
- `static-mounted` retains the committed visual output without a node-local
  worker, renderer loop, listener, observer, or timer.
- `unmounted` retains no node-local executable resource. It may reuse only an
  immutable output entry that must pass through the safe output gateway again
  when committed to a new element.

Virtual-unit teardown aborts pending work. A document, revision, stable syntax
identity, relevant feature config, theme, locale, renderer version, or gateway
version mismatch prevents a stale commit. The stable syntax projection supplies
node identity; DOM paths, array indexes, source offsets, and body hashes are not
cache authority.

## Cache budget

The internal cache contract is versioned as
`markdown-heavy-feature-cache@1` and has both limits:

- at most 128 immutable entries;
- at most 4 MiB of estimated UTF-16 payload data.

Least-recently-used entries are evicted until both limits hold. Node-local state
never crosses document epochs, including when two documents have identical
source. Material theme/config/version changes create distinct entries instead of
clearing unrelated entries. Cache eviction does not mutate source, history, or
selection.

## Scheduling and observability

The lifecycle creates no RAF, interval, polling observer, or feature-local frame
scheduler. Layout-sensitive commits continue to consume the single editor-owned
[frame scheduler](./markdown-editor-frame-scheduler.md).

The renderer exposes current test observability in
`data-markdown-heavy-lifecycle`: active/static counts, activation/reuse/abort/
teardown/eviction/stale totals, cache entries/bytes, and independent retained
task/listener/observer/runtime counts. A declared retained resource without one
teardown hook fails closed; entering `static-mounted`, leaving the virtual
window, aborting, switching documents, or disposing releases that hook exactly
once. This attribute and the lifecycle implementation are internal diagnostic
evidence, not public component or hooks API and not source authority.

Security output still commits through the existing sanitizer/gateway on initial
render and cache reuse. CSP, XSS, source reveal, caret/copy/delete, IME,
selection, and undo/redo behavior are unchanged.
