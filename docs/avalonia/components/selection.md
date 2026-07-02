# Selection

Component ID: `selection`

## Avalonia API

Use `FsusCheckbox`, `FsusCheckboxGroup`, `FsusRadio`, `FsusRadioGroup`, and
`FsusSwitch` for boolean, three-state, grouped, and exclusive selection.

## Vue Contract Mapping

Vue checked values, radio groups, disabled items, loading state, and keyboard
contracts map to `IsChecked`, `SelectedValues`, `SelectedValue`, `ItemValue`,
and typed value-changed events.

## Supported Platform Differences

Native automation peers and high-contrast focus behavior follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Selection controls use focus, disabled, accent, density, text, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var optIn = new FsusCheckbox
{
  Content = "Send release alerts",
  ItemValue = "alerts",
  IsChecked = true,
};
```

## Known Limitations

Group item ordering is based on Avalonia child order, not DOM order queries.
