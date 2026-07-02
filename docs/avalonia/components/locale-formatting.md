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

Culture-specific text shaping and right-to-left flow follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Locale formatting uses the same text, muted text, focus, density, and motion
resources as text controls.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Localization;

var provider = FsusAvaloniaLocaleProvider.CreateDefault();
provider.SetCulture("zh-cn");
var text = new FsusLocalizedText(provider) { Key = "el.select.noData" };
```

## Known Limitations

Product-specific translations must be registered by the consuming app.
