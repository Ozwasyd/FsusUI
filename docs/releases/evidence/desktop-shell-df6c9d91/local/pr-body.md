## Summary

**WIP — ready for Root to create a draft PR; native platform and CI toolchain qualification remain pending.**

Repair DesktopShell document-tab focus during drag reorder and correct the original pointer fixture without weakening its expectations.

Both original Linux/macOS jobs in Quality Gates run 37798728109 throw `ArgumentOutOfRangeException` at line 167 because `contextRequests` is empty. At the supported 220-DIP tab width, the fixture clicks the third header at x=550 outside the 520-DIP viewport. The unchanged method passes with this host's natural font metrics; explicitly setting the supported width reproduces the original exception. The fixture now scrolls the same targets into view through production `ScrollHeaders` and tests both 120/220-DIP widths.

Once pointer targets are visible, the new focus assertion reproduces a production failure at both widths: removing/reinserting the dragged tab preserves selected state but clears actual keyboard focus. The five-line production change remembers whether the moved header was focused and restores its focus after reinsertion. Reordering another header preserves existing focus. All original assertions remain; coverage adds Meta cycling, keyboard context requests, disabled/invalid requests, selected/focused keys, SelectedItem and actual focus identity.

Scope: exactly four files — `FsusDocumentTabs.cs`, `FsusDesktopShellHeadlessTests.cs`, the existing desktop-shell contract page, and a patch changeset. No shared navigation/menu/shortcut, Tree, PDF, Markdown discovery, dependency lock, CI, or held audit files changed.

## Linked Issue

No closing issue assigned. Original failure: PR #861's [Quality Gates run](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109), [Linux job](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109/job/113384931201), [macOS job](https://github.com/Ozwasyd/FsusUI/actions/runs/37798728109/job/113384931043).

## Impact Checklist

- [x] Component/public API impact: restores document-header focus during reorder; no API shape change.
- [x] Theme token impact: none.
- [x] Motion token impact: none.
- [x] Element Plus compatibility impact: none; Avalonia only.
- [x] Visual snapshot impact: no baseline updates; existing light/dark/narrow production captures generated and inspected.
- [x] Accessibility impact: preserves actual keyboard focus and active/focused tab identity.
- [x] Docs updated: existing desktop-shell contract clarifies focus preservation.

## Release Notes

- [x] Patch changeset added: `.changeset/avalonia-document-tab-reorder-focus.md`.
- [ ] Changeset not needed because this is internal-only — not applicable.
- [ ] Breaking changes marked — no breaking change.

## Validation

- [ ] `pnpm run lint` — UNRUN.
- [ ] `pnpm run typecheck` — UNRUN.
- [ ] `pnpm run test` — UNRUN; no broad suite executed or filtered afterward.
- [ ] `pnpm run build` — UNRUN.
- [ ] `pnpm run verify:visual:affected` — UNRUN; no independent visual/UX acceptance claimed.
- [ ] `pnpm run test:consumer-install` — UNRUN.
- **PASS:** locked restore and Release build of the headless-test project and its referenced projects with official SHA-512-verified SDK 10.0.108, runtime 10.0.8, Debian 13 linux-x64. Audit/signature/locked settings unchanged. One pre-existing xUnit2013 warning remains in the separately owned Markdown test.
- **PASS:** exact five-case ordinary allowlist, 5/5, zero skipped: DocumentTabsCancelClosePreserveDirtyStateReorderAndSelectAdjacentFallback; DocumentContextRequestReturnsTypedStableAnchorWithoutSelectingTarget; DocumentTabsSupportCloseDragReorderOverflowContextAndPlatformCycling (120 and 220 DIP); AutomationPeersExposeSelectionDirtyExpandedAndCloseSemantics.
- **PASS:** exact ProductionFixtureRendersDesktopLightDarkAndNarrowEvidence allowlist, 1/1; inspected 1280×720 light/dark and 760×640 compact dark images. These captures show production layout; the focus assertions provide the reorder interaction evidence.
- **PASS:** `node scripts/check-avalonia-docs.mjs`, `node scripts/check-documentation-architecture.mjs`, `git diff --check`.
- **FAIL, expected before correction:** original method at 220 DIP, 1/1 failed with original empty-context exception; visible-target focus regression, 2/2 failed with actual focus null.
- **UNRUN:** Windows/macOS execution, full solution/platform gates, actual CI SDK 10.0.401 qualification, independent UX acceptance. Existing gates remain required.

Exact inputs:

- Base/current main: `b17077f3afd4a80ff3bdc0fe81d5dfc353ffddf2`.
- Original failed PR head: `83036006069be5cfcd09724273d5705d8f848ad0`; CI tested its merge with that base (`e36ce62` in original logs), using SDK 10.0.401.
- Published candidate: `df6c9d917104ca63327ff802382b1bcbe49d4ce9`, branch `fix/desktop-shell-document-tabs`.
- Approved diagnostic prerequisite: `8840c3834f4d1cb67cdccd5238b1cbcc8558141a`, consumed only in isolated diagnostic checkout as cherry-pick `64c7e4b2669d4a12fae0733ae8f0572f8c0b91d9`, plus production/test files byte-identical to the published candidate. Prerequisite locks are absent from the published branch diff.
- SDK archive: official `dotnet-sdk-10.0.108-linux-x64.tar.gz`; SHA-512 `e32f76b768017718aa5a3a51fcac4b617ab4428c5f2d10b1b30f07dd7f1ea3dad4df917df48d855d78a347d635e48ce0ec309787899c53a32c4c10dd216b6b19` matches official release metadata.
- Harness: parallel execution disabled, Skia drawing, `FSUS_HEADLESS_GSANS` unset; final runs use writable local `XDG_CACHE_HOME`. Configured `.husky/_` launcher is absent in the isolated worktree; no hook or gate configuration was modified.

Local evidence: `/tmp/desktop-tabs-evidence/{inputs.json,allowlist.txt,final.filter,restore.log,build-before.log,wide-before.trx,identity-before.trx,after.trx,render.trx}`; original complete run log archive `/tmp/desktop-tabs-original-logs.zip`. Separate native TRX artifact download returned HTTP 403; original Linux/macOS log messages were retrieved successfully.

Commands used in `/workspace/FsusUI-desktop-tabs-diagnostic`:

```bash
export PATH=/tmp/desktop-tabs-sdk/sdk:$PATH
export DOTNET_CLI_HOME=/tmp/desktop-tabs-dotnet-home
export NUGET_PACKAGES=/workspace/.setup/nuget
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export XDG_CACHE_HOME=/tmp/desktop-tabs-font-cache
unset FSUS_HEADLESS_GSANS
project=dotnet/FsusUI.Avalonia.HeadlessTests/FsusUI.Avalonia.HeadlessTests.csproj
dotnet restore "$project" --locked-mode --disable-parallel --maxcpucount:1
dotnet build "$project" --no-restore --configuration Release --maxcpucount:1
dotnet test "$project" --no-restore --configuration Release \
  --filter "$(cat /tmp/desktop-tabs-evidence/final.filter)" \
  --logger 'trx;LogFileName=after.trx' \
  --results-directory /tmp/desktop-tabs-evidence --maxcpucount:1
dotnet test "$project" --no-build --no-restore --configuration Release \
  --filter 'FullyQualifiedName=FsusUI.Avalonia.HeadlessTests.FsusDesktopShellHeadlessTests.ProductionFixtureRendersDesktopLightDarkAndNarrowEvidence' \
  --logger 'trx;LogFileName=render.trx' \
  --results-directory /tmp/desktop-tabs-evidence --maxcpucount:1
```

Remaining dependencies: original owner must resolve SDK 10.0.401's ILLink 10.0.12 NU1004 and qualify that toolchain; Root must obtain Windows/macOS and required full-gate evidence. SDK .108 evidence cannot satisfy .401. Held audits were not recreated and no acceptance receipts were produced. No package publication, deployment, access/security changes or GitHub content writes were performed.

Root's next command:

```bash
gh pr create --repo Ozwasyd/FsusUI --base main \
  --head fix/desktop-shell-document-tabs --draft \
  --title 'WIP: fix DesktopShell document-tab focus and pointer coverage' \
  --body-file /tmp/desktop-tabs-evidence/pr-body.md
```

On each native runner, run the same five-case exact filter after the owning dependency repair enables locked restore with actual SDK 10.0.401. Then run the unchanged required platform gate `node scripts/dotnet-platform-verify.mjs --max-cpu-count 1`; this is a next step, not a local PASS claim. Root owns draft PR creation, metadata and merging. Rollback: revert candidate `df6c9d917104ca63327ff802382b1bcbe49d4ce9` if native validation exposes a regression.
