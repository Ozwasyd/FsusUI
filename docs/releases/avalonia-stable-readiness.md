# Avalonia Stable Readiness Evidence

This evidence file records the stable gate inputs required before publishing
final Avalonia packages.

| Evidence                  | Mapping                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract version          | Component contracts schema v1, `spec/components/contracts/v1/vue-public-contracts.json`, and `spec/components/avalonia-first-subset.yaml`. |
| Token version             | Token schema from `spec/tokens/tokens.json` plus generated token hash in `spec/baselines/vue-current.json`.                                |
| npm version               | `@ozwasyd/element-plus` package version recorded in `spec/baselines/vue-current.json`.                                                     |
| NuGet version             | `dotnet/Directory.Build.props` package version and generated NuGet metadata checks.                                                        |
| Platform overrides        | Active IDs in `spec/platform-overrides/*.yaml` and `docs/releases/platform-overrides.md`.                                                  |
| Known limitations         | Complex controls remain deferred until their roadmap entries have contracts, budgets, accessibility evidence, and platform review.         |
| Cache and sharding policy | Unit shards consume `unit-test-artifacts`; screenshot and .NET build output artifacts are uploaded per matrix axis with short retention.   |

CI groups:

- PR fast: `verify:pr-fast` on pull requests.
- Main: `_quality.yml` with `group: main` on pushes to `main` or `master`.
- Nightly: `_quality.yml` with `group: nightly` on schedule or manual dispatch.
- Release: `_quality.yml` with `group: release` by manual dispatch before final publish.

Required workflow artifacts:

- `unit-test-artifacts`
- `fsusui-npm-package-dist`
- `dotnet-build-output-*`
- `avalonia-screenshots-*`
- `avalonia-generated-artifacts`
- `avalonia-stable-evidence`
- `avalonia-nightly-evidence`
- `avalonia-release-evidence`

The stable gate is reproducible from workflow artifacts by unpacking
`avalonia-stable-evidence`, restoring generated artifacts, and rerunning
`pnpm run verify:stable`.
