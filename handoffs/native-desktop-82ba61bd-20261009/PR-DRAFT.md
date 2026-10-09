WIP: Integrate reviewed Desktop tab focus fix; retain GSANS failure evidence

## Summary

- Add Desktop supplier `b680455bcb872864cebe8e8d0c60a69e6dec3065`'s exact four-path closure to frozen native integration `a0253323cd2442184aa5a42e8ff84fca86a10118`. Source is `82ba61bda502230e4c1fcd1e9084ab2e6c006fda` on `fix/native-desktop-successor-20261009`, based on actual main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`.
- Preserve the reviewed document-tab reorder focus and content remount behavior, its original regression assertions, documentation and changeset. Four Desktop blobs match the supplier exactly; all24 inherited paths match a025. No historical dependency ancestry imported.
- **WIP:** original Desktop checks pass7/7 in GSANS0 and fail1/7 in GSANS1. Fresh-process isolation reproduces the same narrow-width glyph-typeface failure. Root cause remains unresolved; no production/host correction beyond the reviewed supplier closure is claimed. Tree native p95 is UNRUN for missing display. This source is not merge-ready.

## Linked Issue

No issue is closed by this handoff. Root creates the draft PR and owns metadata/ready/merge.

## Scope and provenance

| Source | Exact included scope | Successor evidence |
| --- | --- | --- |
| Desktop b680455b | `FsusDocumentTabs.cs`, `FsusDesktopShellHeadlessTests.cs`, nearest desktop-shell doc, existing Desktop changeset | Exact four blobs; five methods/seven cases per GSANS mode plus justified two-case reproduction |
| Frozen native a0253323 | Reviewed Font06123873, Table90a7d58a/shared1a1fb1b8, Tree3ddcda32, Shortcut68c4fa4a, PDFed80a940;24 paths | All inherited blobs unchanged; original resources/host/locks preserved |
| Root's separate a025 review | Root-reported142 executions including original Table PNG/PDF methods | Evidence stays bound toa025; no Table/PDF repeats or successor execution claims |

The complete28-path supplier/blob/SHA256 roster is in `complete-28-path-roster.json`. Typography9ab and TextEditorf1ee are excluded and remain frozen. All340 tracked PNGs, dependency locks, budgets, TestAppBuilder, theme and serial hooks are unchanged. No held Markdown root helper or denied audit route was invoked. No visual artifact update switch, scratch locks, policy override or alternative native harness was used.

## Impact Checklist

- [x] Component or public API impact is described — reviewed Desktop tab focus/reorder and content-remount behavior; inherited component changes retain prior scope
- [x] Theme token impact is described or not applicable — unchanged
- [x] Motion token impact is described or not applicable — unchanged
- [x] Element Plus compatibility impact is described or not applicable — no new compatibility claim
- [x] Visual snapshot impact is described or not applicable — all340 frozen PNGs byte-identical; independent visual acceptance UNRUN
- [x] Accessibility impact is described or not applicable — original Desktop selection/dirty/expanded/close semantic assertion passed in each mode; complete gate not claimed
- [x] README or docs updated, or docs are not needed — exact reviewed nearest Desktop doc preserved

## Release Notes

- [x] Changeset added for user-facing package changes — reviewed Desktop changeset and inherited Tree/Shortcut changesets preserved
- [x] Changeset not needed because this is internal-only — applies only to separate evidence and inherited fixture/tool setup
- [ ] Breaking changes are marked in the changeset and migration docs — no new breaking change introduced by composition

## Validation

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` — UNRUN
- [ ] `pnpm run test:consumer-install` — UNRUN

Actual successor toolchain: SDK10.0.401/runtime10.0.12/MSBuild18.9.11, Debian13 Linux; actual main's .401-compatible locked graph. No .108 dependency combination used.

| Check | Result |
| --- | --- |
| Exact four supplier blobs, unchanged24 inherited paths, locks/340PNG/host/budgets | PASS |
| Original headless project's locked restore and Release build, including Demo reference | PASS; zero errors, one existing xUnit2013 warning |
| NuGetAudit=true/all/low; shared4+Table2 resource items | PASS; physical-path metadata normalization only |
| Exact positive discovery before tests | PASS; five methods/seven cases in both GSANS modes |
| Desktop GSANS0 | PASS7, FAIL0, skipped0 |
| Desktop GSANS1 | PASS6, FAIL1, skipped0 |
| Fresh-process GSANS1 original width method | PASS1, FAIL1, skipped0; exact discovery2 |
| Original Tree Demo tree-expand-scroll p95 | UNRUN; no DISPLAY/Wayland/X11 socket or standard xvfb-run |
| Windows/macOS, actual CI, broad gates, independent visual acceptance | UNRUN |

The failed original method is `DocumentTabsSupportCloseDragReorderOverflowContextAndPlatformCycling(headerWidth: 120)`: `Could not create glyphTypeface` for `$Default`/Normal, during queued TextBlock measure in `Dispatcher.UIThread.RunJobs` at test line312. Width220 passes. Both first red and isolated red are retained, with raw logs/TRX. There were16 actual executions,14 passes and2 failures of the same condition, not16 distinct cases. Isolation shows the other five cases are not required; it does not establish the cause or justify a global default-family workaround.

## Remaining dependencies and next commands

1. Font/Desktop owner must coordinate diagnosis/correction for the preserved original host or production source. Consume any reviewed correction on a new identity; do not relax assertions or substitute a default font without causal evidence. Exact isolated reproduction/discovery commands are in `NEXT_COMMANDS.txt`.
2. Supply a live display or the existing standard `xvfb-run` prerequisite. Run the original Demo `--render-performance --profile quick --warmups 1 --samples 21 --long-scroll-iterations 256 --backend auto --scenario tree-expand-scroll`; one exact scenario. Retain original summary/raw/disposal/p95; unchanged policy thresholds. A single current measurement does not qualify the order-balanced relative gate.
3. After a source change, locked restore/build and admit the original exact seven-case Desktop list in both modes before execution. Root's separate Table/PDF review remains bound toa025; do not repeat unchanged routes or relabel its142 results.

`TRANSFER.txt`, `NEXT_COMMANDS.txt`, raw discovery/TRX, source/toolchain/input hashes and the complete roster accompany this WIP. No GitHub content API writes, package publication, deployment or access changes occurred. Rollback: revert only successor82ba61bd to retain frozen a025. Root retains draft PR/metadata/merge responsibilities.
