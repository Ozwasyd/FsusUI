WIP: Correct untouched font-table provenance in parity integration

## Summary

- New parity head `9abcb2f0a8b530154c986cb6fb2d673ce88688b5`, parent `989e721734a0b18188905c67057e6bcc617a204a`, consumes only the eight-file correction from supplier `88394484c60b9578d34fdeb7063128d2fadeddd6`. All eight blobs match the supplier exactly. The complete changed-path/hash list accompanies this handoff.
- Withdraw the old checksum-only equality attestation: FontTools compilation had reserialized Noto cmap before the alleged source bytes were read. Snapshot untouched reader bytes before compilation and record the actual source/derived difference.
- At each weight400/500/700, Noto cmap is33328 source bytes (`e45bc357…`) versus33336 derived bytes (`cc91e817…`). All three subtable mappings/metadata and both variation selectors are semantically identical. The corrected verifier rejects semantic and unrelated-table changes. Full hashes and comparison dispositions remain in committed provenance/CORRECTION.md and this handoff.
- The committed resource include and all19 identities remain intact. Nine font binaries, licenses/notices, native fixtures/tests, locks, goldens and budgets are unchanged. No asset regeneration or new global defaults.
- This is the separate parity review correction for reviewer `01a11fd1-6e9b-7747-bcff-464e17528022`. Frozen native integration `a0253323cd2442184aa5a42e8ff84fca86a10118` is untouched; typography remains excluded from it.

## Linked Issue

Independent provenance P2 correction; no issue closed.

## Impact Checklist

- [x] Component or public API impact is described — pure verifier/provenance/docs correction only
- [x] Theme token impact is described or not applicable — unchanged
- [x] Motion token impact is described or not applicable — unchanged
- [x] Element Plus compatibility impact is described or not applicable — no new compatibility claim
- [x] Visual snapshot impact is described or not applicable — font binaries and goldens unchanged; capture/visual acceptance UNRUN
- [x] Accessibility impact is described or not applicable — native glyph/layout/assertion coverage unchanged; semantic cmap rejection tests retained
- [x] README or docs updated, or docs are not needed — exact released correction updates README, VALIDATION, provenance and supplier PR draft, with CORRECTION.md

## Release Notes

- [ ] Changeset added for user-facing package changes — not applicable
- [x] Changeset not needed because this is internal-only
- [ ] Breaking changes are marked in the changeset and migration docs — not applicable

## Validation

- [ ] `pnpm run lint` — UNRUN
- [ ] `pnpm run typecheck` — UNRUN
- [ ] `pnpm run test` — UNRUN
- [ ] `pnpm run build` — UNRUN
- [ ] `pnpm run verify:visual:affected` — UNRUN; captures excluded
- [ ] `pnpm run test:consumer-install` — UNRUN; no public package change

Actual new-head results:

- **PASS:** eight exact changed supplier blobs; project/resource identity evaluation with actual SDK10.0.401,19 identities unchanged; nine font binaries/four notices unchanged; no native-source/lock/PNG/budget change.
- **PASS:** exactly six allowed pure provenance methods,6 passed/0 failed. Python3.12.14, fontTools4.61.1, Brotli1.2.0; complete official archives verified against locked SHA512 and SHA256 before tests. Raw command, input versions, archive hashes and regression log are published.
- **PASS:** tests detect the old false source equality, independently verify all nine assets' raw table provenance, and reject changes to a non-preferred cmap, variation selectors, subtable metadata and an unrelated table. Mutations are in memory; no font generator/application/alternate native host is invoked.
- **UNRUN:** the eleven unchanged native cases, native restore/build at this new head, prior45 CJK-codepoint/three-weight shard comparisons, captures, RepositoryRoot/held routes, broad suites, full CI/platform qualification and independent visual acceptance. Parent989 and supplier results remain bound to their original source/input combinations and are not presented as new-head runs. The old false byte-equality attestation remains withdrawn.
- **FAIL:** none among executed correction checks.

Root/monitor retain draft/body/labels and review/merge. No GitHub content write or package publication. Rollback: revert the correction commit on parity only.
