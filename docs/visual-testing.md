# Visual test profiles

FsusUI exposes four explicit visual profiles. All four are orchestrated by
`scripts/run-visual-tests.mjs`, consume the same resource capacity plan, and
prepare `.tmp/visual-runtime` exactly once before browser execution.

The orchestrator owns the Preview and Dev servers for each run. An unrelated
process already listening on the configured port is rejected instead of being
treated as current runtime evidence. `FSUS_VISUAL_REUSE_SERVER=1` is an
explicit local debugging opt-in only; Full, Evidence, and release verification
must leave it unset so the server is started from the validated runtime
manifest.

| Profile  | Command                     | Contract                                                                                                              |
| -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Smoke    | `pnpm test:visual:smoke`    | Stable Basic fixtures in desktop/light and compact/dark projects. It uses one worker and keeps only failure evidence. |
| Affected | `pnpm test:visual:affected` | Maps a local Git diff to owned specs, Demo sections, and `FSUS_UI_AUDIT_COMPONENTS`. It keeps only failure evidence.  |
| Full     | `pnpm test:visual:full`     | All Preview specs in desktop-light, mobile-light, desktop-dark, and mobile-dark, plus exactly one Dev suite.          |
| Evidence | `pnpm test:visual:evidence` | The same test selection as Full, with successful screenshots, traces, a manifest, and HTML reports retained.          |

The unqualified `pnpm test:visual` command only prints this profile help. It
does not guess a workload and does not forward unknown arguments.

## Browser-free planning

Append `--dry-run` to any profile to print its capacity and test plan without
preparing the runtime, starting a browser, or accessing the network:

```bash
pnpm test:visual:smoke -- --dry-run
pnpm test:visual:affected -- --dry-run
pnpm test:visual:full -- --dry-run
pnpm test:visual:evidence -- --dry-run
```

The affected baseline can be selected with `--base=<local-ref>` or
`FSUS_VISUAL_BASE=<local-ref>`. In CI, an already fetched
`origin/$GITHUB_BASE_REF` is accepted. The planner never fetches a missing ref.
When the checkout is shallow, the directory is not a Git worktree, the base is
missing, or the comparison is empty, affected reports the reason and runs the
Smoke selection. `FSUS_VISUAL_AFFECTED_FILES` accepts a comma/newline-separated
fixture list for deterministic offline tooling and tests.

## Affected ownership registry

`spec/ci/visual-profiles.json` is the source of truth for component source,
theme source, Demo section, visual spec, and audit-component ownership. Its
offline checker fails when a component package is added without an owner or an
owner points at a removed package.

Component and component-theme changes select their Demo section, the UI audit
spec, and the matching `FSUS_UI_AUDIT_COMPONENTS` subset. Demo section changes
select that section's owned spec. Tokens, foundation styles, typography,
public/global shell sources, Playwright configuration, Visual infrastructure,
and other unsafe global inputs are marked `full-required`. Affected still runs
the bounded common-contract selection and prints `pnpm test:visual:full` as a
recommendation; it never silently changes profile.

## Verification and evidence boundaries

`verify`, `verify:full`, and `verify:pr-fast` remain browser-free. Run
`verify:visual:affected` explicitly for local or PR visual feedback.
`verify:nightly` selects Full. Release/manual visual evidence selects Evidence.
Neither Full nor Evidence is invoked by install hooks, commit hooks, ordinary
builds, or ordinary source verification.

Full and Evidence accept an explicit `--shard=N/M`. Every shard runs its
Preview portion; shard `1/M` alone runs the single Dev suite, so distributed
execution does not multiply Dev coverage.

Normal profiles retain screenshots and traces only on failure. Evidence mode
also writes `.tmp/visual-evidence/manifest.json`. Result paths are namespaced by
profile, suite, project, and shard; HTML report paths are namespaced by profile,
suite, and shard. A failure while writing the evidence manifest fails the
evidence command and never changes its Full-equivalent test selection.
Evidence retains a trace for every failure while the authoritative
`screenshot: on` matrix records every successful rendered state. Recording a
second trace for every success is intentionally disabled because it competes
with the success screenshot fixture and can block browser-context teardown.
