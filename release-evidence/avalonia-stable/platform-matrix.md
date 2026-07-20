# Platform matrix

The stable release matrix is enforced by `.github/workflows/_quality.yml` and
`spec/ci/avalonia-stable-readiness.json`.

| Platform         | Required evidence                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `ubuntu-latest`  | Platform restore/build/test/smoke manifest; the separate canonical Ubuntu job owns the sole NuGet candidate. |
| `windows-latest` | Platform restore/build/test/smoke manifest; no package or static-governance work.                            |
| `macos-latest`   | Platform restore/build/test/smoke manifest; no package or static-governance work.                            |

The platform matrix is complete when the release workflow uploads
`avalonia-stable-evidence`, `avalonia-generated-artifacts`,
`dotnet-platform-{linux,windows,macos}`, `dotnet-nuget-candidate`, and
`avalonia-screenshots-*`. Platform manifests are distinct from the unique
NuGet candidate and its aggregate SHA-256.
