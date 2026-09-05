# Locale formatting

Component ID: `locale-formatting`

## Avalonia API

Use `FsusAvaloniaLocaleProvider`, `FsusAvaloniaLocale`, and
`FsusLocalizedText` for built-in locale keys, runtime culture changes, fallback
text, flow direction, and date/number formatting.

## Vue Contract Mapping

Vue locale providers and config providers map to one public locale provider per
application scope plus localized text controls where UI copy must update at
runtime.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for culture-specific text shaping and right-to-left flow.

## Theme Tokens

Use the text-control text, muted-text, focus, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Localization;

var provider = FsusAvaloniaLocaleProvider.CreateDefault();
provider.SetCulture("zh-cn");
var text = new FsusLocalizedText(provider) { Key = "el.select.noData" };
```

## Known Limitations

Product-specific translations must be registered by the consuming app.
