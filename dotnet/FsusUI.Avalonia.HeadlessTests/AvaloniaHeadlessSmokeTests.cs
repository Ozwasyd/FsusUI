using Avalonia.Controls;
using FsusUI.Avalonia.Demo;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class AvaloniaHeadlessSmokeTests
{
  [Fact]
  public void DemoAppBuilderCanBeCreatedWithoutStartingDesktopLifetime()
  {
    var builder = Program.BuildAvaloniaApp();

    Assert.NotNull(builder);
  }

  [Fact]
  public void ThemeManagerSwitchesModesWhileControlsAreMounted()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var button = new FsusButton { Content = "Mounted", IsLoading = true };
    var host = new ContentControl { Content = button };

    foreach (var variant in new[] { FsusThemeVariant.Light, FsusThemeVariant.Dark })
      foreach (var highContrast in new[] { false, true })
        foreach (var density in new[] { FsusDensity.Compact, FsusDensity.Default, FsusDensity.Spacious })
          foreach (var motion in new[] { FsusMotionMode.System, FsusMotionMode.Enabled, FsusMotionMode.Reduced, FsusMotionMode.Disabled })
          {
            manager.Apply(
              application,
              new FsusThemeOptions
              {
                Variant = variant,
                HighContrast = highContrast,
                Density = density,
                MotionMode = motion,
              }
            );

            Assert.Same(button, host.Content);
            Assert.Contains("fsus-button", button.Classes);
            Assert.Contains("fsus-loading", button.Classes);
            Assert.False(button.IsEnabled);
            Assert.NotNull(application.Resources[FsusThemeResourceKeys.BackgroundBrush]);
            Assert.NotNull(application.Resources[FsusThemeResourceKeys.MotionDurationEffective]);
          }
  }
}
