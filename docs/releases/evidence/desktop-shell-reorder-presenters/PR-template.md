## Summary

- **WIP:** repair the actual SDK401/GSANS1 Desktop header lifecycle failure; native Windows/macOS and full-gate qualification remain pending.
- Reinserted ContentPresenters retain their old generated children but reset their creation/recycling state. Parent layout can recreate a header while its old queued TextBlock is being measured, producing the observed detached $Default glyph failure. document.ApplyTemplate alone and ApplyStyling were tested and still failed.
- Mounted ReorderDocument now completes document/presenter template creation before restoring focus and raising Reordered. No fonts, fallback, exception suppression, dependency or host edits.
- Original tests add header text/font/window and old-parent retirement checks. Existing focus-visible/origin, active/selected identity, keyboard/Apps, context, close, drag, overflow, negative assertions and body/template reuse coverage remain.
- Branch `fix/desktop-shell-reorder-template-refresh`, head **dc679b06feba8ffe3dfc3003cf29dc63f60d1120**, parent **82ba61bda502230e4c1fcd1e9084ab2e6c006fda**. Exactly four owned paths. Frozen b680, other owners' files, locks, shared csproj, goldens and gates untouched.

## Linked Issue

No issue supplied. [Original Quality Gates37798728109](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109). New actual82 evidence: af3a9613ec98a50ecd7b7549a620e78a2cf996c5/handoffs/native-desktop-82ba61bd-20261009.

## Impact Checklist

- [x] Component or public API impact described: mounted document header lifecycle; no API shape change.
- [x] Theme token impact: none.
- [x] Motion token impact: none.
- [x] Element Plus compatibility impact: Avalonia only.
- [x] Visual snapshot impact described: unchanged goldens; qualification unrun.
- [x] Accessibility impact described: original focus, keyboard, context and identity coverage retained.
- [x] DesktopShell contract updated.

## Release Notes

- [x] Existing patch changeset updated.
- [ ] Internal-only change.
- [ ] Breaking changes: none.

## Validation

**Actual Linux SDK10.0.401/runtime10.0.12, original approved82 graph:** locked restore/Release build PASS; ordinary exact five positive methods/seven cases, GSANS0 **7/7**, GSANS1 **7/7**, zero skipped. Original unchanged Font two positive controls, GSANS0 **2/2**, GSANS1 **2/2**. Correct narrowed GSANS1 width method **2/2** overlaps these cases. These are bounded qualifications, not stable fullCI or native-platform acceptance.

**FAIL history retained:** unchanged original82 GSANS1 first run **1PASS/1FAIL**,120-DIP glyph exception at test312;220 passes. Same final test source on old82 production **0PASS/2FAIL** at actual pending header retirement. Both rejected document-only template/styling candidates remain **1PASS/1FAIL**. Initial added-test compile error preserved with zero executed cases. Coordinator-reported occasional original2/2 and final1/1 are not erased or called stable green.

Each run used checked nonempty exact positive selection, expected counts and actual original hooks before execution; no broad suite/default fallback, new harness, host or csproj modification. Literal commands, preflights, raw logs/TRX, snapshots/delta and actual counts are attached.

**Other PASS:** Avalonia docs, documentation architecture, diff check.

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` — UNRUN
- [ ] `pnpm run test:consumer-install` — UNRUN

**Remaining:** Windows/macOS execution, fullCI/gates, independent visual/UX qualification and stability certification. No general native OpenAI Sans/default-family font repair claimed. All held routes and content queue remain excluded.

**Next:** combination owner consumes exact dc679 increment on82; inspect actual host/fixtures/setup/cleanup; verify five positive FQNs/seven cases; execute original-project literal-filter commands in COMMANDS.txt for both GSANS modes. Stop on any failed preflight, parse, empty selection or case-count mismatch. Same Desktop reviewer receives full delta/history. Root owns draft PR, metadata and merges; no GitHub content writes. Rollback `git revert dc679b06feba8ffe3dfc3003cf29dc63f60d1120` if required.
