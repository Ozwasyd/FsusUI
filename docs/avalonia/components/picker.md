# Picker

Component ID: `picker`

## Avalonia API

Use `FsusSelect`, `FsusSelectV2`, `FsusAutocomplete`, `FsusOption`,
`FsusOptionGroup`, `FsusCascader`, `FsusCascaderPanel`, and `FsusCascaderNode`.

`FsusSelect` is the production non-editable selector. Its bindable properties
are:

| Property            | Contract                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ItemsSource`       | Enumerates option models or `FsusOption` instances. Observable collections refresh the rendered list.                |
| `SelectedValue`     | Two-way selected value. Selection uses `SetCurrentValue`, so an existing binding remains active.                     |
| `DisplayMemberPath` | Optional public property path used for the rendered label. Nested paths and string-keyed dictionaries are supported. |
| `SelectedValuePath` | Optional public property path used for the selected value. Without it, the item itself is the value.                 |

Use `FsusOption.IsDisabled` when individual options must stay visible but must
not be selected. Set `IsEnabled="False"`, or bind `IsEnabled`, to disable the
entire selector.

## Vue Contract Mapping

Vue option slots, grouped options, filter text, selected value, cascader paths,
and overlay behavior map to typed options, node objects, and selection events.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for native focus, overlay placement, and keyboard traversal.

## Theme Tokens

Use picker surface, border, text, muted-text, focus-ring, control/option-height,
radius, spacing, density, and reduced-motion resources from the active FsusUI
theme ([Application Setup](../installation.md#application-setup)).

## Minimal Avalonia Example

```xml
<fsus:FsusSelect
  AccessibleName="Editor zoom"
  ItemsSource="{Binding ZoomOptions}"
  DisplayMemberPath="Label"
  SelectedValuePath="Value"
  SelectedValue="{Binding Zoom, Mode=TwoWay}" />
```

For a fixed option list, `Options` remains supported:

```csharp
var region = new FsusSelect { AccessibleName = "Region" };
region.Options.Add(new FsusOption
{
  Value = "us",
  Label = "United States",
});
region.Options.Add(new FsusOption
{
  Value = "restricted",
  Label = "Restricted region",
  IsDisabled = true,
});

var autocomplete = new FsusAutocomplete
{
  AccessibleName = "System Font",
  ItemsSource = new[] { "Arial", "Cascadia Code", "Courier New", "Inter", "Segoe UI" },
  SelectedValue = "Inter",
};
```

## Interaction and Accessibility

Pointer press opens or closes the popup. `Down` and `Up` open it and move the
active option while skipping disabled options; `Enter` opens or commits; and
`Escape` dismisses without changing the value. Selection closes the popup and
returns focus to the selector. The control owns popup creation, light-dismiss,
placement flipping, viewport sizing, and scrolling; consumers do not call an
overlay host.

UI Automation exposes the selector as a `ComboBox` with ExpandCollapse and
Selection patterns. The popup option container is a list, and each enabled or
disabled option is a list item with SelectionItem state and an accessible name.

`FsusThemeOptions.FollowSystemTheme` keeps the Avalonia requested theme at
`ThemeVariant.Default`; light and dark variants use their corresponding picker
surface resources.

## Known Limitations

Remote filtering and product-specific data fetching stay outside the control.
`DisplayMemberPath` and `SelectedValuePath` read public runtime properties; for
trimmed applications that cannot preserve those members, pass `FsusOption`
instances or dictionary-backed items instead. Platform popup hosting, screen
reader phrasing, and native focus visuals may differ as documented in
[`platform-differences.md`](../platform-differences.md).
