# FsusUI Avalonia Adoption

This guide is the entry point for product apps adopting the stable Avalonia
packages. Start with [installation](installation.md), then use the component
pages under [components](components/button.md) when mapping existing Vue/FsusUI
contracts to Avalonia controls.

## Package Guides

- [Install the three Avalonia packages](installation.md)
- [Migrate Vue contracts to Avalonia](vue-migration.md)
- [Review supported platform differences](platform-differences.md)

## Stable Component Pages

- [Button](components/button.md)
- [Icon and text](components/icon-text.md)
- [Input](components/input.md)
- [Selection](components/selection.md)
- [Form](components/form.md)
- [Display](components/display.md)
- [Layout](components/layout.md)
- [Navigation](components/navigation.md)
- [Modal panel](components/modal-panel.md)
- [Anchored overlay](components/anchored-overlay.md)
- [Service helper](components/service-helper.md)
- [Picker](components/picker.md)
- [Date and time](components/date-time.md)
- [Value picker](components/value-picker.md)
- [Upload and transfer](components/upload-transfer.md)
- [Data display](components/data-display.md)
- [Media and decorative](components/media-decorative.md)
- [Data table](components/data-table.md)
- [Virtualization](components/virtualization.md)
- [Tree](components/tree.md)
- [Text viewer](components/text-viewer.md)
- [Text editor](components/text-editor.md)
- [Public shell](components/public-shell.md)
- [Desktop shell](components/desktop-shell.md)
- [Product primitives](components/product-primitives.md)
- [Perception challenge](components/perception-challenge.md)
- [Locale formatting](components/locale-formatting.md)

## Verification

Run the documentation gate before publishing adoption changes:

```bash
node scripts/check-avalonia-docs.mjs
dotnet run --project dotnet/FsusUI.Avalonia.ConsumerSample/FsusUI.Avalonia.ConsumerSample.csproj -- --smoke
```

Maintainers can verify the separate packed-package Native AOT consumer on the
current Linux host with:

```bash
pnpm run test:avalonia-aot-smoke-contract
pnpm run test:avalonia-aot-smoke
```

The second command packs the three FsusUI packages, restores the consumer from
an isolated local-only source, publishes a self-contained RID-specific native
executable, and runs that executable directly against a real Avalonia window
and dispatcher. It does not define the component scenario registry.
