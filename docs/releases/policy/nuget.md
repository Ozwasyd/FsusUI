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

## SDK selection and dependency locks

`dotnet/global.json` retains the original `10.0.108` minimum with
`latestFeature`: select the highest installed compatible 10.0 feature band,
rather than require the 10.0.1xx band. The existing restore, platform, and
package verifiers execute .NET from `dotnet/` so the CLI finds this policy,
and print the selected SDK before restoring. Successful platform and package
manifests also record that SDK. A setup-dotnet installation result alone is
not proof of the SDK used by a verifier.

CI platform and package restores use locked mode. SDK-supplied dependencies,
including the implicit ILLink package of AOT-compatible libraries, can change
between feature bands. An installed SDK allowed by `latestFeature` must still
match the committed lock requests; a mismatch fails verification and requires
reviewed lock maintenance, not an unlocked CI restore. A lock snapshot verified
with one SDK does not qualify another feature band.

Run `pnpm dotnet:restore:update-locks` with the intended SDK installed to
regenerate every project lock, then run `pnpm dotnet:restore` and the affected
build and consumer gates with the same selected SDK. Preserve NuGet signature,
content-hash, and audit checks. The current maintenance snapshot targets the
observed CI SDK 10.0.401 and its implicit ILLink 10.0.12 request; the previous
10.0.108/ILLink 10.0.8 snapshot remains separate evidence.
