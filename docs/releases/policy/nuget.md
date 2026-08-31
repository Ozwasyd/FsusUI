# NuGet Policy

> **Role:** Normative NuGet distribution policy
> **Applies to:** Avalonia package scope, metadata, preview/stable status, and package verification

Avalonia packages are preview packages until the cross-platform conformance
matrix is complete.

## Packages

Planned NuGet packages:

- `FsusUI.Avalonia`
- `FsusUI.Avalonia.Themes`
- `FsusUI.Avalonia.Icons`

`FsusUI.Avalonia.Demo` is a reference shell and should not be published unless a
release owner explicitly approves it.

## Required Package Metadata

Every publishable NuGet package must define:

- package id
- description
- repository URL
- license metadata
- tags
- readme metadata where useful
- deterministic build settings where feasible
- release notes source
- preview/stable status

## Release Evidence

Avalonia preview release evidence should include:

- restore/build/test logs
- package audit
- consumer install result
- platform matrix
- known limitations
- conformance gate output

NuGet releases must not replace or block the npm/Web release pipeline unless the
release governance document explicitly makes a shared gate mandatory.

## Local And CI Verification

Root-level .NET commands are exposed next to the existing Web checks:

```bash
pnpm run dotnet:matrix:plan --os linux,windows,macos
pnpm run dotnet:platform:verify
pnpm run dotnet:package:verify
```

`pnpm run dotnet:platform:verify` restores the solution, builds Avalonia projects,
runs tests and startup smoke for the current platform, and emits its platform
manifest. It uses a safe single-worker default for restore, build, and test
orchestration; set `FSUS_DOTNET_MAX_CPU_COUNT` or pass `--max-cpu-count` with a
positive integer only when the execution environment has been sized for the
headless render workload. `pnpm run dotnet:package:verify` independently
restores/builds and then packs the unique canonical NuGet candidate, validates
metadata and contents, runs the packed-consumer and stable-package contracts,
and records its aggregate SHA-256. Token, icon, conformance, governance, and
a11y contracts remain in the single static-quality lane.

Linux, Windows, and macOS CI coverage is required for platform
restore/build/test/smoke. Pack and package validation run once on canonical
Ubuntu; the other platforms never produce package candidates.
