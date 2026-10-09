# Complete source-specific public baseline integration

Published implementation: `a6fafef49b2a22f90f6f3c5fc0d9639c3d44ae76` on [`integration/ui861-complete-projections-20261009`](https://github.com/Ozwasyd/FsusUI/tree/integration/ui861-complete-projections-20261009). Its exact parent is the reviewed source `66d6b56fe6033b5bdca723346847f3deac7d5e40`. The source branch is clean, and the remote branch SHA was checked after push.

The original #827 producer offer `977b406a01b8dae24e434405e2892e55e1ff980c` was consumed with `git cherry-pick -x`. Its exact parent is `66d6b56f…`. The [supplier evidence](https://github.com/Ozwasyd/FsusUI/tree/c9d85d7eb0c56defd5233c21c7a870d22c2f3f0d/docs/releases/evidence/ui861-public-baseline-977b406) was fetched and verified by Git object, independently of local supplier paths.

All 1,600 original producer inputs match the actual parent source and native installation, including the renderer test SHA-256 `d1806866629113a2ebfcbb24fa1fe90e66956a183488284111f249ac0fa4f3e7` (39,710 bytes). All four output preimages, five installed tool identities, Node `v24.19.0`, and pnpm `10.33.0` match. The prior 1,599/1,600 mismatch receipt remains unchanged in its original evidence prefix; the old 18b offer was not consumed.

Exactly four generated paths changed, six insertions and six deletions. Every resulting Git blob matches the supplier offer:

- `docs/avalonia/vue-public-api-baseline.md`: actual capture commit.
- `spec/baselines/vue-current.json`: actual capture commit and source input/output hashes.
- `spec/components/contracts/v1/vue-public-contracts.json`: dependent baseline hash.
- `spec/components/contracts/v2/contract-v2.json`: dependent web baseline hash.

API payload, members, classifications, thresholds, production code, contracts' behavioral rules, and original producers are unchanged. The supplier's genuine fixed-point proof is retained with its original source identity; this worker ran read-only checks on the new committed source and did not regenerate or manually edit projection hashes.

Actual checks executed on `a6fafef4…`:

| Command | Result |
| --- | --- |
| `pnpm run avalonia:baseline:check` | PASS |
| `pnpm run component-contracts:check` | PASS |
| `pnpm run contract-v2:check` | PASS; 228 contracts, 2,455 members |
| `pnpm run test:contract-v2` | PASS; 49 tests, zero failures/skips |
| `pnpm run check:update-surface` | PASS; 119 surfaces, 11 exclusions, 10 groups |
| `pnpm run check:documentation-architecture` | PASS; original architecture fixtures included |
| `git diff --check 8db0ac8f49749e3e5f28be5051bb3d3ed71ada71 a6fafef49b2a22f90f6f3c5fc0d9639c3d44ae76` | PASS |
| Fresh default-branch `git merge-tree --write-tree` | PASS against actual main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71` |

Native dependency setup initially failed because the default pnpm store attempted an unavailable `/home/agent` path. Using the already configured `/workspace/.setup/pnpm-store` with offline frozen install and ignored lifecycle scripts passed. Both actual receipts are retained. The original repository Husky setup was run; hooks were not bypassed. No empty staged-file lint run is claimed as component verification.

New Chromium evidence was actually generated on `a6fafef4…` through the unchanged original `web-interaction-conformance/chromium` cell and config. Preflight selected exactly two original cases, with zero unexpected or empty selections. The original impact plan used fresh main `8db0ac8f…` and candidate `a6fafef4…`; `CI=true` retained the original fresh demo build/server behavior. Execution passed 2/2 tests, zero failures/skips/flaky cases. Both real interaction traces and all 14 successful action steps identify that exact baseline and candidate. Receipt/report/trace byte hashes were verified before archiving. These are original component interaction controls, not new short-landscape, vertical-scroll, two-theme Blog, native IME, or device qualification.

Raw browser files live under `chromium-runtime`, preserving their original repository-relative receipt and report paths. `chromium-summary.json` is a derived index of the original receipt, not synthetic browser evidence. Reused ignored native WASM/icons artifacts were copied only after all 336 tracked producer inputs were byte-identical to the existing native control; their original hashes and provenance caveat are retained. No icon cache freshness, package candidate, or publication qualification is claimed.

The reviewed renderer unit source, production renderer, unit config, Chromium config/spec and runner source are byte-identical to source `66d6b56f…`. The [two genuine reviewed unit receipts](https://github.com/Ozwasyd/FsusUI/tree/52941d9d86d16e1743b0be6228c204e2ab50a14a/review-evidence/ui861-renderer-lint-successor) are reused with their original SHA: original CI637 and added pending/synchronous-cancel cases each passed 1 test with 36 unselected. They were not rerun or relabeled as new executions. The original case-attribution correction is preserved. Older `3baff077…` Chromium receipts remain associated exclusively with that older source.

UNRUN/OPEN: Firefox and WebKit cells and the full required-browser aggregate. The prior official `playwright install-deps firefox webkit` authentication refusal remains stopped and was not retried. Firefox retains its recorded UID-map/read-only cache launch limitations. WebKit host libraries remain unavailable: `libgtk-4.so.1`, `libgraphene-1.0.so.0`, `libharfbuzz-icu.so.0`, `libmanette-0.2.so.0`, `libhyphen.so.0`, `libwoff2dec.so.1.0.2`, `libGLESv2.so.2`. Blog authenticated manage-write local-alias acceptance stays with original2228; no alias ownership change or duplicate consumer run occurred. Published-package, native/device, and other owner acceptance are OPEN. No unrelated full matrix or held audit was rerun.

Only isolated source/evidence Git branches were pushed. No PR creation or body, issue comment, label, ready-state, merge, default-branch, package-publication, credential/App grant, security or CSP write occurred. PR content remains with the coordinator under its current prohibition. Changeset not needed: this increment is internal generated identity metadata. Rollback is omission/reversion of the single four-file increment; all frozen earlier implementation and evidence commits are preserved.
