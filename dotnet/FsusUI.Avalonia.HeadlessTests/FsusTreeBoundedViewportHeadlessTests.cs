using Avalonia;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Avalonia.Media.Imaging;
using Avalonia.Markup.Xaml.Styling;
using FsusUI.Avalonia.Controls;
namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeBoundedViewportHeadlessTests(ITestOutputHelper output)
{
  static void Show(Window window)
  {
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Show();
  }
  static void Layout(Window w) { for (int i = 0; i < 4; i++) { w.UpdateLayout(); Dispatcher.UIThread.RunJobs(); } w.UpdateLayout(); }
  sealed class LegacyTree : FsusTree { protected override Type StyleKeyOverride => typeof(FsusTree); }
  static FsusTree Create(int count, bool legacy = false)
  {
    FsusTree t = legacy ? new LegacyTree() : new FsusTree(); t.RowMinHeight = 30;
    for (int i = 0; i < count; i++) { var n = new FsusTreeNode($"n{i}", $"Node {i}"); n.Children.Add(new FsusTreeNode($"c{i}", $"Child {i}")); t.Nodes.Add(n); }
    t.RefreshView(); return t;
  }
  static byte[] Export(FsusTree t) { using var b = new RenderTargetBitmap(new PixelSize(400, 960)); b.Render(t); using var s = new MemoryStream(); b.Save(s); return s.ToArray(); }
  [AvaloniaFact]
  public void ActualBoundedTreeRetainsLogicalRowsAndExportsLikeLegacy()
  {
    var t = Create(1230); var w = new Window { Width = 400, Height = 700, Content = new Grid { Children = { t } } }; Show(w);
    try
    {
      Layout(w);
      var items = Assert.IsType<FsusTreeViewportItems>(t.Content);
      var peer = ControlAutomationPeer.CreatePeerForElement(items)!;
      var all = peer.GetChildren(); Assert.Equal(1230, all.Count);
      var before = t.GetVisualDescendants().OfType<FsusTreeViewportRow>().Count(); Assert.InRange(before, 1, 30);
      Assert.Equal(1230, t.FlattenedNodes.Count);
      Assert.True(t.FocusNode("n400")); t.Nodes[400].Label = "Changed offscreen";
      Assert.True(t.RefreshNodePresentation("n400")); Assert.Equal("Changed offscreen", all[400].GetName());
      var row = Assert.IsType<FsusTreeViewportRow>(items.Rows[400]); Assert.Contains("fsus-focused", row.Classes);
      var retained = items.Rows[402]; Assert.True(t.Expand("n4")); Layout(w);
      Assert.Equal(1231, t.FlattenedNodes.Count); Assert.Same(retained, items.Rows[403]); Assert.Equal(1231, peer.GetChildren().Count);
      var candidate = Export(t); var bounds = t.Bounds;
      var legacy = Create(1230, true); legacy.FocusNode("n400"); legacy.Nodes[400].Label = "Changed offscreen"; legacy.RefreshNodePresentation("n400"); legacy.Expand("n4");
      w.Content = new Grid { Children = { legacy } }; Layout(w);
      Assert.Equal(bounds, legacy.Bounds); Assert.Equal(Export(legacy), candidate);
      output.WriteLine($"initialVisualRows={before}; logicalRows={items.Rows.Count}; bounds={bounds}; exportByteEquality=true");
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void ExternalContentAndLogicalPeerMutationRemainObservable()
  {
    var t = Create(300); var w = new Window { Width = 400, Height = 700, Content = t }; Show(w);
    try
    {
      Layout(w); var items = Assert.IsType<FsusTreeViewportItems>(t.Content);
      var peer = ControlAutomationPeer.CreatePeerForElement(items)!; Assert.Equal(300, peer.GetChildren().Count);
      t.Nodes.Add(new FsusTreeNode("new", "New")); t.RefreshView(); Layout(w); Assert.Equal(301, peer.GetChildren().Count);
      t.Nodes.RemoveAt(10); t.RefreshView(); Layout(w); Assert.Equal(300, peer.GetChildren().Count);
      var external = new TextBlock { Text = "Externally owned content" }; t.Content = external;
      w.Height = 600; Layout(w); t.RefreshView(); Layout(w); Assert.Same(external, t.Content);
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void OffscreenContextAnchorMatchesLegacy()
  {
    Rect Capture(bool legacy)
    {
      var t = Create(300, legacy); var w = new Window { Width = 400, Height = 700, Content = t }; Show(w);
      try
      {
        Layout(w); Rect anchor = default; t.NodeContextRequested += (_, e) => anchor = e.AnchorBounds;
        Assert.True(t.RequestNodeContext("n200", FsusTreeInteractionSource.Keyboard));
        output.WriteLine($"legacy={legacy}; anchor={anchor}"); return anchor;
      }
      finally { w.Close(); }
    }
    Assert.Equal(Capture(true), Capture(false));
  }
  [AvaloniaFact]
  public void SameHostRemountKeepsBoundedRowsWithoutFluentTheme()
  {
    var app = Application.Current!;
    var fluent = app.Styles.OfType<global::Avalonia.Themes.Fluent.FluentTheme>().Single();
    var t = new FsusTree();
    for (int i = 0; i < 1000; i++) { var n = new FsusTreeNode($"p-{i}", $"Parent {i}"); for (int j = 0; j < 10; j++) n.Children.Add(new FsusTreeNode($"p-{i}-{j}", $"Child {j}")); t.Nodes.Add(n); }
    t.RefreshView(); var host = new Grid { Width = 1120, Height = 700, Children = { t } }; var w = new Window { Width = 1120, Height = 700, Content = host }; Show(w);
    app.Styles.Remove(fluent);
    try
    {
      for (int i = 0; i < 3; i++)
      {
        Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
        Assert.InRange(t.GetVisualDescendants().OfType<FsusTreeViewportRow>().Count(), 1, 64);
        Assert.True(t.Expand($"p-{i}")); t.FocusNode($"p-{i}"); Layout(w);
        output.WriteLine($"cycle={i}; flattened={t.FlattenedNodes.Count}; visuals={t.GetVisualDescendants().Count()}; rows={t.GetVisualDescendants().OfType<FsusTreeViewportRow>().Count()}");
        host.Children.Remove(t); host.Children.Add(t);
        Assert.True(t.Expand($"p-{i + 3}"));
        Assert.True(t.FocusNode($"p-{i + 3}"));
        Assert.IsType<FsusTreeViewportItems>(t.Content);
        Assert.InRange(t.GetVisualDescendants().OfType<FsusTreeViewportRow>().Count(), 1, 64);
        output.WriteLine($"PRE-LAYOUT cycle={i}; host={t.Content?.GetType().Name}; visuals={t.GetVisualDescendants().Count()}");
      }
      Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
    }
    finally { w.Close(); app.Styles.Insert(0, fluent); }
  }
  [AvaloniaFact]
  public void OffscreenAutomationBringIntoViewDoesNotShiftBoundedView()
  {
    var t = Create(300); var w = new Window { Width = 400, Height = 700, Content = t }; Show(w);
    try
    {
      Layout(w); var before = Export(t); var items = Assert.IsType<FsusTreeViewportItems>(t.Content);
      var peers = ControlAutomationPeer.CreatePeerForElement(items)!.GetChildren(); peers[200].BringIntoView(); Layout(w);
      Assert.Equal(before, Export(t));
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void SameTurnDifferentParentAndChangedAncestorSizeDropStampBeforeAction()
  {
    var t = Create(300); var host = new Grid { Width = 400, Height = 700, Children = { t } }; var w = new Window { Width = 400, Height = 700, Content = host }; Show(w);
    try
    {
      Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
      host.Children.Remove(t); host.Height = 600; host.Children.Add(t); t.Expand("n1");
      Assert.IsType<StackPanel>(t.Content); Layout(w);
      Assert.IsType<FsusTreeViewportItems>(t.Content);
      host.Children.Remove(t); var other = new Grid { Children = { t } }; w.Content = other; t.Expand("n2");
      Assert.IsType<StackPanel>(t.Content); Layout(w);
      Assert.IsType<FsusTreeViewportItems>(t.Content);
      other.Children.Remove(t); var scroll = new ScrollViewer { Content = t }; w.Content = scroll; t.Expand("n3");
      Assert.IsType<StackPanel>(t.Content); Layout(w); Assert.IsType<StackPanel>(t.Content);
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void TranslationRevalidationRejectsMovingOutsideRootAndCustomClip()
  {
    var t = Create(300); var host = new Grid { Width = 400, Height = 700, Children = { t } }; var w = new Window { Width = 500, Height = 800, Content = host }; Show(w);
    try
    {
      Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
      host.Arrange(new Rect(0, 0, 400, 700)); host.Children.Remove(t); host.Children.Add(t); t.Expand("n1");
      Assert.IsType<FsusTreeViewportItems>(t.Content);
      host.Arrange(new Rect(0, 300, 400, 700)); host.Children.Remove(t); host.Children.Add(t); t.Expand("n2");
      Assert.IsType<StackPanel>(t.Content);
      host.Clip = new global::Avalonia.Media.RectangleGeometry(new Rect(0, 0, 100, 100)); Layout(w); t.RefreshView(); Assert.IsType<StackPanel>(t.Content);
      host.Clip = null; host.RenderTransform = new global::Avalonia.Media.RotateTransform(5); Layout(w); t.RefreshView(); Assert.IsType<StackPanel>(t.Content);
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void PartialAncestorClipPreservesFullExport()
  {
    byte[] Capture(bool legacy)
    {
      var t = Create(300, legacy);
      var w = new Window { Width = 400, Height = 700, Content = new Border { ClipToBounds = true, Child = new Grid { Height = 1400, VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top, Children = { t } } } };
      Show(w); try { Layout(w); output.WriteLine($"legacy={legacy}; bounds={t.Bounds}; host={t.Content?.GetType().Name}; visuals={t.GetVisualDescendants().OfType<Border>().Count()}"); return Export(t); } finally { w.Close(); }
    }
    Assert.Equal(Capture(true), Capture(false));
  }
  [AvaloniaFact]
  public void ScrollSmallCustomAndEditingUseLegacy()
  {
    var t = Create(300); var scroll = new ScrollViewer { Content = t }; var w = new Window { Width = 400, Height = 700, Content = scroll }; Show(w);
    try
    {
      Layout(w); Assert.IsType<StackPanel>(t.Content); Assert.Equal(300, ((StackPanel)t.Content!).Children.Count);
      scroll.Content = null; w.Content = new Grid { Children = { t } }; Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
      t.RowPresenter = c => new TextBlock { Text = c.Node.Label }; Layout(w); Assert.IsType<StackPanel>(t.Content);
      t.RowPresenter = null; Layout(w); Assert.IsType<FsusTreeViewportItems>(t.Content);
      Assert.True(t.StartRename("n20", "draft")); Layout(w); Assert.IsType<StackPanel>(t.Content);
      w.Content = Create(60); Layout(w); Assert.IsType<StackPanel>(((FsusTree)w.Content).Content);
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void ExplicitlyClearedContentIsNotReplaced()
  {
    var tree = Create(300);
    tree.Content = null;
    var window = new Window { Width = 400, Height = 700, Content = tree };
    Show(window);
    try
    {
      Layout(window);
      tree.RefreshView();
      Layout(window);
      Assert.Null(tree.Content);
    }
    finally { window.Close(); }
  }

}
