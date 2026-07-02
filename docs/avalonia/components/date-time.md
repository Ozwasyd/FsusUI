# Date and time

Component ID: `date-time`

## Avalonia API

Use `FsusCalendar`, `FsusDatePicker`, `FsusTimePicker`, `FsusTimeSelect`,
`FsusDateShortcut`, and `FsusTimeSelectOption`.

## Vue Contract Mapping

Vue calendar, date picker, time picker, time select, shortcuts, disabled dates,
range intent, and clear behavior map to typed date and time values.

## Supported Platform Differences

Native picker panels and locale formatting follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Date and time controls use surface, border, focus, text, muted text, danger,
density, and motion resources.

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
