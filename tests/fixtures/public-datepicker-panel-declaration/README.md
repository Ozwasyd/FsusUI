# DatePicker panel declaration regression

The observer invokes the unchanged canonical declaration task, returns its original
diagnostics, and checks its emitted declaration. It also compares the actual inferred
parameter and return types against the original function from source
`2d05f240e5fb04ac0cd602b4ed638ffe00b1859b`. Two deliberately unequal contracts must
produce TS2344; those in-memory controls are removed before canonical emission.

Use the existing heap hook with the build profile on the outer invocation:

```sh
FSUS_NODE_HEAP_PROFILE=build node scripts/with-node-heap.mjs node --test \
  --test-name-pattern='^canonical producer preserves' \
  tests/public-datepicker-panel-declaration.test.mjs
```

For the installed artifact control, first build the real canonical npm candidate,
resolve a fresh consumer lock from its actual metadata with the original consumer
pins, and install that lock frozen. Set `PUBLIC_DATEPICKER_PANEL_CONSUMER` to this
consumer directory, then run the same test file with the exact name pattern
`^actual installed tarball`. The positive fixture requires the original parameter
type and exact three-component return union under strict checking. The negative
fixture has four intentional invalid uses and requires their precise diagnostic
codes. No declarations or dependencies are substituted. The test compares the
actual packed runtime selector with the original emitted JavaScript.

The annotation repairs one producer TS7056. It does not repair the four missing
component barrels or their six global exports; aggregate installed-package strict
qualification must be reported separately.

`authority.json` records measured source and artifact identities for the original
`2d05f240e5fb04ac0cd602b4ed638ffe00b1859b`, the independent panel repair, and the
real four-component combination `f4a094f300384185918fc6d4be86e88d9ab9f097`.
The combination's producer and installed-test evidence is published at
`736b981fba100a0c2e956e74b61ddef62ff4d508` under
`docs/releases/evidence/public-declaration-four-component-f4a094/`.
The fixture fingerprints all 2,450 tracked non-test Vue, script, configuration,
and root package inputs, including working-tree changes and new untracked inputs.
Only these exact recognized inputs select the complete expected diagnostic rows:
12 original, 11 independent, and zero in the real combination. Unknown inputs or
any additional diagnostic fail. There is no caller-supplied expected-count option.

The installed test identifies the actual tarball by SHA256, checks the recorded
canonical manifest against current build inputs, and compares every installed
package file with the extracted real tarball, plus the exact recorded pnpm KaTeX
binary shim added during installation. Other additions or changed bytes fail.
The known independent artifact must
produce exactly its four recorded missing-barrel diagnostics; the real combination
must produce none. Both must reject the same four negative calls at their precise
source lines. The diagnostic expectation control is recorded separately from the
original strict positive assertion, which remains `positive === []`. Consequently
the independent artifact still records strict FAIL, while the real combination
can pass. The package's aggregate strict qualification remains a separate check.
