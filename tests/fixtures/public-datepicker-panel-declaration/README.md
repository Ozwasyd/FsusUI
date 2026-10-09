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
