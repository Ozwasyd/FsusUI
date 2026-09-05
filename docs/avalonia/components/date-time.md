# Date and time

Component ID: `date-time`

## Avalonia API

Use `FsusCalendar`, `FsusDatePicker`, `FsusTimePicker`, `FsusTimeSelect`,
`FsusDateShortcut`, and `FsusTimeSelectOption`.

## Vue Contract Mapping

Vue calendar, date picker, time picker, time select, shortcuts, disabled dates,
range intent, and clear behavior map to typed date and time values.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for native picker panels and locale-formatting boundaries.

## Theme Tokens

Use surface, border, focus, text, muted-text, danger, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var picker = new FsusDatePicker
{
  AccessibleName = "Due date",
  SelectedDate = new DateOnly(2026, 7, 2),
};
```

## Known Limitations

Native calendar layout may differ from the Web panel while value contracts stay
stable.
