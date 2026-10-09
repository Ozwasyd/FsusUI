# Published declaration authority and actual source integration

Final source: `2d05f240e5fb04ac0cd602b4ed638ffe00b1859b`, branch `fix/published-declaration-authority-20261009`. Actual canonical tarball SHA256: `6da2fe1a5573a04768a4f8280899b45dabaa4f93ca72a278d48c50faca17649a`. Implementation worktree is `/workspace/FsusUI-public-declaration-integration`. Canonical build and exact-SHA verification PASS. The artifact is local; no package was published.

This source includes all five actual compatible author source offers: DOM payload names ed53, Markdown payload names 9a389, ElTable core return 2b9, three public alias barrels 9aa, and TableV2 public class types f8e. Exact original/cherry-pick SHAs are in `source-offers.json`. Held TableV2 runtime performance, other native/table branches and new author evidence commits were not consumed as source. Own changes above 6b735 are only the two existing published dependency pins in `config/dependencies/npm-authority.json`; component, test, producer-script, source manifest and lock bytes are unchanged.

## Corrected actual artifact baseline

The canonical `prepare-npm-package.mjs` calls `applyPublishedExternalFields` and rebuilds external dependency fields exclusively from published authority. Source manifest declarations alone were insufficient: the actual 48ac and 6b735 tarballs omit type-fest/vue-router. Their previous preserved 191 and 10 logs remain actual historical locked-graph results, but stale lock edges supplied those undeclared dependencies. They must not be used as proof of fresh consumer dependency closure. This correction preserves the original artifacts, logs, source, lock/tool identity and frozen review branches.

The new source authority entries are existing exact install/source pins type-fest 4.41.0 and vue-router 4.6.4. The official projection logic and all failure controls are unchanged. No source lock or package version changed; source lock SHA256 remains `c7d35e65a7f82bf145786f0d5697a8fcff2109b7f47a85146ed0acb22510ce94`.

Fresh fixture locks were actually resolved by pnpm from distinct real tarball paths, followed by fresh frozen offline installs. The two pre-fix locks naturally removed only type-fest 4.41.0, vue-router 4.6.4 and its now-unreferenced devtools-api 6.6.4, with zero other changed or added package/snapshot blocks. The final actual artifact declares both dependencies; pnpm naturally restores all original third-party blocks exactly. There are no fixture-added type-fest/vue-router dependencies, overrides, upgrades, skipLibCheck changes or manual package graph repairs.

| Actual artifact check, strict=true / skipLibCheck=false | Result |
| --- | --- |
| Preserved historical 48ac artifact, stale locked graph | Historical FAIL 191; raw evidence remains frozen at 0bd761bf |
| Same actual 48ac artifact, fresh actual-metadata lock | FAIL 259: original 191 component diagnostics + 68 missing dependency diagnostics |
| Integrated 6b735 artifact, fresh actual-metadata lock | FAIL 78: 10 remaining component diagnostics + 68 missing dependency diagnostics |
| Final 2d05f artifact, naturally resolved fresh frozen install | FAIL 10: TS2307 x4 missing barrels + TS2339 x6 global exports; zero missing type-fest/vue-router diagnostics |
| Final four standalone motion probes, Bundler and Node16 | 8 PASS |

Producer is ts-morph 27.0.2 / embedded TypeScript 5.9.2. Actual consumer is Vue 3.5.32, TypeScript 6.0.2, vue-tsc 3.2.6, Node 24.19.0, pnpm 10.33.0. Package/tool/lock/artifact identities and exact raw/parsed diagnostics are recorded. The reported Blog Vue 3.5.33 shadow identity problem is separate and not substituted for any of these results.

## Exact final source controls

| Command / control | Actual result at 2d05f |
| --- | --- |
| `pnpm package:candidate:build` | PASS |
| `pnpm package:candidate:verify --tarball dist/npm-candidate/fsusui-npm-candidate.tgz --commit 2d05f240e5fb04ac0cd602b4ed638ffe00b1859b` | PASS |
| Actual manifest dependency inspection + natural resolver graph parity | PASS; actual edges present, all original third-party blocks unchanged |
| Frozen offline fresh consumer install | PASS |
| `pnpm deps:authority:check` | PASS, 94 existing install packages |
| `pnpm deps:check` | PASS, zero drifts |
| `pnpm test:deps-sync` | PASS, all official mutation controls |
| `authority-declaration-dependency-controls.mjs` | 6 PASS: two source-to-published projection checks, two missing-authority-entry mutations rejected by official checker, real pre-fix artifact expected two dependency errors, real final artifact zero dependency errors |
| `pnpm typecheck:web:no-cache` | PASS |
| `pnpm typecheck:vitest:no-cache` | FAIL one TS2344, Table test-d line 16 |
| Exact two Table/Markdown runtime test files | 22 PASS: 2 Table + 20 Markdown, jsdom |
| `node --test scripts/prepare-npm-package.test.mjs` | 9 PASS, refusal controls retained |
| Read-only canonical generator observer | PASS as observation, original diagnostic return unchanged; 12 real TS7056, all tracked sources mapped and no alias reachability |
| `pnpm changeset status --since=origin/main` | PASS; no version or publication, not full release qualification |
| Fresh `git merge-tree --write-tree HEAD origin/main` | PASS, no conflicts with main 8db0ac8f49749e3e5f28be5051bb3d3ed71ada71 |

Earlier actual 6b735/84449 evidence has source lint, ten declaration-path controls, two build-utils controls, exact strict producer Table paired contracts and runtime JS parity; relevant source/config bytes are unchanged at 2d05f. Those checks are labelled with their actual source in that evidence and not claimed to have been rerun here. The final authority fix was source-only; generated package declarations were never repaired by hand.

## Remaining work by owner

Full installed-package strict qualification remains OPEN. Exact final producer has twelve TS7056 at tracked source owners: Cascader index/SFC; DatePicker getPanel; Pagination Sizes; Select index/SFC/useSelect; Slider index/useSlide/SFC; TimeSelect index/SFC. None of their transitive module closures reaches inbox/metric/settings alias barrels. Four public barrels remain absent: cascader, select, slider, time-select. Six global exports depend on them. The final observer maps virtual `.vue.ts` paths back to tracked `.vue` before any proposals; see its JSON for every original diagnostic node, dependency closure, global augmentation and output absence. Do not rewrite all twelve blindly or change generated files.

A separate in-memory 48ac experiment proves this exact DatePicker proposal, with no tracked source edit:

```ts
export const getPanel = function (
  type: IDatePickerType
): typeof DatePickPanel | typeof DateRangePickPanel | typeof MonthRangePickPanel {
```

Existing three imports and function body are unchanged. Original producer emitted a named 411-byte declaration, removed only that TS7056 (12→11), added no new diagnostics and checked original inferred return/parameters equality. It is not a source offer or tarball qualification. Coordinator must assign/check the current owner. Acceptance: real canonical panel-utils declaration, unchanged public parameter/return parity, real strict consumer recheck and unchanged refusal controls. The four absent barrels do not close from this annotation alone.

The original ElTable owner must adjust its newly offered `table-core-popper-return.test-d.ts:16`: under the existing Vitest `strictNullChecks:false`, `null extends ReturnType<...>` is true even for the correctly non-null core return. Preserve strict null acceptance through the separate strict controls and preserve the existing repository config. This branch does not change the owner's test or config. Current Table runtime two cases and strict producer two contracts per phase pass; full source Vitest typecheck remains accurately red.

## Capabilities, delivery and limitations

Source and evidence branch pushes are ordinary isolated branch operations. Root coordinator alone creates GitHub draft PR/issue metadata; `draft-pr-material.json` is ready and no PR was created by this worker. A separate reviewer handles any merge. Real alias `/workspace/FsusUI` remains 73a61e481fc6a2f684704585c496d004f86000cc. Previous 48ac/0bd branches are preserved. Fresh Blog master read is 57886f75213bd22c0dd3a8e2586073bdbdd97778; no new Blog viewport result is inferred here.

Browser/device notch geometry, Firefox/WebKit, remote GitHub CI and published-registry artifact acceptance remain OPEN/UNRUN. Full repository/release/visual/native/security/e2e suites are UNRUN. No alias repointing, private consumer selector CSS, duplicate consumer kernel, new credentials/App grants, npm publication, default push, CSP/security weakening or merge. Source/locked package tests and jsdom are not physical-device/browser evidence. Unavailable browser setup previously stopped at `su: Authentication failure`; it was not rerouted or retried.

Transient inputs retained: initial offline lock-only reconstruction lacked metadata for tinycolor; normal configured network resolution succeeded without changing other dependency blocks. First attempt to create/run the final fixture used a not-yet-created workdir and failed before execution; corrected preparation ran from existing workspace. One evidence push from the new worktree lacked the configured auth context; an ordinary push from the existing activated source context succeeded without new credentials or grants. Older loader/CLI/path/preflight input failures remain in the corrected 6b735 evidence. These failures are not counted as passing tests.

Rollback is reverting the isolated source offer/authority/metadata commits. Do not reset the configured alias or frozen review branches.
