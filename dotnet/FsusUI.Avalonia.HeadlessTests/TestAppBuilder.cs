using Avalonia;
using Avalonia.Headless;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Skia;
using SkiaSharp;
using Avalonia.Media;
using Avalonia.Media.Fonts;
using System.Globalization;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using Avalonia.Themes.Fluent;

[assembly: AvaloniaTestApplication(typeof(FsusUI.Avalonia.HeadlessTests.TestAppBuilder))]

namespace FsusUI.Avalonia.HeadlessTests;

public static class TestAppBuilder
{
  public static AppBuilder BuildAvaloniaApp() =>
    AppBuilder
      .Configure<HeadlessTestApplication>()
      .UseSkia()
      .UseHeadless(new AvaloniaHeadlessPlatformOptions
      {
        UseHeadlessDrawing = false,
      })
      .WithInterFont()
      .ConfigureFonts(fontManager =>
      {
        if (Environment.GetEnvironmentVariable("FSUS_HEADLESS_GSANS") == "1")
        {
          fontManager.AddFontCollection(new GoogleSansFontCollection().Collection);
        }
      });
}

/// <summary>
/// Loads the bundled Google Sans faces so headless rasterization matches the
/// Web baseline fonts (the demo ships Google Sans as woff2; browsers use it,
/// headless Skia would otherwise fall back to a system face).
/// </summary>
public sealed class GoogleSansFontCollection : IDisposable
{
  private const string FontUriPrefix =
    "avares://FsusUI.Avalonia.HeadlessTests/Assets/Fonts/";

  public Uri Key { get; } = new("fonts:GoogleSansCollection", UriKind.Absolute);

  private EmbeddedFontCollection? collection;

  public IFontCollection Collection =>
    collection ??= new EmbeddedFontCollection(
      new Uri("fonts:GoogleSans?family=Google%20Sans", UriKind.Absolute),
      new Uri(FontUriPrefix, UriKind.Absolute));

  public void Dispose() => (collection as IDisposable)?.Dispose();
}

public sealed class HeadlessTestApplication : Application
{
  public override void Initialize()
  {
    Resources["FsusSpace3"] = new Thickness(12);
    Resources["FsusBorderControlWidth"] = new Thickness(1);
    Resources["FsusRadiusSurfaceMd"] = new CornerRadius(12);
    Styles.Add(new FluentTheme());
    Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/Controls/PerceptionChallenge.axaml"),
    });
  }
}
