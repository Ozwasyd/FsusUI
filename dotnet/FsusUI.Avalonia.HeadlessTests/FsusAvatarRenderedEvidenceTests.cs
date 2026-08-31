using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusAvatarRenderedEvidenceTests
{
  [AvaloniaFact]
  public void RendersCircleAndSquareAvatarsToPng()
  {
    ApplyTheme(FsusThemeVariant.Light);

    var circleAvatar = new FsusAvatar { Size = 64, Shape = FsusAvatarShape.Circle, FallbackText = "A" };
    var squareAvatar = new FsusAvatar { Size = 64, Shape = FsusAvatarShape.Square, FallbackText = "B" };

    var stack = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 16,
      Orientation = Orientation.Horizontal,
      Width = 200,
    };
    stack.Children.Add(circleAvatar);
    stack.Children.Add(squareAvatar);

    var surface = new Border
    {
      Width = 240,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = stack,
    };
    var window = new Window
    {
      Width = 240,
      Height = 160,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();

    window.Measure(new Size(240, 160));
    window.Arrange(new Rect(0, 0, 240, 160));
    surface.Arrange(new Rect(0, 0, 240, 160));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-avatar-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "avatar-state-matrix-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(240, 160), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.True(circleAvatar.Bounds.Width >= 64, "circle avatar should have size.");
    Assert.Equal(64, squareAvatar.Bounds.Width, 1);
    Assert.Contains("fsus-circle", circleAvatar.Classes);
    Assert.Contains("fsus-square", squareAvatar.Classes);
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
