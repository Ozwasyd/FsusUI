# Slider declaration controls

Run only this nonempty Node test file with the existing heap wrapper:

```sh
FSUS_NODE_HEAP_PROFILE=build SLIDER_EVIDENCE_DIR=/absolute/evidence/path SLIDER_CONSUMER_ROOT=/absolute/frozen-consumer/path \
  node scripts/with-node-heap.mjs node --test tests/public-slider-declaration.test.mjs
```

`authority.json` contains two fixed observations, selected by the actual production
source/config/lock inventory, never a caller-provided expected error count:

- Independent source `4214f38b38c8d891c3b25b0e2e56d5e28839edee`: all nine original
  residual producer diagnostics and all eight unrelated installed diagnostics.
- Four-component source `f4a094f300384185918fc6d4be86e88d9ab9f097`: empty complete
  producer and installed external inventories. README/test-only successors retain
  the same input fingerprint.

The independent inventories come from the original actual canonical/packed run;
the composed observation and artifact SHA come from
[the immutable integration evidence](https://github.com/Ozwasyd/FsusUI/tree/736b981fba100a0c2e956e74b61ddef62ff4d508/docs/releases/evidence/public-declaration-four-component-f4a094),
specifically `slider-source-test/producer.json`,
`four-component-candidate.manifest.json`, and
`consumer/bundler-slider-negative-actual.json`. All sixteen negative messages,
locations and codes agree between those two actual packed observations. Only
installation-directory prefixes are normalized; no diagnostic is ignored.

The historical `tarballSha256` fields identify the original observations; they are
not an artifact admission list. The installed test hashes the real tarball, checks every installed package file
against its archive bytes (excluding pnpm's added `node_modules` dependency links
and bin shims), and preserves the original 36 Slider JS file hashes.
Unknown source inputs, inconsistent artifacts, changed diagnostics, additional diagnostics or
missing negative refusals fail. There is no environment override for expectations.
The canonical observer still returns the original complete diagnostics unchanged,
compares original inferred parameters and return (all 19 fields), and compares all
three original Slider runtime scripts. Its original producer options are unchanged.

Fixture acceptance is separate from whole-library strict acceptance:
`packed-status.json` records both. The independent fixture passes with whole-library
strict FAIL (eight errors); the composition requires whole-library strict PASS.
Whole-artifact runtime parity is outside this Slider fixture and remains a separate
retained FAIL; Motion/compiler differences are not whitelisted here. Node16,
browser/native behavior and publication are not qualified by this Bundler test.

This follow-up changes tests only; changeset not needed because the public source
contract and runtime are unchanged. Review the complete test delta from `4214f38b`
with the original reviewer before combination. Do not discard the original
composition fixture failures (`0 !== 9` and `0 !== 8`) or earlier failed runs.

## Actual follow-up verification

Functional test delta at `c7723c8e59bba7b64e9b0556c7ae929310647d80`:

| Check                                                                                   | Actual result                                                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Exact original Slider Vitest list, original setup/cleanup hooks                         | PASS: 35 discovered; runtime rerun UNRUN for this test-only delta                               |
| Independent canonical, installed controls and inventory refusals                        | PASS: 3/3, zero skipped; producer 9, strict positive 8 external, negative 16 local + 8 external |
| Actual f4 canonical and inventory refusals                                              | PASS: 2/2, zero skipped; complete producer diagnostics 0                                        |
| Original inferred parameters/return, all 19 fields, three source runtime scripts        | PASS in both actual canonical runs                                                              |
| Actual independent tarball/installed byte identity and 36 original Slider runtime files | PASS                                                                                            |
| Public f4 actual installed evidence checked against new exact assertions                | PASS: positive 0, negative 16; read-only reconciliation                                         |
| New f4 installed fixture execution in this environment                                  | UNRUN: actual SHA827 tarball unavailable; no substitute rebuilt artifact                        |
| Whole-library strict on independent artifact                                            | FAIL: all eight original unrelated errors retained                                              |
| Whole-artifact runtime byte parity                                                      | Retained FAIL; Motion differences remain owned by Original827                                   |
| Same-reviewer acceptance of this new delta                                              | Pending                                                                                         |

[reviewfix-results.json](./reviewfix-results.json) contains the real source reports,
commands, packed identity/status, nonempty-selection receipt, original protected
file hashes and first-failure receipts. Initial lint, default-pnpm commit hook,
archive-scope assertion, small-heap OOM and generated-WASM-stub failure remain
recorded. Only owned tests/setup reuse were corrected; no production contract,
generator/config, dependency or frozen input was edited. Final documentation and
evidence additions do not change the tested functional files or input fingerprints.

## Diagnostic rebuild admission successor

The original raw-tgz equality assertion at `37bfa80a` rejected the reviewer's
actual same-source rebuilds before positive/negative compilation. Those failures
remain recorded; the author hashes are retained as historical observations.

The [immutable candidate policy](../../../docs/releases/policy/npm-registry.md)
keeps the tested candidate as the publication input. This source fixture grants
no publication authority. For a diagnostic rebuild it now invokes the unchanged
repository `verifyCandidate` contract, with these additional controls:

- Hash the real tarball and require its checksum/manifest to bind the same bytes.
- Read the manifest's full commit from Git, hash all 2,004 actual committed input
  blobs, and require the same pinned input graph as the current checkout. A
  manifest label by itself cannot select an authority profile.
- Require all six canonical build-input digests/fingerprint, Release profile,
  prepared package identity and original Node/npm/pnpm identities to agree.
- Bind the frozen install's SHA-512 to the actual tarball and compare all original
  273 third-party package and snapshot blocks; consumer compiler versions stay
  fixed at TypeScript 6.0.2, Vue 3.5.32 and vue-tsc 3.2.6.
- Run the real canonical observer in this invocation even when only the installed
  test is selected. Compare every emitted Slider declaration (16 in each of
  `es` and `lib`) after the pinned publication self-reference rewrite; missing,
  additional or modified Slider declarations fail. Both formats copy the same
  declaration output in the canonical build.
- Preserve complete archive/installed payload byte equality, the 36 original
  Slider runtime hashes, parameter/19-field paired contracts and all 16 exact
  strict negative refusals. Unknown diagnostics still fail.

No caller-provided expected hash/count or new archive hash allowlist is accepted.
The test checks this candidate's integrity and Slider declarations; complete
runtime qualification remains separate. In particular, it neither compares nor
waives Motion compiler variations: the four full-bundle byte differences and
Node16 failures remain FAIL in their original evidence. The historical 35 runtime
controls retain their original source identities.

Actual successor validation at `946d6da410562f45445e46c4ac47adf68c35fdb6`:
installed-only invocation PASS 1/1 (zero skipped), including a fresh real canonical
run, all 7,240 installed/archive payload files, 32 Slider declarations, 36 original
runtime files, all 16 strict negative diagnostics and candidate/declaration refusal
controls. Whole-library strict remains FAIL with the original eight external
errors. Actual f4 canonical/inventory controls PASS 2/2 (zero skipped), diagnostics
zero, 19 paired fields and all 16 generated Slider declarations preserved.

The reviewer's actual `14ecb9b2` candidate bytes are in its own environment; this
environment has not executed the new composed installed phases. The same reviewer
must run the command above with its real frozen consumer and adjacent original
candidate sidecars. This is a pending actual run, not a user-permission request or
an inferred shared path. [rebuild-results.json](./rebuild-results.json) records the
actual commands, source/input/manifest/payload identities, results, refusal checks
and remaining UNRUN checks. Previous result files and failed logs are retained.

## Frozen `31fe` verification

The immutable successor under review is
`31fe270f524cdd09ea43949077f4826196ebc550`. The resolved Library version 0 input is
`libfile_9ffb624a1b648191aa537b4a4619631a`, backed by
`file_00000000b3d081fd9198c570c165a14c`. Its readable bundle SHA-256 is
`e5e4e193987b34ecb3dfc358c3a81ee1f9fba39928d2fdc9cee9ac2ca7396ae4`; the actual
candidate SHA-256 is
`462360d7342f8f17e40f19eaae6f1246ba5de2909d9bd1b0072e2884798ec215`. These identify
the inspected evidence, rather than acting as an archive admission list.

The original refusal of the new 2,012-input fingerprint is retained. The fixture
now proves the complete 23-file source delta from the accepted `f4` composition
using committed preimage and postimage bytes. It separately verifies the macro
patch omitted by the unchanged original source filter, its exact lock registration,
all original dependency records and snapshots, the offered formatter/renderer
postimages, and the inherited three Slider source files. Earlier independent and
`f4` profiles, diagnostic arrays, and all sixteen original negative messages remain
unchanged. Source metadata changes are restricted to the inspected format exports;
the candidate still goes through the real repository verifier and build inputs.

A successful canonical observer supplies sixteen fresh raw Slider declarations.
The unchanged actual formatter runs against those bytes with the complete fresh
declaration tree and canonical package metadata needed for self-import resolution.
All 48 actual raw ES, ESM and CommonJS Slider declarations must match. Installed
archive byte equality, all 36 original Slider JS hashes, the original 273-package
consumer graph and exact strict positive/negative diagnostics remain mandatory.
Mutation controls reject changed source deltas/patches, manifest inputs/metadata,
checksums, damaged or extra declarations, and a missing barrel in each format.

This is bounded Slider fixture verification. It does not qualify the entire shared
formatter, renderer, browser/device/hydration behavior, or a later source successor.
The whole-artifact runtime mismatch and historical Node16 failures remain retained;
no GitHub content or package publication is authorized. This fixture-only increment
needs no additional changeset; the original public repair changeset is unchanged.

Run the same original three fixture tests with the repository heap wrapper:

```sh
FSUS_NODE_HEAP_MB=6144 FSUS_NODE_HEAP_PROFILE=build \
SLIDER_EVIDENCE_DIR=/absolute/evidence/path \
SLIDER_CONSUMER_ROOT=/absolute/frozen-consumer/path \
node scripts/with-node-heap.mjs node --test tests/public-slider-declaration.test.mjs
```

The manual heap request remains subject to the existing capacity policy. A retained
3,072 MiB run passed the strict positive control before exhausting its heap during
the negative phase; it does not count as a completed negative-control run.

See `frozen-31fe-results.json` for actual final results, commands and retained
first-failure receipts.
