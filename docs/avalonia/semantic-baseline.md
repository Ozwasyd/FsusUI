# Avalonia Semantic Baseline

> **Role:** Machine-observed public API baseline for the Avalonia packages.
> **Applies to:** `FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`,
> `FsusUI.Avalonia.Icons`.

The semantic baseline is extracted from the compiled assemblies by reflection
(`dotnet/FsusUI.Avalonia.ApiTool`) and committed to `spec/avalonia/semantic/`.
It records per public type: kind, base type, content property, CLR properties,
Avalonia styled/direct properties (with default values when reflectable), routed
and CLR events (with payload types), public methods (with signatures), and enum
members.

## Regeneration

```sh
pnpm run avalonia:semantic        # rebuild spec/avalonia/semantic/*.json
pnpm run avalonia:semantic:check  # fail when the committed baseline drifts
```

Compiler-generated types (for example `CompiledAvaloniaXaml.!AvaloniaResources`)
are excluded; only types whose full name starts with `FsusUI.Avalonia` are
captured.

## Relationship to Contract V2

`scripts/contract-v2.mjs` consumes this baseline together with
`spec/baselines/vue-current.json` and produces
`spec/components/contracts/v2/contract-v2.json`. The committed baseline hash is
recorded in the registry, so any semantic change without regeneration fails
`pnpm run contract-v2:check`.
