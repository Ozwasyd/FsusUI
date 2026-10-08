# PublicShell explicit short-landscape modes — WIP

The owned full/critical PublicShell CSS now shares one row with expanded search, inline navigation and existing action slots when their actual minimum widths fit. Empty action wrappers no longer consume gaps. In the original production fixture, every sampled full-CSS mode/state/theme measures **45/67/90px at CSS zoom 1/1.5/2**. At 736×320 and zoom 2, expanded search improves 254→90px and inline-expanded 366→90px. At 667×375, inline-expanded progresses 194→98→90px across the preserved attempts. All meaningful modes/slots and 44px actions remain; BottomTabBar retains its 56px minimum.

**Issue #828 and ProductUX remain open.** The full visual gate is red, the literal combined 34% budget has incompatible ranges, independent UX review is pending, and published-package parity is unproved. These local source/build/component results can be consumed without claiming qualification. No Blog product, matrix, helper, assertion or golden changes are included.

## Exact source

- Latest fetched/verified UI main before work: `b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2`.
- Frozen parent: draft PR #851, `51b51eb1b3c9ccbae5cbdc7fb265c724320568ab`, stacked on #844. Original padding `ad82fbc053a7a19a1ca23d06e10446dd3b11d475` and tested product `5d6541461ccd96bd9edba0a223635920682a8e13` stay distinct.
- Canonical syntax-only #860, `4260996e5e0922c0683fdef4d01e3a83832bba3d`, was inspected: only four Cascader/Menu constructor files. Exact `-x` consumption: `7193be992f05897b8dd6d6e16783ca90952a5914`. No sibling implementation is recreated.
- Owned source commits: `abb0adee344e87dda5d774cad0ea76ba9d8ec199` (horizontal composition); `a8c2b82c6902733d95aaaf11a7fdc28a1efd454d` (input bounds/action minima); `47b68380266da1c15d89265b8bc08ec1191ad65b` (true min-content reservation); `b0a43ba59ff3be6a423ab950822960042851caa5` (existing compact spacing); `69705ac1ca5d3c07fa955486646a1861ba5bb50a` (empty action wrapper).
- **Final product:** `69705ac1ca5d3c07fa955486646a1861ba5bb50a`. **Exact tested candidate:** `d182cf93cbb852006047bc2b7eea0ba28daa4955`. The latter is the original API producer's own generated derivative; product/fixtures/assertions/goldens do not change. The later evidence commit must not be relabeled as the tested product.
- Valid preimplementation classifications were committed at `b2ff33571f3811098325d595624d33abc29156cb`, `2ea638c03cd6ae9705fb7b323c7ce2f9925e6946`, `293cac70891e7c7e2690a9a180af5b9a0c17a041` and `b04b49b3de690181c6c223cd629b53333390215d`. Actual schema/seal/authority-digest checks are retained. No independent UX receipt is invented. The old invalid classification and rejected UX receipt stay unchanged.

Initial width hook commits failed because unconfigured pnpm tried a missing home store. Only the owned two-file patch was saved/restored; clean `2f76110` source was reclassified/sealed and committed before reapplication using configured pnpm 10.33/store. First receipts/install failure are retained; no hook was disabled.

The prior independent PublicShell reviewer used live Blog `d1b2c66cdf982d9a9f58db4a98ca2f83db3a71fd`. `894e729968b2e5bc4db78677976b5e79aa179848` is strictly an #825 touch replay report, never that PublicShell source. The same reviewer, thread `01a11b52-ec77-7602-9d9e-3f040157403f`, must inspect this new exact candidate.

## Actual commands and results

Original logs, exit codes and runtime identities are retained. CI was unset for the original local Playwright profile, which configures zero retries. No original assertion, snapshot, timeout or retry was changed. The own production HTTP index and 20 referenced assets matched the own build byte-for-byte. The prepared manifest records Node 24.19.0, pnpm 10.33.0 and Playwright 1.59.1. Native Chromium is used; no WebKit/iOS/Blog admission is implied.

| Command/evidence | Actual result |
| --- | --- |
| `pnpm run ensure:icons`, `ensure:wasm`, `build:theme`; `node scripts/prepare-visual-runtime.mjs` and its original `--check` | Each exit 0. Genuine own locked-dependency/native WASM bundle and original production runtime; no install stub labeled as runtime. |
| `pnpm exec vitest run --config vue/vitest.config.ts --maxWorkers=1 vue/packages/components/public-shell/__tests__/public-shell.test.tsx vue/packages/theme-chalk/__tests__/public-shell-reduced-motion-state-machine.test.ts vue/packages/components/markdown-renderer/__tests__/markdown-renderer.test.tsx` | 67 pass in 3 files, exit 0 on final product `69705ac1`. |
| `pnpm run typecheck:no-cache` | All four actual web/node/vite-config/vitest projects exit 0. |
| `pnpm run avalonia:baseline:check` | Initial `a8` and `b0` stale checks exit 1, preserved. Read-only producer projections identify only owned CSS-variable used-file references/hash metadata. Original `avalonia:baseline` and recheck each exit 0; derivative `d182` identifies `69705ac1`. No foreign copy/manual baseline edit. |
| `pnpm run check:documentation-architecture`, `check:fsusui-design-conformance`, `tokens:check`; `node scripts/conformance-v2-vue-public-gate.mjs` | Each exit 0. Design checker retains 12 negative controls; public gate: 228 components/2455 members/62 web-only. These checks do not create UX acceptance. |
| `pnpm exec playwright test --config=vue/playwright.config.ts vue/tests/visual/public-shell-mobile-nav.spec.ts vue/tests/visual/public-shell-desktop-search.spec.ts --workers=1 --trace=on --output=/tmp/2228-828-empty-shell42-first` | 42/42 pass, exit 0, 40.0s; all four original projects. All 42 success traces/screenshots retained from actual CLI output. |
| Existing 30-interaction probe against original production fixture | 30/30, exit 0: keyboard order, Search Enter/focus/Escape, Menu native Enter/Escape, action hit tests after native scrollIntoView and touch search. |
| Read-only 480-row visible-control diagnostic | 0 unhittable visible centers; 480 native inline-nav focus/scroll/hit checks succeed, minimum visible logical width 45px and height 44px. Search wrappers: 120 full +120 critical observations, all height 44px and centers hit. Native input content is smaller inside the 44px widget; it is not falsely called a 44px native input. |
| Final 756-row component capture | Capture exit 0, 0 page-error/overflow rows; **72 header and 176 combined-chrome budget failures retained**. Capture completion is not 756-pass qualification. |
| Original `pnpm run test:visual:full` on exact `d182` | **Exit 1: Preview 647 pass/41 fail of 688 (9.2m); Dev 8 pass/11 fail of 19 (6.4m). Same invocation: 655 pass/52 fail of 707.** All 52 first-failure directories/traces/screenshots/contexts retained. |

The first shell trace exporter looked at the default Vue path, producing an empty ZIP. That record is preserved separately and explicitly superseded by the actual CLI-output archive, without rerunning tests. The earlier `b0` runner recorded its source at preview start; its 42-test command did not independently sample metadata HEAD. A classification-only commit arrived during that run with no product/runtime change. The clarification file preserves this limitation; the final runner records `d182` per command.

Prior gates remain separate: original `5d` Preview **646/42**, followed by Dev WASM admission refusal before 19 tests; later **9/10 Dev** was a separate command. Newer `2f` full invocation: **648/40 Preview and 9/10 Dev**, exit 1. Its 50 failure directories and original generated metrics are archived. Of its 22 mobile PNG comparisons, 21 match frozen baseline bytes/RGBA and one differs by 14 RGBA pixels; no cause/waiver is invented. Final `d182` independently compares all 22 current mobile PNGs: all 22 match bytes and RGBA. Neither comparison waives failures. Original `5d` evidence remains unchanged.

Original component attempts are immutable: before 756 rows has 452 header/508 chrome misses; first horizontal attempt has 72/176 misses and 38 critical-only overflow rows; next attempt removes overflow but retains overlapping control boxes; reserved-grid attempt has 74/178 misses and 194px narrow inline-expanded. Final native clipping/hit checks are not assigned retroactively to these attempts. Critical-only disables original production styles and loads original built critical CSS; foundations/fonts/component styling are absent. It is standalone geometry evidence, not full-theme/package parity.

## Incompatible ranges and minimal decision

At 200%, one 44px logical target needs at least 88 rendered CSS px. Even zero border/padding cannot fit 34% when **H<258.823530**. Actual full header 90px requires **H≥264.705883**, hence integer height 265. Sampled 736px-wide default headers, including expanded search/inline, now fit at heights 265–311. These are necessary measured floors, not universal width/locale/custom-slot/safe-area acceptance.

Explicit bottom mode retains the 56–64px minimum. Even 44+56 logical px at zoom 2 gives at least 200 rendered px, requiring **H≥588.235295**, outside every H≤520 short-landscape bottom/zoom-2 case. Actual full combined chrome 102/152/204px at zoom 1/1.5/2 requires **H≥300/447.058824/600**. Safe-area/custom content can increase those floors. Critical-only 101/151/202px does not replace full-theme/current-package acceptance.

**Smallest owner decision:** specify an explicit combined-budget exception for the impossible ranges, or the supported height/mode domain replacing the literal all-height condition. Root does not make that contract change, shrink targets, hide/remap meaningful modes, change authorities or relax goldens.

## Root handoff and remaining gates

Blog #2228 still needs current-source DebugStack/ReleasePreview/AOT/deep fallback, real fixtures, current identities and required Chromium/WebKit evidence. #2229 needs genuine iOS 17+ cutout/HomeIndicator Safari/operator evidence on the same accepted candidate. #1789 aggregates those unmet children. Formal readiness request remains Blog #3475 comment 6053177437; parent must supply the exact current owner/capability. No event #1984, provider/security/runtime receipt, shared-DB bootstrap, iOS result or package parity is fabricated. Historical UI #641/#640 does not identify a guessed active DAG owner for non-owned Editor/motion/demo/lifecycle failures; those need the parent's exact handoff.

Already-closed Blog #3477 is independently reverified on latest fetched master `5798707d359ce5ee57752aa868d0ccbf3f889494`: original checker exit 0, 3 surfaces/4 mutation negatives, unchanged blob `04ecf201800231f71f66388a17a432c87c73c7b5`. No duplicate implementation or state write.

New PR/comment/issue content writes remain under the central 403 embargo. Ordinary isolated Git source/evidence pushes are authorized; prepared PR body and compare links support central draft creation later. Existing #851/#3931 drafts stay unmerged. No master push, merge/auto-merge, deployment or package publication. The consumer patch changeset is included. Full root lint/unit/build/consumer workflows are not represented as all-green equivalents of bounded checks. Rollback can discard the unmerged support branch or separately revert only the five owned PublicShell source commits and regenerate its API metadata; immutable evidence must remain.
