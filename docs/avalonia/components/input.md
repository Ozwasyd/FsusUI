# Input

Component ID: `input`

## Avalonia API

Use `FsusInput`, `FsusTextarea`, `FsusInputNumber`, and `FsusShortcutRecorder`
for text entry, multiline entry, numeric entry, shortcut capture, clear
behavior, validation state, and IME composition guards.

## Vue Contract Mapping

`modelValue`, `clearable`, `disabled`, `readonly`, validation, prefix, suffix,
and change events map to typed properties and events on the Avalonia controls.

## Supported Platform Differences

IME, text selection, focus rings, and font metrics follow
`docs/avalonia/platform-differences.md`.

`FsusShortcutGesture.SerializedText` is the stable persistence form. Its
modifier semantics are platform-neutral: a primary shortcut serializes as
`Ctrl`, while `ToDisplayText(FsusShortcutPlatform.macOS)` presents that
modifier as `Command`; `Alt` is presented as `Option`. OEM keys serialize by
their invariant Avalonia key name so delimiter keys such as `OemPlus`
round-trip without ambiguity.

`FsusShortcutRecorder` starts recording from pointer activation or
Enter/Space, captures one complete gesture, cancels with Escape, and clears
with Backspace/Delete when `IsClearable` is enabled. `ExistingShortcuts` and
`ReservedShortcuts` drive `Duplicate` and `Reserved` validation states.
`AutomationProperties.ItemStatus` and `HelpText` expose the current
recording or validation state.

## Theme Tokens

Inputs use border, focus, disabled, danger, text, muted text, density, and
motion theme resources.

## Minimal Avalonia Example

```csharp
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

var name = new FsusInput
{
  AccessibleName = "Project name",
  Text = "FsusUI",
  IsClearable = true,
};

var publishShortcut = new FsusShortcutRecorder
{
  AccessibleName = "Publish article shortcut",
  ExistingShortcuts =
  [
    new FsusShortcutGesture(Key.S, KeyModifiers.Control),
  ],
};
```

## Known Limitations

DOM input selectors and browser autocomplete attributes are not exposed.
Platform labels are presentation only; persist `SerializedText`, not
`DisplayText`.
