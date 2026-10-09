# Public declaration owner integration evidence

Source: `6b735fa3be7b6500de49e79c0a0dfee7cef12b83`, branch `integration/public-declaration-owner-offers-20261009`. The canonical local tarball SHA256 is `1cc60ea8e3cad4d05806f4024277e650610624344545d0b5e9c270be7fe5e5be`. It was built and verified at that exact source before any diagnostic-only generator rerun. No tarball or npm package was published.

The isolated branch consumes five actual author offers recorded in `source-offers.json`. It also corrects three own Changesets package keys and the imported Markdown Changeset key to the actual workspace package `element-plus`; this does not rename the published `@ozwasyd/element-plus` package. The frozen 48ac implementation/evidence branches and real local alias `73a61e481fc6a2f684704585c496d004f86000cc` remain preserved. The held TableV2 runtime performance branch is not consumed.

## Actual validation

| Check | Result |
| --- | --- |
| Frozen offline source install, private build-constants/build-utils builds | PASS |
| Canonical `pnpm package:candidate:build` | PASS |
| `pnpm package:candidate:verify --tarball dist/npm-candidate/fsusui-npm-candidate.tgz --commit 6b735fa3be7b6500de49e79c0a0dfee7cef12b83` | PASS |
| Frozen offline installed tarball consumer | PASS; all third-party lock blocks/overrides unchanged |
| Consumer `pnpm exec vue-tsc --noEmit -p tsconfig.all.json` | FAIL, exit 2: 10 diagnostics, TS2307 x4 and TS2339 x6; strict=true, skipLibCheck=false |
| Four standalone motion probes under Bundler and Node16 | 8 PASS; strict=true, skipLibCheck=false |
| Source `pnpm typecheck:web:no-cache` | PASS |
| Source `pnpm typecheck:vitest:no-cache` | FAIL, exit 2: one TS2344 in new Table test-d line 16 |
| Exact Table + Markdown runtime file selections | 22 PASS at 84449; 2 Table + 20 Markdown; relevant file bytes unchanged at 6b735 |
| Strict original-producer Table declaration/source contracts | PASS at 84449: two contracts per phase, one declaration diagnostic before / zero after, runtime JS bytes identical; relevant files unchanged at 6b735 |
| Exact motion runtime selection at 6b735 | 2 PASS, 36 outside selection |
| Declaration path controls (tsx/cjs loader) | 10 PASS |
| Prepare-package refusal controls | 9 PASS |
| Build-utils path controls | 2 PASS |
| Changed source lint | PASS, zero errors; default ignores two test files with warnings; separate --no-ignore three test-file run PASS |
| Changesets `status --since=origin/main` | PASS; no version or publication operation; not a full release qualification |
| Documentation architecture contract and fixture checks | PASS |
| Fresh origin/main merge-tree | PASS, no conflicts with 8db0ac8f49749e3e5f28be5051bb3d3ed71ada71 |

The actual 48ac baseline remains frozen in the separate `public-declaration-closure-48ac` evidence branch: 191 diagnostics with its original full compiler log and tool/lock/artifact identity. This integration has the same source lock SHA256 `c7d35e65a7f82bf145786f0d5697a8fcff2109b7f47a85146ed0acb22510ce94`, producer ts-morph 27.0.2 / TypeScript 5.9.2, consumer TypeScript 6.0.2 / vue-tsc 3.2.6 / Vue 3.5.32, Node 24.19.0 / pnpm 10.33.0. The separate Blog Vue 3.5.33 identity shadow and its reported 1023 diagnostics are not this 191→10 result.

## Remaining source causes and owner handoff

The read-only canonical generator observer returned every original diagnostic unchanged. All twelve TS7056 still occur at 6b735 after the real alias fixes. None of their source-module dependency closures reaches inbox/metric/settings alias barrels. Virtual `.vue.ts` names were mapped to tracked `.vue` files with git ls-files. Four public component barrels remain absent and cause the ten installed-package diagnostics. See `owner-final-dependency-mapped-producer-diagnostics.json` for exact nodes, closures, global augmentations and absent outputs.

Dependency clusters: Cascader index→Cascader SFC; Select index/SFC→useSelect; Pagination Sizes→Select; TimeSelect index/SFC→Select; Slider index→Slider SFC↔useSlide; DatePicker getPanel is a separate root. No classic component source is rewritten in this branch.

A separate diagnostic-only in-memory experiment at preserved 48ac proves this exact candidate return annotation for `vue/packages/components/date-picker/src/panel-utils.ts`:

```ts
export const getPanel = function (
  type: IDatePickerType
): typeof DatePickPanel | typeof DateRangePickPanel | typeof MonthRangePickPanel {
```

The imported panels and body stay unchanged. The actual producer emitted a 411-byte named declaration, removed only getPanel TS7056 (12→11), produced no new diagnostics, and checked inferred/annotated return and parameter equality. This is a proposal, not an implemented offer, full build, or tarball qualification. Coordinator must establish source ownership before assignment. Acceptance should rerun the canonical package producer, require real panel-utils.d.ts, preserve parameter/return parity, and retain strict package diagnostics without any/unknown/suppression or generated declaration edits. Its removal alone does not close the four missing barrels.

The imported ElTable test-d has a separate configuration mismatch: line 16 asserts `null extends ReturnType<...>` is false, but `vue/tsconfig.vitest.json` explicitly sets strictNullChecks=false. Under that setting null is assignable even to the correctly non-null core return, so this assertion fails. Its separate strict producer controls pass. Return this test adjustment to the original Table owner; preserve both the strict null acceptance and existing Vitest config. No owner-file change or weakening is made here.

## Failed invocations retained

The initial verify invocation omitted an explicit --tarball; the CLI mistook the --commit value for a positional tarball. The corrected explicit invocation passed. Initial declaration-path controls lacked tsx/cjs and failed module resolution before cases ran; corrected loader passed all ten. Two lint invocations used guessed file paths and failed discovery; a tracked-path invocation and explicit test lint passed. Earlier Markdown positive preflight mistakenly expected five direct it declarations; actual it.each expansion is twenty and the corrected positive file/count/name preflight passed before the 22-case run. These input failures are retained, not counted as acceptance passes.

## Boundaries and delivery

Fresh Blog master read via git ls-remote is `57886f75213bd22c0dd3a8e2586073bdbdd97778`; this evidence is UI producer/consumer work and does not claim a new Blog viewport run. Browser, physical-device/notch geometry, Firefox/WebKit, publication/registry and remote GitHub CI acceptance are UNRUN/OPEN here. Full repository, release, visual, native/.NET, security and end-to-end suites are UNRUN. The configured Firefox/WebKit setup limitation previously recorded is not retried or bypassed. No credentials/App grants, CSP/security changes, default-branch pushes, alias repointing or merge occurred. No runtime/browser result is inferred from jsdom, source checks, producer success, or owner-local tests.

Only the root coordinator creates GitHub draft PR/issue metadata and a separate reviewer handles any merge. Draft PR material is supplied in `draft-pr-material.json`; this worker has not created a PR. Revert the isolated source offer/metadata commits for rollback; do not reset the alias or frozen review branches.
