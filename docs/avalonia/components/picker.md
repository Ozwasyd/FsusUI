# Picker

Component ID: `picker`

## Avalonia API

Use `FsusSelect`, `FsusSelectV2`, `FsusAutocomplete`, `FsusOption`,
`FsusOptionGroup`, `FsusCascader`, `FsusCascaderPanel`, and `FsusCascaderNode`.

## Vue Contract Mapping

Vue option slots, grouped options, filter text, selected value, cascader paths,
and overlay behavior map to typed options, node objects, and selection events.

## Supported Platform Differences

Native focus, overlay placement, and keyboard traversal follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Pickers use surface, border, focus, text, muted text, loading, density, and
motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var select = new FsusSelect { AccessibleName = "Region" };
select.Options.Add(new FsusOption { Value = "us", Content = "United States" });

var autocomplete = new FsusAutocomplete
{
  AccessibleName = "System Font",
  ItemsSource = new[] { "Arial", "Cascadia Code", "Courier New", "Inter", "Segoe UI" },
  SelectedValue = "Inter",
};
```

## Known Limitations

Remote filtering and product-specific data fetching stay outside the control.
