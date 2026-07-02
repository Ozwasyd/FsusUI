# Consumer install results

## Consumer install results

The stable packed consumer fixture is
`tests/fixtures/avalonia-packed-consumer/FsusUI.Avalonia.PackedConsumerSample.csproj`.
It references packed packages from `dotnet/artifacts/nuget` and does not use
`ProjectReference`.

Local RC command:

```bash
node scripts/check-avalonia-nuget-stable.mjs
```

Result: restore, build, and `--smoke` run passed against the locally packed
NuGet artifacts.
