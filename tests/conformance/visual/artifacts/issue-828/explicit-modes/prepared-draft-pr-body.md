## Summary

Expanded search and inline navigation exceeded the existing short-landscape header budget. The owned full/critical PublicShell CSS now shares the row with existing-token spacing and reserves action widths; empty action wrappers no longer allocate gaps. In the original fixture, all sampled modes/states/themes measure45/67/90px at zoom1/1.5/2, including90px for667x375 inline-expanded at200%. All meaningful modes, slots and44px targets remain; BottomTabBar retains56px minimum.

Draft only. The literal combined34% budget is impossible for default bottom mode at200% throughoutH<=520, and for the measured full header below265px. No requirement/golden is relaxed. Same independent reviewer01a11b52-ec77-7602-9d9e-3f040157403f must inspect the final exact candidate.

Base: `fix/828-landscape-geometry-20261008` (frozen PR851). Head: `fix/828-explicit-landscape-widths-20261008`. Product69705ac1ca5d3c07fa955486646a1861ba5bb50a; exact tested API metadata candidate d182cf93cbb852006047bc2b7eea0ba28daa4955. Report/evidence commits add no product changes. New PR creation is centrally embargoed; this body is prepared for the parent's authorized write stage.

## Linked Issue

Related to #828 and Ozwasyd/FsusBlog#2228. Keep both open; no closing directive.

## Impact Checklist

- [x] PublicShell layout/consumer impact described above; no export/prop/event changes.
- [x] Existing space tokens only; no theme or motion token changes.
- [x] Existing CSP-safe/reduced-motion behavior retained by original checks.
- [x] No upstream Element Plus compatibility claim.
- [x] Goldens unchanged; immutable first failures and current trace/PNG data retained.
- [x]44px targets and56px BottomTabBar minimum retained; native focus/scroll/hit evidence included.
- [x] Nearest PublicShell doc and original generated API derivative updated.

## Release Notes

- [x] Patch changeset `public-shell-explicit-landscape-modes.md` included.
- [ ] No package publishing/deployment/merge performed.

## Validation

-67 focused original units pass; all four actual `typecheck:no-cache` projects pass.
-42 original PublicShell browser tests pass, with 42 success traces;30 interaction probes and480 read-only hit/focus/scroll diagnostic rows have no reach failures.
- Original native WASM/icons/theme/Vite/runtime prepare/check and own production HTTP20 assets matched; docs/tokens/design negative controls/Contract V2 public gate pass.
- Original `pnpm run test:visual:full` on exactd182 exits1: Preview647/688 pass,41 fail; Dev8/19 pass,11 fail; same invocation655 pass52 fail/707.52 first-failure directories retained. Full gate remains red.
- Historical source results are never reused as current Blog/provider/device/package qualification. Real iOS/current Blog live admission/published package parity remain unproved.
- Full root lint/unit/build/consumer install workflows were not run as green equivalents; bounded original checks and actual failing full visual are named above.

See `tests/conformance/visual/artifacts/issue-828/explicit-modes/README.md` and custody manifests for exact source/commands, every preserved first failure, machine identities, mathematical incompatible ranges and remaining independent-owner handoffs.
