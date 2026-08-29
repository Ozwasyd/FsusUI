using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.Tests.Theme;

public class FsusThemeManagerTests
{
  [Fact]
  public void ApplyUsesHighContrastThenAccentDensityAndMotionOverrides()
  {
    var resources = new ResourceDictionary();
    resources[FsusTokens.ComponentStateButtonPrimaryBackgroundDefaultResourceKey] =
      FsusTokens.ComponentStateButtonPrimaryBackgroundDefaultBrush;
    var manager = new FsusThemeManager();

    var resolved = manager.Apply(
      resources,
      new FsusThemeOptions
      {
        Variant = FsusThemeVariant.Dark,
        HighContrast = true,
        Density = FsusDensity.Compact,
        MotionMode = FsusMotionMode.Disabled,
        AccentOverride = Color.Parse("#FF00AA"),
      }
    );

    Assert.True(resolved.HighContrast);
    Assert.Equal(FsusThemeVariant.Dark, resolved.Variant);
    Assert.Equal(FsusDensity.Compact, resolved.Density);
    Assert.Equal(FsusMotionMode.Disabled, resolved.MotionMode);
    AssertBrush(resources, FsusThemeResourceKeys.BackgroundBrush, "#000000");
    AssertBrush(resources, "FsusThemeTreeSurfaceBrush", "#000000");
    AssertBrush(resources, FsusThemeResourceKeys.FocusBrush, "#FF00AA");
    AssertBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundDefaultResourceKey,
      "#FFFFFF"
    );
    AssertBrush(
      resources,
      FsusTokens.ComponentStateButtonPrimaryBackgroundHoverResourceKey,
      "#FF00AA"
    );
    Assert.Equal(40d, resources[FsusThemeResourceKeys.DensityControlDefaultY]);
    Assert.Equal(
      TimeSpan.FromMilliseconds(1),
      resources[FsusThemeResourceKeys.MotionDurationEffective]
    );
  }

  [Fact]
  public void ApplyUpdatesTreeSurfaceForRuntimeDarkThemeChanges()
  {
    var resources = new ResourceDictionary();
    var manager = new FsusThemeManager();

    manager.Apply(
      resources,
      new FsusThemeOptions { Variant = FsusThemeVariant.Dark });

    AssertBrush(resources, "FsusThemeTreeSurfaceBrush", "#1B2433");
  }

  [Fact]
  public void ApplyFallsBackToStableDefaultsForUnknownOptions()
  {
    var resources = new ResourceDictionary();
    var manager = new FsusThemeManager();

    var resolved = manager.Apply(
      resources,
      new FsusThemeOptions
      {
        Variant = (FsusThemeVariant)99,
        Density = (FsusDensity)99,
        MotionMode = (FsusMotionMode)99,
      }
    );

    Assert.Equal(FsusThemeVariant.Light, resolved.Variant);
    Assert.Equal(FsusDensity.Default, resolved.Density);
    Assert.Equal(FsusMotionMode.System, resolved.MotionMode);
    AssertBrush(resources, FsusThemeResourceKeys.BackgroundBrush, "#FFFFFF");
    Assert.Equal(44d, resources[FsusThemeResourceKeys.DensityControlDefaultY]);
    Assert.Equal(
      FsusTokens.MotionDurationControlTimeSpan,
      resources[FsusThemeResourceKeys.MotionDurationEffective]
    );
  }

  [Fact]
  public void ApplyCanFollowSystemVariantWithoutDiscardingResourceFallbacks()
  {
    var application = new Application();
    var manager = new FsusThemeManager();

    manager.Apply(
      application,
      new FsusThemeOptions
      {
        FollowSystemTheme = true,
        Density = FsusDensity.Spacious,
        MotionMode = FsusMotionMode.Reduced,
      }
    );

    Assert.Equal(ThemeVariant.Default, application.RequestedThemeVariant);
    Assert.Equal(48d, application.Resources[FsusThemeResourceKeys.DensityControlDefaultY]);
    Assert.Equal(
      TimeSpan.FromMilliseconds(1),
      application.Resources[FsusThemeResourceKeys.MotionDurationEffective]
    );
  }

  [Fact]
  public void ApplyPrependsApplicationFontsBeforeStableFallbacks()
  {
    var resources = new ResourceDictionary();
    var manager = new FsusThemeManager();

    manager.Apply(
      resources,
      new FsusThemeOptions
      {
        Typography = new FsusTypographyOptions
        {
          ApplicationFontFamilies = ["Acme App Sans"],
          ApplicationMonospaceFontFamilies = ["Acme Mono"],
        },
      }
    );

    var body = Assert.IsType<FontFamily>(
      resources[FsusTokens.TypographyFamilyBodyResourceKey]
    );
    var monospace = Assert.IsType<FontFamily>(
      resources[FsusTokens.TypographyFamilyMonospaceResourceKey]
    );
    var bodyStack = Assert.IsType<string>(
      resources[FsusThemeResourceKeys.BodyFontStack]
    );
    var monospaceStack = Assert.IsType<string>(
      resources[FsusThemeResourceKeys.MonospaceFontStack]
    );
    Assert.StartsWith("Acme App Sans", body.Name);
    Assert.Contains("Noto Sans SC", bodyStack);
    Assert.StartsWith("Acme Mono", monospace.Name);
    Assert.Contains("Consolas", monospaceStack);
  }

  private static void AssertBrush(
    ResourceDictionary resources,
    string key,
    string color
  )
  {
    var brush = Assert.IsType<SolidColorBrush>(resources[key]);
    Assert.Equal(Color.Parse(color), brush.Color);
  }
}
