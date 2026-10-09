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
