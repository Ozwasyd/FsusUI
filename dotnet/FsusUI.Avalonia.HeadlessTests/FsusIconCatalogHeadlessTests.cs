using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Icons;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusIconCatalogHeadlessTests
{
  private const double IconSizeDefault = 16;

  private static readonly string[] CatalogIconKeys =
  [
    FsusIconKeys.Folder,
    FsusIconKeys.Outline,
    FsusIconKeys.SaveAll,
    FsusIconKeys.CloseAll,
  ];

  private static readonly string[] FileTypeSampleNames =
  [
    "README.md",
    "notes.txt",
    "Program.cs",
    "data.csv",
    "photo.jpeg",
    "archive.tar.gz",
    "report.pdf",
  ];

  [AvaloniaTheory]
  [InlineData(FsusIconKeys.Folder, "FsusIconFolder")]
  [InlineData(FsusIconKeys.Outline, "FsusIconOutline")]
  [InlineData(FsusIconKeys.SaveAll, "FsusIconSaveAll")]
  [InlineData(FsusIconKeys.CloseAll, "FsusIconCloseAll")]
  public void GeneratedCatalogKeysResolveStreamGeometry(
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
  public void IconAccessibilityFollowsSearchAndSettingsContract()
  {
    var window = new Window { Width = 320, Height = 200 };
    var decorativeIcon = new FsusIcon { IconKey = FsusIconKeys.Folder };
    var namedIcon = new FsusIcon
    {
      IconKey = FsusIconKeys.Outline,
      IsDecorative = false,
      AccessibleName = "Document outline",
    };
    var unnamedIcon = new FsusIcon
    {
      IconKey = FsusIconKeys.Outline,
      IsDecorative = false,
    };
    var namedButton = new FsusIconButton
    {
      AccessibleName = "Files",
      Content = new FsusIcon { IconKey = FsusIconKeys.Folder },
    };
    var decorativeButton = new FsusIconButton
    {
      IsDecorativeIcon = true,
      Content = new FsusIcon { IconKey = FsusIconKeys.Outline },
    };
    var disabledButton = new FsusIconButton
    {
      AccessibleName = "Close all documents",
      IsEnabled = false,
      Content = new FsusIcon { IconKey = FsusIconKeys.Outline },
    };

    window.Content = new StackPanel
    {
      Children = { decorativeIcon, namedIcon, unnamedIcon, namedButton, decorativeButton, disabledButton },
    };
    window.Show();

    Assert.True(decorativeIcon.IsDecorative);
    Assert.True(string.IsNullOrEmpty(AutomationProperties.GetName(decorativeIcon)));
    Assert.Equal("Document outline", AutomationProperties.GetName(namedIcon));
    Assert.Equal("Files", AutomationProperties.GetName(namedButton));
    Assert.Equal(
      "Close all documents",
      AutomationProperties.GetName(disabledButton));

    namedIcon.ValidateAccessibility();
    namedButton.ValidateAccessibility();
    decorativeButton.ValidateAccessibility();
    disabledButton.ValidateAccessibility();
    Assert.Throws<InvalidOperationException>(unnamedIcon.ValidateAccessibility);

    window.Close();
  }

  [AvaloniaFact]
  public void RenderedCatalogProducesLightDarkHighContrastAndZoomEvidence()
  {
    var application = Assert.IsType<HeadlessTestApplication>(Application.Current);
    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "screenshots",
      "avalonia");
    Directory.CreateDirectory(outputRoot);

    var variants = new[]
    {
      new CatalogVariant("icon-catalog-light", FsusThemeVariant.Light, false, IconSizeDefault),
      new CatalogVariant("icon-catalog-dark", FsusThemeVariant.Dark, false, IconSizeDefault),
      new CatalogVariant(
        "icon-catalog-high-contrast",
        FsusThemeVariant.Dark,
        true,
        IconSizeDefault),
      new CatalogVariant(
        "icon-catalog-zoom-200",
        FsusThemeVariant.Light,
        false,
        IconSizeDefault * 2),
    };

    var evidence = new List<CatalogRenderEvidence>();
    foreach (var variant in variants)
    {
      ApplyTheme(application, variant.Variant, variant.HighContrast);
      evidence.Add(RenderCatalogVariant(application, outputRoot, variant));
    }

    Assert.Equal(
      new[] { "icon-catalog-light", "icon-catalog-dark", "icon-catalog-high-contrast", "icon-catalog-zoom-200" },
      evidence.Select(item => item.Name).ToArray());
    Assert.All(
      evidence,
      item =>
      {
        Assert.True(
          File.Exists(Path.Combine(FindRepositoryRoot(), item.File)),
          $"{item.File} must be written as rendered evidence.");
        Assert.Equal(64, item.Sha256.Length);
        Assert.True(item.PixelWidth > 0);
        Assert.True(item.PixelHeight > 0);
        Assert.All(
          item.Icons,
          icon =>
          {
            Assert.True(
              icon.NonBackgroundRatio > 0.005,
              $"{item.Name}/{icon.IconKey} must render visible geometry.");
            if (icon.ExpectsForegroundMatch)
            {
              Assert.True(
                icon.ForegroundMatchRatio > 0.25,
                $"{item.Name}/{icon.IconKey} must inherit the active foreground color.");
            }
          });
      });

    var manifestPath = Path.Combine(outputRoot, "icon-catalog-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(evidence, new JsonSerializerOptions { WriteIndented = true }));
    Assert.True(File.Exists(manifestPath));
  }

  private static CatalogRenderEvidence RenderCatalogVariant(
    Application application,
    string outputRoot,
    CatalogVariant variant)
  {
    var expectedForeground = Assert.IsAssignableFrom<ISolidColorBrush>(
      application.Resources[FsusThemeResourceKeys.TextBrush]).Color;

    var iconSize = variant.IconSize;
    var catalogRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 24 };
    var fileRow = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 24 };
    var panel = new StackPanel
    {
      Spacing = 20,
      VerticalAlignment = VerticalAlignment.Center,
      HorizontalAlignment = HorizontalAlignment.Center,
      Children =
      {
        catalogRow,
        fileRow,
      },
    };
    var catalogIcons = CatalogIconKeys
      .Select(key => new FsusIcon { IconKey = key, Width = iconSize, Height = iconSize })
      .ToList();
    var fileTypeIcons = FileTypeSampleNames
      .Select(name => new FsusIcon
      {
        IconKey = FsusFileTypeIcon.Resolve(name),
        Width = iconSize,
        Height = iconSize,
      })
      .ToList();
    var disabledIcon = new FsusIcon
    {
      IconKey = CatalogIconKeys[0],
      Width = iconSize,
      Height = iconSize,
      IsEnabled = false,
    };
    var button = new FsusIconButton
    {
      AccessibleName = "Files",
      Content = new FsusIcon { IconKey = CatalogIconKeys[0] },
      VerticalAlignment = VerticalAlignment.Center,
    };

    foreach (var icon in catalogIcons)
    {
      catalogRow.Children.Add(icon);
    }

    foreach (var icon in fileTypeIcons)
    {
      fileRow.Children.Add(icon);
    }

    catalogRow.Children.Add(disabledIcon);
    catalogRow.Children.Add(button);

    var surface = new Border
    {
      Padding = new Thickness(24),
      Background = Assert.IsAssignableFrom<IBrush>(
        application.Resources[FsusThemeResourceKeys.BackgroundBrush]),
      Child = panel,
    };
    var window = new Window
    {
      Width = 440,
      Height = 240,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachCatalogSupport(window);
    window.Show();

    using var bitmap = new RenderTargetBitmap(
      new PixelSize(440, 240),
      new Vector(96, 96));
    bitmap.Render(surface);

    var renderedIcons = catalogIcons
      .Select(icon => new
      {
        Evidence = AnalyzeRegion(
          bitmap,
          CaptureBounds(icon, surface),
          expectedForeground,
          expectsForegroundMatch: true),
        icon.IconKey,
      })
      .ToList();
    var renderedFileTypes = fileTypeIcons
      .Select(icon => new
      {
        Evidence = AnalyzeRegion(
          bitmap,
          CaptureBounds(icon, surface),
          expectedForeground,
          expectsForegroundMatch: true),
        icon.IconKey,
      })
      .ToList();
    Assert.All(
      fileTypeIcons,
      icon => Assert.True(
        icon.TryFindResource(icon.IconKey!, out _),
        $"{icon.IconKey} must resolve from the generated catalog."));
    var disabledEvidence = AnalyzeRegion(
      bitmap,
      CaptureBounds(disabledIcon, surface),
      expectedForeground,
      expectsForegroundMatch: false);
    var buttonIcon = Assert.IsType<FsusIcon>(button.Content);
    var buttonEvidence = AnalyzeRegion(
      bitmap,
      CaptureBounds(buttonIcon, surface),
      expectedForeground,
      expectsForegroundMatch: true);

    var fileName = $"{variant.Name}.png";
    var filePath = Path.Combine(outputRoot, fileName);
    var pixelSize = bitmap.PixelSize;
    using (var stream = File.Create(filePath))
    {
      bitmap.Save(stream);
    }

    window.Close();

    var repositoryRoot = FindRepositoryRoot();
    var icons = renderedIcons
      .Select(item => new IconPixelEvidence(
        item.IconKey!,
        item.Evidence.NonBackgroundRatio,
        item.Evidence.ForegroundMatchRatio,
        item.Evidence.ExpectsForegroundMatch))
      .ToList();
    icons.Add(new IconPixelEvidence(
      $"{CatalogIconKeys[0]}-disabled",
      disabledEvidence.NonBackgroundRatio,
      disabledEvidence.ForegroundMatchRatio,
      disabledEvidence.ExpectsForegroundMatch));
    icons.Add(new IconPixelEvidence(
      $"{CatalogIconKeys[0]}-icon-button",
      buttonEvidence.NonBackgroundRatio,
      buttonEvidence.ForegroundMatchRatio,
      buttonEvidence.ExpectsForegroundMatch));
    icons.AddRange(renderedFileTypes.Select(item => new IconPixelEvidence(
      item.IconKey!,
      item.Evidence.NonBackgroundRatio,
      item.Evidence.ForegroundMatchRatio,
      item.Evidence.ExpectsForegroundMatch)));

    return new CatalogRenderEvidence(
      variant.Name,
      Path.GetRelativePath(repositoryRoot, filePath).Replace('\\', '/'),
      Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(filePath))),
      pixelSize.Width,
      pixelSize.Height,
      iconSize,
      variant.HighContrast,
      icons);
  }

  private static Rect CaptureBounds(Control control, Visual relativeTo)
  {
    var origin = control.TranslatePoint(new Point(0, 0), relativeTo) ?? default;
    return new Rect(origin, new Size(control.Bounds.Width, control.Bounds.Height));
  }

  private static RegionPixelEvidence AnalyzeRegion(
    Bitmap bitmap,
    Rect bounds,
    Color expectedForeground,
    bool expectsForegroundMatch)
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
      nonBackground == 0 ? 0 : Math.Round(foregroundMatch / (double)nonBackground, 6),
      expectsForegroundMatch);
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

  private static void AttachCatalogSupport(Window window)
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

  private sealed record CatalogVariant(
    string Name,
    FsusThemeVariant Variant,
    bool HighContrast,
    double IconSize);

  private sealed record RegionPixelEvidence(
    double NonBackgroundRatio,
    double ForegroundMatchRatio,
    bool ExpectsForegroundMatch);

  private sealed record IconPixelEvidence(
    string IconKey,
    double NonBackgroundRatio,
    double ForegroundMatchRatio,
    bool ExpectsForegroundMatch);

  private sealed record CatalogRenderEvidence(
    string Name,
    string File,
    string Sha256,
    int PixelWidth,
    int PixelHeight,
    double IconSize,
    bool HighContrast,
    List<IconPixelEvidence> Icons);
}
