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
    HeadlessTheme.Attach(window, new FsusThemeOptions
    {
      Variant = FsusThemeVariant.Light,
      MotionMode = FsusMotionMode.Enabled,
    });
    window.Show();

    window.Measure(new Size(380, 160));
    window.Arrange(new Rect(0, 0, 380, 160));
    surface.Arrange(new Rect(0, 0, 380, 160));

    var outputRoot = Path.Combine(
      HeadlessRepositoryRoot.FindBySolution(),
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
}
