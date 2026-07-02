# Value picker

Component ID: `value-picker`

## Avalonia API

Use `FsusSlider`, `FsusRate`, `FsusColorPicker`, `FsusSliderMark`, and
`FsusNumericValueChangedEventArgs` for scalar, rating, and color selection.

## Vue Contract Mapping

Vue slider marks, rate values, color values, disabled state, and change events
map to typed value properties and events.

## Supported Platform Differences

Pointer geometry, keyboard increments, and focus cues follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Value pickers use focus, accent, surface, border, text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var slider = new FsusSlider
{
  AccessibleName = "Confidence",
  Minimum = 0,
  Maximum = 100,
  Value = 80,
};
```

## Known Limitations

Browser color input UI is not reused; use the Avalonia color picker contract.
