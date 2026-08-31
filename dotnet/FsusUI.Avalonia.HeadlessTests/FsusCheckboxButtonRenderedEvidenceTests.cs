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

public class FsusCheckboxButtonRenderedEvidenceTests
{
  [AvaloniaFact]
  public void RendersCheckedUncheckedDisabledButtonsToPng()
  {
    ApplyTheme(FsusThemeVariant.Light);

    var checkedBtn = new FsusCheckboxButton { Checked = true, Label = "Checked", Content = "Checked" };
    var uncheckedBtn = new FsusCheckboxButton { Checked = false, Label = "Unchecked", Content = "Unchecked" };
    var disabledBtn = new FsusCheckboxButton { Checked = false, Disabled = true, Label = "Disabled", Content = "Disabled" };

    var stack = new StackPanel
    {
      Margin = new Thickness(24),
      Spacing = 8,
      Orientation = Orientation.Horizontal,
      Width = 320,
    };
    stack.Children.Add(checkedBtn);
    stack.Children.Add(uncheckedBtn);
    stack.Children.Add(disabledBtn);

    var surface = new Border
    {
      Width = 380,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = stack,
    };
    var window = new Window
    {
      Width = 380,
      Height = 160,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachFsusTheme(window);
    window.Show();

    window.Measure(new Size(380, 160));
    window.Arrange(new Rect(0, 0, 380, 160));
    surface.Arrange(new Rect(0, 0, 380, 160));

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.HeadlessTests",
      "TestResults",
      "fsus-checkbox-button-rendered-evidence");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, "checkbox-button-state-matrix-light.png");
    using var bitmap = new RenderTargetBitmap(new PixelSize(380, 160), new Vector(96, 96));
    bitmap.Render(surface);
    using (var stream = File.Create(outputPath))
    {
      bitmap.Save(stream);
    }

    Assert.True(File.Exists(outputPath));
    Assert.True(new FileInfo(outputPath).Length > 1_000);
    Assert.All(new[] { checkedBtn, uncheckedBtn, disabledBtn }, btn =>
    {
      Assert.True(btn.IsArrangeValid, $"{btn.Label} arrange should complete.");
      Assert.True(btn.Bounds.Width > 0, $"{btn.Label} should have a width.");
      Assert.True(btn.Bounds.Height > 0, $"{btn.Label} should have a height.");
    });
    Assert.Contains("fsus-checked", checkedBtn.Classes);
    Assert.Contains("fsus-unchecked", uncheckedBtn.Classes);
    Assert.Contains("fsus-disabled", disabledBtn.Classes);
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
