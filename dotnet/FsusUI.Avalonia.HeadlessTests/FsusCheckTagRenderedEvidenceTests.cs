using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusCheckTagRenderedEvidenceTests
{
  [AvaloniaFact]
  public void RendersCheckedAndUncheckedTagsToPng()
  {
    ApplyTheme(FsusThemeVariant.Light);

    var checkedTag = new FsusCheckTag { Checked = true, Content = "Checked tag" };
    var uncheckedTag = new FsusCheckTag { Checked = false, Content = "Unchecked tag" };

    var stack = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 8,
      Width = 320,
    };
    stack.Children.Add(checkedTag);
    stack.Children.Add(uncheckedTag);

    var surface = new Border
    {
      Width = 320,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = stack,
    };
    var window = new Window
    {
      Width = 320,
      Height = 220,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();

    window.Measure(new Size(320, 220));
    window.Arrange(new Rect(0, 0, 320, 220));
    surface.Arrange(new Rect(0, 0, 320, 220));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-checktag-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "checktag-state-matrix-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(320, 220), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.All(new[] { checkedTag, uncheckedTag }, tag =>
    {
      Assert.True(tag.IsArrangeValid, $"{tag.Content} arrange should complete.");
      Assert.True(tag.Bounds.Width > 0, $"{tag.Content} should have a width.");
      Assert.True(tag.Bounds.Height > 0, $"{tag.Content} should have a height.");
    });
    Assert.Contains("fsus-checked", checkedTag.Classes);
    Assert.Contains("fsus-unchecked", uncheckedTag.Classes);
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
