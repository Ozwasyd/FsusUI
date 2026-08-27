# Navigation

Component ID: `navigation`

## Avalonia API

Use `FsusTabs`, `FsusTabPane`, `FsusMenu`, `FsusMenuItem`, `FsusSubMenu`,
`FsusMenuItemGroup`, `FsusBreadcrumb`, `FsusBreadcrumbItem`, `FsusPageHeader`,
`FsusSteps`, `FsusStep`, `FsusSettingsShell`, `FsusSettingsCategory`, and
`FsusSettingsScrollResetBehavior`.

## Vue Contract Mapping

Vue active keys, tab panes, menu item groups, breadcrumbs, page header actions,
step status, and settings shell navigation map to typed controls, selected keys,
and activation events.

## Supported Platform Differences

Keyboard navigation and focus rings follow `docs/avalonia/platform-differences.md`.

## Theme Tokens

Navigation controls use focus, surface, border, text, muted text, density, and
motion resources.

## Settings Shell

`FsusSettingsShell` is a reusable, non-modal settings surface. Host it inside an
application-owned `Window`; the control does not create, cache, reopen, or close
that window and does not write global FsusUI state.

Add `FsusSettingsCategory` instances to `Categories`. Each category has a stable
`Key`, a one-line `Header`, optional `Icon`, optional accessible `Description`,
and content. Exactly one enabled category is selected while enabled categories
exist. Invalid, removed, disabled, or collection-reset selections normalize to
the first enabled category; an all-disabled or empty collection has no
selection.

The shell exposes:

- `SelectedKey`, `SelectedCategory`, `SelectionChanged`, and `FocusedKey` for
  selection and focus state.
- `RailWidth`, `NarrowBreakpointWidth`, `NarrowRailWidth`, `IsNarrow`, and
  `ApplyViewport` for the fixed vertical rail and compact viewport state.
- `SearchSlot`, `RailHeader`, `RailFooter`, and `ActionsSlot` for host-owned
  controls. Search stays above the category list; actions stay below the
  independently scrolling content.
- `ScrollResetBehavior`, `ContentScrollOffset`, `ResetScroll`,
  `SetContentScrollOffset`, and `GetCategoryScrollOffset` for resetting or
  restoring each category's vertical offset.

Category focus handles `Up`, `Down`, `Home`, `End`, `Enter`, and `Space`, skips
disabled categories, and keeps selection and focus aligned. Keystrokes
originating in search or action controls remain owned by those controls. The
shell and categories expose the single-selection and selection-item UI
Automation patterns, selection names, position-in-set metadata, and polite
selection announcements.

At narrow widths, the rail uses `NarrowRailWidth` and hides category labels when
icons are present; labels without icons remain ellipsized. The content viewport
never enables horizontal scrolling. In right-to-left mode, the rail moves to the
right and the divider follows it; slotted or category content remains
responsible for its own bidi text direction.

Long content scrolls independently from the rail and fixed actions. The host may
implement singleton-window behavior in its own service without storing state in
the control:

```csharp
private Window? settingsWindow;

void ShowSettings()
{
  settingsWindow ??= new Window
  {
    Width = 950,
    Height = 650,
    Content = BuildSettingsShell(),
  };
  settingsWindow.Closed += (_, _) => settingsWindow = null;
  settingsWindow.Show();
  settingsWindow.Activate();
}
```

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tabs = new FsusTabs();
tabs.Items.Add(new FsusTabPane { Header = "Overview", Content = "Ready" });
```

## Known Limitations

Router integration belongs to the app shell; navigation controls do not own URL
mutation. `FsusSettingsShell` does not filter categories when a search slot
changes, persist category scroll offsets across control instances, or own native
window lifetime; the consuming app supplies those behaviors.
