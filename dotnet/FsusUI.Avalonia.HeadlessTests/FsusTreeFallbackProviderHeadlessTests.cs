using System.Collections;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Fonts;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeFallbackProviderHeadlessTests(ITestOutputHelper output)
{
  [AvaloniaTheory]
  [InlineData(true)]
  [InlineData(false)]
  public void DefaultRowsObserveFallbackReplacementWithUnchangedPrimary(bool refreshOnly)
  {
    WithFallback((manager, original, replacementFace, tree, host, label) =>
    {
      var primary = new Typeface(label.FontFamily).GlyphTypeface;
      var oldPixels = Raster(label);
      Assert.Equal(FreshPixels(host, label), oldPixels);
      var builds = label.ShapingBuildCount;
      var replacement = new FallbackCollection(replacementFace);
      manager.AddFontCollection(replacement);
      Assert.True(original.Disposed);
      Assert.Same(primary, new Typeface(label.FontFamily).GlyphTypeface);
      if (refreshOnly)
        tree.RefreshView();
      else
        label.InvalidateMeasure();
      Assert.Same(label, Label(tree));
      var freshPixels = FreshPixels(host, label);
      Assert.False(oldPixels.SequenceEqual(freshPixels));
      var actual = Raster(label);
      output.WriteLine($"Refresh only: {refreshOnly}; shaping builds before/after: {builds}/{label.ShapingBuildCount}; old/fresh pixels differ: {!oldPixels.SequenceEqual(freshPixels)}");
      Assert.Equal(freshPixels, actual);
      Assert.True(label.ShapingBuildCount > builds);
      Assert.True(replacement.Lookups > 0);
    });
  }

  [AvaloniaFact]
  public void DefaultRowsReuseShapingWithTheSameFallbackProvider()
  {
    WithFallback((_, original, _, tree, host, label) =>
    {
      var pixels = Raster(label);
      var builds = label.ShapingBuildCount;
      for (var iteration = 0; iteration < 5; iteration++)
      {
        tree.RefreshView();
        label.InvalidateMeasure();
        Assert.Equal(FreshPixels(host, label), Raster(label));
        Assert.Equal(pixels, Raster(label));
        Assert.Same(label, Label(tree));
        Assert.Equal(builds, label.ShapingBuildCount);
      }
      Assert.False(original.Disposed);
    });
  }

  [AvaloniaFact]
  public void DefaultRowsReleaseLayoutOnUnloadAndResolveFallbackAfterRebinding()
  {
    WithFallback((manager, _, replacementFace, tree, host, label) =>
    {
      var pixels = Raster(label);
      var builds = label.ShapingBuildCount;
      host.Children.Remove(tree);
      // A detached consumer can still measure the retained label before the
      // deferred unload releases its shaping data and its TextBlock layout.
      Raster(label);
      Assert.True(label.IsMeasureValid);
      Dispatcher.UIThread.RunJobs();
      Assert.False(label.HoldsShapingCache);
      Assert.False(label.IsMeasureValid);
      manager.AddFontCollection(new FallbackCollection(replacementFace));
      host.Children.Add(tree);
      Dispatcher.UIThread.RunJobs();
      Assert.Same(label, Label(tree));
      var freshPixels = FreshPixels(host, label);
      Assert.False(pixels.SequenceEqual(freshPixels));
      Assert.Equal(freshPixels, Raster(label));
      Assert.True(label.HoldsShapingCache);
      Assert.True(label.ShapingBuildCount > builds);
    });
  }

  [AvaloniaFact]
  public void FallbackReplacementPreservesUnrelatedDefaultRowShaping()
  {
    WithFallback((manager, _, replacementFace, tree, host, label) =>
    {
      tree.Nodes.Add(new FsusTreeNode("ascii", "ASCII label"));
      tree.RefreshView();
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var ascii = Assert.IsType<FsusTreeDefaultLabel>(Assert.IsType<Border>(panel.Children[1]).Child);
      var asciiPixels = Raster(ascii);
      var asciiBuilds = ascii.ShapingBuildCount;
      var cjkBuilds = label.ShapingBuildCount;
      manager.AddFontCollection(new FallbackCollection(replacementFace));
      tree.RefreshView();
      Assert.Equal(FreshPixels(host, label), Raster(label));
      Assert.True(label.ShapingBuildCount > cjkBuilds);
      ascii.InvalidateMeasure();
      Assert.Equal(asciiPixels, Raster(ascii));
      Assert.Equal(asciiBuilds, ascii.ShapingBuildCount);
    });
  }

  private static void WithFallback(Action<FontManager, FallbackCollection, GlyphTypeface,
    FsusTree, Grid, FsusTreeDefaultLabel> check)
  {
    var manager = FontManager.Current;
    var originalFace = new Typeface("Noto Sans CJK SC").GlyphTypeface;
    var replacementFace = new Typeface("Noto Serif CJK SC").GlyphTypeface;
    Assert.NotSame(originalFace, replacementFace);
    Assert.True(originalFace.CharacterToGlyphMap.TryGetGlyph('中', out _));
    Assert.True(replacementFace.CharacterToGlyphMap.TryGetGlyph('中', out _));
    Assert.False(new Typeface("DejaVu Sans").GlyphTypeface.CharacterToGlyphMap.TryGetGlyph('中', out _));
    var primary = new FallbackCollection(new Typeface("DejaVu Sans").GlyphTypeface,
      "fonts:fsus-tree-fallback-primary", false);
    manager.AddFontCollection(primary);
    var original = new FallbackCollection(originalFace);
    manager.AddFontCollection(original);
    var tree = new FsusTree
    {
      FontFamily = new FontFamily($"{primary.Key}#Tree Fallback, {original.Key}#Tree Fallback"),
      FontSize = 24,
    };
    tree.Nodes.Add(new FsusTreeNode("cjk", "A 中文"));
    tree.RefreshView();
    var host = new Grid { Children = { tree } };
    var window = new Window { Width = 400, Height = 180, Content = host };
    try
    {
      window.Show();
      Dispatcher.UIThread.RunJobs();
      check(manager, original, replacementFace, tree, host, Label(tree));
    }
    finally
    {
      window.Close();
      manager.RemoveFontCollection(original.Key);
      manager.RemoveFontCollection(primary.Key);
    }
  }

  private static FsusTreeDefaultLabel Label(FsusTree tree) =>
    Assert.IsType<FsusTreeDefaultLabel>(Assert.IsType<Border>(
      Assert.Single(Assert.IsType<StackPanel>(tree.Content).Children)).Child);

  private static byte[] FreshPixels(Grid host, TextBlock label)
  {
    var reference = new TextBlock
    {
      Text = label.Text, FontFamily = label.FontFamily, FontSize = label.FontSize,
      Foreground = label.Foreground, VerticalAlignment = label.VerticalAlignment,
    };
    host.Children.Add(reference);
    try { return Raster(reference); }
    finally { host.Children.Remove(reference); }
  }

  private static byte[] Raster(TextBlock label)
  {
    label.Measure(new Size(360, 60));
    label.Arrange(new Rect(0, 0, 360, 60));
    using var bitmap = new RenderTargetBitmap(new PixelSize(360, 60), new Vector(96, 96));
    bitmap.Render(label);
    using var stream = new MemoryStream();
    bitmap.Save(stream);
    return stream.ToArray();
  }

  private sealed class FallbackCollection(GlyphTypeface face,
    string key = "fonts:fsus-tree-fallback-test", bool matchCharacters = true) : IFontCollection
  {
    public Uri Key { get; } = new(key);
    public bool Disposed { get; private set; }
    public int Lookups { get; private set; }
    public int Count => 1;
    public FontFamily this[int index] => index == 0 ? new FontFamily("Tree Fallback") : throw new IndexOutOfRangeException();
    public IEnumerator<FontFamily> GetEnumerator() => new[] { this[0] }.AsEnumerable().GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    public void Dispose() => Disposed = true;
    public bool TryGetGlyphTypeface(string familyName, FontStyle style, FontWeight weight,
      FontStretch stretch, [NotNullWhen(true)] out GlyphTypeface? glyphTypeface)
    {
      Lookups++;
      glyphTypeface = face;
      return true;
    }
    public bool TryGetNearestMatch(string familyName, FontStyle style, FontWeight weight,
      FontStretch stretch, [NotNullWhen(true)] out GlyphTypeface? glyphTypeface) =>
      TryGetGlyphTypeface(familyName, style, weight, stretch, out glyphTypeface);
    public bool TryMatchCharacter(int codepoint, FontStyle fontStyle, FontWeight fontWeight,
      FontStretch fontStretch, string? familyName, CultureInfo? culture, out Typeface typeface)
    {
      typeface = new Typeface(new FontFamily($"{Key}#Tree Fallback"), fontStyle, fontWeight, fontStretch);
      return matchCharacters && face.CharacterToGlyphMap.TryGetGlyph(codepoint, out _);
    }
    public bool TryGetFamilyTypefaces(string familyName,
      [NotNullWhen(true)] out IReadOnlyList<Typeface>? familyTypefaces)
    {
      familyTypefaces = [new Typeface(new FontFamily($"{Key}#Tree Fallback"))];
      return true;
    }
    public bool TryCreateSyntheticGlyphTypeface(GlyphTypeface glyphTypeface, FontStyle style,
      FontWeight weight, FontStretch stretch, [NotNullWhen(true)] out GlyphTypeface? syntheticGlyphTypeface)
    {
      syntheticGlyphTypeface = null;
      return false;
    }
  }
}
