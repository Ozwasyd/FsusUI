# Navigation

Component ID: `navigation`

## Avalonia API

Use `FsusTabs`, `FsusTabPane`, `FsusMenu`, `FsusMenuItem`, `FsusSubMenu`,
`FsusMenuItemGroup`, `FsusBreadcrumb`, `FsusBreadcrumbItem`, `FsusPageHeader`,
`FsusSteps`, `FsusStep`, `FsusSettingsShell`, `FsusSettingsCategory`,
`FsusSettingsScrollResetBehavior`, `FsusPlatformCommand`,
`FsusNativeMenuItemModel`, `FsusNativeMenuBuilder`, `FsusNativeMenuOptions`,
`FsusNativeMenuProfile`, and `FsusNativeMenuSynthesizedRoots`.

Desktop editor shells use `FsusActivityRailShell`, `FsusDocumentTabs`, and
`FsusNativeTitleBar`; their close, reorder, resize, overflow, window-state, and
platform contracts are documented in [Desktop shell](desktop-shell.md).

Tab headers raise the typed `PaneContextRequested` event
(`FsusTabPaneContextEventArgs`) through right-click, `Shift+F10`/`Apps`, or
`RequestPaneContext(key, source)` without changing the selected tab; compose it
with the shared context-menu surface described in `tree.md`.

## Vue Contract Mapping

Vue active keys, tab panes, menu item groups, breadcrumbs, page header actions,
step status, and settings shell navigation map to typed controls, selected keys,
and activation events.

## Supported Platform Differences

Keyboard navigation and focus rings follow `docs/avalonia/platform-differences.md`.

`FsusPlatformCommand` is the neutral command source for
`FsusNativeMenuBuilder` and `FsusCommandPaletteModel`. A builder owns its
subscriptions: dispose it or rebuild through the same instance so obsolete
native items stop receiving state updates. The generated menu-item command
reflects `FsusPlatformCommand.IsEnabled` and any nested `Command` state, so an
item whose command starts disabled renders disabled from the first `Build`,
stays synchronized on `StateChanged` and `CanExecuteChanged`, and never
executes while disabled. `FsusNativeMenuMetadata.GetRole`
and `GetCommandId` preserve platform role and command identity independently
of localized labels.

macOS application menus use explicit About, Preferences, Services, Hide,
Hide Others, Show All, Quit, and Window roles. Windows and Linux omit
macOS-only roles and order top-level menus as File, Edit, View, Window, Help.
`FsusNativeMenuOptions` selects the build profile for `Build` and both
`AttachTo` overloads: `StandardDocumentWindow` (default) keeps the platform
normalization above, while `PreserveRoots` returns exactly the supplied roots
on every platform and still applies role metadata, gestures, and reactive
command state. `SynthesizedRoots` limits which missing required roots
standard mode may synthesize (`Application`, `File`, `Window`, `Help`); on
Windows and Linux, role relocation into File/Help happens only when both
destinations exist or may be synthesized, and otherwise supplied roots are
kept in place with macOS-only roles removed.
`FsusDockMenuContract.AttachTo` uses Avalonia `NativeDock`, while
`FsusDockMenuRouter` supplies active-window and windowless command routes.

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
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

var window = new Window();
var tabs = new FsusTabs();
tabs.Items.Add(new FsusTabPane { Header = "Overview", Content = "Ready" });

var save = new FsusPlatformCommand(
  "document.save",
  "Save",
  FsusPlatformRole.FileSave)
{
  Gesture = new FsusShortcutGesture(Key.S, KeyModifiers.Control),
};
var file = FsusNativeMenuItemModel.SubMenu(
  "File",
  FsusNativeMenuItemModel.Action(save));
using var builder = new FsusNativeMenuBuilder();
builder.AttachTo(window, [file], FsusShortcutPlatform.Auto);
```

## Known Limitations

Router integration belongs to the app shell; navigation controls do not own URL
mutation. `FsusSettingsShell` does not filter categories when a search slot
changes, persist category scroll offsets across control instances, or own native
window lifetime; the consuming app supplies those behaviors. The repository
verifies macOS/Windows role routing with local platform simulations; those
fixtures do not claim execution on physical hardware.
