using Avalonia;
using Avalonia.Headless;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Skia;
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
      });
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
