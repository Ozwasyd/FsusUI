# Correction: untouched cmap provenance

This ordinary supplier correction is based on
`be0a1127cc1ba8abce36b96559cd2bad9effe8fa` and addresses the P2 reported by
independent review of integrated candidate
`989e721734a0b18188905c67057e6bcc617a204a`. The integration owner can apply the
correction commit without another resource include: it changes only files
inside `Assets/VueParityTypography/`. No font binary, native fixture or test,
license/notice, global font host, shared csproj, lock, golden or budget changes.
The existing `changed-paths.txt` remains the historical 36-path list for the
original supplier increment; it is not this correction's changed-file list.

## Withdrawn claim and truthful comparison

The previous `derive.py` reported a PASS for "all decoded tables preserved
(head checksum normalized)". That preservation claim and the three Noto
source cmap hashes were inaccurate. `getTableData()` compiles loaded tables;
compiling the already-loaded OS/2 table loads cmap, so the later alleged source
cmap bytes had already been reserialized. Original result history is retained,
but this byte-preservation attestation is withdrawn, not treated as a valid
pass of the corrected raw-byte verification.

At each real Noto weight 400, 500 and 700:

| Container | Untouched decoded cmap length | SHA-256 |
| --- | --- | --- |
| Original locked WOFF2 | 33,328 bytes | `e45bc35798d276268a8973d8fb052731c7366e9cc1ee50e6831b746e9199ab59` |
| Existing committed TTF | 33,336 bytes | `cc91e8176e45bda7a35500e532f4342fb758da90b5a03fa29e8c33d8fd111218` |

Fresh independent parses of each source and derived container prove identical
cmap version, subtable formats/platform/encoding/language metadata, every
character-to-glyph-ID map, and both variation selectors' default/non-default
glyph-ID mappings. All three subtables and both selectors are checked; the
comparison is not limited to getBestCmap(). Both semantic digests are
`674c3b92e421459ceadf4266f373a1b6766c3d454783f06146494a5f44226ed8`.

The corrected script snapshots WOFF2Reader/SFNTReader table bytes before any
table access/compilation. Google Sans cmap bytes are identical. Apart from
these three semantic-neutral Noto cmap reserializations, only the nine
head.checkSumAdjustment fields differ; all other decoded table bytes are
identical. `provenance.json` now records the true source/derived hashes and
explicit comparison dispositions. The verifier rejects changes to all other
table bytes and rejects changed cmap semantics. It reproduces all nine
existing TTF hashes without asset churn, and retains the previous 45 CJK
codepoint × 3-weight Web-shard outline and metric comparisons.

## Focused regression and retained evidence

Using the existing complete integrity-locked archives and Python 3.12,
fontTools 4.61.1 and brotli 1.2.0:

```sh
python dotnet/FsusUI.Avalonia.HeadlessTests/Assets/VueParityTypography/derive.py \
  /path/to/tarballs /path/to/FsusUI
python dotnet/FsusUI.Avalonia.HeadlessTests/Assets/VueParityTypography/test_derive.py \
  /path/to/tarballs -v \
  DerivationTests.test_snapshot_catches_old_false_source_equality \
  DerivationTests.test_nine_provenance_entries_match_independent_container_bytes \
  DerivationTests.test_non_best_character_map_mutation_is_rejected \
  DerivationTests.test_variation_selector_mutation_is_rejected \
  DerivationTests.test_subtable_metadata_mutation_is_rejected \
  DerivationTests.test_unrelated_table_change_is_rejected
```

Actual result: **6 selected methods, 6 PASS, 0 FAIL**. The first method checks
all three weights' known untouched hashes and reproduces the old false-equal
serialization explicitly. The second checks all nine actual assets' complete
provenance against independent reader bytes. Mutation tests prove rejection
of a change only in a non-preferred character map, a variation selector,
subtable metadata, and an unrelated metrics table. No application or alternate
native test host is created by these Python verifier checks.

The first correction-test attempt failed four assertions across two methods:
the test setup had omitted the old OS/2 load before getTableData(), and it
assumed that FontTools did not share the format-4 cmap dictionaries. Loading
OS/2 reproduces the real old failure, and detaching the one dictionary makes
the mutation affect only the non-preferred subtable. The true raw hashes,
all-subtable comparison and rejection assertions were retained. This failed
attempt remains recorded in `correction-results.json`; its raw local output
is preserved outside the checkout and is not published.

The three actual earlier failed native attempts are also retained as named
case outcomes, counters and original TRX hashes in `correction-results.json`:
6 FAIL/5 PASS before the exact Noto collection, 5 FAIL/6 PASS before empty-name
handling, and 1 FAIL/10 PASS before correcting the 500 legacy-name assertion,
each with exactly 11 cases. They were intermediate uncommitted candidates,
not final-source failures. Their original raw local TRX files remain intact.
The original supplier's legitimate final 11/11 passes in each GSANS mode
remain in `validation-results.json`; their native source and fonts are
unchanged. No new native run is claimed for this verifier-only correction.

The reviewer's independent .401 restore/build, 19-resource and 11-case passes
for the integrated candidate were reported to the supplier and are not
inherited as this correction's results. Full CI qualification and Batch3
capture/visual acceptance remain **UNRUN**. No capture method, RepositoryRoot
helper, held audit, broad suite or content API was invoked. Root and the sole
integration owner retain committed-candidate integration, review and metadata
updates, including correcting any downstream checksum-only preservation claim.
