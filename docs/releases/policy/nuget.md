# NuGet Policy

> **Role:** Normative NuGet distribution policy
> **Applies to:** Avalonia package scope, metadata, preview/stable status, and verification

Avalonia packages remain preview packages until the cross-platform conformance
matrix is complete.

## Packages and metadata

| Package | Policy |
| --- | --- |
| `FsusUI.Avalonia` | Publishable library |
| `FsusUI.Avalonia.Themes` | Publishable library |
| `FsusUI.Avalonia.Icons` | Publishable library |
| `FsusUI.Avalonia.Demo` | Reference shell; publish only with explicit release-owner approval |

Each publishable package must define its package metadata: package ID, description, repository
URL, license, tags, optional readme metadata, deterministic build settings
where feasible, release-notes source, and preview/stable status.

## Evidence and channel independence

Preview release evidence includes restore/build/test logs, package audit, consumer
install result, platform matrix, known limitations, and conformance output.
NuGet must not replace or block the npm/Web pipeline unless
[`docs/releases/governance.md`](../governance.md) makes a shared gate mandatory.

## Local and CI verification

```bash
pnpm dotnet:matrix:plan --os linux,windows,macos
pnpm dotnet:platform:verify
pnpm dotnet:package:verify
```

`dotnet:platform:verify` restores, builds, tests, and smoke-starts the Avalonia
solution for the current host and emits its platform manifest. It defaults to
one worker; set `FSUS_DOTNET_MAX_CPU_COUNT` or `--max-cpu-count` only when the
headless render workload has been sized for it.

`dotnet:package:verify` independently restores/builds, packs the unique
canonical NuGet candidate, validates metadata and contents, runs packed-consumer
and stable-package contracts, and records one aggregate SHA-256. Token, icon,
conformance, governance, and a11y contracts remain in the static-quality lane.

CI requires platform restore/build/test/smoke on Linux, Windows, and macOS.
Packing and package validation run once on canonical Ubuntu; other platforms do
not produce package candidates.
