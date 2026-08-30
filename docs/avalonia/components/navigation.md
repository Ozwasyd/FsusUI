# Navigation

Component ID: `navigation`

## Avalonia API

Use `FsusTabs`, `FsusTabPane`, `FsusMenu`, `FsusMenuItem`, `FsusSubMenu`,
`FsusMenuItemGroup`, `FsusBreadcrumb`, `FsusBreadcrumbItem`, `FsusPageHeader`,
`FsusSteps`, `FsusStep`, `FsusSettingsShell`, `FsusSettingsCategory`,
`FsusSettingsScrollResetBehavior`, `FsusPlatformCommand`,
`FsusNativeMenuItemModel`, `FsusNativeMenuBuilder`, `FsusNativeMenuOptions`,
`FsusNativeMenuProfile`, `FsusNativeMenuSynthesizedRoots`,
`FsusCommandPalette`, `FsusCommandPaletteProvider`,
`FsusCommandPaletteResult`, `FsusCommandPaletteState`, and
`FsusCommandPaletteFailureStage`.

Desktop editor shells use `FsusActivityRailShell`, `FsusDocumentTabs`, and
`FsusNativeTitleBar`; their close, reorder, resize, overflow, window-state, and
platform contracts are documented in [Desktop shell](desktop-shell.md).

Tab headers raise the typed `PaneContextRequested` event
(`FsusTabPaneContextEventArgs`) through right-click, `Shift+F10`/`Apps`, or
`RequestPaneContext(key, source)` without changing the selected tab; compose it
with the shared context-menu surface described in `tree.md`.

Populate `FsusTabs` through `Panes`; the inherited `Items` collection is not a
second mutable tab source while the control owns its internal `ItemsSource`.
`Panes` supports incremental mutation and synchronous clear/rebuild flows. An
empty collection clears selection, and the first enabled pane becomes selected
when panes are added again.

For a host-owned strip-only layout, place `FsusTabs` in the host's horizontal
scroll region, keep pane `Content` unset, and compose adjacent actions outside
the control. Continue to populate `Panes`; replacing the internal source through
inherited `Items` is not a supported strip-only adapter.

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

## Command Palette

`FsusCommandPalette` is a modal, theme-aware overlay that consumes the same
`FsusNativeMenuItemModel` tree as native menus. Set `CommandTree`, then call
`Open` or `OpenAsync` with an application-owned `FsusOverlayHost`; no control
template lookup or named-part access is required. `OpenAsync` waits for the
initial provider search, while `Open` returns immediately and exposes progress
through `State` and `IsBusy`.

Search compares command id, localized label, description, and category with
ordinal case-insensitive matching. Optional `Providers` receive the current
root query and cancellation token; nested groups resolve their bound children
without merging global provider results. Superseded requests are cancelled and
cannot replace newer results. Provider failures keep the palette open, move it to
`Failed`, populate `FailureMessage`, and raise `Failed` with the `Search` stage.

Each result preserves its stable command id, localized label, description,
category, icon key, platform-formatted shortcut, enabled state, and child
state. `IsEnabledPredicate` and `IsVisiblePredicate` are evaluated whenever the
palette refreshes. A host whose predicate inputs change calls
`NotifyStateChanged`; the mounted palette then removes hidden commands and
updates disabled commands without rebuilding the tree. `ExecuteAsyncAction`
adds cancellable asynchronous execution to the existing synchronous
`ExecuteAction`/`Command` paths.

Up and Down wrap across enabled results, Enter activates the selected result,
and Escape dismisses the palette. Pointer press selects and activates the same
result path. A result with children enters that group; `NavigateBackAsync` and
the visible back control return one level. Selection is scrolled into view by
the internal `FsusVirtualList` without moving focus away from search.

`BeginImeComposition`, `UpdateImeComposition`, and `CommitImeComposition`
provide an explicit host bridge when a platform input adapter surfaces IME
pre-edit separately. Pre-edit text does not filter or trigger palette keys;
commit updates `Query` once. The production text box remains the focused input
for Avalonia's native IME path.

The results surface exposes list/list-item automation roles, accessible names,
help text, selected/disabled status, and position-in-set metadata. Search,
running, empty, and failure states are announced through the palette status.
Successful sync or async execution raises `CommandExecuted` and dismisses the
overlay; failure leaves it open. Closing by execution, Escape, or pointer
outside restores focus to the invoker supplied to `Open`/`OpenAsync`.

```csharp
var published = false;
var publish = new FsusPlatformCommand("workspace.publish", "Publish workspace")
{
  Category = "Workspace",
  Description = "Build and publish the active workspace",
  Gesture = new FsusShortcutGesture(Key.P, KeyModifiers.Control | KeyModifiers.Shift),
  ExecuteAsyncAction = async (_, cancellationToken) =>
  {
    await PublishWorkspaceAsync(cancellationToken);
    published = true;
  },
};
var format = FsusNativeMenuItemModel.SubMenu(
  "Format",
  FsusNativeMenuItemModel.Action(
    new FsusPlatformCommand("format.heading", "Apply heading")));
var palette = new FsusCommandPalette
{
  CommandTree = [format, FsusNativeMenuItemModel.Action(publish)],
  Providers = [SearchWorkspaceCommandsAsync],
};

await palette.OpenAsync(overlayHost, openCommandsButton);
await palette.HandleKeyAsync(Key.Down);
await palette.HandleKeyAsync(Key.Enter);
```

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
tabs.Panes.Add(new FsusTabPane
{
  Key = "overview",
  Header = "Overview",
  Content = "Ready",
});

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

The command palette does not register a global shortcut, own an overlay host,
persist recent commands, or localize its built-in labels. The application owns
those policies and supplies localized label properties. Async providers return
a query-scoped snapshot; pagination and durable caching remain application
responsibilities.
