using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using FsusUI.Avalonia.Demo;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusThemeManagerHeadlessTests
{
  [Fact]
  public void LiveResourceConsumerFollowsVariantPaletteSwitch()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var consumer = new Border();
    consumer.Bind(
      Border.BorderBrushProperty,
      application.Resources.GetResourceObservable(
        FsusTokens.ColorActionPrimaryBrushResourceKey
      )
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Light }
    );
    Assert.Equal(
      Color.Parse("#2A599C"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Dark }
    );
    Assert.Equal(
      Color.Parse("#4B79CC"),
      Assert.IsType<SolidColorBrush>(consumer.BorderBrush).Color
    );
  }

  [Fact]
  public void LiveResourceConsumersFollowPaletteOverridesAndFallbackRestoration()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var background = BindBrush(application, FsusThemeResourceKeys.BackgroundBrush);
    var surface = BindBrush(application, FsusThemeResourceKeys.SurfaceBrush);
    var text = BindBrush(application, FsusThemeResourceKeys.TextBrush);
    var icon = BindBrush(application, FsusThemeResourceKeys.IconBrush);

    manager.Apply(
      application,
      FsusThemeOptions.Default with
      {
        Variant = FsusThemeVariant.Dark,
        Palette = new FsusThemePaletteOptions
        {
          Background = Color.Parse("#102030"),
          Text = Color.Parse("#F0E0D0"),
          Icon = Color.Parse("#ABCDEF"),
        },
      }
    );

    AssertBrush(background, "#102030");
    AssertBrush(surface, "#171F2C");
    AssertBrush(text, "#F0E0D0");
    AssertBrush(icon, "#ABCDEF");

    manager.Apply(
      application,
      FsusThemeOptions.Default with { Variant = FsusThemeVariant.Light }
    );

    AssertBrush(background, "#FFFFFF");
    AssertBrush(surface, "#FFFFFF");
    AssertBrush(text, "#111827");
    AssertBrush(icon, "#111827");
  }

  [AvaloniaFact]
  public void RealHeadlessSkiaRendersPaletteFallbackMatrix()
  {
    var application = new App();
    var manager = new FsusThemeManager();
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests/conformance/visual/artifacts/screenshots/avalonia");
    Directory.CreateDirectory(outputRoot);

    var cases = new[]
    {
      ("light", FsusThemeOptions.Default),
      ("dark", FsusThemeOptions.Default with { Variant = FsusThemeVariant.Dark }),
      ("custom", FsusThemeOptions.Default with
      {
        Palette = new FsusThemePaletteOptions
        {
          Background = Color.Parse("#FFF4D6"),
          Surface = Color.Parse("#E0F2FE"),
          SurfaceRaised = Color.Parse("#DCFCE7"),
          Text = Color.Parse("#312E81"),
          MutedText = Color.Parse("#6D28D9"),
          Border = Color.Parse("#BE123C"),
          Icon = Color.Parse("#0369A1"),
        },
      }),
      ("partial-dark", FsusThemeOptions.Default with
      {
        Variant = FsusThemeVariant.Dark,
        Palette = new FsusThemePaletteOptions
        {
          Surface = Color.Parse("#14342B"),
          Icon = Color.Parse("#FBBF24"),
        },
      }),
      ("highcontrast", FsusThemeOptions.Default with { HighContrast = true }),
    };

    foreach (var (name, options) in cases)
    {
      manager.Apply(application, options);
      RenderPalette(application, Path.Combine(outputRoot, $"issue-708-theme-{name}.png"));
    }
  }

  private static void RenderPalette(App application, string output)
  {
    var window = new Window { Width = 640, Height = 360 };
    var root = BindBrush(application, FsusThemeResourceKeys.BackgroundBrush);
    root.Width = 640;
    root.Height = 360;
    root.Padding = new Thickness(32);

    var surface = BindBrush(application, FsusThemeResourceKeys.SurfaceBrush);
    surface.Padding = new Thickness(24);
    surface.BorderThickness = new Thickness(4);
    surface.Bind(
      Border.BorderBrushProperty,
      application.Resources.GetResourceObservable(FsusThemeResourceKeys.BorderBrush));
    var raised = BindBrush(application, FsusThemeResourceKeys.SurfaceRaisedBrush);
    raised.Padding = new Thickness(24);
    var text = new TextBlock { Text = "Theme palette text and icon resource", FontSize = 20 };
    text.Bind(
      TextBlock.ForegroundProperty,
      application.Resources.GetResourceObservable(FsusThemeResourceKeys.TextBrush));
    var muted = new TextBlock { Text = "Muted text keeps its independent semantic role", FontSize = 15 };
    muted.Bind(
      TextBlock.ForegroundProperty,
      application.Resources.GetResourceObservable(FsusThemeResourceKeys.MutedTextBrush));
    var icon = new Border { Width = 48, Height = 48, CornerRadius = new CornerRadius(24) };
    icon.Bind(
      Border.BackgroundProperty,
      application.Resources.GetResourceObservable(FsusThemeResourceKeys.IconBrush));
    raised.Child = new StackPanel { Spacing = 16, Children = { text, muted, icon } };
    surface.Child = raised;
    root.Child = surface;
    window.Content = root;
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(640, 360));
    window.Arrange(new Rect(0, 0, 640, 360));

    using var bitmap = new RenderTargetBitmap(new PixelSize(640, 360), new Vector(96, 96));
    bitmap.Render(root);
    using (var stream = File.Create(output))
    {
      bitmap.Save(stream);
    }
    window.Close();
  }

  private static string FindRepositoryRoot()
  {
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "pnpm-workspace.yaml")))
    {
      current = current.Parent;
    }
    return current?.FullName ?? throw new InvalidOperationException("Repository root not found.");
  }

  private static Border BindBrush(App application, string resourceKey)
  {
    var consumer = new Border();
    consumer.Bind(
      Border.BackgroundProperty,
      application.Resources.GetResourceObservable(resourceKey)
    );
    return consumer;
  }

  private static void AssertBrush(Border consumer, string color)
  {
    Assert.Equal(
      Color.Parse(color),
      Assert.IsType<SolidColorBrush>(consumer.Background).Color
    );
  }
}
