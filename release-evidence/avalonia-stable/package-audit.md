# Package audit

## Package audit results

Local RC audit command:

```bash
dotnet restore dotnet/FsusUI.Avalonia.slnx
dotnet build dotnet/FsusUI.Avalonia.slnx --configuration Release
dotnet pack dotnet/FsusUI.Avalonia.slnx --no-build --configuration Release -o dotnet/artifacts/nuget
node scripts/check-nuget-metadata.mjs
node scripts/check-nuget-package-smoke.mjs
node scripts/check-avalonia-nuget-stable.mjs
```

Results:

- `FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`, and
  `FsusUI.Avalonia.Icons` produced `.nupkg` and `.snupkg` files.
- Demo, tests, smoke projects, and consumer samples remain unpublished.
- Package contents are limited to README, nuspec, metadata, DLL, and symbol
  PDB assets.
- Dependency review allows only `Avalonia` plus the intended
  `FsusUI.Avalonia` package dependency for Themes and Icons.
- Public API baselines are stored under `spec/avalonia/public-api/`.
