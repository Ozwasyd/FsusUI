WIP: Integrate reviewed native Font, TableV2, Tree, Shortcut and PDF fixes

## Summary

- Combine the reviewed native corrections on actual main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`, preserving the .401-compatible dependency graph. The resulting source head is `a0253323cd2442184aa5a42e8ff84fca86a10118` on `fix/native-reviewed-integration-20261009`.
- Restore real bundled family registration and font resources; keep TableV2's Noto fonts in their dedicated prefix; retain Tree rows across expansion; correct platform-primary Shortcut/native-menu behavior; add the reviewed PDF-tool setup to the existing native CI job.
- Twenty-four unique reviewed source paths are included. All23 non-project blobs match their supplier exactly. The sole overlapping project resolution preserves canonical shared fonts and adds the reviewed TableV2 resource item; its final bytes match supplier `1a1fb1b820ca08f254ab8773041d023c0da0a0e5`.
- WIP: the admitted ordinary cases pass on this combined source, but the excluded capture, RepositoryRoot, native platform and independent visual cells remain UNRUN. This does not claim a full native gate or visual acceptance.

## Linked Issue

No issue is closed by this integration handoff. Supplier issue references and changesets are preserved.

## Owned and inherited roster

| Owner | Exact reviewed source | Included paths | Combined-tree result |
| --- | --- | --- | --- |
| Font | `06123873e2a45fe866d93576cc7ef0db1edfc702` | Original test host, font regression tests, shared project item;3 paths |5 headless cases pass in each GSANS mode |
| TableV2 | `90a7d58aad585edbbeec8756fc6d6e5aa0a2c9a7`, legitimate shared resource correction `1a1fb1b820ca08f254ab8773041d023c0da0a0e5` |6 unchanged source/font/license/docs blobs plus shared project composition |10 ordinary headless cases pass in each mode; both PNG cases UNRUN |
| Tree | `3ddcda32c11925d152dfc25b946dcf4016fafd82` |Production Tree source, two reviewed tests, changeset;4 paths |1 mounted headless case per mode and5 unit cases pass |
| Shortcut | `68c4fa4ab5b031d043a29ac945f44c6998b047fa` |Nine own paths, including production recorder/native menu, tests/docs/changeset; duplicate Font3 paths omitted after exact equality check |30 headless cases per mode and28 unit cases pass; capture UNRUN |
| PDF | `ed80a940757a1bf9ef3b9e86b12a0adb53bbcdd1` |Reviewed composite action and exact native-job workflow hunk;2 paths |12 original adapter unit simulation cases pass; native PDF/tool capture and actual CI action UNRUN |
| Integration owner |This branch; sole shared csproj composition |Recorded before/after project/resource graph and supplier provenance; no new component implementation |Resource, graph, builds and exact-count admission pass |

`c53f37c06e0079bd64249cff9c854b23d088c508` was read-only matching test-composition context, not an imported dependency branch. Typography `be0a/989e`, DesktopShell `b680`, and Tag/Card are excluded. Supplier source branches and their individual evidence remain frozen; previous qualifications are not presented as these combined-tree results. The evidence handoff provides the complete24-path owner/supplier/blob/SHA256 roster.

## Impact Checklist

- [x] Component or public API impact is described — reviewed Tree retention and Shortcut/platform behavior; no additional API changes
- [x] Theme token impact is described or not applicable — token/default changes excluded
- [x] Motion token impact is described or not applicable — unchanged
- [x] Element Plus compatibility impact is described or not applicable — no new compatibility claim
- [x] Visual snapshot impact is described or not applicable — all340 tracked PNGs byte-identical to main; capture/visual cells UNRUN
- [x] Accessibility impact is described or not applicable — reviewed Tree row metadata and Shortcut conflict/focus assertions retained; relevant admitted cases pass; excluded full matrices remain UNRUN
- [x] README or docs updated, or docs are not needed — reviewed supplier docs/licenses and complete separate integration handoff preserved

## Release Notes

- [x] Changeset added for user-facing package changes — reviewed Tree/Shortcut changesets preserved
- [x] Changeset not needed because this is internal-only — applies to Font/Table fixture and PDF CI setup only
- [ ] Breaking changes are marked in the changeset and migration docs — no new breaking change introduced by integration

## Validation

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` if UI, theme, motion, layout, icons, or demo output changed — UNRUN; excluded capture routes remain excluded
- [ ] `pnpm run test:consumer-install` if public package output, exports, install flow, or registry behavior changed — UNRUN

Actual committed-source results, SDK10.0.401/runtime10.0.12, Debian13 linux-x64:

- **PASS:** all non-project supplier blobs identical; only the recorded project composition; original project/package references; unchanged main locks, SDK policy, budgets, baselines and assertions. Evaluated NuGetAudit=true/all/low; no audit/signature override or scratch lock.
- **PASS:** original-project normal resource evaluation: six singular items (shared4, TableV2 2), zero plural items; no external include/import or alternate host.
- **PASS:** both original projects locked restore and Release build. Headless build has one existing xUnit2013 warning at Markdown test line162; unit build has zero warnings; both zero errors.
- **PASS:** before any tests, all three exact positive discovery axes matched their frozen nonempty method/cardinality manifest. Headless38 FQNs/46 cases in GSANS0 and1; unit33 FQNs/45 cases once. All137 executions passed, failed0/skipped0. Raw discovery/TRX, exact filters/commands, source hashes and hook records are published in the separate evidence handoff.
- **PASS, limited tooling preflight:** existing package-owned `/usr/bin` pdfinfo/pdftotext/pdftoppm resolve consistently to Poppler25.03.0. Default PATH had mixed versions, recorded separately. No install action or PDF capture ran; ordinary unit PDF simulations do not qualify native PDF tooling/rendering.
- **UNRUN:** both TableV2 rendered PNG cases; RepositoryRoot-linked Table contract method; Shortcut state-matrix and WebView/PDF matrix captures; separate native-menu bound-evidence output; held routes/audits/receipts; broad suites; actual Windows/macOS and CI; independent visual acceptance. No alternative harness or baseline refresh fills those cells.
- **FAIL:** none among executed admitted checks; missing cells remain UNRUN.

Next ordinary validation after a reviewed composition change: locked restore/build both projects, exact frozen positive discovery with counts46/46/45, then the admitted selectors. Further capture/platform/visual routes require Root's separately released scope. Monitor owns draft/body/labels; Root owns ready/merge. No package publication or GitHub content writes occurred.
