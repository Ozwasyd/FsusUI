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

## Vue Contract Mapping

Vue tree, tree-v2, tree-select, and tree-table contracts map to node keys,
expansion state, checked/selected state, lazy loading, and flattened budgets.
The `node-click` contract maps to `NodeActivated`; lazy loading maps to
`ChildrenLoader` plus `LazyLoadStateChanged`.

## Supported Platform Differences

Automation tree semantics, indentation rendering, and platform differences for
Enter/Space/arrow-key handling follow `docs/avalonia/platform-differences.md`.
True screen-reader announcement of lifecycle states is not verifiable locally
and remains covered by AutomationPeer item status only.

## Theme Tokens

Tree controls use surface, border, focus, text, muted text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tree = new FsusTree { AccessibleName = "Workspace files", ChildrenLoader = LoadFolderAsync };
tree.NodeActivated += (_, args) =>
{
  args.Handled = true;
  OpenFile(args.Key);
};
tree.LazyLoadStateChanged += (_, args) => ShowLoadState(args.State);

bool LoadFolderAsync(FsusTreeNode node, CancellationToken token);
void OpenFile(string key);
void ShowLoadState(FsusTreeLazyLoadState state);
```

## Known Limitations

Drag/drop file-system semantics are not included in the stable tree contract.
