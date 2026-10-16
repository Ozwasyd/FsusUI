using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using FsusUI.Avalonia.Controls;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreeLayoutHeadlessTests(ITestOutputHelper output)
{
  [AvaloniaFact]
  public void DefaultRowsKeepMeasurementsAcrossExpansionAndFocusAndInvalidateOnRemount()
  {
    var tree = new FsusTree();
    for (var index = 0; index < 1000; index++)
    {
      var parent = new FsusTreeNode($"p-{index}", $"Parent {index}");
      for (var child = 0; child < 10; child++)
        parent.Children.Add(new FsusTreeNode($"p-{index}-{child}", $"Child {child}"));
      tree.Nodes.Add(parent);
    }
    tree.RefreshView();
    var host = new Grid { Width = 1120, Height = 700, Children = { tree } };
    var window = new Window { Width = 1180, Height = 760, Content = host };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    window.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var labels = panel.Children.Cast<Border>().Select(row => Assert.IsType<FsusTreeDefaultLabel>(row.Child)).ToArray();
      Assert.Equal(1000, labels.Length);
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));
      var builds = labels.Select(label => label.ShapingBuildCount).ToArray();
      Assert.True(tree.Expand("p-0"));
      Assert.True(tree.FocusNode("p-1"));
      output.WriteLine($"After expansion/focus: invalid labels {labels.Count(label => !label.IsMeasureValid)}");
      Assert.False(labels[0].IsMeasureValid);
      Assert.All(labels.Skip(1), label => Assert.True(label.IsMeasureValid));
      host.Measure(new Size(1120, 700));
      host.Arrange(new Rect(0, 0, 1120, 700));
      Dispatcher.UIThread.RunJobs();
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));
      for (var index = 1; index < labels.Length; index++)
        Assert.Equal(builds[index], labels[index].ShapingBuildCount);

      var originalFamily = labels[1].FontFamily;
      var originalSize = labels[1].FontSize;
      var originalForeground = labels[1].Foreground;
      var changes = new List<string>();
      labels[1].PropertyChanged += (_, args) =>
      {
        if (args.Property == TextBlock.FontFamilyProperty ||
            args.Property == TextBlock.FontSizeProperty ||
            args.Property == TextBlock.ForegroundProperty)
          changes.Add(args.Property.Name);
      };
      host.Children.Remove(tree);
      host.Children.Add(tree);
      output.WriteLine(string.Join("\n", changes));
      output.WriteLine($"After remount: invalid labels {labels.Count(label => !label.IsMeasureValid)}");
      Assert.Equal(originalFamily, labels[1].FontFamily);
      Assert.Equal(originalSize, labels[1].FontSize);
      Assert.Same(originalForeground, labels[1].Foreground);
      builds = labels.Select(label => label.ShapingBuildCount).ToArray();
      Assert.True(tree.Expand("p-1"));
      Assert.True(tree.FocusNode("p-2"));
      host.Measure(new Size(1120, 700));
      host.Arrange(new Rect(0, 0, 1120, 700));
      Assert.All(labels, label => Assert.True(label.IsMeasureValid));
      for (var index = 2; index < labels.Length; index++)
        Assert.Equal(builds[index], labels[index].ShapingBuildCount);
      output.WriteLine($"Unaffected labels requiring new shaped data after remount: {labels.Skip(2).Where((label, index) => label.ShapingBuildCount != builds[index + 2]).Count()}");
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void DefaultRowsReleaseShapingCachesOnCollapseReplacementAndRealUnload()
  {
    var tree = new FsusTree();
    var parent = new FsusTreeNode("parent", "Parent");
    parent.Children.Add(new FsusTreeNode("child", "Child"));
    tree.Nodes.Add(parent);
    tree.RefreshView();
    var window = new Window { Width = 320, Height = 200, Content = tree };
    window.Show();
    try
    {
      Assert.True(tree.Expand(parent.Key));
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var labels = panel.Children.Cast<Border>().Select(row => Assert.IsType<FsusTreeDefaultLabel>(row.Child)).ToArray();
      Assert.All(labels, label => Assert.True(label.HoldsShapingCache));
      Assert.True(tree.Collapse(parent.Key));
      Assert.False(labels[1].HoldsShapingCache);
      parent.Label = "Renamed";
      Assert.False(labels[0].HoldsShapingCache);
      Dispatcher.UIThread.RunJobs();
      var replacement = Assert.IsType<FsusTreeDefaultLabel>(Assert.IsType<Border>(Assert.Single(panel.Children)).Child);
      Assert.True(replacement.HoldsShapingCache);

      window.Content = null;
      Dispatcher.UIThread.RunJobs();
      Assert.False(replacement.HoldsShapingCache);
      window.Content = tree;
      Dispatcher.UIThread.RunJobs();
      Assert.True(replacement.HoldsShapingCache);
      window.Close();
      Assert.False(replacement.HoldsShapingCache);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void DefaultRowsMatchFreshTextThroughFormattingResourceDpiAndThemeChanges()
  {
    var tree = new FsusTree();
    tree.Nodes.Add(new FsusTreeNode("file", "File 中文 مرحبا long label for clipping"));
    tree.RefreshView();
    var host = new Grid { Children = { tree } };
    var window = new Window { Width = 320, Height = 200, Content = host };
    window.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var row = Assert.IsType<Border>(Assert.Single(Assert.IsType<StackPanel>(tree.Content).Children));
      var label = Assert.IsType<FsusTreeDefaultLabel>(row.Child);
      byte[] Check(double width = 180)
      {
        var reference = new TextBlock
        {
          Text = label.Text, FontFamily = label.FontFamily, FontSize = label.FontSize,
          FontStyle = label.FontStyle, FontWeight = label.FontWeight, FontStretch = label.FontStretch,
          Foreground = label.Foreground, FlowDirection = label.FlowDirection,
          LetterSpacing = label.LetterSpacing, LineHeight = label.LineHeight, LineSpacing = label.LineSpacing,
          TextAlignment = label.TextAlignment, TextWrapping = label.TextWrapping, TextTrimming = label.TextTrimming,
          TextDecorations = label.TextDecorations, FontFeatures = label.FontFeatures, MaxLines = label.MaxLines,
          VerticalAlignment = label.VerticalAlignment, Padding = label.Padding,
        };
        host.Children.Add(reference);
        Dispatcher.UIThread.RunJobs();
        try
        {
          byte[] Raster(TextBlock target)
          {
            target.Measure(new Size(width, 60));
            target.Arrange(new Rect(0, 0, width, 60));
            using var bitmap = new RenderTargetBitmap(new PixelSize((int)width, 60), new Vector(96, 96));
            bitmap.Render(target);
            using var stream = new MemoryStream();
            bitmap.Save(stream);
            return stream.ToArray();
          }
          var actual = Raster(label);
          Assert.Equal(Raster(reference), actual);
          return actual;
        }
        finally
        {
          host.Children.Remove(reference);
        }
      }

      Check();
      label.FontFamily = new FontFamily("Noto Sans CJK SC");
      Check();
      label.FontSize = 23;
      Check();
      label.FontWeight = FontWeight.Bold;
      Check();
      label.FontStyle = FontStyle.Italic;
      Check();
      label.FontStretch = FontStretch.Condensed;
      Check();
      var brush = new SolidColorBrush(Colors.Red);
      label.Foreground = brush;
      var red = Check();
      var builds = label.ShapingBuildCount;
      brush.Color = Colors.Blue;
      brush.Opacity = 0.7;
      label.InvalidateMeasure();
      var blue = Check();
      Assert.False(red.SequenceEqual(blue));
      Assert.True(label.ShapingBuildCount > builds);
      Check(80);
      window.SetRenderScaling(2);
      Assert.Equal(2, window.RenderScaling);
      Check();
      window.RequestedThemeVariant = ThemeVariant.Dark;
      Check();
      label.Text = "  Updated 中文 مرحبا";
      label.FlowDirection = FlowDirection.RightToLeft;
      label.LetterSpacing = 1.5;
      label.LineHeight = 32;
      label.MaxLines = 1;
      Check();
      label.TextDecorations = TextDecorations.Underline;
      Check();
      Assert.False(label.HoldsShapingCache);
      label.TextDecorations = null;
      label.LineSpacing = 4;
      Check();
      Assert.False(label.HoldsShapingCache);
      label.LineSpacing = 0;
      label.TextWrapping = TextWrapping.Wrap;
      Check(80);
      Assert.False(label.HoldsShapingCache);
      label.TextWrapping = TextWrapping.NoWrap;
      label.Text = "  First\nSecond";
      Check();
      Assert.False(label.HoldsShapingCache);
      label.Text = "  Resource change";
      Check();
      Assert.True(label.HoldsShapingCache);
      window.Resources["tree-test-resource"] = "new value";
      Assert.False(label.HoldsShapingCache);
      Check();
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void DefaultRowsApplyNewHostTypographyAndLivePresentationAfterRemount()
  {
    var tree = new FsusTree();
    var node = new FsusTreeNode("file", "File");
    tree.Nodes.Add(node);
    tree.RefreshView();
    var first = new Window { Width = 320, Height = 200, FontSize = 14, Content = tree };
    var second = new Window
    {
      Width = 320,
      Height = 200,
      FontSize = 23,
      FontFamily = new FontFamily("Noto Sans CJK SC"),
    };
    first.Show();
    try
    {
      Dispatcher.UIThread.RunJobs();
      var panel = Assert.IsType<StackPanel>(tree.Content);
      var row = Assert.IsType<Border>(Assert.Single(panel.Children));
      var label = Assert.IsType<FsusTreeDefaultLabel>(row.Child);
      Assert.Equal(14, label.FontSize);
      first.Content = null;
      second.Content = tree;
      second.Show();
      Dispatcher.UIThread.RunJobs();
      Assert.Same(row, Assert.Single(panel.Children));
      Assert.Same(label, row.Child);
      Assert.Equal(23, label.FontSize);
      Assert.Equal(second.FontFamily, label.FontFamily);
      Assert.True(label.IsMeasureValid);

      tree.FontSize = 26;
      tree.Foreground = Brushes.Red;
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(26, label.FontSize);
      Assert.Same(Brushes.Red, label.Foreground);
      Assert.True(label.IsMeasureValid);
      node.Label = "Renamed 中文";
      Dispatcher.UIThread.RunJobs();
      Assert.Equal("  Renamed 中文", Assert.IsType<FsusTreeDefaultLabel>(row.Child).Text);
      Assert.Equal("Renamed 中文", global::Avalonia.Automation.AutomationProperties.GetName(row));
    }
    finally
    {
      first.Close();
      second.Close();
    }
  }
}
