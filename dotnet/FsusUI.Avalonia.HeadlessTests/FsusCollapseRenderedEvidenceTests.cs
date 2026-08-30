using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCollapseRenderedEvidenceTests
{
  [AvaloniaFact]
  public void RendersCollapseStateMatrixToPng()
  {
    ApplyTheme(FsusThemeVariant.Light);

    var item1 = new FsusCollapseItem { Title = "Options", ItemKey = "options" };
    var item2 = new FsusCollapseItem { Title = "Advanced", ItemKey = "advanced" };
    var item3 = new FsusCollapseItem { Title = "Disabled", ItemKey = "disabled", Disabled = true };
    var collapse = new FsusCollapse
    {
      Accordion = false,
      ActiveNames = new object[] { "options" },
    };
    var stack = new StackPanel { Margin = new Thickness(24), Spacing = 0, Width = 560 };
    stack.Children.Add(item1);
    stack.Children.Add(item2);
    stack.Children.Add(item3);
    collapse.Content = stack;

    var surface = new Border
    {
      Width = 560,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = collapse,
    };
    var window = new Window
    {
      Width = 560,
      Height = 440,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();

    window.Measure(new Size(560, 440));
    window.Arrange(new Rect(0, 0, 560, 440));
    surface.Arrange(new Rect(0, 0, 560, 440));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-collapse-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "collapse-state-matrix-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(560, 440), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.True(item1.IsMeasureValid);
    Assert.True(item1.IsArrangeValid);
    Assert.True(item1.Bounds.Width > 0);
    Assert.True(item1.Bounds.Height > 0);
    Assert.All(new[] { item1, item2, item3 }, item =>
    {
      Assert.True(item.IsArrangeValid, $"{item.Title} arrange should complete.");
      Assert.True(item.Bounds.Height > 0, $"{item.Title} should have a height.");
    });
    Assert.Contains("fsus-active", item1.Classes);
    Assert.DoesNotContain("fsus-active", item2.Classes);
    Assert.Contains("fsus-disabled", item3.Classes);
    window.Close();
  }

  private static FsusThemeOptions themeOptions = new();

  private static void ApplyTheme(FsusThemeVariant variant)
  {
    themeOptions = new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = FsusMotionMode.Enabled,
    };
  }

  private static void AttachFsusTheme(Window window)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, themeOptions);
    window.Resources.MergedDictionaries.Add(resources);
    window.Styles.Add(
      new global::Avalonia.Markup.Xaml.Styling.StyleInclude(
        new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
      {
        Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
      });
  }

  private static string FindRepositoryRoot()
  {
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null &&
           !File.Exists(Path.Combine(dir.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
    {
      dir = dir.Parent;
    }

    return dir?.FullName
      ?? throw new InvalidOperationException("Unable to locate repository root.");
  }
}
