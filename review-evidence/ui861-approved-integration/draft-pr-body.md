## Summary

Compose the independently reviewed SelectV2 fixes from #861 with approved canonical metadata, migration identity, and conformance runner increments. SelectV2 restores its documented focus/blur path and option accessibility semantics; trace runners bind existing test inputs to the exact checkout/base commit and preserve original collection diagnostics.

The isolated source head is `a58cae49d4cbbed48e62c877bab24a7c0041bef6` on `integration/ui861-approved-increments-20261009`, based on fresh main `b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2`. All 16 changed file blobs match their approved sources. The branch retains #861 ancestry and cherry-picks only the four distinct approved increments; no duplicate SelectV2 ancestor commits or extra implementation changes.

## Linked Issue

Refs #825 and #861. Related draft PRs #865 (conformance identity) and #867 (migration baseline identity) remain open and unchanged; this handoff neither closes nor replaces them. Issue-specific runtime and published-artifact acceptance remains OPEN. #827 consumer package qualification remains separate.

## Impact Checklist

- [x] Component or public API impact is described: restored existing SelectV2 focus/blur behavior, inherited disabled state, combobox/listbox/option relationships, virtual option positions, and cancellation of stale refocus. No new public API or consumer kernel.
- [x] Theme token impact is described or not applicable: no token changes.
- [x] Motion token impact is described or not applicable: no token or timing-budget changes.
- [x] Element Plus compatibility impact is described or not applicable: existing documented SelectV2 APIs only; 83 focused unit tests passed. This is not a blanket compatibility certification.
- [x] Visual snapshot impact is described or not applicable: SelectV2 semantic/focus behavior can affect focus presentation; combined-head visual snapshot suite is UNRUN and visual acceptance remains OPEN.
- [x] Accessibility impact is described or not applicable: original reviewed SelectV2 ARIA roles/state/relationships preserved; Chromium representative-component interactions passed. Firefox, WebKit, native IME, and physical-device acceptance remain OPEN.
- [x] README or docs updated, or docs are not needed: canonical generated public baseline doc and contract metadata reconciled to approved component source; no additional consumer API introduced by internal runner/identity changes.

## Release Notes

- [x] Changeset added for user-facing package changes: existing `.changeset/select-v2-focus-accessibility.md` retained exactly.
- [ ] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs

No breaking change is intended. Internal trace diagnostics, canonical metadata, and migration identity bookkeeping do not independently require another changeset.

## Validation

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run test`
- [ ] `pnpm run build`
- [ ] `pnpm run verify:visual:affected` if UI, theme, motion, layout, icons, or demo output changed
- [ ] `pnpm run test:consumer-install` if public package output, exports, install flow, or registry behavior changed

The full repository gates above are UNRUN. Exact-head local focused results:

- PASS: `pnpm install --frozen-lockfile --offline --ignore-scripts --store-dir /workspace/.setup/pnpm-store`; all nine original authority/dependency/identity/governance checks (exact commands and logs in `check-results.json`). Pins, lockfiles, and producer rules unchanged.
- PASS: `node scripts/avalonia-vue-public-api-baseline.mjs --check`, `node scripts/component-contract-registry.mjs --check`, `node scripts/contract-v2.mjs --check`, and `node --test tests/contract-v2.test.mjs` (49 tests).
- PASS: `node --test tests/conformance-playwright-identity.test.mjs` (18 tests after preparing the expected `.tmp` directory), plus both original Markdown/conformance owner-policy checks. Initial fresh-checkout regression run FAILED 17/18 because `.tmp` was absent; original failed log retained, no test edit made.
- PASS: focused ESLint on all changed JS/TS/Vue files, `pnpm exec vitest run --config vue/vitest.config.ts vue/packages/components/select-v2` (83 tests), and `pnpm run typecheck:web:no-cache`.
- Vitest typecheck initially FAILED because original build-utils declarations were missing. Original `pnpm -C vue/internal/build-utils run build` FAILED exit 1 on implicit `@pnpm/types` bundling warning. It emitted declarations before failing; `pnpm run typecheck:vitest:no-cache` then PASSED using those artifacts. The producer itself remains FAIL; no strict warning controls were relaxed.
- PASS: original Playwright config collected all six tests (two each for Chromium/Firefox/WebKit). Initial list command using `pnpm -C vue` FAILED due to no workspace package there; corrected original-config command and both logs retained.
- PASS: actual combined-head Chromium conformance cell (two tests, zero skips, two genuine interaction JSON traces, 14 actions), baseline `b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2`, candidate `a58cae49d4cbbed48e62c877bab24a7c0041bef6`, browser revision 1217. Explicit configured `PLAYWRIGHT_BROWSERS_PATH` used with original build/preview server; no CSP/security or selector bypass. Initial cell FAILED because the process looked in an unconfigured browser cache; original report, failure ZIPs and receipt retained separately.
- FAIL: original three-browser conformance aggregate verifier (exit 1): required Firefox/WebKit receipts absent. Current-head Firefox/WebKit are UNRUN due to known host limitations; prior genuine failures are retained at evidence SHA `c5d85038a61109d9be31cf5cb7f7be69ce8faea1` and source `80f6e96b8d5419942583711fb417492b1f0abb67`, explicitly not current-head browser evidence. Firefox hit read-only `/proc/self/uid_map` and unwritable font/dconf caches; WebKit lacks seven host libraries listed in the handoff.
- PASS: fresh `git merge-tree --write-tree b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2 a58cae49d4cbbed48e62c877bab24a7c0041bef6` exit 0, tree `310d454ebc6f6197486569b9f9031ea71df600ce`. Source branch pushed and remote exact SHA verified.

## WIP and review ownership

Full CI, full visual coverage, Firefox/WebKit, official native/platform/AOT artifacts, native IME/device evidence, published package consumer acceptance, and authenticated Blog manage-write in both themes remain OPEN. Chromium success does not qualify the three-browser aggregate or issue completion. No package publication, default-branch push, credentials/App grants, API content write, merge, held audit, RepositoryRoot helper, AOT workflow edit, budget relaxation, or security/CSP change was performed.

The real Blog-owned local alias still resolves through `/workspace/FsusUI` at frozen `2103366e4a3d79e0dc5ab0ac5445afc2f1f35216`, with Vue owned by Blog. Blog remains clean at `6e287562b3f861d3eb81dcb23f93e6243205abd8`; original2228 owns shared consumer runtime evidence. Existing frozen review heads are preserved.

Root alone creates/updates this draft PR and its public content; the separately root-created reviewer owns merge review. No merge authorization is inferred from these focused results. Roll back this isolated integration by retaining the original #861 head `83036006069be5cfcd09724273d5705d8f848ad0` and omitting the four cherry-picked increments; no existing branch needs modification.
