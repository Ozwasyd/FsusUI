using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusShellActionIconHeadlessTests
{
  private static readonly (string Key, string ResourceKey)[] ShellActionIcons =
  [
    (FsusIconKeys.AddDocument, "FsusIconAddDocument"),
    (FsusIconKeys.ApplicationMenu, "FsusIconApplicationMenu"),
    (FsusIconKeys.Close, "FsusIconClose"),
    (FsusIconKeys.RefreshReplace, "FsusIconRefreshReplace"),
    (FsusIconKeys.SearchFilter, "FsusIconSearchFilter"),
  ];

  [AvaloniaTheory]
  [InlineData(FsusIconKeys.AddDocument, "FsusIconAddDocument")]
  [InlineData(FsusIconKeys.ApplicationMenu, "FsusIconApplicationMenu")]
  [InlineData(FsusIconKeys.Close, "FsusIconClose")]
  [InlineData(FsusIconKeys.RefreshReplace, "FsusIconRefreshReplace")]
  [InlineData(FsusIconKeys.SearchFilter, "FsusIconSearchFilter")]
  public void ShellActionKeysResolveGeneratedGeometry(
    string iconKey,
    string expectedResourceKey)
  {
    Assert.Equal(expectedResourceKey, iconKey);

    var icon = new FsusIcon { IconKey = iconKey };
    icon.Resources.MergedDictionaries.Add(new ResourceInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
    });

    Assert.True(
      icon.TryFindResource(iconKey, out var resource),
      $"{iconKey} must resolve from the generated icon catalog.");
    var geometry = Assert.IsAssignableFrom<StreamGeometry>(resource);
    Assert.True(geometry.Bounds.Width > 0);
    Assert.True(geometry.Bounds.Height > 0);
  }

  [AvaloniaFact]
  public void RenderedShellActionsProduceIssue814ThemeAndSizeEvidence()
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "issue-814-shell-action-icons");
    Directory.CreateDirectory(outputRoot);

    var variants = new[]
    {
      new ShellActionVariant("shell-actions-light-16", FsusThemeVariant.Light, false, 16),
      new ShellActionVariant("shell-actions-dark-16", FsusThemeVariant.Dark, false, 16),
      new ShellActionVariant("shell-actions-high-contrast-16", FsusThemeVariant.Dark, true, 16),
      new ShellActionVariant("shell-actions-light-20", FsusThemeVariant.Light, false, 20),
      new ShellActionVariant("shell-actions-light-24", FsusThemeVariant.Light, false, 24),
    };

    var evidence = new List<ShellActionRenderEvidence>();
    foreach (var variant in variants)
    {
      ApplyTheme(application, variant.Theme, variant.HighContrast);
      evidence.Add(RenderVariant(application, outputRoot, variant));
    }

    Assert.Equal(
      new[]
      {
        "shell-actions-light-16",
        "shell-actions-dark-16",
        "shell-actions-high-contrast-16",
        "shell-actions-light-20",
        "shell-actions-light-24",
      },
      evidence.Select(item => item.Name).ToArray());

    Assert.All(
      evidence,
      item =>
      {
        Assert.True(
          File.Exists(Path.Combine(FindRepositoryRoot(), item.File)),
          $"{item.File} must be written as rendered evidence.");
        Assert.Equal(64, item.Sha256.Length);
        Assert.All(
          item.Icons,
          icon =>
          {
            Assert.True(
              icon.NonBackgroundRatio > 0.005,
              $"{item.Name}/{icon.IconKey} must render visible geometry.");
            Assert.True(
              icon.ForegroundMatchRatio > 0.25,
              $"{item.Name}/{icon.IconKey} must inherit the active foreground color.");
          });
      });

    var manifestPath = Path.Combine(outputRoot, "shell-action-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        evidence,
        new JsonSerializerOptions { WriteIndented = true }));
    Assert.True(File.Exists(manifestPath));
  }

  private static ShellActionRenderEvidence RenderVariant(
    Application application,
    string outputRoot,
    ShellActionVariant variant)
  {
    var expectedForeground = Assert.IsAssignableFrom<ISolidColorBrush>(
      application.Resources[FsusThemeResourceKeys.TextBrush]).Color;

    var row = new StackPanel
    {
      Orientation = Orientation.Horizontal,
      Spacing = 28,
      VerticalAlignment = VerticalAlignment.Center,
      HorizontalAlignment = HorizontalAlignment.Center,
    };
    var icons = ShellActionIcons
      .Select(item => new FsusIcon
      {
        IconKey = item.Key,
        Width = variant.IconSize,
        Height = variant.IconSize,
      })
      .ToList();
    foreach (var icon in icons)
    {
      row.Children.Add(icon);
    }

    var surface = new Border
    {
      Padding = new Thickness(28),
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = row,
    };
    var window = new Window
    {
      Width = 560,
      Height = 180,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachIconSupport(window);
    window.Show();

    using var bitmap = new RenderTargetBitmap(
      new PixelSize(560, 180),
      new Vector(96, 96));
    bitmap.Render(surface);

    var iconEvidence = icons
      .Select(icon =>
      {
        Assert.True(
          icon.TryFindResource(icon.IconKey!, out _),
          $"{icon.IconKey} must resolve from the generated catalog.");
        var evidence = AnalyzeRegion(
          bitmap,
          CaptureBounds(icon, surface),
          expectedForeground);
        return new IconPixelEvidence(
          icon.IconKey!,
          evidence.NonBackgroundRatio,
          evidence.ForegroundMatchRatio);
      })
      .ToList();

    var fileName = $"{variant.Name}.png";
    var filePath = Path.Combine(outputRoot, fileName);
    using (var stream = File.Create(filePath))
    {
      bitmap.Save(stream);
    }

    window.Close();

    var repositoryRoot = FindRepositoryRoot();
    return new ShellActionRenderEvidence(
      variant.Name,
      Path.GetRelativePath(repositoryRoot, filePath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(filePath))),
      bitmap.PixelSize.Width,
      bitmap.PixelSize.Height,
      variant.IconSize,
      variant.HighContrast,
      iconEvidence);
  }

  private static Rect CaptureBounds(Control control, Visual relativeTo)
  {
    var origin = control.TranslatePoint(new Point(0, 0), relativeTo) ?? default;
    return new Rect(origin, new Size(control.Bounds.Width, control.Bounds.Height));
  }

  private static RegionPixelEvidence AnalyzeRegion(
    Bitmap bitmap,
    Rect bounds,
    Color expectedForeground)
  {
    using var buffer = new WriteableBitmap(
      bitmap.PixelSize,
      new Vector(96, 96),
      global::Avalonia.Platform.PixelFormat.Bgra8888,
      global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = buffer.Lock();
    bitmap.CopyPixels(framebuffer);
    var pixels = new byte[framebuffer.RowBytes * bitmap.PixelSize.Height];
    Marshal.Copy(framebuffer.Address, pixels, 0, pixels.Length);
    var background = new[] { pixels[0], pixels[1], pixels[2] };

    var minX = Math.Max(0, (int)Math.Floor(bounds.X));
    var minY = Math.Max(0, (int)Math.Floor(bounds.Y));
    var maxX = Math.Min(bitmap.PixelSize.Width - 1, (int)Math.Ceiling(bounds.Right));
    var maxY = Math.Min(bitmap.PixelSize.Height - 1, (int)Math.Ceiling(bounds.Bottom));

    var total = 0L;
    var nonBackground = 0L;
    var foregroundMatch = 0L;
    for (var y = minY; y <= maxY; y++)
      for (var x = minX; x <= maxX; x++)
      {
        var offset = y * framebuffer.RowBytes + x * 4;
        total++;
        var isNonBackground = Math.Abs(pixels[offset] - background[0]) +
          Math.Abs(pixels[offset + 1] - background[1]) +
          Math.Abs(pixels[offset + 2] - background[2]) > 24;
        if (!isNonBackground)
        {
          continue;
        }

        nonBackground++;
        if (Math.Abs(pixels[offset + 2] - expectedForeground.R) <= 32 &&
          Math.Abs(pixels[offset + 1] - expectedForeground.G) <= 32 &&
          Math.Abs(pixels[offset] - expectedForeground.B) <= 32)
        {
          foregroundMatch++;
        }
      }

    return new RegionPixelEvidence(
      total == 0 ? 0 : Math.Round(nonBackground / (double)total, 6),
      nonBackground == 0 ? 0 : Math.Round(foregroundMatch / (double)nonBackground, 6));
  }

  private static void ApplyTheme(
    Application application,
    FsusThemeVariant variant,
    bool highContrast)
  {
    new FsusThemeManager().Apply(
      application,
      new FsusThemeOptions
      {
        Variant = variant,
        HighContrast = highContrast,
        Density = FsusDensity.Default,
        MotionMode = FsusMotionMode.Reduced,
      });
  }

  private static void AttachIconSupport(Window window)
  {
    window.Resources.MergedDictionaries.Add(new ResourceInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml"),
    });
    window.Resources.MergedDictionaries.Add(new ResourceInclude(
      new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml"),
    });
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/Controls/IconText.axaml"),
    });
  }

  private static string FindRepositoryRoot()
  {
    for (
      var directory = new DirectoryInfo(AppContext.BaseDirectory);
      directory is not null;
      directory = directory.Parent)
    {
      if (File.Exists(Path.Combine(directory.FullName, "pnpm-workspace.yaml")))
      {
        return directory.FullName;
      }
    }

    throw new DirectoryNotFoundException("Could not locate the FsusUI repository root.");
  }

  private sealed record ShellActionVariant(
    string Name,
    FsusThemeVariant Theme,
    bool HighContrast,
    double IconSize);

  private sealed record RegionPixelEvidence(
    double NonBackgroundRatio,
    double ForegroundMatchRatio);

  private sealed record IconPixelEvidence(
    string IconKey,
    double NonBackgroundRatio,
    double ForegroundMatchRatio);

  private sealed record ShellActionRenderEvidence(
    string Name,
    string File,
    string Sha256,
    int PixelWidth,
    int PixelHeight,
    double IconSize,
    bool HighContrast,
    List<IconPixelEvidence> Icons);
}
