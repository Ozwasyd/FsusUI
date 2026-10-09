Suggested title: fix(headless): use pinned Web typography in Batch3 fixtures

## Summary

- Batch3 claimed Google Sans/Noto Sans SC parity while using a system-only BodyFont. Its GSANS opt-in now selects explicit pinned Google Sans Latin/symbol and Noto Sans SC CJK resources with genuine 400/500/700 weights. Standalone mode explicitly uses the specification's ordered system stack. The Empty template receives the same window-local typography resource.
- Preserve exact Fontsource package/license/CSS provenance and font-table identities. A fixture-local exact-name Noto collection handles the upstream literal `Noto Sans SC Thin` family without renaming fonts, synthesizing weights, changing global defaults or editing the font host.
- Source-only increment from `8db0ac8f49749e3e5f28be5051bb3d3ed71ada71` on `fix/batch3-native-web-typography-20261009`. The sole resource owner must add the portable resource include; the shared project is unchanged here. Full Batch3 capture and visual acceptance remain UNRUN.

## Linked Issue

Refs #861. No issue closure is requested by this source increment.

## Impact Checklist

- [x] Component or public API impact is described — internal headless parity fixture only; no public API change
- [x] Theme token impact is described or not applicable — no token definition/generated output change; fixture-local FontFamily resource only
- [x] Motion token impact is described or not applicable — unchanged
- [x] Element Plus compatibility impact is described or not applicable — no component behavior change; source typography restoration only
- [x] Visual snapshot impact is described or not applicable — no PNG or threshold edits; full visual acceptance UNRUN
- [x] Accessibility impact is described or not applicable — real Chinese glyphs and weights covered; no screen-reader or broader accessibility acceptance claimed
- [x] README or docs updated, or docs are not needed — local asset README, provenance and validation handoff supplied; authoritative design intent unchanged

## Release Notes

- [ ] Changeset added for user-facing package changes
- [x] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs

## Validation

- [ ] `pnpm run lint` — UNRUN; no broad suite in the delegated scope
- [ ] `pnpm run typecheck` — UNRUN; no Web source change
- [ ] `pnpm run test` — UNRUN; no broad suite in the delegated scope
- [ ] `pnpm run build` — UNRUN; no Web/package output change
- [ ] `pnpm run verify:visual:affected` if UI, theme, motion, layout, icons, or demo output changed — UNRUN; coordinator must identify a permitted original capture route
- [ ] `pnpm run test:consumer-install` if public package output, exports, install flow, or registry behavior changed — UNRUN/not applicable to internal fixture source

Focused source checks: exact locked registry archive integrities and official release licenses/metadata PASS; all nine derived TTF table comparisons PASS; all 45 fixture/spec CJK codepoints at 400/500/700 match the Web unicode-range shards' outlines and metrics PASS. Original-project locked restore and Release build PASS with selected SDK 10.0.401/runtime 10.0.12 and unchanged matching locks. One existing xUnit2013 build warning remains outside this scope.

Original native Skia test host: seven exact positive FQNs, exactly 11 cases, with inspected assembly setup and cleanup. GSANS=0: 11 PASS, 0 FAIL, 0 skipped. GSANS=1: 11 PASS, 0 FAIL, 0 skipped. Tests check real glyphs/families/weights, CJK fallback, simulations, mixed TextLayout runs, license notices, fixture mode/resource binding, absent resources, wrong/unavailable families and unavailable weights. See `Assets/VueParityTypography/VALIDATION.md`, `validation-results.json`, `positive-fqns.txt` and `provenance.json` for commands and exact source/lock/tool evidence.

These tests staged only the resource include through an external MSBuild import into the original project. This source branch itself leaves the shared csproj unchanged. The resource-owner include and coordinator rerun remain required before claiming committed integration. The capture method and RepositoryRoot helper were never invoked; font resolution and layout passes do not establish visual parity.

Minimal resource include for the sole project owner:

```xml
<ItemGroup>
  <AvaloniaResource Include="Assets/VueParityTypography/**/*.ttf;Assets/VueParityTypography/Source/*/LICENSE;Assets/VueParityTypography/Source/*/COPYRIGHT.txt" />
</ItemGroup>
```

Rollback: revert this source increment and remove its coordinated project include together. No SDK, lock, theme-manager, global font host, token, fixture measurement, frozen PNG or threshold change accompanies it. PR creation/review/metadata, integration and full acceptance belong to Root; no package publication or issue closure is part of this handoff.
