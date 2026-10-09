# PR889: exact CI source comparison and missing report inputs

## Concrete findings

Run `37958456189` executed actual merge `de0b90b49697a40741220e5e8cce23f7dc460195`, whose first parent is base `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71` and second parent is head `6b5bb2fcaf7d1eef066b5d8e3e867504d2e00b8f`. Git verifies merge content equals head content. The head changes exactly eight Tree/render-diagnostic paths; it has not consumed the published conformance identity/collection-diagnostic increment.

All three original runner blobs equal the original pre-80f6 source. `conformance-playwright-owner-run.mjs` does not forward the PR impact plan to its child cells, `conformance-playwright-runner.mjs` does not resolve a verified baseline/candidate identity, and `markdown-playwright-runner.mjs` launches without passing that identity to the existing public trace inputs. The trace spec falls back to `git merge-base HEAD origin/main` during module collection. The official job log records a depth-one checkout of the merge commit. These are concrete source gaps and a source-supported collection risk; the logs do not identify the actual hidden Playwright exception, so collection failure at `origin/main` is not asserted as the observed cause of this run.

The already published icons increment `332e7523cb3dd381c40b57f310df2b08411c5abc` is also unconsumed. Its three tracked preimages match exactly, its dedicated test is absent, and a read-only `git apply --check` passes. No icon producer was rerun or icon source consumed in this conformance correction, and no icons failure is attributed to these CI jobs without their original reports.

The five layout runtime/runner source blobs are identical between head and published `a6fafef49b2a22f90f6f3c5fc0d9639c3d44ae76`. There is no published layout source increment to consume from that composition. This byte equality proves no exact-base CI failure: relevant base jobs were skipped or differently routed, so no base failure or Tree-caused geometry regression is inferred.

The four generated public-baseline preimages on the Tree head differ from the actual source-specific `977b406`/`a6fafef4` offer. Those outputs were generated on actual source `66d6b56f…`; they cannot be copied onto this head as qualified evidence. Baseline and native/package production remain with their existing owner. Their fingerprints and old runtime receipts were not rebound.

## Actual official CI evidence and unavailable named inputs

Decoded official logs were successfully read from GitHub's authorized job-log API and retained here. No artifact endpoint, artifact download, alternative denied route, browser installer, or CI dispatch was used.

[Conformance job 113915103242](https://github.com/Ozwasyd/FsusUI/actions/runs/37958456189/job/113915103242) actually runs:

```sh
node scripts/conformance-playwright-owner-run.mjs --owner playwright-conformance --group pr --impact-plan .tmp/playwright-impact/receipt.json --evidence-dir .tmp/playwright-conformance
```

All three browser cells report `produced no real interaction trace attachments`. Required cells and trace authenticity/action checks remain intact. The original report references/counters are overwritten by the old catch path and the process stderr is not retained; the original JSON files are nevertheless written into the evidence directory before the attachment validation fails. The concrete missing report inputs are:

- `.tmp/playwright-conformance/reports/web-interaction-conformance/chromium/report.json`
- `.tmp/playwright-conformance/reports/web-interaction-conformance/firefox/report.json`
- `.tmp/playwright-conformance/reports/web-interaction-conformance/webkit/report.json`
- `.tmp/playwright-impact/receipt.json` for the actual supplied baseline identity.

The collection errors, stats, failed test titles/locations/errors and attachment entries in those JSON reports are required to resolve the actual cause. The original runner does not archive raw process stderr, so a current stderr file is not invented. The official log names `playwright-conformance-evidence-pr`, artifact ID `11630721282`; that artifact was not accessed.

[Layout job 113915103029](https://github.com/Ozwasyd/FsusUI/actions/runs/37958456189/job/113915103029) actually runs:

```sh
node scripts/layout-playwright-owner-run.mjs --owner playwright-layout --group pr --impact-plan .tmp/playwright-impact/receipt.json --runtime-dir .tmp/visual-runtime-playwright --evidence-dir .tmp/playwright-layout --server-port 4181 --skip-prepare
```

Actual argv uses separate `--server-port` and `4181` arguments. Its geometry cell reports **35 passed, 1 failed, 0 skipped**. The original runner captures JSON stdout at lines 166–190 and only prints the count summary; that official stdout does not name the failed assertion. Preceding fixture validation messages about `manifestDigest` are not identified as the failing geometry assertion.

The exact missing input is `.tmp/playwright-layout/reports/geometry-smoke/chromium/report.json`, specifically the failed spec's `title`, `file/line/column` and `tests[].results[].errors` (message, stack and location), plus diagnostic attachments where present. The log names `playwright-layout-evidence-pr`, artifact ID `11631211100`; it was not accessed. Root reports prior head `82eee…` passed 36/36; no exact prior raw report was independently retrieved here, and no failure identity is inferred from that comparison.

## Minimal original-owned source integration

Published independent correction: `ec2a5ee8b555556ff74c5b1b38371db032a8e798` on [`integration/pr889-conformance-identity-20261009`](https://github.com/Ozwasyd/FsusUI/tree/integration/pr889-conformance-identity-20261009). It starts from the exact head above and cherry-picks only the three canonical source/test increments with `-x`:

1. `80f6e96b8d5419942583711fb417492b1f0abb67`: verified identity handoff and collection diagnostics.
2. `6583b7a59a0a871e13b97594a583ca58ca63027e`: exact baseline commit-object validation.
3. `b7f143099ab8bbb6be69f49f6dbfd6c97831d902`: fresh diagnostic scratch parent.

The exact original-owned four-path set was checked against all eight Tree change paths: zero overlap, original preimages match, and the isolated destination was clean. Root explicitly continued this canonical runner integration ownership. No external live actor-claim registry is exposed here; this record does not assert a global roster/lease check. No native/827 package, layout, icons, baseline or Tree writer path was edited. The final three runner blobs and dedicated test blob exactly equal the published a6 composition; no new workaround, required-cell reduction, trace shortcut, threshold change or producer rewrite was introduced.

Actual local verification on `ec2a5ee8…`: offline frozen native dependency install PASS; original Husky setup PASS; original `node --test tests/conformance-playwright-identity.test.mjs` **18/18 PASS, zero failures/skips**, with `.tmp` absent before execution; whitespace and fresh-default merge-tree PASS against main `8db0ac8f…`. The intentional `origin/main` collection-error fixture in this local control log is a regression control, not the hidden CI exception. Final source is clean and the remote SHA was verified.

Browser cells, geometry replay, package/native acceptance and held matrices were UNRUN on this correction. Historical a6/3b browser evidence keeps its original identity. FF/WebKit install refusal remains stopped. The independent source integration is ready for Root review; actual current CI conformance and layout failures remain unresolved until the named report inputs are available. No dispatch or PR/body/comment/label/ready/merge/default-branch write occurred.

Changeset not needed: original internal runner/test integration, with public behavior and contracts preserved. Rollback is omission of these three isolated integration commits. Previous frozen review/source/evidence branches and the real local-alias owner remain unchanged.
