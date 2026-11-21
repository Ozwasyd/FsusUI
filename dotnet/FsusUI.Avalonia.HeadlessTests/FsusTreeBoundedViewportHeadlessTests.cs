using Avalonia;
using Avalonia.Automation;
using Avalonia.Media;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Avalonia.Media.Imaging;
using Avalonia.Markup.Xaml.Styling;
using FsusUI.Avalonia.Controls;
using System.Runtime.InteropServices;
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
  // Compare canonical raster bytes, not PNG compression or row-stride padding.
  static byte[] Export(FsusTree tree)
  {
    var size = new PixelSize(400, 960);
    var dpi = new Vector(96, 96);
    using var rendered = new RenderTargetBitmap(size, dpi);
    rendered.Render(tree);
    using var pixels = new WriteableBitmap(size, dpi,
      global::Avalonia.Platform.PixelFormat.Bgra8888,
      global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = pixels.Lock();
    rendered.CopyPixels(framebuffer);
    var rowBytes = size.Width * 4;
    var packed = new byte[rowBytes * size.Height];
    for (var y = 0; y < size.Height; y++)
      Marshal.Copy(IntPtr.Add(framebuffer.Address, y * framebuffer.RowBytes), packed, y * rowBytes, rowBytes);
    return packed;
  }
  static void Drive(FsusTree tree, Window window)
  {
    Assert.True(tree.FocusNode("n400"));
    tree.Nodes[400].Label = "Changed offscreen";
    Assert.True(tree.RefreshNodePresentation("n400"));
    var focusedRow = tree.Content is FsusTreeViewportItems viewport
      ? viewport.Rows[400] : Assert.IsType<StackPanel>(tree.Content).Children[400];
    Assert.Contains("fsus-focused", focusedRow.Classes);
    Assert.True(tree.Expand("n4"));
    Assert.Equal("n4", tree.FocusedKey);
    Layout(window);
  }
  static string VisibleGeometry(FsusTree tree) => string.Join("\n",
    tree.GetVisualDescendants().OfType<Border>().Where(row => row.Classes.Contains("fsus-tree-row"))
      .Select(row => (Row: row, Rect: new Rect(row.TranslatePoint(default, tree) ?? default, row.Bounds.Size)))
      .Where(entry => entry.Rect.Intersects(new Rect(tree.Bounds.Size)))
      .Select(entry => {
        var text = entry.Row.Child as TextBlock;
        var family = text is not null && FontManager.Current.TryGetGlyphTypeface(new Typeface(text.FontFamily, text.FontStyle, text.FontWeight, text.FontStretch), out var glyph) ? glyph.FamilyName : "unresolved";
        return $"{AutomationProperties.GetAutomationId(entry.Row)} rect={entry.Rect} visible={entry.Row.IsVisible}/{entry.Row.IsEffectivelyVisible} clip={entry.Row.GetTransformedBounds()?.Clip} text={text?.Text} labelBounds={text?.Bounds} desired={text?.DesiredSize} font={text?.FontFamily} size={text?.FontSize} weight={text?.FontWeight} lineHeight={text?.LineHeight} resolvedFont={family} layoutHeight={text?.TextLayout.Height}";
      }));
  static string PixelDifference(byte[] expected, byte[] actual)
  {
    if (expected.Length != actual.Length) return $"Pixel length mismatch: {expected.Length} != {actual.Length}";
    var first = -1; var count = 0; var minX = 400; var minY = 960; var maxX = -1; var maxY = -1;
    for (var i = 0; i < expected.Length; i++)
    {
      if (expected[i] == actual[i]) continue;
      if (first < 0) first = i;
      count++;
      var x = i / 4 % 400; var y = i / 4 / 400;
      minX = Math.Min(minX, x); maxX = Math.Max(maxX, x); minY = Math.Min(minY, y); maxY = Math.Max(maxY, y);
    }
    return first < 0 ? "Raster bytes are identical." :
      $"Different channels={count}; first=(x={first / 4 % 400},y={first / 4 / 400},BGRA-channel={first % 4}) expected={expected[first]}, actual={actual[first]}; mismatch bounds=({minX},{minY})-({maxX},{maxY}).";
  }
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
      Assert.IsType<FsusTreeViewportRow>(items.Rows[400]);
      var retained = items.Rows[402];
      Drive(t, w);
      Assert.Equal("Changed offscreen", all[400].GetName());
      Assert.Equal(1231, t.FlattenedNodes.Count); Assert.Same(retained, items.Rows[403]); Assert.Equal(1231, peer.GetChildren().Count);
      var candidate = Export(t); var bounds = t.Bounds;
      var candidateGeometry = VisibleGeometry(t);
      var sampleRow = t.GetVisualDescendants().OfType<Border>().First(r => r.Classes.Contains("fsus-tree-row"));
      output.WriteLine("Ancestor clips: " + string.Join(" | ", sampleRow.GetVisualAncestors().Select(v => $"{v.GetType().Name}:bounds={v.Bounds},clipToBounds={v.ClipToBounds},clip={v.Clip}")));
      var legacy = Create(1230, true);
      w.Content = new Grid { Children = { legacy } }; Layout(w);
      Drive(legacy, w);
      Assert.Equal(bounds, legacy.Bounds);
      var expected = Export(legacy);
      var legacyGeometry = VisibleGeometry(legacy);
      output.WriteLine($"initialVisualRows={before}; logicalRows={items.Rows.Count}; bounds={bounds}; {PixelDifference(expected, candidate)}");
      output.WriteLine($"Candidate visible geometry:\n{candidateGeometry}\nLegacy visible geometry:\n{legacyGeometry}");
      Assert.True(expected.AsSpan().SequenceEqual(candidate), PixelDifference(expected, candidate));
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void FontAndPartialRowBoundaryMatchesLegacyPixels()
  {
    var differences = new List<string>();
    foreach (var padding in new[] { 8d, 64d, 300d })
    foreach (var family in new[] { "Arial", "Times New Roman", "Courier New" })
    foreach (var height in new[] { 680, 690, 700, 710 })
    {
      var t = Create(500); t.Padding = new Thickness(8, padding, 8, padding);
      var w = new Window { Width = 400, Height = height, FontFamily = new FontFamily(family),
        Content = new Grid { Children = { t } } }; Show(w);
      try
      {
        Layout(w); Drive(t, w); Assert.IsType<FsusTreeViewportItems>(t.Content);
        var candidate = Export(t); var candidateGeometry = VisibleGeometry(t);
        var legacy = Create(500, true); legacy.Padding = new Thickness(8, padding, 8, padding); w.Content = new Grid { Children = { legacy } };
        Layout(w); Drive(legacy, w); var expected = Export(legacy);
        var equal = expected.AsSpan().SequenceEqual(candidate);
        if (!equal)
        {
          differences.Add($"padding={padding}; font={family}; height={height}; {PixelDifference(expected,candidate)}");
          output.WriteLine($"Candidate geometry:\n{candidateGeometry}\nLegacy geometry:\n{VisibleGeometry(legacy)}");
        }
      }
      finally { w.Close(); }
    }
    Assert.True(differences.Count == 0, string.Join("\n", differences));
  }
  [AvaloniaFact]
  public void ExplicitUnclippedTreeUsesLegacyAndClippingChangeRevalidates()
  {
    var tree = Create(500); tree.ClipToBounds = false;
    var w = new Window { Width = 400, Height = 700, Content = tree }; Show(w);
    try
    {
      Layout(w); Assert.IsType<StackPanel>(tree.Content);
      tree.ClipToBounds = true; Layout(w); Assert.IsType<FsusTreeViewportItems>(tree.Content);
      tree.ClipToBounds = false; Layout(w); Assert.IsType<StackPanel>(tree.Content);
      var actual = Export(tree);
      var legacy = Create(500, true); legacy.ClipToBounds = false; w.Content = legacy; Layout(w);
      Assert.Equal(Export(legacy), actual);
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void CustomTemplateAndResizeUseActualContentOriginForExactExport()
  {
    FsusTree Build(bool legacy)
    {
      var tree = Create(500, legacy); tree.ClipToBounds = true;
      tree.Template = new global::Avalonia.Controls.Templates.FuncControlTemplate<FsusTree>((owner, _) =>
      {
        var presenter = new global::Avalonia.Controls.Presenters.ContentPresenter();
        presenter.Bind(global::Avalonia.Controls.Presenters.ContentPresenter.ContentProperty,
          owner.GetObservable(ContentControl.ContentProperty));
        return new Border { Padding = new Thickness(5, 29, 7, 83), Background = Brushes.White, Child = presenter };
      });
      return tree;
    }
    var t = Build(false); var w = new Window { Width = 400, Height = 700, FontFamily = new FontFamily("Arial"), Content = t }; Show(w);
    try
    {
      Layout(w); Drive(t,w); Assert.IsType<FsusTreeViewportItems>(t.Content);
      w.Height = 640; Layout(w);
      var actual = Export(t);
      var legacy = Build(true); w.Content = legacy; Layout(w); Drive(legacy,w);
      var expected = Export(legacy);
      Assert.True(expected.AsSpan().SequenceEqual(actual), PixelDifference(expected,actual));
    }
    finally { w.Close(); }
  }
  [AvaloniaFact]
  public void NonStretchAndUnboundedWidthRetainLegacyMeasurement()
  {
    var tree = Create(500); tree.Nodes[499].Label = new string('W', 400);
    tree.HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left;
    var w = new Window { Width=400, Height=700, Content=tree }; Show(w);
    try
    {
      Layout(w); Assert.IsType<StackPanel>(tree.Content);
      tree.HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch;
      w.Content = null;
      var horizontal = new StackPanel { Orientation = global::Avalonia.Layout.Orientation.Horizontal, Children = { tree } };
      w.Content = horizontal; Layout(w); Assert.IsType<StackPanel>(tree.Content);
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
    var t = new FsusTree { ClipToBounds = true };
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
