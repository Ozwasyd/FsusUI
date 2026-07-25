# Stable Version Inputs

## Contract version

Component contracts use schema v1 from
`spec/components/contracts/v1/vue-public-contracts.json` and the Avalonia
stable family registry in `dotnet/FsusUI.Avalonia.Demo/Gallery/FsusAvaloniaGalleryRegistry.cs`.

## Token version

Token version is Token v2 from `spec/tokens/tokens.json` with generated
Avalonia resources under `dotnet/FsusUI.Avalonia/Generated`.

## Icon version

Icon registry version is `1` from `spec/icons/registry.yaml`; generated
Avalonia keys are in `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs`.

## npm version

The Web compatibility package version is `@ozwasyd/element-plus@1.5.1` from
`vue/packages/element-plus/package.json`.

## NuGet version

The Avalonia package version is `0.0.0-preview.0` from
`dotnet/Directory.Build.props`. Stable NuGet metadata and public API baselines
are guarded by `scripts/check-avalonia-nuget-stable.mjs`.
