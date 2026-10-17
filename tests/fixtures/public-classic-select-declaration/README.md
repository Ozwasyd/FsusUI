# Classic Select declaration controls

Role: test-fixture evidence and execution reference. Applies to the bounded
classic Select repair; this record does not redefine the public API contract.

Run from the repository root, with the original locked dependencies and hooks:

```sh
FSUS_NODE_HEAP_PROFILE=build node scripts/with-node-heap.mjs node --test tests/public-classic-select-declaration.test.mjs
node tests/fixtures/public-classic-select-declaration/packed-controls.mjs <installed-consumer-directory>
node tests/fixtures/public-classic-select-declaration/packed-options-controls.mjs <installed-consumer-directory>
node tests/fixtures/public-classic-select-declaration/runtime-default-controls.mjs <installed-consumer-directory>
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

Each packed phase runs a fresh actual TypeScript process through
`compile-control.mjs`, with the same strict options and version assertions.
This bounds checker memory without changing the selected controls; the earlier
multi-program heap exhaustion remains recorded as a failed harness run.

## Node16 CJS default contract

The inspected shared 2b78cfa source and actual canonical candidate have a separate
identity, including their complete manifest, changed shared lock identity and
ESM `.d.mts` declarations. The original two identities and their complete old
Node16 failures remain recorded. No shared input is merged into the independent
Select source branch.

Bundler retains the original `positive.ts` and all eight negatives. For the
new shared format, Node16 uses `positive-node16.ts`: its supported CJS entry is
`import = require`, with a type-only native default import checking the same
module-object type. The module object equals the declaration namespace; its
`.default` property equals named ElSelect. All original props/emits/slots/ref,
export and installer assertions remain. Node16's original eight negatives still
run, as do two additional module-as-component/plugin negatives. The unchanged
Bundler positive fixture, when deliberately compiled as a Node16 negative,
must reject precisely its former direct module-to-component assertion. The new
Node16 positive must compile with zero diagnostics; that failure is not accepted
as a positive result.

Native Node executes the actual public require path and ESM-loads its exact
`require.resolve` target: native default is the whole require result and native
default.default is requireResult.ElSelect. Vite 7.3.1 bundles that same actual
CJS file: its interop default is ElSelect, with matching installer extras.
These loader checks are separate from public export-condition qualification.
The inspected candidate exposes the lib directory path under `require` only:
direct native ESM package import fails ERR_PACKAGE_PATH_NOT_EXPORTED, and direct
Vite static package import fails with no matching export condition. Both real
failures are retained in the runtime result, which reports public import
qualification FAIL. Loading the require-resolved file checks the CJS loader
contract; it does not establish support for those blocked package spellings.
No export alias or resolver plugin is introduced to make them work.

The `packageQualification` field in packed controls records only strict
TypeScript whole-package compilation. It does not accept the shared declaration
producer's outstanding AST review items or public runtime export conditions;
those remain owned by the shared producer/package writer.
