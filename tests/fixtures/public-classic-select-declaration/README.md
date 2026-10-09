# Classic Select declaration controls

Role: test-fixture evidence and execution reference. Applies to the bounded
classic Select repair; this record does not redefine the public API contract.

Run from the repository root, with the original locked dependencies and hooks:

```sh
FSUS_NODE_HEAP_PROFILE=build node scripts/with-node-heap.mjs node --test tests/public-classic-select-declaration.test.mjs
node tests/fixtures/public-classic-select-declaration/packed-controls.mjs <installed-consumer-directory>
node tests/fixtures/public-classic-select-declaration/packed-options-controls.mjs <installed-consumer-directory>
```

The packed consumer must contain the three original, nonempty positive,
negative and whole-package fixtures. Their contents are preflighted against
the tracked originals. Both installed controls require TypeScript 6.0.2 and
Vue 3.5.32, strict checking and skipLibCheck=false. The canonical producer
remains unmodified and uses its own original TypeScript 5.9.2 and options.

`authority.json` records the actual independent 6dd7dc source/artifact and the
actual four-component f4a094 composition. Its source fingerprints cover all
tracked and nonignored Vue inputs except test/mocks, plus root package/lock.
Installed fingerprints cover the listed declaration boundaries and the entire
actual package metadata. Fixture or documentation successors with identical
production inputs can match these identities. Unknown source/declaration
identities fail; there is no caller-selectable expected-count override.

The independent producer has precisely six TS7056 diagnostics; the composition
has zero. Independent Bundler positive/whole-package compilations retain exactly
two/four Cascader/Slider diagnostics; composed compilations have zero. Every
diagnostic is compared by file, line, code and full message, preserving duplicate
diagnostics. Only the installation location is normalized. The same original
eight negative contracts are checked in both module modes, and a real unrelated
TS2322 injection must make the full diagnostic authority check fail.

Expectation controls and package qualification are separate results. Node16
positive compilation remains FAIL: 75 diagnostics independently and 73 in the
composition (68 boundary failures plus five local errors, with two additional
independent absent barrels). Node16 negative and whole-package compilations
also retain their complete failures. A successful exact-diagnostic control
does not qualify Node16 or describe its positive fixture as compiling.

The changeset intentionally documents a typing compatibility break:
`popperOptions` is now `Partial<Options> | undefined`. The original raw SFC
accepted invalid placement/strategy values; the repair rejects both with
TS2322 while complete valid partial option objects, omission and undefined
remain accepted. Raw original props equality produces TS2344 and remains
recorded. Normalized equality binds only the original free `Options` name to
check the intended declared contract; it does not establish raw public-type
parity. Original useSelect inferred contracts are compared unmodified, and
runtime JavaScript equality is checked separately.

Public four-component reference evidence is at commit
736b981fba100a0c2e956e74b61ddef62ff4d508 under
`docs/releases/evidence/public-declaration-four-component-f4a094/`.
The original failed residual-count assertion and Node16 errors remain in that
record. No production source, producer, config, lock or frozen golden is changed
by this fixture repair.
