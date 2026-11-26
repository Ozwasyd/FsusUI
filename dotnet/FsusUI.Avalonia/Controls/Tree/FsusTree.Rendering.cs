using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public partial class FsusTree
{
  private void RefreshRows()
  {
    SelectRowHost();
    if (expansionRowContexts is { } previousContexts && ReconcileExpansionRows(previousContexts))
    {
      return;
    }
    renderedRows.Clear();
    RowChildren.Clear();
    foreach (var view in flattenedNodes)
    {
      var node = view.Node;
      var context = CreateRowContext(view);
      var row = BuildRow(view, context);
      renderedRows[node.Key] = row;
      RowChildren.Add(row);

      if (
        ActiveInlineEdit is
        {
          Kind: FsusTreeInlineEditKind.Create,
          ParentKey: var parentKey,
        } && parentKey == node.Key)
      {
        RowChildren.Add(BuildTransientInlineEditRow(view.Level + 1));
      }
    }

    if (ActiveInlineEdit is { Kind: FsusTreeInlineEditKind.Create, ParentKey: null })
    {
      RowChildren.Add(BuildTransientInlineEditRow(1));
    }
  }

  private bool ReconcileExpansionRows(Dictionary<string, FsusTreeRowContext> previousContexts)
  {
    var visibleKeys = flattenedNodes.Select(view => view.Node.Key).ToHashSet(StringComparer.Ordinal);
    if (visibleKeys.Count != flattenedNodes.Count)
    {
      return false;
    }
    foreach (var key in renderedRows.Keys.Where(key => !visibleKeys.Contains(key)).ToArray())
    {
      RowChildren.Remove(renderedRows[key]);
      renderedRows.Remove(key);
    }

    for (var index = 0; index < flattenedNodes.Count; index++)
    {
      var view = flattenedNodes[index];
      var context = CreateRowContext(view);
      if (!renderedRows.TryGetValue(context.Key, out var row))
      {
        row = BuildRow(view, context);
        renderedRows.Add(context.Key, row);
        RowChildren.Insert(index, row);
      }
      else
      {
        if (!previousContexts.TryGetValue(context.Key, out var previous) ||
          !ReferenceEquals(previous.Node, context.Node) || previous.Level != context.Level ||
          previous.Position != context.Position || previous.SetSize != context.SetSize)
        {
          RowChildren.Remove(row);
          row = BuildRow(view, context);
          renderedRows[context.Key] = row;
          RowChildren.Insert(index, row);
        }
        else
        {
          if (!ReferenceEquals(RowChildren[index], row))
          {
            RowChildren.Remove(row);
            RowChildren.Insert(index, row);
          }
          if (previous != context)
          {
            ApplyRowState(row, context);
            row.Child = BuildNodeContent(view, context);
          }
        }
      }
    }
    return true;
  }

  private Border BuildRow(FsusTreeNodeView view, FsusTreeRowContext context)
  {
    var label = BuildNodeContent(view, context);
    Border row = usingViewport ? new FsusTreeViewportRow(viewportItems!) : new Border();
    row.Child = label;
    row.MinHeight = ResolveRowMinHeight();
    row.Padding = RowPadding ?? global::FsusUI.Avalonia.FsusTokens.Space2Thickness;
    row.Margin = new Thickness(Math.Max(0, view.Level - 1) * global::FsusUI.Avalonia.FsusTokens.Space5Thickness.Left, 0, 0, 0);
    row.Focusable = false;
    row.IsEnabled = !view.Node.IsDisabled;
    FsusComponentClasses.SetBaseClasses(row, "fsus-tree-row");
    ApplyRowState(row, context);
    row.PointerPressed += (_, e) => HandleRowPointerPressed(view, row, e);
    return row;
  }

  private Control BuildNodeContent(FsusTreeNodeView view, FsusTreeRowContext context)
  {
    if (
      ActiveInlineEdit is
      {
        Kind: FsusTreeInlineEditKind.Rename,
        Key: var editKey,
      } && editKey == view.Node.Key)
    {
      return BuildInlineEditContent(view.Node.Label);
    }

    if (RowPresenter is not null)
    {
      return RowPresenter(context);
    }

    var statePrefix = context.IsExpandable
      ? context.IsExpanded ? "▾" : "▸"
      : " ";
    return new FsusTreeLabel
    {
      Text = $"{statePrefix} {view.Node.Label}",
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      TextTrimming = global::Avalonia.Media.TextTrimming.CharacterEllipsis,
    };
  }

  private FsusTreeRowContext CreateRowContext(FsusTreeNodeView view)
  {
    var node = view.Node;
    var expandable = IsExpandable(node);
    return new FsusTreeRowContext(
      node.Key,
      node,
      node.Payload,
      view.Level,
      view.Position,
      view.SetSize,
      node.IsDisabled,
      selectedKeys.Contains(node.Key),
      checkedKeys.Contains(node.Key),
      FocusedKey == node.Key,
      expandable && expandedKeys.Contains(node.Key),
      expandable,
      lazyLoadStates.TryGetValue(node.Key, out var lazyLoadState) ? lazyLoadState : null);
  }

  private void ApplyRowState(Border row, FsusTreeRowContext context)
  {
    row.MinHeight = ResolveRowMinHeight();
    row.Padding = RowPadding ?? global::FsusUI.Avalonia.FsusTokens.Space2Thickness;
    row.IsEnabled = !context.IsDisabled;
    FsusComponentClasses.Ensure(row, "fsus-selected", context.IsSelected);
    FsusComponentClasses.Ensure(row, "fsus-focused", context.IsFocused);
    FsusComponentClasses.Ensure(row, "fsus-disabled", context.IsDisabled);
    FsusComponentClasses.Ensure(row, "fsus-expandable", context.IsExpandable);
    AutomationProperties.SetAutomationId(row, $"fsus-tree-node-{context.Key}");
    AutomationProperties.SetName(row, context.Node.Label);
    AutomationProperties.SetControlTypeOverride(row, AutomationControlType.TreeItem);
    AutomationProperties.SetPositionInSet(row, context.Position);
    AutomationProperties.SetSizeOfSet(row, context.SetSize);
    AutomationProperties.SetLiveSetting(row, AutomationLiveSetting.Polite);
    var loadState = context.LazyLoadState?.ToString().ToLowerInvariant() ?? "idle";
    AutomationProperties.SetItemStatus(
      row,
      $"{(context.IsSelected ? "selected" : "not selected")}, " +
      $"{(context.IsExpandable ? context.IsExpanded ? "expanded" : "collapsed" : "leaf")}, " +
      $"{loadState}, level {context.Level.ToString(CultureInfo.InvariantCulture)}");
  }

  private double ResolveRowMinHeight() =>
    RowMinHeight ??
    (Application.Current?.Resources[
      global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYResourceKey] is double
      currentDensityHeight
        ? currentDensityHeight
        : global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYDouble);

  private Border BuildTransientInlineEditRow(int level)
  {
    var edit = ActiveInlineEdit!;
    var row = new Border
    {
      Child = BuildInlineEditContent("New item"),
      MinHeight = global::FsusUI.Avalonia.FsusTokens.DensityControlDefaultYDouble,
      Padding = global::FsusUI.Avalonia.FsusTokens.Space2Thickness,
      Margin = new Thickness(
        Math.Max(0, level - 1) *
        global::FsusUI.Avalonia.FsusTokens.Space5Thickness.Left,
        0,
        0,
        0),
      Focusable = false,
    };
    FsusComponentClasses.SetBaseClasses(row, "fsus-tree-row");
    FsusComponentClasses.Ensure(row, "fsus-focused", true);
    FsusComponentClasses.Ensure(row, "fsus-tree-inline-create", true);
    AutomationProperties.SetAutomationId(row, $"fsus-tree-node-{edit.Key}");
    AutomationProperties.SetName(row, "New item");
    AutomationProperties.SetControlTypeOverride(row, AutomationControlType.TreeItem);
    AutomationProperties.SetLiveSetting(row, AutomationLiveSetting.Polite);
    AutomationProperties.SetItemStatus(
      row,
      string.IsNullOrWhiteSpace(edit.ValidationError)
        ? $"editing create, level {level.ToString(CultureInfo.InvariantCulture)}"
        : $"editing create, invalid, level {level.ToString(CultureInfo.InvariantCulture)}");
    renderedRows[edit.Key] = row;
    return row;
  }

  private Control BuildInlineEditContent(string accessibleTargetName)
  {
    var edit = ActiveInlineEdit!;
    var editor = new TextBox
    {
      Text = edit.Text,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
    };
    FsusComponentClasses.Ensure(editor, "fsus-tree-inline-editor", true);
    FsusComponentClasses.Ensure(
      editor,
      "fsus-invalid",
      !string.IsNullOrWhiteSpace(edit.ValidationError));
    AutomationProperties.SetAutomationId(editor, $"fsus-tree-inline-editor-{edit.Key}");
    AutomationProperties.SetName(
      editor,
      edit.Kind == FsusTreeInlineEditKind.Rename
        ? $"Rename {accessibleTargetName}"
        : "New item name");
    AutomationProperties.SetHelpText(editor, edit.ValidationError ?? string.Empty);
    AutomationProperties.SetItemStatus(
      editor,
      string.IsNullOrWhiteSpace(edit.ValidationError)
        ? $"editing {edit.Kind.ToString().ToLowerInvariant()}"
        : $"editing {edit.Kind.ToString().ToLowerInvariant()}, invalid");
    editor.PropertyChanged += (_, args) =>
    {
      if (
        args.Property == TextBox.TextProperty &&
        ReferenceEquals(ActiveInlineEdit, edit) &&
        ReferenceEquals(inlineEditor, editor))
      {
        edit.Text = editor.Text ?? string.Empty;
        if (edit.ValidationError is not null)
        {
          edit.ValidationError = null;
          FsusComponentClasses.Ensure(editor, "fsus-invalid", false);
          AutomationProperties.SetHelpText(editor, string.Empty);
          AutomationProperties.SetItemStatus(
            editor,
            $"editing {edit.Kind.ToString().ToLowerInvariant()}");
        }
      }
    };
    editor.KeyDown += (_, e) =>
    {
      if (e.Handled)
      {
        return;
      }

      if (e.Key == Key.Enter)
      {
        CommitInlineEdit();
        e.Handled = true;
      }
      else if (e.Key == Key.Escape)
      {
        CancelInlineEdit(FsusTreeInlineEditCancelReason.Escape);
        e.Handled = true;
      }
    };
    inlineEditor = editor;
    FocusInlineEditor(editor, edit);

    if (string.IsNullOrWhiteSpace(edit.ValidationError))
    {
      return editor;
    }

    var error = new TextBlock
    {
      Text = edit.ValidationError,
      TextWrapping = global::Avalonia.Media.TextWrapping.Wrap,
    };
    FsusComponentClasses.SetBaseClasses(error, "fsus-tree-inline-error");
    return new StackPanel
    {
      Spacing = global::FsusUI.Avalonia.FsusTokens.Space1Thickness.Left,
      Children = { editor, error },
    };
  }

  private void FocusInlineEditor(
    TextBox editor,
    FsusTreeInlineEditState edit)
  {
    Dispatcher.UIThread.Post(() =>
    {
      if (!ReferenceEquals(ActiveInlineEdit, edit) || !ReferenceEquals(inlineEditor, editor))
      {
        return;
      }

      editor.Focus();
      if (edit.SelectAllOnFocus)
      {
        editor.SelectAll();
        edit.SelectAllOnFocus = false;
      }
      else
      {
        editor.CaretIndex = editor.Text?.Length ?? 0;
      }
    });
  }

  private bool CancelInlineEdit(FsusTreeInlineEditCancelReason reason)
  {
    var edit = ActiveInlineEdit;
    if (edit is null)
    {
      return false;
    }

    ActiveInlineEdit = null;
    DetachInlineEditPointerGuard();
    FocusedKey = ResolveInlineEditReturnFocus(edit);
    RefreshView();
    InlineEditCanceled?.Invoke(this, new FsusTreeInlineEditCanceledEventArgs(
      edit.Kind,
      edit.Key,
      edit.ParentKey,
      edit.Text,
      reason));
    return true;
  }

  private string ResolveInlineEditReturnFocus(FsusTreeInlineEditState edit)
  {
    if (FindNode(edit.PreviousFocusedKey) is not null)
    {
      return edit.PreviousFocusedKey;
    }

    if (edit.ParentKey is not null && FindNode(edit.ParentKey) is not null)
    {
      return edit.ParentKey;
    }

    return flattenedNodes.FirstOrDefault()?.Node.Key ?? string.Empty;
  }

  private void AttachInlineEditPointerGuard()
  {
    if (
      ActiveInlineEdit is null ||
      inlineEditTopLevel is not null ||
      TopLevel.GetTopLevel(this) is not { } topLevel)
    {
      return;
    }

    inlineEditTopLevel = topLevel;
    topLevel.AddHandler(
      InputElement.PointerPressedEvent,
      OnTopLevelPointerPressed,
      RoutingStrategies.Tunnel,
      handledEventsToo: true);
  }

  private void DetachInlineEditPointerGuard()
  {
    inlineEditTopLevel?.RemoveHandler(
      InputElement.PointerPressedEvent,
      OnTopLevelPointerPressed);
    inlineEditTopLevel = null;
    inlineEditor = null;
  }

  private void OnTopLevelPointerPressed(object? sender, PointerPressedEventArgs e)
  {
    if (
      ActiveInlineEdit is null ||
      inlineEditor is null ||
      e.Source is Visual source &&
      (ReferenceEquals(source, inlineEditor) || inlineEditor.IsVisualAncestorOf(source)))
    {
      return;
    }

    if (CancelInlineEdit(FsusTreeInlineEditCancelReason.PointerOutside))
    {
      e.Handled = true;
    }
  }

  private void HandleRowPointerPressed(
    FsusTreeNodeView view,
    Border row,
    PointerPressedEventArgs e)
  {
    if (e.Handled || view.Node.IsDisabled)
    {
      return;
    }

    var point = e.GetCurrentPoint(row);
    if (point.Properties.IsRightButtonPressed)
    {
      var rowAnchor = ResolveNodeAnchorBounds(view.Node.Key);
      var pointerAnchor = new Rect(
        rowAnchor.X + point.Position.X,
        rowAnchor.Y + point.Position.Y,
        1,
        1);
      Focus();
      if (RequestNodeContext(
        view.Node.Key,
        FsusTreeInteractionSource.Pointer,
        pointerAnchor))
      {
        e.Handled = true;
      }
      return;
    }

    if (!point.Properties.IsLeftButtonPressed)
    {
      return;
    }

    Focus();
    var expandable = IsExpandable(view.Node);
    if (
      expandable &&
      point.Position.X <= global::FsusUI.Avalonia.FsusTokens.Space6Thickness.Left)
    {
      e.Handled = GestureToggleExpansion(
        view.Node.Key,
        FsusTreeInteractionSource.Pointer);
      return;
    }

    if (!selectedKeys.Contains(view.Node.Key))
    {
      ToggleSelection(view.Node.Key);
    }
    e.Handled = Activate(view.Node.Key, FsusTreeInteractionSource.Pointer);
  }

  private void RaiseSelectionChanged(IReadOnlyList<string> added, IReadOnlyList<string> removed)
  {
    if (added.Count == 0 && removed.Count == 0)
    {
      return;
    }

    SelectionChanged?.Invoke(this, new FsusTreeSelectionChangedEventArgs(
      added,
      removed,
      new HashSet<string>(selectedKeys, StringComparer.Ordinal)));
  }

  private void RaiseLazyLoadState(
    string key,
    FsusTreeLazyLoadState state,
    Exception? exception = null)
  {
    lazyLoadStates[key] = state;
    RefreshRows();
    SyncState();
    LazyLoadStateChanged?.Invoke(this, new FsusTreeLazyLoadEventArgs(key, state, exception));
  }

  private void SyncPresentationSubscriptions()
  {
    try
    {
      CollectNodes(Nodes, currentPresentationNodes);
      foreach (var node in presentationSubscriptions)
      {
        if (!currentPresentationNodes.Contains(node))
          removedPresentationNodes.Add(node);
      }
      foreach (var node in removedPresentationNodes)
      {
        node.PresentationInvalidated -= nodePresentationHandler;
        presentationSubscriptions.Remove(node);
      }
      foreach (var node in currentPresentationNodes)
      {
        if (presentationSubscriptions.Add(node))
          node.PresentationInvalidated += nodePresentationHandler;
      }
    }
    finally
    {
      currentPresentationNodes.Clear();
      removedPresentationNodes.Clear();
    }
  }

  private static void CollectNodes(
    Collection<FsusTreeNode> nodes,
    HashSet<FsusTreeNode> destination)
  {
    for (var index = 0; index < nodes.Count; index++)
    {
      var node = nodes[index];
      if (!destination.Add(node))
      {
        continue;
      }

      CollectNodes(node.Children, destination);
    }
  }

  private void RefreshSubscribedNodePresentation(FsusTreeNode node)
  {
    if (!presentationSubscriptions.Contains(node))
    {
      return;
    }

    RefreshNodePresentation(node.Key);
    SyncState();
  }

  private sealed class NodePresentationSubscription(FsusTree tree)
  {
    // Caller-owned nodes may outlive the control, including while it is detached.
    private readonly WeakReference<FsusTree> owner = new(tree);

    public void OnInvalidated(object? sender, EventArgs e)
    {
      if (sender is not FsusTreeNode node)
      {
        return;
      }

      if (Dispatcher.UIThread.CheckAccess())
      {
        Deliver(node);
      }
      else
      {
        Dispatcher.UIThread.Post(() => Deliver(node));
      }
    }

    private void Deliver(FsusTreeNode node)
    {
      if (owner.TryGetTarget(out var tree))
      {
        tree.RefreshSubscribedNodePresentation(node);
      }
      else
      {
        node.PresentationInvalidated -= OnInvalidated;
      }
    }
  }

  private FsusTreeNode? FindNode(IEnumerable<FsusTreeNode> nodes, string key)
  {
    foreach (var node in nodes)
    {
      if (node.Key == key)
      {
        return node;
      }

      var child = FindNode(node.Children, key);
      if (child is not null)
      {
        return child;
      }
    }

    return null;
  }

  private void AddVisibleNodes(IReadOnlyList<FsusTreeNode> nodes, int level)
  {
    for (var index = 0; index < nodes.Count; index++)
    {
      var node = nodes[index];
      flattenedNodes.Add(new FsusTreeNodeView(node, level, index + 1, nodes.Count));
      if (expandedKeys.Contains(node.Key))
      {
        AddVisibleNodes(node.Children, level + 1);
      }
    }
  }

  private void AddFilteredNodes(IReadOnlyList<FsusTreeNode> nodes, int level)
  {
    foreach (var node in nodes)
    {
      if (Filter?.Invoke(node) == true)
      {
        flattenedNodes.Add(new FsusTreeNodeView(node, level, flattenedNodes.Count + 1, flattenedNodes.Count + 1));
      }

      AddFilteredNodes(node.Children, level + 1);
    }
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-checkable", Checkable);
    FsusComponentClasses.Ensure(this, "fsus-multiple", SelectionMode == FsusTreeSelectionMode.Multiple);
    FsusComponentClasses.Ensure(this, "fsus-empty", flattenedNodes.Count == 0);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, FocusedKey));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tree);
    AutomationProperties.SetItemStatus(
      this,
      $"{flattenedNodes.Count.ToString(CultureInfo.InvariantCulture)} nodes, {selectedKeys.Count.ToString(CultureInfo.InvariantCulture)} selected");
  }
}
