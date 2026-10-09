## Summary

- **WIP draft:** repair native DesktopShell document-tab behavior; actual SDK 10.0.401 and native qualification remain pending.
- The original Linux/macOS failure in Quality Gates 37798728109 indexed an empty context-request list because the third header's pointer target lay outside the viewport. Preserve assertions and reveal pointer targets through production scrolling; retain close, drag, overflow, context, keyboard, negative, platform-cycling and selection coverage.
- Reorder now restores the original focused header and navigation origin, including the keyboard focus ring. An additional non-text mounted-control reproducer proves that theme removal can leave the original Grid owned by a retired selected-content presenter. Release that presenter's visual child during template replacement, preserving Content, active document identity and remounting.
- Source branch: `fix/desktop-shell-content-lifecycle`, **1556abf0287806502c77718d14dc128ce7dcc2da**. Base **b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2**. Incremental parent **4ab7a563ecd680cd5e29de9988de281337e5c219**. Scope is four files: FsusDocumentTabs.cs, owned ordinary DesktopShell tests, DesktopShell contract and existing changeset. Shared menu/shortcuts, locks, CI, ThemeManager/test host and other owners' files are untouched.

## Linked Issue

No issue number supplied. Original failing head 83036006069be5cfcd09724273d5705d8f848ad0; [Quality Gates 37798728109](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109), jobs 113384931201 and 113384931043. Original logs identify the empty-context-list indexing failure; separate TRX retrieval returned 403.

## Impact Checklist

- [x] Component or public API impact is described: document-tab focus and body presenter lifecycle; no API shape change.
- [x] Theme token impact is described or not applicable: no tokens changed.
- [x] Motion token impact is described or not applicable: no motion change.
- [x] Element Plus compatibility impact is described or not applicable: Avalonia correction only.
- [x] Visual snapshot impact is described or not applicable: no frozen snapshots/budgets changed; visual qualification unrun for this increment.
- [x] Accessibility impact is described or not applicable: keyboard-origin focus ring, stable active/focused identity and context action counts retained.
- [x] README or docs updated, or docs are not needed: DesktopShell contract updated.

## Release Notes

- [x] Changeset added for user-facing package changes: existing patch changeset updated.
- [ ] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs: no breaking change.

## Validation

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` — UNRUN for this increment; no independent UX acceptance claim.
- [ ] `pnpm run test:consumer-install` — UNRUN

**PASS:** exact six-case ordinary headless allowlist (six executed, six passed, zero skipped), Release project-reference build through test, locked restore, Avalonia docs check, documentation architecture check, diff check. The finalized lifecycle test **FAILS as expected before correction**, confirming the original Grid remains parented to the retired presenter. Initial reproducer also throws a Grid visual-parent conflict when restoring the theme. Existing original assertions remain.

**Exact diagnostic inputs:** official SHA512-verified SDK 10.0.108/runtime 10.0.8, Debian13/linux-x64, Avalonia12.0.4, approved prerequisite 8840c3834f4d1cb67cdccd5238b1cbcc8558141a represented by isolated diagnostic 64c7e4b2669d4a12fae0733ae8f0572f8c0b91d9, plus candidate production/test source. Source branch excludes prerequisite locks. Existing Skia host and disabled test parallelism unchanged; FSUS_HEADLESS_GSANS unset. No audit/signature/locked settings disabled.

**UNRUN / dependencies:** actual SDK 10.0.401 and its separate ILLink10.0.12 NU1004 repair; plain source-head restore; native Windows/macOS; fullCI/suite; ThemeManager renderer and font-owner composition 2b7/2d1d runtime; independent visual/UX qualification. The lifecycle reproduction does not claim to fix or qualify the primary font exception or every cleanup stack in that composition. Linux 108 results qualify only the explicitly documented combination.

**Next commands:** in the original owner's approved actual401 composition, restore with locked mode, then `dotnet test dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj --no-restore --configuration Release --filter "$(cat <evidence>/ordinary.filter)" --logger 'trx;LogFileName=desktop-tabs.trx' --maxcpucount:1`. Expect six cases on each platform. Preserve all gate requirements. Same reviewer 01a11f70-e3dc-73b6-ba6c-969277d75023 receives full incremental delta; Root owns draft PR metadata and merges.
