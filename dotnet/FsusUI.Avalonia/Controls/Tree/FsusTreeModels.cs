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

public enum FsusTreeSelectionMode
{
  Single,
  Multiple,
}

public sealed class FsusTreeNode
{
  private string label;
  private bool isDisabled;
  private bool hasLazyChildren;
  private object? payload;

  public FsusTreeNode(string key, string label)
  {
    Key = key;
    this.label = label;
  }

  internal event EventHandler? PresentationInvalidated;

  public string Key { get; }
  public string Label
  {
    get => label;
    set
    {
      if (label == value)
      {
        return;
      }

      label = value;
      InvalidatePresentation();
    }
  }
  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      if (isDisabled == value)
      {
        return;
      }

      isDisabled = value;
      InvalidatePresentation();
    }
  }
  public bool HasLazyChildren
  {
    get => hasLazyChildren;
    set
    {
      if (hasLazyChildren == value)
      {
        return;
      }

      hasLazyChildren = value;
      InvalidatePresentation();
    }
  }
  public object? Payload
  {
    get => payload;
    set
    {
      if (ReferenceEquals(payload, value))
      {
        return;
      }

      payload = value;
      InvalidatePresentation();
    }
  }
  public Collection<FsusTreeNode> Children { get; } = [];

  public void InvalidatePresentation() => PresentationInvalidated?.Invoke(this, EventArgs.Empty);
}

public sealed record FsusTreeNodeView(
  FsusTreeNode Node,
  int Level,
  int Position,
  int SetSize);

public sealed record FsusTreeNodeState(
  string Key,
  bool Selected,
  bool Checked,
  string ExpandedState,
  int Level,
  int Position,
  int SetSize);

public sealed record FsusTreeRowContext(
  string Key,
  FsusTreeNode Node,
  object? Payload,
  int Level,
  int Position,
  int SetSize,
  bool IsDisabled,
  bool IsSelected,
  bool IsChecked,
  bool IsFocused,
  bool IsExpanded,
  bool IsExpandable,
  FsusTreeLazyLoadState? LazyLoadState);

public delegate Control FsusTreeRowPresenter(FsusTreeRowContext context);

public sealed record FsusTreeVirtualizationBudget(
  int RealizedRows,
  int RetainedNodes,
  int MaxDepth,
  double LazyLoadLatencyMs,
  double MemoryKb);

public sealed record FsusTreeBudgetResult(
  int RealizedRows,
  int RetainedNodes,
  int MaxDepth,
  FsusTreeVirtualizationBudget Budget)
{
  public bool WithinBudget =>
    RealizedRows <= Budget.RealizedRows &&
    RetainedNodes <= Budget.RetainedNodes &&
    MaxDepth <= Budget.MaxDepth;
}

public delegate ValueTask<IReadOnlyList<FsusTreeNode>> FsusTreeChildrenLoader(
  FsusTreeNode node,
  CancellationToken cancellationToken);

public enum FsusTreeInteractionSource
{
  Pointer,
  Keyboard,
}

public enum FsusTreeLazyLoadState
{
  Started,
  Completed,
  Canceled,
  Failed,
}

public enum FsusTreeInlineEditKind
{
  Rename,
  Create,
}

public enum FsusTreeInlineEditCancelReason
{
  Programmatic,
  Escape,
  PointerOutside,
}

public sealed class FsusTreeInlineEditState(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text)
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; internal set; } = text;
  public string? ValidationError { get; internal set; }
  internal string PreviousFocusedKey { get; set; } = string.Empty;
  internal bool SelectAllOnFocus { get; set; } = kind == FsusTreeInlineEditKind.Rename;
}

public sealed class FsusTreeInlineEditCommitEventArgs(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text) : EventArgs
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; } = text;
  public string? ValidationError { get; set; }
}

public sealed class FsusTreeInlineEditCanceledEventArgs(
  FsusTreeInlineEditKind kind,
  string key,
  string? parentKey,
  string text,
  FsusTreeInlineEditCancelReason reason) : EventArgs
{
  public FsusTreeInlineEditKind Kind { get; } = kind;
  public string Key { get; } = key;
  public string? ParentKey { get; } = parentKey;
  public string Text { get; } = text;
  public FsusTreeInlineEditCancelReason Reason { get; } = reason;
}

public sealed class FsusTreeNodeActivatedEventArgs(
  string key,
  FsusTreeInteractionSource source) : EventArgs
{
  public string Key { get; } = key;
  public FsusTreeInteractionSource Source { get; } = source;
  public bool Handled { get; set; }
}

public sealed class FsusTreeSelectionChangedEventArgs(
  IReadOnlyList<string> addedKeys,
  IReadOnlyList<string> removedKeys,
  IReadOnlySet<string> selectedKeys) : EventArgs
{
  public IReadOnlyList<string> AddedKeys { get; } = addedKeys;
  public IReadOnlyList<string> RemovedKeys { get; } = removedKeys;
  public IReadOnlySet<string> SelectedKeys { get; } = selectedKeys;
}

public sealed class FsusTreeExpansionChangedEventArgs(
  string key,
  bool isExpanded,
  FsusTreeInteractionSource source) : EventArgs
{
  public string Key { get; } = key;
  public bool IsExpanded { get; } = isExpanded;
  public FsusTreeInteractionSource Source { get; } = source;
}

public sealed class FsusTreeLazyLoadEventArgs(
  string key,
  FsusTreeLazyLoadState state,
  Exception? exception = null) : EventArgs
{
  public string Key { get; } = key;
  public FsusTreeLazyLoadState State { get; } = state;
  public Exception? Exception { get; } = exception;
}

public sealed class FsusTreeNodeContextEventArgs(
  string key,
  FsusTreeNode node,
  FsusTreeInteractionSource source,
  Rect anchorBounds) : RoutedEventArgs(FsusTree.NodeContextRequestedEvent)
{
  public string Key { get; } = key;
  public FsusTreeNode Node { get; } = node;
  public FsusTreeInteractionSource InteractionSource { get; } = source;
  public Rect AnchorBounds { get; } = anchorBounds;
}
