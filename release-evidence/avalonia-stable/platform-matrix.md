# Platform matrix

The stable release matrix is enforced by `.github/workflows/_quality.yml` and
`spec/ci/avalonia-stable-readiness.json`.

| Platform | Required evidence |
| --- | --- |
| `ubuntu-latest` | Static quality, .NET verification, package audit, accessibility checks, visual fixtures, performance budgets. |
| `windows-latest` | .NET verification, native focus/high-contrast behavior, package restore/build, visual evidence where applicable. |
| `macos-latest` | .NET verification, text smoothing coverage, package restore/build, visual evidence where applicable. |

The platform matrix is complete when the release workflow uploads
`avalonia-stable-evidence`, `avalonia-generated-artifacts`,
`dotnet-build-output-*`, and `avalonia-screenshots-*`.
