## Summary

- **WIP draft:** source correction is published; actual SDK10.0.401/native qualification remains pending and the reported 220-DIP glyph failure remains unresolved.
- Original native DesktopShell interaction failure indexed an empty context-request list because the pointer target was outside the viewport. The aggregate branch reveals targets using production scrolling, restores focused-header navigation origin during reorder, and retains close/drag/overflow/context/platform/negative/selection assertions.
- This increment fixes the remaining P2: a null-matching recycling ContentTemplate can retain the original Grid in the outgoing presenter after Content is cleared. Clear ONLY the outgoing presenter's ContentTemplate before the existing content release/UpdateChild. Preserve document Content and ContentTemplate for replacement and remount.
- Existing lifecycle regression now covers untemplated and recycling-template documents, direct mounted template replacement, theme removal/restoration, original Grid identity and single parent, original document/template identity, actual template reuse, selection and remount. No original assertion weakened.
- Branch `fix/desktop-shell-recycling-template`; head **b680455bcb872864cebe8e8d0c60a69e6dec3065**; frozen parent **1556abf0287806502c77718d14dc128ce7dcc2da**; ancestry base **b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2**. Same four owned paths only: production DocumentTabs, original ordinary tests, DesktopShell contract and existing changeset. No shared menus/shortcuts, fonts, locks, gates/CI, harness, ThemeManager/test host or other-owner edit.

## Linked Issue

No issue number supplied. [Original Quality Gates37798728109](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109), failing head83036006069be5cfcd09724273d5705d8f848ad0, jobs113384931201 and113384931043. Original logs retrieved; separate TRX403. Same independent reviewer01a11f70-e3dc-73b6-ba6c-969277d75023 receives full incremental delta.

## Impact Checklist

- [x] Component or public API impact is described: presenter teardown and original tab corrections; no API shape change.
- [x] Theme token impact is described or not applicable: no token edits.
- [x] Motion token impact is described or not applicable: no motion edits.
- [x] Element Plus compatibility impact is described or not applicable: Avalonia correction only.
- [x] Visual snapshot impact is described or not applicable: frozen visuals unchanged; new visual qualification unrun.
- [x] Accessibility impact is described or not applicable: previous focus, keyboard and active/selected identity assertions preserved.
- [x] README or docs updated, or docs are not needed: DesktopShell template/reuse contract updated.

## Release Notes

- [x] Changeset added for user-facing package changes: existing patch changeset updated.
- [ ] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs: no breaking change.

## Validation

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` — UNRUN for this increment
- [ ] `pnpm run test:consumer-install` — UNRUN

**PASS, explicit Linux108 diagnostic only:** locked restore; Release project-reference build via test; exact five positive method allowlist with seven cases, all seven passed/zero skipped; documentation checks; diff check. **Expected FAIL before correction:** same final lifecycle source on frozen1556 production, two cases executed, untemplated PASS and recycling FAIL at the actual Grid visual-parent oracle. Raw reports, final source snapshots, exact delta/commands/filter, checked preflights and result-count evidence are included. Initial setup attempts are labelled separately and retained truthfully.

**Exact inputs:** official SHA512-verified SDK10.0.108/runtime10.0.8, Avalonia12.0.4, Debian13/linux-x64; exact approved8840c3834f4d1cb67cdccd5238b1cbcc8558141a on isolated diagnostic64c7e4b2669d4a12fae0733ae8f0572f8c0b91d9 based on b170, plus candidate production/test files. Candidate excludes dependency-lock edits. Existing shared host, disabled parallelism and Skia options unchanged; GSans unset. No signature/audit/locked settings disabled.

**Actual SDK401 FAIL preserved (coordinator-reported):** actual main8db0 + byte-exact1556 four candidate files, tree62b43e2b5306e860441cddc30a81bda3d252de3c, SDK10.0.401/.12 locked restore/Release build PASS; six ordinary cases, five PASS/one FAIL. 220-DIP interaction fails at test311 dispatcher layout with $Default glyph exception; lifecycle PASS/no visual-parent exception. Font06123873e2a45fe866d93576cc7ef0db1edfc702 independent .4018+8PASS explicitly does not fix native OpenAI Sans cmap/default-family failure. This increment has not been run in that actual composition; no blanket fallback or private font edit made.

**UNRUN:** new increment on actual401 or native Windows/macOS; plain source-head restore; fullCI/suite; renderer/RepositoryRoot routes; independent visual/UX acceptance. Linux108 results do not qualify these. Preserve WIP until the actual glyph failure and required qualification are resolved by their owners.

**Next commands:** coordinator first inspects actual composition/fixture/setup/cleanup hooks, verifies the exact nonempty positive five-FQN selection and seven source cases, and stops on any failed preflight, parse, empty selection or count mismatch. Run the literal-filter `dotnet test ... --no-restore --configuration Release --filter 'FullyQualifiedName=...|...' --logger 'trx;LogFileName=desktop-tabs.trx' --maxcpucount:1` command copied verbatim from commands.txt, with its approved actual toolchain/composition. No failed output, unchecked variable, missing filter or shell fallback may select a suite. Root owns GitHub draft/metadata/merge; no duplicate PR or content API writes. Rollback increment with `git revert b680455bcb872864cebe8e8d0c60a69e6dec3065` if required.
