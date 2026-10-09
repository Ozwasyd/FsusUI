## Summary

Compose the reviewed runner identity/failure-diagnostic fixes and fresh-checkout regression repair with actual main's SDK/locked-graph contract and the published MarkdownRenderer pending-theme correction. Existing SelectV2 public focus/blur/accessibility behavior and its approved canonical metadata remain in the reviewed ancestry.

Source `3baff077297ad15a1d205eba8dc0bc525483ff88` on `integration/ui861-renderer-sdk-20261009`; fresh main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`. All20 changed file blobs match consumed reviewed sources. All7 SDK contract files match actual main exactly. All4 renderer preimages match original base `ba90d4df9b0b76e3c8cf7b4a57ceab08ded13990`; final blobs match `7087a573feb1091791ae4445542b571679841214`. Renderer commits retain the9a482352ebb34b2c6fb079be5742626268cc34a7/397d1ce0226630fcd5b81be7dfb523e4fcd14037 provenance and the ab2c95d83a4a62e0efea417e33a2c8a2333d7a5c/7087 consumption links. No renderer rewrite, duplicated source kernel or actor-owned projection edit.

## Linked Issue

Refs #825, #842, #861 and #882. Related drafts #865 and #867 remain separate. SDK contract source from actual main corresponds to #868. Runtime, published-artifact and full-CI acceptance remains OPEN; no issue is closed by this handoff.

## Impact Checklist

- [x] Component or public API impact is described: retained reviewed SelectV2 existing focus/blur and option semantics; MarkdownRenderer now immediately aborts pending heavy activation on shared theme changes before the debounced rerender, including pending imports. No new public API.
- [x] Theme token impact is described or not applicable: no token values changed; existing shared theme event drives the corrected abort behavior.
- [x] Motion token impact is described or not applicable: no timing budget or motion token changed.
- [x] Element Plus compatibility impact is described or not applicable: original existing component APIs retained; no blanket compatibility qualification.
- [x] Visual snapshot impact is described or not applicable: asynchronous theme behavior changed; full visual snapshots and all4 reuse cells are UNRUN on this new source. Existing PR882 visual failures remain unresolved.
- [x] Accessibility impact is described or not applicable: reviewed SelectV2 relationships and focus controls retained; genuine Chromium public interactions passed. Firefox/WebKit/native/device coverage remains OPEN.
- [x] README or docs updated, or docs are not needed: original renderer documentation and both original user-facing changesets consumed. Public baseline still needs its owner827's genuine producer output for this actual combined source; no metadata identity handfill.

## Release Notes

- [x] Changeset added for user-facing package changes: original SelectV2 and Markdown pending-theme changesets retained exactly.
- [ ] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs

No breaking change intended. Internal runner/fresh scratch and source composition do not require another independent changeset.

## Validation

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run test`
- [ ] `pnpm run build`
- [ ] `pnpm run verify:visual:affected` if UI, theme, motion, layout, icons, or demo output changed
- [ ] `pnpm run test:consumer-install` if public package output, exports, install flow, or registry behavior changed

New exact-source checks actually run:

- PASS: original `node scripts/check-update-surface.mjs` (119 surfaces,11 exclusions,10 groups). No update-surface output gap and no tracked projection write.
- FAIL: original `node scripts/avalonia-vue-public-api-baseline.mjs --check`: `spec/baselines/vue-current.json` stale. A read-only call to the original producer shows only `source.inputTreeHash` and `source.outputHash` differ; public members/counts are unchanged. Original827 owns the tracked producer output; required original command `pnpm run avalonia:baseline` must run against actual source `3baff077297ad15a1d205eba8dc0bc525483ff88` using native dependency inputs. See shared-metadata-gap.json for exact inputs and computed read-only differences.
- PASS: original component-contract registry and contract-v2 `--check` on currently consumed metadata. The original owner should run these again after any officially produced baseline changes; no future result is inferred.
- FAIL: exact focused ESLint on published renderer Vue/test files: four `@typescript-eslint/consistent-type-imports` errors in renderer test lines50:34,54:12,75:12,81:18. The four annotations match original renderer preimage exactly; consumer made no correction outside ownership. Renderer Vue file has no errors in that command. See renderer-lint-gap.json.
- PASS: original finite renderer test command `pnpm exec vitest run --config vue/vitest.config.ts vue/packages/components/markdown-renderer/__tests__/markdown-renderer.test.tsx -t 'invalidates pending heavy activation when the shared theme changes'`:1 selected PASS;36 unselected (framework reports36 skipped), not aggregate37-case acceptance.
- PASS: original Chromium conformance cell:2 real tests,0 failures,0 skips,2 original interaction trace attachments,14 actions. Baseline `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`, candidate `3baff077297ad15a1d205eba8dc0bc525483ff88`, browser revision1217. Original build/preview and assertions retained; explicit configured browser cache, CI=true and private task port5314. No CSP/security, selector, timeout, skip or budget workaround; old traces are not rebound.
- PASS: original ensure:wasm cache verification after26 producer-input files verified byte-equal; original native icon outputs reused with312 current tracked input files verified equal to control. Original artifact SHA manifest and the prior icon-producer generated-index caveat are recorded; no strict package or ensure:icons cache qualification is claimed.
- PASS: `git diff --check 8db0ac8f49749e3e5f28be5051bb3d3ed71ada71 3baff077297ad15a1d205eba8dc0bc525483ff88` and fresh-default merge-tree exit0 (actual tree in fresh-main-conflict.json). Source branch pushed and exact remote head verified.

## Required owner inputs and WIP

Original827: produce the current public baseline through `pnpm run avalonia:baseline` on this actual source, then check applicable original contracts. Update-surface check already passes; consumer has no write authorization for these shared tracked projections. Strict package producer/source files remain exclusively827-owned and were not edited or run here.

Original renderer637: provide a source follow-up for the four retained lint errors if required by its canonical gate. This consumer only consumes published renderer blobs and will not rewrite them.

Firefox/WebKit, three-browser aggregate, visual reuse, native/platform/AOT, strict package/published consumers, full CI and Blog manage-write in both themes remain OPEN/UNRUN on this source. The prior local install-deps `su: Authentication failure` route remains stopped. There was no installation retry, credential/permission/security/certificate change, alternate installation executor, package publication, or GitHub issue/PR/API content write.

Unchanged18 identity and83 SelectV2 suites were not rerun for a report: exact source blobs are preserved, and their historical results remain bound to their historical SHAs. Frozen b7/a58/6583 branches, real Blog alias ownership and original2228 consumer ownership remain intact. Only the original finite new-combination renderer regression and actual Chromium cell were run.

Root handles the paused content queue and the same existing reviewer can assess the new actual source. No merge qualification is inferred from partial browser success. Roll back this independent successor by retaining frozen b7 and main8db; no existing review branch needs modification.
