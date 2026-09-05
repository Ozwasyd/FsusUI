# Desktop shell

> **Role:** Avalonia public component contract
> **Applies to:** `FsusUI.Avalonia` desktop application shells
> **Authority:** Applies [`docs/design.md`](../../design.md), the generated
> Avalonia token resources, and
> [`docs/avalonia/platform-differences.md`](../platform-differences.md).

Component ID: `desktop-shell`

## Avalonia API

Use these three independently composable primitives:

- `FsusActivityRailShell` with `FsusActivityRailSection` for a fixed activity
  rail and one contextual pane.
- `FsusDocumentTabs` with `FsusDocumentTab` for open desktop documents.
- `FsusNativeTitleBar` for extended-client-area title, status, actions, drag
  regions, and window actions.

All public state is expressed through typed CLR/Avalonia properties, enums,
methods, and event arguments. The controls do not require runtime reflection,
dynamic code generation, browser APIs, or a private product adapter, so the API
is compatible with the package's Native AOT contract.

### Activity rail and contextual pane

`Sections` contains stable-key `FsusActivityRailSection` values. The first
enabled section becomes active. `ActivateKey` activates another section and
opens its `Content`; activating the current section again toggles the pane.
`ShowPane` and `HidePane` change visibility without discarding `SelectedKey`.

`ActivityRailWidth` owns the fixed rail width. `PaneWidth`, `MinPaneWidth`, and
`MaxPaneWidth` own the expanded contextual-pane width. The resize thumb:

- accepts pointer drag;
- accepts Left/Right Arrow, with Shift applying the larger step;
- resets to `DefaultPaneWidth` on double-click;
- exposes a keyboard-focusable accessible resize affordance.

`SectionActivated` yields `FsusActivitySectionActivatedEventArgs` with the key,
previous key, open state, and pointer/keyboard/programmatic source.
`PaneResized` yields `FsusContextualPaneResizedEventArgs` with old/new widths,
the reason, and completion state.

The shell keeps selection, visibility, and width in memory only. It never
writes durable storage. A host may persist these public values and restore them
when constructing another instance; see
[`docs/runtime-state-boundaries.md`](../../runtime-state-boundaries.md).

### Desktop document tabs

Add only `FsusDocumentTab` values through `AddDocument` or `Panes`. Keys must be
stable and unique when using `AddDocument`. `IsDirty` exposes an unsaved marker
and the corresponding automation status. `IsClosable` controls the close
affordance.

`RequestClose` raises cancellable `CloseRequested` before mutation. The reason
distinguishes the close button, middle-click, keyboard, and programmatic calls.
After a selected document closes, the tab at the same index is selected; when
that was the last document, the previous adjacent tab is selected.

Pointer drag calls `ReorderDocument` and raises typed `Reordered` arguments with
the old/new indexes and source. The horizontally scrollable header reveals the
selected tab; `CanScrollBackward`, `CanScrollForward`, `ScrollHeaders`, and the
header extent/viewport/offset properties expose overflow without product
state. Right-click and Shift+F10/Apps raise `DocumentContextRequested` with the
document control and its bounds as a stable context-menu anchor, without
changing selection.

Ctrl+Tab and Ctrl+Shift+Tab cycle enabled documents. Meta+Tab and
Meta+Shift+Tab provide the equivalent neutral Command-key mapping for a macOS
host. A consuming application may route a platform-reserved shortcut before it
reaches the control.

### Native title bar

Set `DocumentTitle`, `DocumentPath`, `Status`, `LeadingActions`, and
`TrailingActions`, then call `AttachTo(Window)`. Attachment enables the
extended client area, tracks normal/maximized/fullscreen state, and follows the
window's actual light/dark theme. The control also attaches itself when hosted
directly in a `Window` visual tree.

The title area is draggable. Leading/trailing slots and embedded window buttons
are no-drag regions. Mark additional interactive descendants with
`FsusNativeTitleBar.SetIsNoDrag(control, true)`.

`InvokeWindowAction` supports typed minimize, maximize, restore, and close
actions and raises `WindowActionInvoked`. `CanMinimize`, `CanMaximize`,
`CanClose`, and `WindowControlsVisible` control the embedded action surface.
Call `Detach` or `Dispose` before reusing the title bar outside its current
window.

## Vue Contract Mapping

These are Avalonia-native task-surface primitives. The activity rail maps keyed
navigation plus an app-owned pane width; document tabs extend the shared tab
selection contract with desktop close/reorder/overflow behavior; the native
title bar maps slots to extended-client-area window composition. They do not
introduce a Web DOM, CSS selector, router, or browser-storage contract.

## Supported Platform Differences

The shared typed state and events remain stable; native window management
follows [`docs/avalonia/platform-differences.md`](../platform-differences.md).

| Platform | Title-bar and shortcut behavior |
| --- | --- |
| Windows | Extended-client-area drag uses the Avalonia window adapter. Embedded minimize/maximize/restore/close actions are supported. Windows high contrast may replace focus and border brushes. |
| macOS | A host retaining native traffic lights sets `WindowControlsVisible = false`; title/status/actions and drag/no-drag regions remain usable. Meta is the neutral Command modifier for document cycling. Native fullscreen animation and traffic-light placement remain owned by macOS/Avalonia. |
| Linux | Extended-client-area drag and window actions depend on the active X11/Wayland compositor. The typed action/state contract remains stable even when a compositor ignores a requested decoration or animation. |

Native font rasterization, high-contrast overrides, focus rendering, and
window-manager animation may differ; no separate platform theme or private
platform token is created.

## Theme Tokens

The controls consume generated surface, raised-surface, border, text, muted-text,
action, focus, density, radius, spacing, and motion resources; they add no token
source. Light/dark resources update dynamically, and density changes rail,
tab/header, close-target, and title-bar dimensions. See [Avalonia Motion
Runtime](../motion-runtime.md) for reduced/disabled behavior: selection, pane
visibility, resizing, overflow, reorder, and window state still reach their
final state without essential animation.

## Accessibility and keyboard behavior

- The activity shell and document tabs expose single-selection Automation
  providers; sections and documents expose selection-item providers with
  selected, expanded/collapsed, dirty/saved, enabled, position, and set-size
  metadata.
- Activity sections use Up/Down/Home/End for focus movement and Enter/Space for
  activation. The resize thumb has an accessible name and keyboard help.
- Document tabs expose the selected and dirty state. Every visible close button
  has a document-specific accessible name and dirty-state help text.
- Context requests expose a typed anchor for the shared context-menu surface.
- The title bar exposes its title, platform, maximized/fullscreen status, polite
  status updates, and named window buttons. Slotted interactive controls remain
  in normal keyboard order and never become drag targets.

## Minimal Avalonia Example

```csharp
using Avalonia.Controls;
using FsusUI.Avalonia.Controls;

var documents = new FsusDocumentTabs { AccessibleName = "Open documents" };
documents.AddDocument(new FsusDocumentTab
{
  Key = "readme",
  Header = "README.md",
  IsDirty = true,
  Content = new TextBlock { Text = "Document content" },
});
documents.CloseRequested += (_, request) =>
{
  request.Cancel = request.Document.IsDirty && !ConfirmDiscard(request.Key);
};

var shell = new FsusActivityRailShell { MainContent = documents };
shell.Sections.Add(new FsusActivityRailSection
{
  Key = "explorer",
  Header = "Explorer",
  Icon = new TextBlock { Text = "EX" },
  Content = new TextBlock { Text = "Workspace files" },
});

var titleBar = new FsusNativeTitleBar
{
  DocumentTitle = "README.md",
  DocumentPath = "/workspace/README.md",
  Status = "Unsaved",
};
var window = new Window
{
  Content = new StackPanel { Children = { titleBar, shell } },
};
titleBar.AttachTo(window);

static bool ConfirmDiscard(string key) => false;
```

## Known Limitations

`StorageProvider`, file/folder pickers, document loading/saving, dirty-state
decisions, context-menu contents, route composition, native traffic-light
placement, and durable persistence belong to the consuming application.
Headless Linux rendering can verify deterministic interaction, layout, theme,
and automation state; it does not represent execution on physical Windows or
macOS window managers.
