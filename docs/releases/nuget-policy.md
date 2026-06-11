# NuGet Policy

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
pnpm run dotnet:restore
pnpm run dotnet:build
pnpm run dotnet:test
pnpm run dotnet:pack
pnpm run dotnet:verify
```

`pnpm run dotnet:verify` restores the solution, builds Avalonia packages, runs
unit and headless tests, executes the demo startup smoke, packs NuGet
candidates, validates package metadata, checks generated token/icon freshness,
and reruns cross-platform conformance/governance gates.

Linux and Windows CI coverage is required for restore/build/test/pack before an
Avalonia preview package can be considered releasable. macOS coverage is
tracked as a later platform-matrix expansion unless a release owner makes it
mandatory for a specific preview.
