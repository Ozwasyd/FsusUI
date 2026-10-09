# Slider declaration controls

Run only this nonempty Node test file with the existing heap wrapper:

```sh
SLIDER_EVIDENCE_DIR=/absolute/evidence/path SLIDER_CONSUMER_ROOT=/absolute/frozen-consumer/path \
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

The installed test hashes the real tarball, checks every installed package file
against its archive bytes, and preserves the original 36 Slider JS file hashes.
Unknown source inputs, artifacts, changed diagnostics, additional diagnostics or
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
