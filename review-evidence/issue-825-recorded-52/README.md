# Recorded issue 825 visual evidence

This evidence branch is archival only and must not be merged into product source. The implementation correction is on `fix/issue-825-server-ownership`; its parent 74a232 remains frozen.

## Actual recorded identity

These are original artifacts from `pnpm test:visual:full` at source **3edfed2c6d119a302b7d50031e300761d1d22e59**: preview 646 passed / 42 failed; development 9 passed / 10 failed. They are not a new run of 74a232 or the server ownership correction, and are not independent acceptance.

`issue825-corrected-full-visual.log` is the unchanged original terminal transcript. `current52-case-table.json` contains all 52 exact case names, original failure blocks and trace paths. `artifacts/` preserves all 52 original trace ZIPs, 117 screenshots (actual/expected/diff where recorded) and 52 error contexts. The bare development markdown-stress timeout omitted by the earlier 51-trace extractor is included from the separately recovered original trace. `manifest.json` binds every original payload with its SHA-256; the original copied payload bytes are unchanged. `prepared-runtime/` preserves the original prepare and identity evidence.

For any row, use its `trace` path relative to `artifacts/`:

```sh
pnpm exec playwright show-trace review-evidence/issue-825-recorded-52/artifacts/<row.trace>
```

`first-root-causes.*` is implementation-owner analysis, not a waiver. The default-toolbar subtraction retained borrowed renderer changes and is not a full main checkout. Unchanged main source does not establish a fresh-main runtime pass. The prior51RowArtifact note in the original case-table predates the later inline named-row comparison; it is retained as original recorded content. The later comparison established that Calendar title locale passed, the four long-HTML/scroll stress cases persisted, the bare route stress timeout and TreeSelect timeout were additional; it did not establish project-specific equality of the three cancellation rows.

## Independent identity separation

The reviewer reported Vue 3.5.32 SSR 4/4 and other checks on 74a232. The implementation owner's dedicated 74a232 SSR 4/4 used the Blog-owned Vue 3.5.33/server-renderer pair. Neither result is relabeled as the other dependency identity. This archive is the earlier visual run only.

No snapshots, tolerances, test assertions, acceptance controls, review heads or source files were changed to publish this archive. Remaining visual failures stay open for their canonical owners and the same independent reviewer.
