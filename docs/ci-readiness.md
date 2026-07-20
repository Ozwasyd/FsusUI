# CI readiness evidence aggregation

Stable, nightly, and release readiness jobs are read-only aggregation gates.
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

- stable requires static quality, all three `.NET` platforms, the unique NuGet
  candidate, typecheck, the complete Unit shard set, final coverage, the unique
  npm candidate and consumer install, demo build, and visual results;
- nightly requires the stable leaves plus real-render performance;
- release requires the same complete evidence set and preserves the immutable
  candidate/channel-lock hand-off used by the publish workflow.

The aggregator rejects a missing owner, duplicate owner/dimension, incomplete
matrix or shard set, mixed commit or workflow group, non-success status, stale
run/attempt, missing report summary, a locally available artifact whose digest
does not match, and an npm candidate producer/consumer digest mismatch. A failed
or cancelled job therefore cannot be replaced by an artifact from an earlier
run.

The planning and fixture checks are local, deterministic, and require neither
the GitHub API nor the Actions artifact service:

```bash
pnpm ci:readiness:plan --group stable
pnpm ci:readiness:check --fixtures tests/fixtures/ci-readiness/valid
pnpm test:ci-readiness
pnpm check:readiness-workflow
```

`verify:stable`, `verify:nightly`, and `verify:release` remain explicit local
developer entry points. They are intentionally not called by a readiness job.
The workflow policy checker guards that boundary and does not use runner wall
time as a correctness condition.
