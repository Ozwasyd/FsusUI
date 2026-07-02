# Input

Component ID: `input`

## Avalonia API

Use `FsusInput`, `FsusTextarea`, and `FsusInputNumber` for text entry,
multiline entry, numeric entry, clear behavior, validation state, and IME
composition guards.

## Vue Contract Mapping

`modelValue`, `clearable`, `disabled`, `readonly`, validation, prefix, suffix,
and change events map to typed properties and events on the Avalonia controls.

## Supported Platform Differences

IME, text selection, focus rings, and font metrics follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Inputs use border, focus, disabled, danger, text, muted text, density, and
motion theme resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var name = new FsusInput
{
  AccessibleName = "Project name",
  Text = "FsusUI",
  IsClearable = true,
};
```

## Known Limitations

DOM input selectors and browser autocomplete attributes are not exposed.
