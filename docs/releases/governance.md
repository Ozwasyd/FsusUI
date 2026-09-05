# FsusUI Release Governance

> **Role:** Normative release governance and operational workflow
> **Applies to:** Versioning, quality gates, candidate construction, publishing, and rollback decisions
> **Authority:** This page coordinates the linked release policies and machine-readable contracts; it does not replace them.

Release policy is English and intentionally short. Distribution-specific rules
live in the [npm](./policy/npm-registry.md), [NuGet](./policy/nuget.md), and
[cross-platform](./policy/cross-platform.md) policies. Local CI and capacity
operations are summarized here and detailed in the [engineering handoff](../engineering-handoff.md).

## 1. Targets and gate profiles

| Item | Current contract |
| --- | --- |
| Registry | npm public registry (`https://registry.npmjs.org/`) |
| Package | `@ozwasyd/element-plus` (prepared from `vue/packages/element-plus`) |
| Trigger | `vX.Y.Z` or `vX.Y.Z-*` tag |
| `verify:pr-fast` | PR affected typecheck/unit, lint, governance, and package smoke |
| `verify:full` | Full local quality chain plus `build:demo` |
| `verify:stable` | Token/icon/interaction/visual/a11y/performance/conformance/governance/.NET checks |
| `verify:nightly` | Full, coverage, visual, .NET, and performance checks |
| `verify:release` | Full/stable checks plus candidate, negative fixtures, and consumer matrix |

`pnpm verify` remains the safe alias for `verify:full`. The CI
`stable-readiness`, `nightly-readiness`, and `release-readiness` jobs aggregate
only structured leaf manifests from the current workflow run; they do not call
the local `verify:*` scripts. Their contract is [`docs/ci-readiness.md`](../ci-readiness.md).

The named local profiles remain runnable as scripts:

```bash
pnpm verify:pr-fast
pnpm verify:full
pnpm verify:stable
pnpm verify:nightly
pnpm verify:release
```

`spec/ci/readiness-gates.json` is the profile registry for main, nightly, and
release. Inspect or validate it without starting tests, browsers, or network
calls:

```bash
pnpm ci:profile:plan --group release
pnpm ci:profile:check
```

Tag workflows and manual Release dispatch must pass `group: release` explicitly.
The release aggregator binds the unique npm candidate’s commit, tag, package
version, and digest to readiness evidence; publish waits for that digest.

Parallel quality groups use `run-p --continue-on-error` to collect the complete
failure set and still exit non-zero. The policy does not weaken any gate.

## 2. Shared build and quality boundaries

- Rollup suppresses only verified internal cycles in `mlly`, `semver`,
  `d3-interpolate`, `d3-selection`, and `d3-transition`. The filter resolves
  the exact `node_modules` package for every cycle and prints cycles involving
  repository files, unknown packages, or other warning codes. Validate it with
  `pnpm check:rollup-warning-policy`.
- `FsusUI.Avalonia.Tests` serializes its shared UI Dispatcher; Avalonia,
  Headless, and Performance assemblies remain parallel at the process level.
- Demo performance is measured from a real consumer graph: first-screen static
  and Markdown cold-hydration closures are separate, Markdown/WASM/Mermaid/
  Shiki/KaTeX/Cytoscape are not pulled into the first screen, and the measured
  raw/gzip/Brotli baseline in `scripts/consumer-performance-baseline.json` is a
  non-increasing ratchet. `FSUS_CONSUMER_FIXTURE_PATH` is diagnostic only;
  release gates use a cold install.
- The demo uses one `fsus-ui` runtime chunk while third-party dependencies stay
  grouped. `onlyExplicitManualChunks` remains off, and non-size warnings still
  fail the zero-warning gate.
- `prepare:test-artifacts` reuses icon/WASM outputs only after source-fingerprint
  validation. CI cache hits are logged; publish and forced regeneration use
  `pnpm run build:wasm` or `FORCE_REBUILD=1 pnpm run prepare:test-artifacts`.
- The test artifact cache reports a cache hit or cache miss and delegates
  regeneration to `prepare:test-artifacts` or `build:wasm` when fingerprints
  do not match.
- Unit shards come from the capacity plan rather than a fixed count. A shared
  `unit-test-artifacts` upload is prepared once; shards verify it with
  `pnpm run check:test-artifacts-ready` and use the planned
  `FSUS_VITEST_WORKERS`.
- Node heap profiles reserve memory for the OS, filesystem cache,
  Chromium/WASM/esbuild/Sass, and native allocations. `FSUS_NODE_HEAP_PROFILE`
  selects a profile; `FSUS_NODE_HEAP_MB` is a capped diagnostic override. The
  implementation is `scripts/with-node-heap.mjs`.

Capacity planning clamps `FSUS_CI_CPU_LIMIT`, `FSUS_CI_MEMORY_LIMIT_MB`, and
`FSUS_CI_MAX_PARALLEL_LANES` against cgroup limits, host memory, and
`availableParallelism()`. Coverage planning accepts
`FSUSUI_COVERAGE_KNOWN_SECONDS`; explicit shard/worker requests remain capped.

Package smoke checks `public-shell-critical.css`, `dist/fsus.css`, and
`el-fsus-theme.css` separately from the consumer first-screen closure.

See [`docs/engineering-handoff.md`](../engineering-handoff.md) for the local
commands, cache paths, capacity fixtures, .NET lanes, and coverage merge rules.

## 3. Changesets and pre-release verification

Use Changesets for every consumer-visible package change:

```bash
pnpm changeset
pnpm version-packages
pnpm verify:release
```

Before tagging, run:

```bash
pnpm verify:release
pnpm test:coverage
pnpm test:visual:evidence
```

The changeset describes the public component/API/token/package effect and
migration action. A missing changeset blocks a functional package release;
docs-only, CI-only, test-only, and internal refactors with no public runtime,
type, package, or visual impact are explicitly marked “changeset not needed”.
Breaking changes use a major changeset beginning with `BREAKING:` and update
the relevant migration or API-stability page.

Candidate checks must inspect `dist/element-plus/package.json`, `npm pack
--dry-run`/`pnpm pack --dry-run` output, and package contents. Reject
`workspace:` dependencies, private registry URLs, secrets, `.npmrc`, source
maps, debug WASM, unrewritten `.worker.ts` URLs, or a consumer that fails
`vue-tsc`/Vite build. `scripts/prepare-npm-package.mjs` must normalize
`dependencies`, `peerDependencies`, and `optionalDependencies` and fail if
`workspace:` remains.

The publish job consumes the verified candidate with:

```bash
npm pack --dry-run
npm publish ./fsusui-npm-candidate.tgz
```

The consumer performance sample uses explicit component imports and
`profile: 'consumer'`; it measures actual raw/gzip/Brotli first-screen and
dynamic closures. Full plugin installation, complete CSS, and runtime exports
are checked separately by package and contract smoke tests.

For Markdown, `initialRender` must come from a same-source, same-renderer-version
`MarkdownSafeRenderResult`; WASM parses and replaces content asynchronously
after static HTML has provided first paint. This proves that renderer, worker,
and WASM do not compete with the first-screen Vue/CSS task.

## 4. GitHub Actions and publish binding

The workflow order is fixed:

- `.github/workflows/_quality.yml` defines the reusable quality gates;
- `.github/workflows/quality.yml` dispatches PR/main/nightly/release groups; and
- `.github/workflows/publish-npm.yml` responds only to `v*.*.*` and
  `v*.*.*-*`, depends on release quality, and publishes the verified
  `fsusui-npm-candidate.tgz` without running build or prepare again.

Before publish, the workflow:

1. locks `registry + package + resolved dist-tag` with
   `cancel-in-progress: false`;
2. verifies tag, plan, candidate manifest, package, version, registry, and
   dist-tag identity;
3. checks channel monotonicity before and after the lock, failing closed on
   query errors; and
4. uses npm Trusted Publishing/OIDC, never a long-lived npm token.

Only a newer absent version publishes. An exact version already assigned to the
requested tag is an idempotent skip; an older candidate or a version assigned to
another tag fails. Intentional tag recovery is restricted to
`recover-npm-dist-tag.yml`, its protected `npm-recovery` environment, an
expected-current value, and `NPM_RECOVERY_TOKEN`.

## 5. Stable post-publish verification

Stable `latest` publication additionally consumes the successful FsusBlog
consumer-gate receipt for the same candidate. After a real publish (never an
idempotent skip), it polls npm, downloads the registry tarball, verifies
SHA-512 integrity, candidate SHA-256, package name/version, and the `latest`
tag, then emits `fsusui-npm-published-v1`. Preview/next channels and any
verification or App-permission failure emit no event.

The payload contracts are:

- [`fsusui-npm-published-v1.schema.json`](../../spec/releases/fsusui-npm-published-v1.schema.json)
- [`fsusui-release-dispatch-receipt.schema.json`](../../spec/releases/fsusui-release-dispatch-receipt.schema.json)
- [`fsus-cross-repo-app-evidence.schema.json`](../../spec/releases/fsus-cross-repo-app-evidence.schema.json)

The sender uses `FSUS_RELEASE_TRAIN_APP_ID` and
`FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY` to mint a metadata-only FsusUI token and a
separate FsusBlog token with metadata-read, contents-write, and pull-request-
write permissions. Missing, insufficient, or extra permissions fail closed;
PATs and `GITHUB_TOKEN` are not cross-repository dispatch credentials.

The #318 pre-publish App uses `FSUS_CROSS_REPO_APP_ID` and
`FSUS_CROSS_REPO_APP_PRIVATE_KEY`, restricted to metadata/contents read for
FsusUI and FsusBlog. Its verifier emits only the sanitized evidence defined by
`fsus-cross-repo-app-evidence.schema.json`; real installation and administrator
evidence are external and must not be inferred from a local simulator pass.

The trusted `_fsusblog-consumer-gate.yml` runs only from a release-tag context.
It resolves the FsusBlog default branch once, freezes its full 40-character SHA,
checks out with credentials disabled after checkout, and runs
`verify:fsusui-candidate` against the absolute downloaded tarball. It records
exact Node/npm/Vue/Vite/TypeScript/`vue-tsc` versions and requires a clean tree
before and after. Its exact five-gate record, candidate SHA-256, workflow
identity, and pinned FsusBlog SHA are schema-validated; missing, skipped,
failed, stale, tampered, substituted, or mismatched records fail closed.
The workflow is `.github/workflows/_fsusblog-consumer-gate.yml`; its
`fsusblog-consumer-gate.receipt.json` is the receipt binding the downstream
candidate. The evidence path is supplied through
`FSUSBLOG_FSUSUI_CANDIDATE_EVIDENCE`.

The local deterministic App/dispatch matrix is:

```bash
pnpm check:npm-release-workflow
```

This proves repository configuration only; it does not claim a real npm
publication, App installation, dispatch, or downstream migration.

After publishing, confirm the Actions run, npm version, provenance, absence of
`workspace:` in the manifest, consumer dependency resolution, and remote visual
baselines/hand-off docs. These checks are observations, not substitutes for the
immutable candidate and readiness evidence.

## 6. Failure handling and rollback

| Failure | Required response |
| --- | --- |
| Quality gate | Do not publish; reproduce the failing gate and rerun `pnpm verify:release`. |
| Candidate preparation | Inspect `scripts/prepare-npm-package.mjs`, workspace dependency projection, metadata, and `dist/element-plus`. |
| Published manifest error | Do not mutate the published package; ship a new patch and document the replacement. |

## 7. Maintainer boundary

The current release interfaces are `verify`, `verify:pr-fast`, `verify:full`,
`check:consumer-contract`, `verify:release`, `test:coverage`,
`test:consumer-install`, `test:visual:evidence`, the reusable quality workflow,
Changesets, and npm public-preview audit evidence. Storybook, multi-OS Node
matrices, CODEOWNERS, branch protection, and a complex release train are not
part of this contract. Any extension must preserve the release order and gate
semantics above.
