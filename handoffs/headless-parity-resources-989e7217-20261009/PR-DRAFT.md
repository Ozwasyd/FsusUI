WIP: Embed released parity typography resources in the headless project

## Summary

- The released parity fixture source cannot load its pinned Web fonts from the original headless project until those files are Avalonia resources. Add its exact unique-prefix include for nine font faces and four license notices.
- The new integration commit changes only one line in `FsusUI.Avalonia.HeadlessTests.csproj`. Shared Google Sans and dedicated TableV2 font prefixes are preserved. Global font defaults, project references, host setup, locks, PNGs, assertions and budgets are unchanged.
- Source head: `989e721734a0b18188905c67057e6bcc617a204a`, base current main `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71`. The independent branch carries the released TableV2/shared resource commits `24a7ba8c`, `90a7d58a`, `1a1fb1b8` and the supplier's exact 36-file increment `be0a1127cc1ba8abce36b96559cd2bad9effe8fa`. Their original branches remain frozen; the supplier's files remain byte-identical.
- WIP for review of the recorded prerequisite composition and separately scoped visual acceptance. This PR does not claim screenshot parity or new TableV2 qualification.

## Linked Issue

None supplied; does not close an issue.

## Impact Checklist

- [x] Component or public API impact is described — internal fixture resource integration only
- [x] Theme token impact is described or not applicable — no token/default changes
- [x] Motion token impact is described or not applicable — unchanged
- [x] Element Plus compatibility impact is described or not applicable — unchanged
- [x] Visual snapshot impact is described or not applicable — frozen PNGs unchanged; capture and visual acceptance UNRUN
- [x] Accessibility impact is described or not applicable — assertions and coverage preserved; supplier controls exercise readable CJK/mixed glyphs without changing accessibility behavior
- [x] README or docs updated, or docs are not needed — released supplier provenance/licenses and separate exact integration evidence supplied

## Release Notes

- [ ] Changeset added for user-facing package changes — not applicable
- [x] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs — not applicable

## Validation

- [ ] `pnpm run lint` — UNRUN, outside this narrow .NET integration
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` if UI, theme, motion, layout, icons, or demo output changed — UNRUN; excluded capture routes remain excluded
- [ ] `pnpm run test:consumer-install` if public package output, exports, install flow, or registry behavior changed — UNRUN; no public package change

Actual SDK10.0.401 / runtime10.0.12 Linux results on this committed source:

- **PASS:** Normal project resource evaluation, total singular items6→19, zero plural items: shared4, TableV2 2, parity13 (nine TTFs, four notices). No external resource include/import.
- **PASS:** Original-project locked restore and Release build with current-main unchanged locks, audit/signature policy and original references/host. Zero errors; one existing xUnit2013 warning at Markdown test line162.
- **PASS:** Exact seven-FQN/eleven-case positive allowlist from the released supplier, inspected before execution. Eleven exact discoveries and eleven passes, zero failures/skips in each of GSANS=0 and GSANS=1. Raw logs/TRX and command/filter files accompany the evidence handoff. Missing-resource/family/weight rejection assertions remain active.
- **UNRUN:** TableV2 rendered cases on this composition, all eight Batch3 capture cases, RepositoryRoot/held routes, screenshot parity/independent visual acceptance, broad suites, Windows/macOS and official CI. Earlier supplier staging and Table evidence are not substituted for these new-source results.

The next ordinary verification on a changed reviewed composition is the recorded seven-FQN selector in both modes, with an exact eleven-case discovery check first. Root separately controls any permitted visual route, PR metadata and merge. No package publication or GitHub content write occurred. Rollback: revert the single integration commit `989e721734a0b18188905c67057e6bcc617a204a`.
