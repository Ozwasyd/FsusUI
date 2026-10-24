# CI readiness evidence aggregation

Main/stable, nightly, and release readiness jobs are read-only aggregation gates.
They do not run a second copy of build, test, coverage, visual, package, or
`.NET` verification. Each execution owner records one schema-versioned JSON
manifest after its leaf job and uploads that small manifest under
`readiness-manifest-*`.

Every leaf manifest binds the result to the workflow group, full commit SHA,
run id and attempt. It also records the gate name, result status, runtime and
toolchain identity, an input fingerprint, dimensions such as OS or shard,
report-summary path, and SHA-256 values for relevant artifacts. The candidate
package producer and consumer both record the `npm-candidate` digest, so the
consumer cannot attest to a different tarball.

The profile contract lives in `spec/ci/readiness-gates.json`:

- main requires static quality, all three `.NET` platforms, the unique NuGet
  candidate, typecheck, the complete Unit shard set, final coverage, the unique
  npm candidate and consumer install, demo build, visual results, and quick
  real-render performance;
- nightly selects full real-render performance with the same registry;
- release selects full real-render and evidence visual profiles, then binds the
  immutable candidate to commit SHA, the v-prefixed tag, and package version.

The aggregator rejects a missing owner, duplicate owner/dimension, incomplete
matrix or shard set, mixed commit or workflow group, non-success status, stale
run/attempt, missing report summary, a locally available artifact whose digest
does not match, and an npm candidate producer/consumer digest mismatch. A failed
or cancelled job therefore cannot be replaced by an artifact from an earlier
run.

The PR feedback and static-quality leaves run the original complete
`conformance:v2` producer before governance consumes its candidate-bound
alignment. NuGet candidate leaves run that same producer before packaging.
Each checkout produces its own evidence; a head artifact cannot be relabeled as
the PR merge candidate. These Linux executions install the real Orca/AT-SPI
prerequisites through `.github/actions/setup-conformance-accessibility` and run
inside a D-Bus session with Xvfb. Missing tools, producer failures, alignment
gaps, and stale identities retain their original failure behavior. A local
`verify:pr-fast` invocation likewise requires the governed producer's current
alignment before its governance consumer runs. Each CI producer retains its
own `.tmp/conformance-v2` diagnostics even on failure; those diagnostic uploads
do not attest to a passing alignment or replace a candidate package.

The Playwright readiness owners are derived from
`spec/ci/playwright-owners.json`. The `playwright-conformance` owner contributes
one required receipt for each Chromium, Firefox, and WebKit cell. Its manifests
also bind the Contract V2, Vue baseline, normalized scenario registry, runner,
browser revision, interaction-trace identity and digest, scenario/action
cardinality, and the native IME evidence references tracked by #319 and #320.

The planning and fixture checks are local, deterministic, and require neither
the GitHub API nor the Actions artifact service:

```bash
pnpm ci:profile:plan --group main
pnpm ci:profile:plan --group nightly
pnpm ci:profile:plan --group release
pnpm ci:profile:check
pnpm ci:readiness:check --fixtures tests/fixtures/ci-readiness/valid
pnpm test:ci-readiness
pnpm check:readiness-workflow
```

`verify:stable`, `verify:nightly`, and `verify:release` remain explicit local
developer entry points. They are intentionally not called by a readiness job.
The workflow policy checker guards that boundary and does not use runner wall
time as a correctness condition.

The tag workflow passes `group: release` and its tag to the same reusable
profile used by manual Release dispatch. `publish` consumes both the unique npm
candidate digest and the release-readiness evidence digest; it cannot proceed
from the reusable workflow's default Main profile. Manual Release may omit a
tag input, in which case the aggregator derives the expected `v<packageVersion>`
identity without creating or querying a tag.
