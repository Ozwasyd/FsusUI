using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Collections.Generic;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

/// <summary>
/// Cross-platform visual parity evidence for the Vue component families that
/// previously had no Web↔Avalonia comparison. Each case mirrors the Vue demo
/// fixture layout (same padding, gap, copy, and states) so the captured
/// artifact can be compared against the Playwright capture of the same
/// fixture. PNGs land under tests/conformance/visual/artifacts/screenshots/.
/// </summary>
public class FsusVueParityCrossPlatformEvidenceTests
{
  public static TheoryData<string> ParityCases => new()
  {
    "avatar", "check-tag", "checkbox-button", "collapse",
  };

  [AvaloniaTheory]
  [MemberData(nameof(ParityCases))]
  public void VueParityFamiliesRenderToConformanceArtifacts(string componentId)
  {
    var (surface, measure) = componentId switch
    {
      "avatar" => BuildAvatarFixture(),
      "check-tag" => BuildCheckTagFixture(),
      "checkbox-button" => BuildCheckboxButtonFixture(),
      "collapse" => BuildCollapseFixture(),
      _ => throw new InvalidOperationException($"unknown parity case {componentId}"),
    };

    var window = new Window
    {
      Width = measure.Width + 2,
      Height = measure.Height + 2,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachTheme(window, FsusThemeVariant.Light);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    window.Measure(new Size(window.Width, window.Height));
    window.Arrange(new Rect(0, 0, window.Width, window.Height));
    surface.Measure(new Size(measure.Width, measure.Height));
    surface.Arrange(new Rect(0, 0, measure.Width, measure.Height));
    Dispatcher.UIThread.RunJobs();

    var outputRoot = Path.Combine(
      FindRepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "artifacts",
      "screenshots",
      "avalonia");
    Directory.CreateDirectory(outputRoot);
    var outputPath = Path.Combine(outputRoot, $"{componentId}-vue-parity.png");
    var pixelSize = new PixelSize(
      (int)Math.Ceiling(surface.Bounds.Width),
      (int)Math.Ceiling(surface.Bounds.Height));
    Assert.True(pixelSize.Width > 40, $"{componentId} surface must have width");
    Assert.True(pixelSize.Height > 40, $"{componentId} surface must have height");
    using (var bitmap = new RenderTargetBitmap(pixelSize, new Vector(96, 96)))
    {
      bitmap.Render(surface);
      using var stream = File.Create(outputPath);
      bitmap.Save(stream);
    }

    Dispatcher.UIThread.RunJobs();
    var manifest = new
    {
      component = componentId,
      runner = "headless-skia",
      screenshot = outputPath,
      surfaceBounds = new[]
      {
        Math.Round(surface.Bounds.X, 2),
        Math.Round(surface.Bounds.Y, 2),
        Math.Round(surface.Bounds.Width, 2),
        Math.Round(surface.Bounds.Height, 2),
      },
      controlBounds = CollectControlFrames(surface)
        .Select(frame => new
        {
          frame.name,
          x = Math.Round(frame.bounds.X, 2),
          y = Math.Round(frame.bounds.Y, 2),
          width = Math.Round(frame.bounds.Width, 2),
          height = Math.Round(frame.bounds.Height, 2),
        })
        .ToArray(),
    };
    File.WriteAllText(
      Path.Combine(outputRoot, $"{componentId}-vue-parity.manifest.json"),
      System.Text.Json.JsonSerializer.Serialize(manifest, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

    Assert.True(new FileInfo(outputPath).Length > 1_000);
    window.Close();
  }

  private static (Border Surface, Size Measure) BuildAvatarFixture()
  {
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 16,
    };
    row.Children.Add(new FsusAvatar
    {
      Size = 64,
      Shape = FsusAvatarShape.Circle,
      FallbackText = "A",
    });
    row.Children.Add(new FsusAvatar
    {
      Size = 64,
      Shape = FsusAvatarShape.Square,
      FallbackText = "B",
    });
    var surface = Frame(row, horizontal: false);
    return (surface, new Size(200, 112));
  }

  private static (Border Surface, Size Measure) BuildCheckTagFixture()
  {
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 8,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    };
    row.Children.Add(new FsusCheckTag
    {
      Checked = true,
      Content = "Checked tag",
    });
    row.Children.Add(new FsusCheckTag
    {
      Checked = false,
      Content = "Unchecked tag",
    });
    var surface = Frame(row, horizontal: true, width: 320);
    return (surface, new Size(320, 70));
  }

  private static (Border Surface, Size Measure) BuildCheckboxButtonFixture()
  {
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 8,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    };
    row.Children.Add(new FsusCheckboxButton
    {
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      Checked = true,
      Content = "Checked",
    });
    row.Children.Add(new FsusCheckboxButton
    {
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      Checked = false,
      Content = "Unchecked",
    });
    row.Children.Add(new FsusCheckboxButton
    {
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      Checked = false,
      Disabled = true,
      Content = "Disabled",
    });
    var surface = Frame(row, horizontal: false);
    return (surface, new Size(360, 88));
  }

  private static (Border Surface, Size Measure) BuildCollapseFixture()
  {
    var collapse = new FsusCollapse
    {
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      ActiveNames = new object?[] { "options" },
      Content = new StackPanel
      {
        Children =
        {
          new FsusCollapseItem
          {
            Title = "Options",
            ItemKey = "options",
            Content = new TextBlock { Text = "Options content." },
          },
          new FsusCollapseItem
          {
            Title = "Advanced",
            ItemKey = "advanced",
            Content = new TextBlock { Text = "Advanced content." },
          },
          new FsusCollapseItem
          {
            Title = "Disabled",
            ItemKey = "disabled",
            Disabled = true,
            Content = new TextBlock { Text = "Disabled content." },
          },
        },
      },
    };
    var surface = Frame(collapse, horizontal: true, width: 560);
    return (surface, new Size(560, 204));
  }

  private static IEnumerable<(string name, Rect bounds)> CollectControlFrames(Border surface)
  {
    foreach (var control in surface.GetVisualDescendants().OfType<Control>())
    {
      if (control.GetType().Namespace?.StartsWith("FsusUI.Avalonia") == true)
      {
        var transform = control.TransformToVisual(surface);
        var topLeft = transform?.Transform(new Point(0, 0)) ?? control.Bounds.TopLeft;
        yield return (
          control.GetType().Name,
          new Rect(topLeft, control.Bounds.Size));
      }
    }
  }

  private static Border Frame(Control child, bool horizontal, double? width = null) =>
    new()
    {
      Width = width ?? double.NaN,
      Padding = new Thickness(24),
      Background = new SolidColorBrush(Colors.White),
      Child = child,
    };

  private static void AttachTheme(Window window, FsusThemeVariant variant)
  {
    var resources = new ResourceDictionary();
    new FsusThemeManager().Apply(resources, new FsusThemeOptions
    {
      Variant = variant,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.Resources.MergedDictionaries.Add(resources);
    window.Resources.MergedDictionaries.Add(
      new ResourceInclude(new Uri("avares://FsusUI.Avalonia.Themes"))
      {
        Source = new Uri(
          $"avares://FsusUI.Avalonia.Themes/Themes/Fsus{variant}.axaml"),
      });
    window.RequestedThemeVariant = variant == FsusThemeVariant.Dark
      ? ThemeVariant.Dark
      : ThemeVariant.Light;
    window.Styles.Add(
      new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
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
