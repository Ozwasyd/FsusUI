# Tree

Component ID: `tree`

## Avalonia API

Use `FsusTree`, `FsusTreeV2`, `FsusTreeSelect`, `FsusTreeTable`,
`FsusTreeNode`, `FsusTreeNodeState`, tree budget records, and the user-gesture
events on `FsusTree`: `NodeActivated`
(`FsusTreeNodeActivatedEventArgs`: stable node key,
`FsusTreeInteractionSource` pointer/keyboard, settable `Handled` acknowledgement),
`SelectionChanged` (`FsusTreeSelectionChangedEventArgs`: added keys, removed keys,
and the full selection set), `ExpansionChanged`
(`FsusTreeExpansionChangedEventArgs`: key, expanded flag, source), and
`LazyLoadStateChanged` (`FsusTreeLazyLoadEventArgs`:
`FsusTreeLazyLoadState.Started/Completed/Canceled/Failed`).

Activation fires only from real user gestures: pointer row activation forwarded
through `Activate(key, source)` or keyboard Enter on the focused node. Keyboard
Space toggles selection and Right/Left expand/collapse; programmatic
`ToggleSelection`, `Expand`, `Collapse`, and `FocusNode` never raise activation
or expansion events (`SelectionChanged` reports every state change). A stale
lazy-load request reports `Canceled` and never emits a stale `Completed`.

## Inline editing

`StartRename(key, initialValue)` replaces a visible node label with an editor,
focuses it, and selects the supplied name. `StartCreate(key, parentKey)` adds a
transient empty editor at the root or directly below the supplied folder; a
collapsed parent expands before the editor receives focus. The transient key
must not already belong to a node.

Enter raises one `InlineEditCommitRequested` event with
`FsusTreeInlineEditKind`, the stable edit key, optional parent key, and entered
text. The application owns persistence and node collection mutations. Set the
event argument's `ValidationError` to keep the editor open, focused, invalid,
and associated with accessible error help. A successful request only closes
the editor; it does not rename or insert a node on the application's behalf.

Escape, `CancelInlineEdit()`, and a pointer press outside the editor raise
`InlineEditCanceled` with `FsusTreeInlineEditCancelReason`. Outside cancellation
is handled before another node is activated. Selection, expansion, and the
focused node key survive editing; `RefreshView()` and unrelated lazy loads keep
the active editor text and focus.

```csharp
tree.InlineEditCommitRequested += (_, args) =>
{
  if (string.IsNullOrWhiteSpace(args.Text))
  {
    args.ValidationError = "A name is required.";
    return;
  }

  SaveName(args.Kind, args.Key, args.ParentKey, args.Text);
};

tree.StartRename("readme", "README.md");
tree.StartCreate("new-file-draft", parentKey: "src");
```

## Context Menus

Tree nodes and document tabs share the composable context-menu surface
(`FsusContextMenu`, `FsusContextMenuItem`, `FsusContextMenuSeparator`, and the
attachable `FsusContextMenuService`). Right-click and keyboard context requests
(`Shift+F10`, `Apps`) synchronize selection and focus before the menu opens and
never fire `NodeActivated`, so opening a menu does not open the file.

`FsusTree` raises the typed `NodeContextRequested` event
(`FsusTreeNodeContextEventArgs`: node key, node, pointer/keyboard source, anchor
bounds) and exposes `RequestNodeContext(key, source)`; set
`NodeAnchorBoundsResolver` so the overlay can place the menu at the node.
Real pointer requests use the pointer position inside those resolved node
bounds; keyboard and programmatic requests use the complete node bounds.
`FsusTabs` raises `PaneContextRequested` (`FsusTabPaneContextEventArgs`) for tab
headers via `RequestPaneContext`.

```csharp
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;

var host = new FsusOverlayHost();
var menu = new FsusContextMenu { AccessibleName = "File actions" };
menu.Items.Add(new FsusContextMenuItem { Key = "rename", Header = "Rename" });
menu.Items.Add(new FsusContextMenuSeparator());
menu.Items.Add(new FsusContextMenuItem { Key = "delete", Header = "Delete", IsDangerous = true });
menu.ItemActivated += (_, args) => RunTreeAction(args.TargetKey, args.ActionKey);

tree.NodeContextRequested += (_, args) =>
  menu.Open(host, new FsusContextMenuRequest(
    args.Key, args.InteractionSource, args.AnchorBounds, tree));
tree.NodeAnchorBoundsResolver = key => nodeBoundsRelativeToHost(key);

// Document tabs retain a stable target key without changing selection:
tabs.PaneContextRequested += (_, args) =>
  menu.Open(host, new FsusContextMenuRequest(
    args.PaneKey,
    args.InteractionSource,
    boundsRelativeToHost(args.Pane),
    tabs));

// Any other control can use the shared pointer/keyboard positioning service:
FsusContextMenuService.Attach(moreActionsButton, menu, host);
```

Disabled nodes and panes do not request context menus. Choosing an enabled item
raises a typed activation with the target and action keys and restores focus to
the invoker; Escape, outside pointer presses, and viewport collision (flip to a
top-start placement) are handled by the anchored overlay host.

## Vue Contract Mapping

Vue tree, tree-v2, tree-select, and tree-table contracts map to node keys,
expansion state, checked/selected state, lazy loading, and flattened budgets.
The `node-click` contract maps to `NodeActivated`; lazy loading maps to
`ChildrenLoader` plus `LazyLoadStateChanged`.

## Supported Platform Differences

Automation tree semantics, indentation rendering, and platform differences for
Enter/Space/arrow-key handling follow `docs/avalonia/platform-differences.md`.
Repository acceptance uses a reproducible local AutomationPeer and
AutomationProperties simulation for screen-reader semantics; it is explicitly
not evidence of a physical device or an OS screen-reader session.

## Theme Tokens

Tree controls use surface, border, focus, text, muted text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tree = new FsusTree
{
  AccessibleName = "Workspace files",
  ChildrenLoader = LoadFolderAsync,
};
tree.NodeActivated += (_, args) =>
{
  args.Handled = true;
  OpenFile(args.Key);
};
tree.LazyLoadStateChanged += (_, args) => ShowLoadState(args.State);

ValueTask<IReadOnlyList<FsusTreeNode>> LoadFolderAsync(
  FsusTreeNode node,
  CancellationToken token);
void OpenFile(string key);
void ShowLoadState(FsusTreeLazyLoadState state);
```

## Known Limitations

Drag/drop file-system semantics are not included in the stable tree contract.
