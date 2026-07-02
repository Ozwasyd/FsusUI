# Form

Component ID: `form`

## Avalonia API

Use `FsusForm` and `FsusFormItem` for field registration, label placement,
sync and async validation, reset, validation clearing, and scroll-to-error
focus targeting.

## Vue Contract Mapping

Vue form models and rules map to public validation adapters and field names.
Slots map to `Content` inside `FsusFormItem`.

## Supported Platform Differences

Focus movement, scroll targeting, and accessible error relationships follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Forms use text, muted text, danger, focus, border, density, and disabled theme
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var form = new FsusForm();
form.Children.Add(new FsusFormItem
{
  FieldName = "email",
  Label = "Email",
  Content = new FsusInput { AccessibleName = "Email" },
});
```

## Known Limitations

Vue rule objects are not interpreted directly; adapt them to the public
validation callbacks.
