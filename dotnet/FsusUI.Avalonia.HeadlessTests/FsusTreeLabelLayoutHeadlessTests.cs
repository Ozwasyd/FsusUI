using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using System.Reflection;
using System.Runtime.InteropServices;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeLabelLayoutHeadlessTests
{
  [AvaloniaFact]
  public void DefaultLabelMatchesStockLayoutAndPixelsAcrossRemountAndChanges()
  {
    var cached = new FsusTreeLabel { Text = "▾ Parent 中文 العربية long label for ellipsis", TextTrimming = TextTrimming.CharacterEllipsis };
    var stock = new TextBlock { Text = cached.Text, TextTrimming = cached.TextTrimming };
    var host = new Grid();
    var window = new Window { Width = 300, Height = 160, Content = host };
    window.Show();
    try
    {
      var actions = new Action<TextBlock>[]
      {
        _ => { },
        label => label.FontSize = 22,
        label => label.FontWeight = FontWeight.Bold,
        label => label.FontStyle = FontStyle.Italic,
        label => label.FontStretch = FontStretch.Condensed,
        label => label.TextTrimming = TextTrimming.WordEllipsis,
        label => label.TextTrimming = TextTrimming.None,
        label => label.TextTrimming = TextTrimming.CharacterEllipsis,
        label => label.UseLayoutRounding = false,
        label => label.UseLayoutRounding = true,
        label => label.FontFamily = new FontFamily("Arial"),
        label => label.FlowDirection = FlowDirection.RightToLeft,
        label => label.Padding = new Thickness(3.5, 2.5),
        label => label.LetterSpacing = 1.25,
        label => label.LineHeight = 32,
        label => label.LineSpacing = 2,
        label => label.LineSpacing = 0,
        label => label.TextAlignment = TextAlignment.Center,
        label => label.TextWrapping = TextWrapping.Wrap,
        label => label.MaxLines = 2,
        label => label.Foreground = Brushes.Red,
        label => label.Text = "Changed line\nsecond line 中文",
        _ => window.RequestedThemeVariant = ThemeVariant.Dark,
        label => label.TextDecorations = global::Avalonia.Media.TextDecorations.Underline,
        label => label.TextDecorations = new TextDecorationCollection(),
        label => label.FontFeatures = FontFeatureCollection.Parse("liga=0"),
        label => label.FontFeatures = new FontFeatureCollection(),
        label => label.Inlines!.Add(new Run(" inline content")),
        label => { label.Inlines!.Clear(); label.Text = "Plain content again 中文"; },
      };
      foreach (var action in actions)
      {
        action(cached);
        action(stock);
        foreach (var constraint in new[] { new Size(180, 80), new Size(80, 40), new Size(180, 80) })
        {
          var expected = LayoutAndPixels(stock, host, constraint);
          var actual = LayoutAndPixels(cached, host, constraint);
          Assert.Equal(expected.Desired, actual.Desired);
          Assert.Equal(expected.Pixels, actual.Pixels);
          var remount = LayoutAndPixels(cached, host, constraint);
          Assert.Equal(expected.Desired, remount.Desired);
          Assert.Equal(expected.Pixels, remount.Pixels);
          var shapingCache = typeof(FsusTreeLabel).GetField("shapingCache", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(cached);
          if (cached.LineSpacing == 0 && cached.Inlines is not { Count: > 0 } &&
            cached.FontFeatures is not { Count: > 0 } && cached.TextDecorations is not { Count: > 0 })
            Assert.NotNull(shapingCache);
          else
            Assert.Null(shapingCache);
        }
      }
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void DifferentMeasureAndArrangeConstraintsMatchStockAcrossIdenticalRemounts()
  {
    var cached = new FsusTreeLabel { Text = "Long label 中文 العربية which must trim or wrap", TextTrimming = TextTrimming.CharacterEllipsis };
    var stock = new TextBlock { Text = cached.Text, TextTrimming = cached.TextTrimming };
    var host = new Grid();
    var window = new Window { Width = 300, Height = 160, Content = host };
    window.Show();
    try
    {
      foreach (var wrapping in new[] { TextWrapping.NoWrap, TextWrapping.Wrap })
      {
        cached.TextWrapping = stock.TextWrapping = wrapping;
        foreach (var (measure, arrange) in new[]
        {
          (new Size(180, 80), new Size(70, 30)),
          (new Size(100, 60), new Size(70, 30)),
          (new Size(70, 30), new Size(180, 80)),
          (new Size(180, 80), new Size(70, 30)),
        })
        {
          var expected = LayoutAndPixels(stock, host, measure, arrange);
          var actual = LayoutAndPixels(cached, host, measure, arrange);
          Assert.Equal(expected.Desired, actual.Desired);
          Assert.Equal(expected.Pixels, actual.Pixels);
          var remount = LayoutAndPixels(cached, host, measure, arrange);
          Assert.Equal(expected.Desired, remount.Desired);
          Assert.Equal(expected.Pixels, remount.Pixels);
        }
      }
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void ReparentingTracksInheritedTypographyAndForegroundWithoutPinning()
  {
    var cached = new FsusTreeLabel { Text = "Parent 中文 inherited font", TextTrimming = TextTrimming.CharacterEllipsis };
    var stock = new TextBlock { Text = cached.Text, TextTrimming = cached.TextTrimming };
    var firstHost = new Grid();
    var secondHost = new Grid();
    var first = new Window { Width = 300, Height = 160, Content = firstHost, FontSize = 14, FontFamily = new FontFamily("Arial"), Foreground = Brushes.Red };
    var second = new Window { Width = 300, Height = 160, Content = secondHost, FontSize = 26, FontFamily = new FontFamily("Times New Roman"), FontWeight = FontWeight.Bold, Foreground = Brushes.Blue };
    first.Show();
    second.Show();
    try
    {
      byte[]? previousPixels = null;
      foreach (var (window, host) in new[] { (first, firstHost), (second, secondHost), (first, firstHost) })
      {
        var constraint = new Size(180, 80);
        var expected = LayoutAndPixels(stock, host, constraint);
        var actual = LayoutAndPixels(cached, host, constraint);
        Assert.Equal(window.FontSize, cached.FontSize);
        Assert.Equal(window.FontFamily, cached.FontFamily);
        Assert.Same(window.Foreground, cached.Foreground);
        Assert.Equal(expected.Desired, actual.Desired);
        Assert.Equal(expected.Pixels, actual.Pixels);
        if (previousPixels is not null) Assert.False(previousPixels.SequenceEqual(actual.Pixels));
        previousPixels = actual.Pixels;
        var remount = LayoutAndPixels(cached, host, constraint);
        Assert.Equal(expected.Desired, remount.Desired);
        Assert.Equal(expected.Pixels, remount.Pixels);
      }
    }
    finally { second.Close(); first.Close(); }
  }

  [AvaloniaFact]
  public void IdenticalRemountDefersDefaultLabelShapingUntilRender()
  {
    var label = new FsusTreeLabel { Text = "Parent 中文", TextTrimming = TextTrimming.CharacterEllipsis };
    var host = new Grid();
    var window = new Window { Width = 300, Height = 160, Content = host, FontSize = 19 };
    window.Show();
    try
    {
      host.Children.Add(label);
      label.Measure(new Size(180, 80));
      label.Arrange(new Rect(0, 0, 180, 80));
      var expected = label.DesiredSize;
      host.Children.Clear();
      host.Children.Add(label);
      label.InvalidateMeasure();
      label.Measure(new Size(180, 80));
      label.Arrange(new Rect(0, 0, 180, 80));
      Assert.Equal(expected, label.DesiredSize);
      var layout = typeof(TextBlock).GetField("_textLayout", BindingFlags.Instance | BindingFlags.NonPublic)!;
      Assert.Null(layout.GetValue(label));
      Assert.NotNull(label.TextLayout);
      window.FontSize = 27;
      label.Measure(new Size(180, 80));
      label.Arrange(new Rect(0, 0, 180, 80));
      Assert.NotEqual(expected, label.DesiredSize);
      Assert.NotNull(layout.GetValue(label));
    }
    finally { window.Close(); }
  }

  [AvaloniaFact]
  public void ShapingCacheIsPerLabelSurvivesLayoutReplacementAndReleasesAfterActualDetach()
  {
    var label = new FsusTreeLabel { Text = "Parent 中文 shaping ownership", TextTrimming = TextTrimming.CharacterEllipsis };
    var other = new FsusTreeLabel { Text = label.Text, TextTrimming = label.TextTrimming };
    var cacheField = typeof(FsusTreeLabel).GetField("shapingCache", BindingFlags.Instance | BindingFlags.NonPublic)!;
    label.Measure(new Size(180, 80));
    Assert.Null(cacheField.GetValue(label));
    var host = new Grid();
    var window = new Window { Width = 300, Height = 160, Content = host };
    window.Show();
    try
    {
      var constraint = new Size(180, 80);
      var first = LayoutAndPixels(label, host, constraint);
      var ownedCache = cacheField.GetValue(label);
      Assert.NotNull(ownedCache);
      var oldLayout = label.TextLayout;
      label.InvalidateMeasure();
      label.Measure(constraint);
      label.Arrange(new Rect(default, constraint));
      Assert.NotSame(oldLayout, label.TextLayout);
      Assert.Same(ownedCache, cacheField.GetValue(label));
      var remount = LayoutAndPixels(label, host, constraint);
      Assert.Equal(first.Desired, remount.Desired);
      Assert.Equal(first.Pixels, remount.Pixels);
      Assert.Same(ownedCache, cacheField.GetValue(label));

      LayoutAndPixels(other, host, constraint);
      Assert.NotNull(cacheField.GetValue(other));
      Assert.NotSame(ownedCache, cacheField.GetValue(other));
      Dispatcher.UIThread.RunJobs();
      Assert.Null(cacheField.GetValue(label));
      var reattached = LayoutAndPixels(label, host, constraint);
      Assert.NotNull(cacheField.GetValue(label));
      Assert.NotSame(ownedCache, cacheField.GetValue(label));
      Assert.Equal(first.Desired, reattached.Desired);
      Assert.Equal(first.Pixels, reattached.Pixels);
      host.Children.Clear();
      Dispatcher.UIThread.RunJobs();
      Assert.Null(cacheField.GetValue(other));
      Assert.Null(cacheField.GetValue(label));
    }
    finally { window.Close(); Dispatcher.UIThread.RunJobs(); }
  }

  private static (Size Desired, byte[] Pixels) LayoutAndPixels(TextBlock label, Grid host, Size constraint, Size? arrange = null)
  {
    (label.Parent as Panel)?.Children.Remove(label);
    host.Children.Clear();
    host.Children.Add(label);
    label.Measure(constraint);
    label.Arrange(new Rect(default, arrange ?? constraint));
    using var bitmap = new RenderTargetBitmap(new PixelSize(200, 80), new Vector(96, 96));
    bitmap.Render(label);
    using var buffer = new WriteableBitmap(bitmap.PixelSize, new Vector(96, 96), global::Avalonia.Platform.PixelFormat.Bgra8888, global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = buffer.Lock();
    bitmap.CopyPixels(framebuffer);
    var pixels = new byte[framebuffer.RowBytes * bitmap.PixelSize.Height];
    Marshal.Copy(framebuffer.Address, pixels, 0, pixels.Length);
    return (label.DesiredSize, pixels);
  }
}
