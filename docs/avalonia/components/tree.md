# Tree

Component ID: `tree`

## Avalonia API

Use `FsusTree`, `FsusTreeV2`, `FsusTreeSelect`, `FsusTreeTable`,
`FsusTreeNode`, `FsusTreeNodeState`, and tree budget records.

## Vue Contract Mapping

Vue tree, tree-v2, tree-select, and tree-table contracts map to node keys,
expansion state, checked/selected state, lazy loading, and flattened budgets.

## Supported Platform Differences

Automation tree semantics and indentation rendering follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Tree controls use surface, border, focus, text, muted text, density, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var tree = new FsusTree { AccessibleName = "Folders" };
tree.Nodes.Add(new FsusTreeNode("root", "Root"));
```

## Known Limitations

Drag/drop file-system semantics are not included in the stable tree contract.
