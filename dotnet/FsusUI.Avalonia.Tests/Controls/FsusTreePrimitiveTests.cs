using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTreePrimitiveTests
{
  [Fact]
  public async Task TreeRowPresenterReceivesConsumerPayloadStateAndInvalidation()
  {
    var fileMetadata = new WorkspaceRowMetadata(IsCurrent: false, IsDirty: true);
    var root = new FsusTreeNode("src", "src") { HasLazyChildren = true };
    var file = new FsusTreeNode("file", "EditorView.axaml") { Payload = fileMetadata };
    root.Children.Add(file);

    var contexts = new List<FsusTreeRowContext>();
    var tree = new FsusTree
    {
      Checkable = true,
      RowMinHeight = 30,
      RowPadding = new Thickness(6, 0),
      RowPresenter = context =>
      {
        contexts.Add(context);
        return new TextBlock
        {
          Text = context.Payload is WorkspaceRowMetadata metadata
            ? $"{context.Node.Label}|current={metadata.IsCurrent}|dirty={metadata.IsDirty}"
            : context.Node.Label,
        };
      },
    };
    tree.Nodes.Add(root);
    tree.RefreshView();

    var rootContext = contexts.Last(context => context.Key == "src");
    Assert.True(rootContext.IsFocused);
    Assert.True(rootContext.IsExpandable);
    Assert.False(rootContext.IsExpanded);
    Assert.Null(rootContext.LazyLoadState);

    Assert.True(tree.Expand("src"));
    Assert.True(tree.ToggleSelection("file"));
    Assert.True(tree.ToggleCheck("file"));
    Assert.True(tree.FocusNode("file"));

    var fileContext = contexts.Last(context => context.Key == "file");
    Assert.Same(file, fileContext.Node);
    Assert.Same(fileMetadata, fileContext.Payload);
    Assert.Equal(2, fileContext.Level);
    Assert.Equal(1, fileContext.Position);
    Assert.Equal(1, fileContext.SetSize);
    Assert.True(fileContext.IsSelected);
    Assert.True(fileContext.IsChecked);
    Assert.True(fileContext.IsFocused);
    Assert.False(fileContext.IsExpanded);
    Assert.False(fileContext.IsExpandable);

    var rows = Assert.IsType<StackPanel>(tree.Content);
    var fileRow = Assert.IsType<Border>(rows.Children.Single(control =>
      AutomationProperties.GetAutomationId(control) == "fsus-tree-node-file"));
    Assert.Equal(30, fileRow.MinHeight);
    Assert.Equal(new Thickness(6, 0), fileRow.Padding);
    Assert.Contains("current=False|dirty=True", Assert.IsType<TextBlock>(fileRow.Child).Text);

    file.Payload = fileMetadata with { IsCurrent = true };
    Assert.Contains("current=True|dirty=True", Assert.IsType<TextBlock>(fileRow.Child).Text);

    var mutableMetadata = new MutableWorkspaceRowMetadata { IsCurrent = true };
    file.Payload = mutableMetadata;
    mutableMetadata.IsDirty = true;
    file.InvalidatePresentation();
    Assert.Equal(
      "EditorView.axaml",
      contexts.Last(context => context.Key == "file").Node.Label);

    Assert.True(tree.StartRename("file", "EditorView.axaml"));
    fileRow = Assert.IsType<Border>(rows.Children.Single(control =>
      AutomationProperties.GetAutomationId(control) == "fsus-tree-node-file"));
    var activeEditor = Assert.IsType<TextBox>(fileRow.Child);
    activeEditor.Text = "EditorRenamed.axaml";
    mutableMetadata.IsDirty = false;
    file.InvalidatePresentation();
    Assert.Same(activeEditor, fileRow.Child);
    Assert.Equal("EditorRenamed.axaml", activeEditor.Text);
    Assert.True(tree.CancelInlineEdit());

    var completion = new TaskCompletionSource<IReadOnlyList<FsusTreeNode>>();
    tree.ChildrenLoader = (_, _) => new ValueTask<IReadOnlyList<FsusTreeNode>>(completion.Task);
    var load = tree.LoadChildrenAsync("src");
    Assert.Equal(
      FsusTreeLazyLoadState.Started,
      contexts.Last(context => context.Key == "src").LazyLoadState);
    completion.SetResult([new FsusTreeNode("generated", "Generated.cs")]);
    Assert.True(await load);
    Assert.Equal(
      FsusTreeLazyLoadState.Completed,
      contexts.Last(context => context.Key == "src").LazyLoadState);
  }

  [Fact]
  public void TreeV2InheritsConsumerRowPresenterContract()
  {
    var presented = new List<FsusTreeRowContext>();
    var tree = new FsusTreeV2
    {
      RowPresenter = context =>
      {
        presented.Add(context);
        return new TextBlock { Text = context.Node.Label };
      },
    };
    tree.Nodes.Add(new FsusTreeNode("readme", "README.md") { Payload = "markdown" });

    tree.RefreshView();

    var context = Assert.Single(presented);
    Assert.Equal("readme", context.Key);
    Assert.Equal("markdown", context.Payload);
    Assert.Single(tree.VisibleNodes);
  }

  [Fact]
  public async Task TreeExpandsSelectsChecksFiltersAndKeyboardNavigates()
  {
    var tree = new KeyboardTree
    {
      AccessibleName = "Release tree",
      SelectionMode = FsusTreeSelectionMode.Multiple,
      Checkable = true,
    };
    var root = new FsusTreeNode("root", "Root");
    root.Children.Add(new FsusTreeNode("child-a", "Child A"));
    root.Children.Add(new FsusTreeNode("child-b", "Child B"));
    tree.Nodes.Add(root);
    tree.Nodes.Add(new FsusTreeNode("wide", "Wide sibling"));

    tree.RefreshView();

    Assert.Equal(new[] { "root", "wide" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.True(tree.Expand("root"));

    Assert.Equal(new[] { "root", "child-a", "child-b", "wide" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.Equal(2, tree.FlattenedNodes[1].Level);
    Assert.Equal("expanded", tree.GetNodeState("root").ExpandedState);

    Assert.True(await tree.PressAsync(Key.Down));
    Assert.Equal("child-a", tree.FocusedKey);
    Assert.True(await tree.PressAsync(Key.Space));
    Assert.Contains("child-a", tree.SelectedKeys);

    Assert.True(tree.ToggleCheck("child-a"));
    Assert.Contains("child-a", tree.CheckedKeys);

    tree.Filter = node => node.Label.Contains("Child", StringComparison.Ordinal);
    tree.RefreshView();

    Assert.Equal(new[] { "child-a", "child-b" }, tree.FlattenedNodes.Select(node => node.Node.Key));
    Assert.Equal(AutomationControlType.Tree, AutomationProperties.GetControlTypeOverride(tree));
    Assert.Equal("Release tree", AutomationProperties.GetName(tree));
  }

  [Fact]
  public async Task TreeLazyLoadCancelsStaleRequestAndKeepsFocusSelection()
  {
    var first = new FsusTreeNode("async-a", "Async A") { HasLazyChildren = true };
    var second = new FsusTreeNode("async-b", "Async B") { HasLazyChildren = true };
    var tree = new FsusTree();
    tree.Nodes.Add(first);
    tree.Nodes.Add(second);
    tree.RefreshView();
    tree.ToggleSelection("async-a");
    tree.FocusNode("async-a");

    var firstCompletion = new TaskCompletionSource<IReadOnlyList<FsusTreeNode>>();
    var firstCanceled = false;
    var calls = 0;
    tree.ChildrenLoader = (node, cancellationToken) =>
    {
      calls++;
      if (calls == 1)
      {
        cancellationToken.Register(() =>
        {
          firstCanceled = true;
          firstCompletion.TrySetCanceled(cancellationToken);
        });
        return new ValueTask<IReadOnlyList<FsusTreeNode>>(firstCompletion.Task);
      }

      return ValueTask.FromResult<IReadOnlyList<FsusTreeNode>>([
        new FsusTreeNode($"{node.Key}-child", $"{node.Label} child"),
      ]);
    };

    var stale = tree.LoadChildrenAsync("async-a");
    var loaded = await tree.LoadChildrenAsync("async-b");
    var staleResult = await stale;

    Assert.False(staleResult);
    Assert.True(loaded);
    Assert.True(firstCanceled);
    Assert.True(tree.LastLoadCanceled);
    Assert.Equal("async-a", tree.FocusedKey);
    Assert.Contains("async-a", tree.SelectedKeys);
    Assert.Equal(new[] { "async-b-child" }, second.Children.Select(node => node.Key));
  }

  [Fact]
  public async Task TreeV2TreeSelectAndTreeTableVirtualizeOverlayAndBudgets()
  {
    var tree = new FsusTreeV2
    {
      AccessibleName = "Large tree",
      VirtualizationThreshold = 100,
      VisibleRowLimit = 36,
    };
    for (var index = 0; index < 10_000; index++)
    {
      tree.Nodes.Add(new FsusTreeNode($"node-{index}", $"Node {index}"));
    }

    tree.RefreshView();
    tree.ScrollToIndex(9_950);

    Assert.True(tree.IsVirtualized);
    Assert.Equal(36, tree.VisibleNodes.Count);
    Assert.True(tree.RealizedRowCount <= tree.VirtualizationBudget.RealizedRows);
    Assert.Equal("node-9950", tree.VisibleNodes[0].Node.Key);
    Assert.True(tree.EvaluateBudget().WithinBudget);

    var host = new FsusOverlayHost();
    var treeSelect = new FsusTreeSelect
    {
      AccessibleName = "Choose node",
      Tree = tree,
    };

    treeSelect.Open(host);
    Assert.True(treeSelect.IsOpen);
    Assert.Single(host.OpenOverlays);
    Assert.True(treeSelect.SelectNode("node-9950"));
    Assert.Equal("node-9950", treeSelect.SelectedKey);
    Assert.True(await treeSelect.CloseAsync());
    Assert.Empty(host.OpenOverlays);

    var treeTable = new FsusTreeTable
    {
      AccessibleName = "Tree table",
      Tree = tree,
      VisibleColumnLimit = 4,
    };
    treeTable.Columns.Add(new FsusDataTableColumn("name", "Name"));
    treeTable.Columns.Add(new FsusDataTableColumn("owner", "Owner"));
    treeTable.Columns.Add(new FsusDataTableColumn("status", "Status"));
    treeTable.Columns.Add(new FsusDataTableColumn("score", "Score"));
    treeTable.Columns.Add(new FsusDataTableColumn("updated", "Updated"));
    treeTable.RefreshView();

    Assert.True(treeTable.IsVirtualized);
    Assert.Equal(4, treeTable.VisibleColumns.Count);
    Assert.True(treeTable.RealizedCellCount <= treeTable.VirtualizationBudget.RealizedCells);
    Assert.Equal(AutomationControlType.DataGrid, AutomationProperties.GetControlTypeOverride(treeTable));
  }

  [Fact]
  public void TreeThemeVisualAccessibilityAndPerformanceBaselinesCoverStable35()
  {
    var tree = ReadControlTheme("Tree.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusTree",
      "fsus|FsusTreeV2",
      "fsus|FsusTreeSelect",
      "fsus|FsusTreeTable",
    })
    {
      Assert.Contains(selector, tree);
    }

    Assert.Contains("FsusThemeTreeSurfaceBrush", tree);
    Assert.Contains("FsusMotionDurationEffective", tree);
    Assert.Contains("fsus-virtualized", tree);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Tree.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("tree-stable35-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("tree-stable35", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"tree\"", performanceBudgets);
    Assert.Contains("\"id\": \"tree-table\"", performanceBudgets);
  }

  [Fact]
  public void TreeActivationEventsFireOnlyFromUserGestureEntries()
  {
    var tree = new FsusTree();
    var root = new FsusTreeNode("root", "Root");
    root.Children.Add(new FsusTreeNode("file-a", "File A"));
    root.Children.Add(new FsusTreeNode("file-b", "File B") { IsDisabled = true });
    tree.Nodes.Add(root);
    tree.RefreshView();

    var activations = new List<FsusTreeNodeActivatedEventArgs>();
    tree.NodeActivated += (_, args) =>
    {
      args.Handled = true;
      activations.Add(args);
    };

    tree.ToggleSelection("file-a");
    tree.FocusNode("file-a");
    tree.Expand("root");

    Assert.Empty(activations);

    Assert.True(tree.Activate("file-a", FsusTreeInteractionSource.Pointer));
    var pointer = Assert.Single(activations);
    Assert.Equal("file-a", pointer.Key);
    Assert.Equal(FsusTreeInteractionSource.Pointer, pointer.Source);
    Assert.True(pointer.Handled);
    Assert.Equal("file-a", tree.FocusedKey);

    Assert.False(tree.Activate("file-b", FsusTreeInteractionSource.Pointer));
    Assert.False(tree.Activate("missing", FsusTreeInteractionSource.Keyboard));
    Assert.Single(activations);
  }

  [Fact]
  public async Task TreeEnterOnFocusedNodeActivatesExactlyOnce()
  {
    var tree = new KeyboardTree
    {
      SelectionMode = FsusTreeSelectionMode.Multiple,
    };
    tree.Nodes.Add(new FsusTreeNode("file-a", "File A"));
    tree.RefreshView();

    var activations = new List<FsusTreeNodeActivatedEventArgs>();
    tree.NodeActivated += (_, args) => activations.Add(args);

    Assert.True(await tree.PressAsync(Key.Down));
    Assert.True(await tree.PressAsync(Key.Enter));

    var activation = Assert.Single(activations);
    Assert.Equal("file-a", activation.Key);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, activation.Source);
    Assert.Equal("file-a", tree.FocusedKey);
  }

  [Fact]
  public void TreeInlineRenameRequestsCommitKeepsValidationAndNeverMutatesNode()
  {
    var tree = new FsusTree();
    var node = new FsusTreeNode("file-a", "File A.md");
    tree.Nodes.Add(node);
    tree.RefreshView();
    tree.ToggleSelection(node.Key);
    tree.FocusNode(node.Key);
    var commitRequests = new List<FsusTreeInlineEditCommitEventArgs>();
    var reject = true;
    tree.InlineEditCommitRequested += (_, args) =>
    {
      commitRequests.Add(args);
      if (reject)
      {
        args.ValidationError = "A file with this name already exists.";
      }
    };

    Assert.True(tree.StartRename(node.Key, "File A.md"));
    Assert.Equal(FsusTreeInlineEditKind.Rename, tree.ActiveInlineEdit?.Kind);
    Assert.Equal(node.Key, tree.ActiveInlineEdit?.Key);
    Assert.Equal("File A.md", tree.ActiveInlineEdit?.Text);
    Assert.Contains(node.Key, tree.SelectedKeys);

    Assert.False(tree.CommitInlineEdit());
    var rejected = Assert.Single(commitRequests);
    Assert.Equal(node.Key, rejected.Key);
    Assert.Null(rejected.ParentKey);
    Assert.Equal("File A.md", rejected.Text);
    Assert.Equal("A file with this name already exists.", tree.ActiveInlineEdit?.ValidationError);
    Assert.Equal("File A.md", node.Label);

    reject = false;
    Assert.True(tree.CommitInlineEdit());
    Assert.Equal(2, commitRequests.Count);
    Assert.Null(tree.ActiveInlineEdit);
    Assert.Equal("File A.md", node.Label);
    Assert.Contains(node.Key, tree.SelectedKeys);
    Assert.Equal(node.Key, tree.FocusedKey);
  }

  [Fact]
  public void TreeInlineCreateExpandsParentPersistsAcrossRefreshAndCancelsByStableKey()
  {
    var tree = new FsusTree();
    var folder = new FsusTreeNode("src", "src");
    folder.Children.Add(new FsusTreeNode("existing", "Existing.cs"));
    var emptyFolder = new FsusTreeNode("empty", "Empty folder");
    tree.Nodes.Add(folder);
    tree.Nodes.Add(emptyFolder);
    tree.Nodes.Add(new FsusTreeNode("readme", "README.md"));
    tree.RefreshView();
    tree.ToggleSelection("readme");
    tree.FocusNode("readme");
    var canceled = new List<FsusTreeInlineEditCanceledEventArgs>();
    tree.InlineEditCanceled += (_, args) => canceled.Add(args);

    Assert.True(tree.StartCreate("draft-file", folder.Key));
    Assert.Contains(folder.Key, tree.ExpandedKeys);
    Assert.Equal("draft-file", tree.FocusedKey);
    Assert.Equal(string.Empty, tree.ActiveInlineEdit?.Text);
    Assert.Equal(folder.Key, tree.ActiveInlineEdit?.ParentKey);
    Assert.Contains("readme", tree.SelectedKeys);

    tree.RefreshView();

    Assert.Equal("draft-file", tree.FocusedKey);
    Assert.Equal("draft-file", tree.ActiveInlineEdit?.Key);
    Assert.Contains(folder.Key, tree.ExpandedKeys);
    Assert.True(tree.CancelInlineEdit());
    var cancel = Assert.Single(canceled);
    Assert.Equal("draft-file", cancel.Key);
    Assert.Equal(folder.Key, cancel.ParentKey);
    Assert.Equal(FsusTreeInlineEditCancelReason.Programmatic, cancel.Reason);
    Assert.Equal("readme", tree.FocusedKey);
    Assert.Contains("readme", tree.SelectedKeys);
    Assert.DoesNotContain(folder.Children, child => child.Key == "draft-file");

    Assert.True(tree.StartCreate("root-draft"));
    Assert.Null(tree.ActiveInlineEdit?.ParentKey);
    Assert.True(tree.CancelInlineEdit());
    Assert.DoesNotContain(tree.Nodes, child => child.Key == "root-draft");

    Assert.True(tree.StartCreate("empty-draft", emptyFolder.Key));
    Assert.Equal(emptyFolder.Key, tree.ActiveInlineEdit?.ParentKey);
    Assert.Contains(emptyFolder.Key, tree.ExpandedKeys);
    Assert.True(tree.CancelInlineEdit());
    Assert.DoesNotContain(emptyFolder.Children, child => child.Key == "empty-draft");
  }

  [Fact]
  public async Task TreeInlineEditSurvivesUnrelatedLazyLoadAndPreservesTreeState()
  {
    var folder = new FsusTreeNode("lazy", "Lazy") { HasLazyChildren = true };
    var readme = new FsusTreeNode("readme", "README.md");
    var tree = new FsusTree
    {
      ChildrenLoader = (_, _) => ValueTask.FromResult<IReadOnlyList<FsusTreeNode>>([
        new FsusTreeNode("loaded", "Loaded.cs"),
      ]),
    };
    tree.Nodes.Add(folder);
    tree.Nodes.Add(readme);
    tree.RefreshView();
    tree.ToggleSelection(readme.Key);

    Assert.True(tree.StartRename(readme.Key, readme.Label));
    Assert.True(await tree.LoadChildrenAsync(folder.Key));

    Assert.Equal(readme.Key, tree.ActiveInlineEdit?.Key);
    Assert.Equal(readme.Label, tree.ActiveInlineEdit?.Text);
    Assert.Equal(readme.Key, tree.FocusedKey);
    Assert.Contains(readme.Key, tree.SelectedKeys);
    Assert.Contains(folder.Key, tree.ExpandedKeys);
    Assert.Contains(folder.Children, child => child.Key == "loaded");
    Assert.Equal("README.md", readme.Label);
  }

  [Fact]
  public void TreeSelectionEventsReportDeltaAndFullSetMatchingAutomationState()
  {
    var tree = new FsusTree { SelectionMode = FsusTreeSelectionMode.Multiple };
    tree.Nodes.Add(new FsusTreeNode("leaf-a", "Leaf A"));
    tree.Nodes.Add(new FsusTreeNode("leaf-b", "Leaf B"));
    tree.RefreshView();

    var changes = new List<FsusTreeSelectionChangedEventArgs>();
    tree.SelectionChanged += (_, args) => changes.Add(args);

    Assert.True(tree.ToggleSelection("leaf-a"));
    var added = changes[^1];
    Assert.Equal(new[] { "leaf-a" }, added.AddedKeys);
    Assert.Empty(added.RemovedKeys);
    Assert.Equal(new[] { "leaf-a" }, added.SelectedKeys);
    Assert.True(tree.GetNodeState("leaf-a").Selected);

    Assert.True(tree.ToggleSelection("leaf-b"));
    Assert.Equal(new[] { "leaf-b" }, changes[^1].AddedKeys);
    Assert.Equal(new[] { "leaf-a", "leaf-b" }, changes[^1].SelectedKeys.Order());

    Assert.True(tree.ToggleSelection("leaf-a"));
    var removed = changes[^1];
    Assert.Empty(removed.AddedKeys);
    Assert.Equal(new[] { "leaf-a" }, removed.RemovedKeys);
    Assert.Equal(new[] { "leaf-b" }, removed.SelectedKeys);
    Assert.False(tree.GetNodeState("leaf-a").Selected);
    Assert.Equal(3, changes.Count);

    var single = new FsusTree();
    single.Nodes.Add(new FsusTreeNode("only", "Only"));
    single.RefreshView();
    var singleChanges = new List<FsusTreeSelectionChangedEventArgs>();
    single.SelectionChanged += (_, args) => singleChanges.Add(args);

    Assert.True(single.ToggleSelection("only"));
    Assert.True(single.ToggleSelection("only"));
    var singleChange = Assert.Single(singleChanges);
    Assert.Equal(new[] { "only" }, singleChange.AddedKeys);
  }

  [Fact]
  public async Task TreeExpansionEventsFireFromKeyboardGesturesOnly()
  {
    var tree = new KeyboardTree();
    var root = new FsusTreeNode("root", "Root");
    root.Children.Add(new FsusTreeNode("child", "Child"));
    tree.Nodes.Add(root);
    tree.RefreshView();

    var expansions = new List<FsusTreeExpansionChangedEventArgs>();
    tree.ExpansionChanged += (_, args) => expansions.Add(args);

    Assert.True(await tree.PressAsync(Key.Right));
    var expanded = expansions[^1];
    Assert.Equal("root", expanded.Key);
    Assert.True(expanded.IsExpanded);
    Assert.Equal(FsusTreeInteractionSource.Keyboard, expanded.Source);
    Assert.Equal("expanded", tree.GetNodeState("root").ExpandedState);

    Assert.True(await tree.PressAsync(Key.Left));
    Assert.False(expansions[^1].IsExpanded);
    Assert.Equal("collapsed", tree.GetNodeState("root").ExpandedState);

    Assert.True(tree.Expand("root"));
    Assert.Equal(2, expansions.Count);
  }

  [Fact]
  public async Task TreeLazyLoadLifecycleReportsStartedCompletedCanceledAndFailed()
  {
    var first = new FsusTreeNode("lazy-a", "Lazy A") { HasLazyChildren = true };
    var second = new FsusTreeNode("lazy-b", "Lazy B") { HasLazyChildren = true };
    var tree = new FsusTree();
    tree.Nodes.Add(first);
    tree.Nodes.Add(second);
    tree.RefreshView();

    var lifecycle = new List<FsusTreeLazyLoadEventArgs>();
    tree.LazyLoadStateChanged += (_, args) => lifecycle.Add(args);

    var firstCompletion = new TaskCompletionSource<IReadOnlyList<FsusTreeNode>>();
    var calls = 0;
    tree.ChildrenLoader = (node, cancellationToken) =>
    {
      calls++;
      if (calls == 1)
      {
        cancellationToken.Register(() =>
          firstCompletion.TrySetCanceled(cancellationToken));
        return new ValueTask<IReadOnlyList<FsusTreeNode>>(firstCompletion.Task);
      }

      return ValueTask.FromResult<IReadOnlyList<FsusTreeNode>>([
        new FsusTreeNode($"{node.Key}-child", $"{node.Label} child"),
      ]);
    };

    var stale = tree.LoadChildrenAsync("lazy-a");
    var loaded = await tree.LoadChildrenAsync("lazy-b");
    var staleResult = await stale;

    Assert.False(staleResult);
    Assert.True(loaded);
    Assert.Equal(
      new[] { FsusTreeLazyLoadState.Started, FsusTreeLazyLoadState.Canceled },
      lifecycle.Where(args => args.Key == "lazy-a").Select(args => args.State));
    Assert.Equal(
      new[] { FsusTreeLazyLoadState.Started, FsusTreeLazyLoadState.Completed },
      lifecycle.Where(args => args.Key == "lazy-b").Select(args => args.State));
    Assert.All(
      lifecycle.Where(args => args.Key == "lazy-a"),
      args => Assert.NotEqual(FsusTreeLazyLoadState.Completed, args.State));
    Assert.Equal("expanded", tree.GetNodeState("lazy-b").ExpandedState);
    Assert.False(second.HasLazyChildren);

    var failing = new FsusTreeNode("failing", "Failing") { HasLazyChildren = true };
    tree.Nodes.Add(failing);
    tree.ChildrenLoader = (_, _) => throw new InvalidOperationException("offline");
    var failureCountBeforeThrow = lifecycle.Count;

    await Assert.ThrowsAsync<InvalidOperationException>(
      () => tree.LoadChildrenAsync("failing").AsTask());

    var failure = lifecycle[failureCountBeforeThrow + 1];
    Assert.Equal(FsusTreeLazyLoadState.Failed, failure.State);
    Assert.IsType<InvalidOperationException>(failure.Exception);
    Assert.Equal(FsusTreeLazyLoadState.Started, lifecycle[failureCountBeforeThrow].State);
  }

  private sealed class KeyboardTree : FsusTree
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed record WorkspaceRowMetadata(bool IsCurrent, bool IsDirty);

  private sealed class MutableWorkspaceRowMetadata
  {
    public bool IsCurrent { get; init; }
    public bool IsDirty { get; set; }
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
