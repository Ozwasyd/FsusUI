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
