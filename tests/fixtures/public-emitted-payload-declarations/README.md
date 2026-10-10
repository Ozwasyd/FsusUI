This regression covers only ColorPicker focus/blur, ConversationListItem select,
and TreeV2 node-contextmenu. MarkdownEditor remains with its existing owner.

The baseline fixture records the published producer
`48ac5c2029a231e574a77a4aa537907f5bd447da`, its historical tarball
`91dbac01c30df9c9b3d9f29811a3d045244ceb65f82845fba9f23f210f391256`, and all
191 historical diagnostics from the [public handoff evidence](https://github.com/Ozwasyd/FsusUI/tree/0bd761bfc64a629368a0c4c59c1bf95d6116df4b/docs/releases/evidence/public-declaration-closure-48ac).

An unchanged-source rebuild produces a different artifact. Its unchanged
authority projection drops source-declared `vue-router` and `type-fest`.
The original full-package `tsconfig.all.json` therefore reports the historical
191 diagnostics plus 68 missing-dependency diagnostics, for 259 total. The
narrow root-motion config reports 253. These failures remain visible; dependency
metadata and the package/declaration generators are outside this repair.

The focused source repair must remove exactly 26 TS2300 diagnostics. With the
current prerequisite, 233 strict package errors remain; after its independent
dependency projection repair, the expected residual is 165. Both retain all eight
separately owned MarkdownEditor duplicate-identifier errors. The regression
asserts the complete diagnostic multiset for the actual artifact; passing this
source regression does not mean the package strict check passes.

Use the original pinned environment: Node 24.19.0, pnpm 10.33.0, npm 11.13.0,
TypeScript 6.0.2, Vue 3.5.32, vue-tsc 3.2.6, and the unchanged source lockfile.

```sh
pnpm install --frozen-lockfile
pnpm run package:candidate:build
pnpm run package:candidate:verify
pnpm exec node tests/fixtures/public-emitted-payload-declarations/install-consumer.mjs \
  dist/npm-candidate/fsusui-npm-candidate.tgz \
  /tmp/new-payload-consumer \
  /path/to/the/unchanged-baseline-consumer/pnpm-lock.yaml
FSUSUI_PAYLOAD_CONSUMER_ROOT=/tmp/new-payload-consumer \
FSUSUI_PAYLOAD_TARBALL=dist/npm-candidate/fsusui-npm-candidate.tgz \
  pnpm exec node --test tests/public-emitted-payload-declarations.test.mjs
pnpm --dir /tmp/new-payload-consumer exec vue-tsc --noEmit --project tsconfig.all.json
pnpm exec changeset status --since 48ac5c2029a231e574a77a4aa537907f5bd447da
```

The consumer installer uses the original consumer template and the original
lock-generation/frozen-install commands. It copies, never modifies, the seed
lock and refuses third-party resolution drift. The four consumer probe/config
files are unchanged copies of the public handoff fixtures. The compiler probe
adds five valid emit calls, four untyped-contract guards, and nine rejected calls
checked with `@ts-expect-error`.

Runtime checks exercise original DOM payload acceptance, invalid payloads,
TreeV2 short-circuit values and return identity against source and actual installed
ESM/CJS. Whole-source, generated JavaScript and complete component declarations
are hashed after alpha-normalizing only the affected payload bindings; types,
argument order, props, slots, instances and other members stay covered. Actual
installed files must match the tarball. Original Vitest configuration/setup is
used for three existing component emission tests, with exact positive selectors,
parsed preflight counts and parsed result counts. A failed preflight stops that
execution. No generated output is edited.
