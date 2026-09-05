# Value picker

Component ID: `value-picker`

## Avalonia API

Use `FsusSlider`, `FsusRate`, `FsusColorPicker`, `FsusSliderMark`, and
`FsusNumericValueChangedEventArgs` for scalar, rating, and color selection.

### `FsusSlider`

`FsusSlider` is a directly interactive horizontal range control. Its
production template renders a track, a value fill, and a thumb whose position
reflects `Value` across the logical `Min` to `Max` direction. `Min`, `Max`,
`Step`, `Value`, `Size`, `IsDisabled`, `AccessibleName`, and
`AccessibleValueText` are bindable Avalonia styled properties.

`ValueChanged` fires whenever snapping changes the value. `ValueCommitted`
fires once when a pointer gesture ends, after a handled keyboard adjustment,
or after an enabled automation range provider sets the value. Both events use
`FsusNumericValueChangedEventArgs` and include the old and new values.

Pointer press focuses the slider, updates the value, and captures the pointer;
dragging continues outside the control until release or capture loss. Values
clamp to the inclusive bounds and snap to `Step`. Reversed bounds are supported:
the track direction still runs from `Min` to `Max`, while the automation range
reports the numerically lower and upper bounds.

| Key | Result |
| --- | --- |
| `Left` / `Down` | One `Step` toward `Min` |
| `Right` / `Up` | One `Step` toward `Max` |
| `Home` | `Min` |
| `End` | `Max` |
| `PageDown` | Up to ten steps toward `Min` |
| `PageUp` | Up to ten steps toward `Max` |

The production automation peer exposes the RangeValue pattern with numeric
minimum, maximum, value, small change, large change, and read-only state.
`AccessibleValueText` supplies the announced value text for units such as
`"2 seconds"` or `"14 pixels"`; when omitted it falls back to the invariant
numeric value. Set `AccessibleName` to the preference or field label.

## Vue Contract Mapping

Vue slider marks, rate values, color values, disabled state, and change events
map to typed value properties and events.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for pointer geometry,
keyboard increments, and focus cues.

## Theme Tokens

Value pickers use focus, accent, surface, border, text, density, and motion
resources. The slider keeps its track, fill, and thumb distinct in Light, Dark,
and the registered high-contrast override. Compact, default, and spacious
density resources control the target height and thumb size. Thumb and fill
transitions consume the effective Avalonia control-motion resources, including
the `1ms` reduced-motion terminal behavior. Disabled sliders use disabled and
border resources rather than lowering the opacity of the whole control.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var slider = new FsusSlider
{
  AccessibleName = "Auto-save delay",
  AccessibleValueText = "2 seconds",
  Min = 0,
  Max = 10,
  Step = 1,
  Value = 2,
};
```

## Known Limitations

Browser color input UI is not reused; use the Avalonia color picker contract.
`FsusSlider` is horizontal only. It does not add tooltip, range-selection, or
mark-label rendering beyond the existing `Marks` data contract.
