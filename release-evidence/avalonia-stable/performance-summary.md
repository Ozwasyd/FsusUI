# Performance summary

## Static fixture and budget summary

Static fixture/budget commands:

```bash
node scripts/avalonia-performance-budget.mjs check
dotnet test dotnet/FsusUI.Avalonia.PerformanceTests/FsusUI.Avalonia.PerformanceTests.csproj
```

Results: Avalonia performance budgets passed and performance tests passed with
32 tests.

The commands above validate maintained budget fixtures and control invariants;
they are not live visual-tree, layout, draw, scroll, allocation, or disposal
measurements. Real-render evidence is produced separately with:

```bash
pnpm perf:render -- --profile full --output .tmp/performance/full
```

See `docs/performance/real-render-benchmarks.md` for the browser/Avalonia
matrix, same-runner relative regression policy, environment metadata, and raw
artifact contract. No cross-machine absolute score comparison is implied by
this release summary.
