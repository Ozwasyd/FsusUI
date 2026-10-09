# Cascader declaration regression

The original source is `2d05f240e5fb04ac0cd602b4ed638ffe00b1859b`.
The published diagnostic mapping is under
`docs/releases/evidence/public-declaration-authority-2d05f` at
`42723d0bcea4c13c9cd1296b6cb999eba1d07307`.

The test runs the unchanged canonical declaration task with its actual ts-morph
TypeScript 5.9.2. It returns the original diagnostic array unchanged. Temporary
in-memory controls compare the complete original inferred component and its
props, emits, slots, instance refs, and exposed function parameters and returns.
Those controls are removed before the real declaration emission.

Build actual baseline and repaired candidates through `package:candidate:build`
in isolated original-source and repaired-source worktrees, using the frozen
lockfile and pnpm 10.33.0. Then run:

```sh
FSUS_CASCADER_BASELINE_CANDIDATE=/absolute/path/to/baseline.tgz \
FSUS_CASCADER_CANDIDATE=/absolute/path/to/repaired.tgz \
FSUS_CASCADER_EVIDENCE=/absolute/path/to/evidence \
FSUS_CASCADER_STORE=/absolute/path/to/pnpm-store \
node --test tests/public-cascader-declaration.test.mjs
```

Both tarballs are required. Their actual ESM/CJS cascader runtime files must be
byte-identical. The repaired tarball is installed into a fresh consumer with
Vue 3.5.32 and TypeScript 6.0.2. Every compilation uses `strict: true` and
`skipLibCheck: false`; no diagnostic is suppressed. All twenty negative cases
must produce exactly one consumer diagnostic each, and no positive consumer
case may produce a diagnostic.

The independent select, slider, and time-select barrels and their five related
global exports can still cause strict library failures in this isolated branch.
Only those precise existing failures are allowed by the regression assertion;
the actual diagnostics and strict PASS/FAIL statuses are retained in the evidence.
The same regression supports a later combination that removes those failures.
`library.ts` reproduces the strict library-only check; `aggregate.ts` additionally
checks the root and global `ElCascader` exports.

The original cascader runtime selection is
`vue/packages/components/cascader/__tests__/cascader.test.tsx`, preflighted with
the existing Vitest configuration and artifact hook. This repair does not claim
publication or broad runtime qualification.
