using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.TextFormatting;
using SkiaSharp;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusBundledInterFontRegistrationRegressionTests
{
  public static bool IsLinux => OperatingSystem.IsLinux();

  [AvaloniaFact]
  public void DeclaredBodyStackResolvesTheRegisteredBundledFamily()
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions());
    var family = Assert.IsType<FontFamily>(resources["FsusTypographyFamilyBody"]);
    var expected = Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS") == "1"
      ? "Google Sans 18pt"
      : "Inter";
    var typeface = new Typeface(family);
    Assert.Equal(expected, typeface.GlyphTypeface.FamilyName);
    Assert.Equal("Inter", new Typeface("Inter").GlyphTypeface.FamilyName);
    if (Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS") == "1")
    {
      Assert.Equal(expected, new Typeface("Google Sans").GlyphTypeface.FamilyName);
    }

    using var layout = new TextLayout("Open commands", typeface, 14);
    Assert.True(layout.Width > 0);
    Assert.True(layout.Height > 0);
  }

  [AvaloniaTheory(Skip = "Linux native monospace aliases", SkipUnless = nameof(IsLinux))]
  [InlineData("monospace")]
  [InlineData("ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace")]
  public void LinuxMonospaceAliasesResolveTheNativeFixedPitchFamilyAndLayout(string family)
  {
    using var native = SKFontManager.Default.MatchFamily("monospace");
    Assert.NotNull(native);
    Assert.True(native.IsFixedPitch);

    var typeface = new Typeface(family);
    Assert.Equal(native.FamilyName, typeface.GlyphTypeface.FamilyName);
    using var layout = new TextLayout("code = 123;", typeface, 14);
    Assert.True(layout.Width > 0);
    Assert.True(layout.Height > 0);
  }

  [AvaloniaFact(Skip = "Linux declared monospace stack", SkipUnless = nameof(IsLinux))]
  public void DeclaredMonospaceStackRetainsItsAvailableNamedFamily()
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions());
    var family = Assert.IsType<FontFamily>(resources["FsusTypographyFamilyMonospace"]);
    using var native = SKFontManager.Default.MatchFamily("Liberation Mono");
    Assert.NotNull(native);
    Assert.True(native.IsFixedPitch);
    Assert.Equal(native.FamilyName, new Typeface(family).GlyphTypeface.FamilyName);
  }

  [AvaloniaFact]
  public void BundledInterResolvesGlyphsAndLaysOutTextInAFluentWindow()
  {
    var family = new FontFamily("fonts:Inter#Inter");
    var typeface = new Typeface(family);
    Assert.Equal("Inter", typeface.GlyphTypeface.FamilyName);

    using var layout = new TextLayout("Open commands", typeface, 14);
    Assert.True(layout.Width > 0);
    Assert.True(layout.Height > 0);

    var text = new TextBlock
    {
      Text = "Open commands",
      FontFamily = family,
    };
    var button = new Button { Content = "Open commands" };
    var window = new Window
    {
      Width = 400,
      Height = 200,
      ShowInTaskbar = false,
      Content = new StackPanel { Children = { text, button } },
    };

    try
    {
      window.Show();
      Assert.True(text.Bounds.Width > 0);
      Assert.True(text.Bounds.Height > 0);
      Assert.True(button.IsMeasureValid);
      Assert.True(button.IsArrangeValid);
    }
    finally
    {
      window.Close();
    }
  }
}
