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

// Logical row controls stay addressable even when they do not enter the viewport.
internal sealed class FsusTreeViewportItems : ItemsControl
{
  internal ObservableCollection<Control> Rows { get; }
  protected override Type StyleKeyOverride => typeof(ItemsControl);
  internal FsusTreeViewportItems(ObservableCollection<Control> rows, FsusTree tree)
  {
    Rows = rows;
    // The legacy StackPanel paints into the tree padding. Only the outer tree
    // owns clipping; the bounded fast path requires its ClipToBounds to be true.
    ClipToBounds = false;
    ItemsSource = rows;
    Template = new FuncControlTemplate<FsusTreeViewportItems>((owner, scope) =>
      new FsusTreeViewportPresenter(tree)
      {
        Name = "PART_ItemsPresenter",
        ItemsPanel = owner.ItemsPanel,
      }.RegisterInNameScope(scope));
    ItemsPanel = new FuncTemplate<Panel?>(() => new VirtualizingStackPanel());
  }
  internal void Realize(Control row)
  {
    var index = Rows.IndexOf(row);
    if (index >= 0) ScrollIntoView(index);
  }
  protected override AutomationPeer OnCreateAutomationPeer() => new RowsPeer(this);
  private sealed class RowsPeer : ControlAutomationPeer
  {
    private readonly FsusTreeViewportItems owner;
    public RowsPeer(FsusTreeViewportItems owner) : base(owner)
    {
      this.owner = owner;
      owner.Rows.CollectionChanged += (_, _) => InvalidateChildren();
    }
    protected override IReadOnlyList<AutomationPeer>? GetChildrenCore() =>
      owner.Rows.Select(CreatePeerForElement).ToArray();
  }
}
internal sealed class FsusTreeViewportRow(FsusTreeViewportItems owner) : Border
{
  protected override Type StyleKeyOverride => typeof(Border);
  protected override AutomationPeer OnCreateAutomationPeer() => new RowPeer(this, owner);
  private sealed class RowPeer(FsusTreeViewportRow row, FsusTreeViewportItems owner) : ControlAutomationPeer(row)
  {
    protected override string GetClassNameCore() => nameof(Border);
    protected override void BringIntoViewCore() => owner.Realize(row);
  }
}

internal sealed class FsusTreeViewportPresenter(FsusTree tree) : global::Avalonia.Controls.Presenters.ItemsPresenter
{
  protected override Size ArrangeOverride(Size finalSize)
  {
    var origin = this.TranslatePoint(default, tree);
    var height = origin is { } point && tree.Bounds.Height > 0
      ? Math.Max(finalSize.Height, tree.Bounds.Height - point.Y)
      : finalSize.Height;
    // Keep row width and origin unchanged, but realize through the outer tree
    // bottom rather than truncating at the inner content/padding boundary.
    Panel?.Arrange(new Rect(0, 0, finalSize.Width, height));
    return finalSize;
  }
  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    tree.PropertyChanged += TreeBoundsChanged;
  }
  protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
  {
    tree.PropertyChanged -= TreeBoundsChanged;
    base.OnDetachedFromVisualTree(e);
  }
  private void TreeBoundsChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
  {
    if (e.Property == BoundsProperty) InvalidateArrange();
  }
}
