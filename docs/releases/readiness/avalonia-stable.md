# Avalonia Stable Readiness Contract

> **Role:** Normative stable-readiness contract
> **Applies to:** Required inputs and signoff records before final Avalonia package publication

This contract records the stable gate inputs required before publishing
final Avalonia packages.

| Evidence                    | Mapping                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract version            | Component contracts schema v1, `spec/components/contracts/v1/vue-public-contracts.json`, and `spec/components/avalonia-first-subset.yaml`. |
| Token version               | Token schema from `spec/tokens/tokens.json` plus generated token hash in `spec/baselines/vue-current.json`.                                |
| Icon version                | `spec/icons/registry.yaml` version `1` plus generated Avalonia icon keys.                                                                  |
| npm version                 | `@ozwasyd/element-plus` package version recorded in `spec/baselines/vue-current.json`.                                                     |
| NuGet version               | `dotnet/Directory.Build.props` package version and generated NuGet metadata checks.                                                        |
| CI run ids                  | `docs/releases/evidence/avalonia-stable/ci-run-ids.md` records the RC Quality Gates run ids.                                                     |
| Platform matrix             | `docs/releases/evidence/avalonia-stable/platform-matrix.md` records Ubuntu, Windows, and macOS coverage.                                         |
| Package audit               | `docs/releases/evidence/avalonia-stable/package-audit.md` records NuGet metadata, symbol, dependency, and content checks.                        |
| Consumer install results    | `docs/releases/evidence/avalonia-stable/consumer-install.md` records packed-package restore/build/smoke results.                                 |
| Visual diff summary         | `docs/releases/evidence/avalonia-stable/visual-diff-summary.md` records visual conformance output.                                               |
| Accessibility summary       | `docs/releases/evidence/avalonia-stable/accessibility-summary.md` records automation and headless test output.                                   |
| Performance summary         | `docs/releases/evidence/avalonia-stable/performance-summary.md` records budget and performance test output.                                      |
| Platform overrides          | Active IDs in `spec/platform-overrides/*.yaml` and `docs/releases/readiness/platform-overrides.md`.                                                  |
| Active platform overrides   | `docs/releases/evidence/avalonia-stable/active-platform-overrides.md` lists every accepted active override.                                      |
| Stable-readiness checklist  | `docs/releases/evidence/avalonia-stable/stable-readiness-checklist.md` links every required issue and component family.                          |
| Release notes               | `docs/releases/evidence/avalonia-stable/release-notes.md` summarizes stable consumer changes.                                                    |
| Preview-to-stable migration | `docs/releases/evidence/avalonia-stable/preview-to-stable-migration.md` records migration steps.                                                 |
| Known limitations           | Complex controls remain deferred until their roadmap entries have contracts, budgets, accessibility evidence, and platform review.         |
| Cache and sharding policy   | Unit shards consume `unit-test-artifacts`; screenshot and .NET build output artifacts are uploaded per matrix axis with short retention.   |

CI groups:

- PR fast: `verify:pr-fast` on pull requests.
- Main: `_quality.yml` with `group: main` on pushes to `main` or `master`.
- Nightly: `_quality.yml` with `group: nightly` on schedule or manual dispatch.
- Release: `_quality.yml` with `group: release` by manual dispatch before final publish.

Required workflow artifacts:

- `unit-test-artifacts`
- `fsusui-npm-candidate` (tarball, SHA-256 sidecar, and candidate manifest)
- `dotnet-platform-{linux,windows,macos}`
- `dotnet-nuget-candidate`
- `avalonia-screenshots-*`
- `avalonia-generated-artifacts`
- `avalonia-stable-evidence`
- `avalonia-nightly-evidence`
- `avalonia-release-evidence`
- `readiness-manifest-*` (schema-versioned leaf result manifests for this run)

The stable aggregation decision is reproducible without rerunning leaf work by
unpacking `avalonia-stable-evidence` and running
`pnpm ci:readiness:check --fixtures <unpacked-readiness-root>`. The explicit
local `pnpm verify:stable` command remains available when a developer wants to
execute all stable checks again; it is not the CI readiness implementation.
