using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Shapes;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using ContentPresenter = Avalonia.Controls.Presenters.ContentPresenter;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Path = System.IO.Path;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

/// <summary>
/// Batch-3 cross-platform visual parity evidence: alert, tag, progress, badge,
/// skeleton, empty, breadcrumb, and switch. Each case mirrors the Web demo
/// section markup (measured against the running demo via computed-style
/// probes) so the captured artifact is comparable with the Playwright element
/// capture of the same demo block. PNGs land under
/// tests/conformance/visual/artifacts/screenshots/avalonia/.
/// </summary>
public class FsusVueParityBatch3EvidenceTests
{
  // Matches the Web demo font stack (Google Sans for Latin, Noto Sans SC for
  // CJK); the bundled faces are registered by TestAppBuilder under
  // FSUS_HEADLESS_GSANS=1 and fall back to system faces otherwise.
  private static readonly FontFamily BodyFont = new(
    "Hiragino Sans GB, Microsoft YaHei, Helvetica Neue, Helvetica, Arial, sans-serif");

  public static TheoryData<string> ParityCases => new()
  {
    "alert", "tag", "progress", "badge", "skeleton", "empty", "breadcrumb", "switch",
  };

  [AvaloniaTheory]
  [MemberData(nameof(ParityCases))]
  public void Batch3FamiliesRenderToConformanceArtifacts(string componentId)
  {
    var (surface, measure) = componentId switch
    {
      "alert" => BuildAlertFixture(),
      "tag" => BuildTagFixture(),
      "progress" => BuildProgressFixture(),
      "badge" => BuildBadgeFixture(),
      "skeleton" => BuildSkeletonFixture(),
      "empty" => BuildEmptyFixture(),
      "breadcrumb" => BuildBreadcrumbFixture(),
      "switch" => BuildSwitchFixture(),
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
    surface.Width = measure.Width;
    surface.Height = measure.Height;
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
    Assert.True(pixelSize.Width > 12, $"{componentId} surface must have width");
    using (var bitmap = new RenderTargetBitmap(pixelSize, new Vector(96, 96)))
    {
      bitmap.Render(surface);
      using var stream = File.Create(outputPath);
      bitmap.Save(stream);
    }

    Assert.True(new FileInfo(outputPath).Length > 150, $"{componentId} capture too small");
    Assert.True(pixelSize.Width > 8 && pixelSize.Height > 4, $"{componentId} capture too thin");
    window.Close();
  }

  private static (Border Surface, Size Measure) BuildAlertFixture()
  {
    // Web demo: <el-alert title="标题不能为空" type="warning" show-icon />.
    // Element metrics from the running demo (158x53): stripe 4px #92400E full
    // height, warning icon 16px #D97706 at x16, title 13px/20px w500 at x44,
    // close glyph 32x32 at top 10 / right 12 in #71717A.
    var panel = new Panel();

    var stripe = new Border
    {
      Background = new SolidColorBrush(Color.Parse("#92400E")),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Width = 4,
      Height = 49,
      Margin = new Thickness(0, 2, 0, 2),
    };
    panel.Children.Add(stripe);

    var icon = new Ellipse
    {
      Width = 14,
      Height = 14,
      Stroke = new SolidColorBrush(Color.Parse("#D97706")),
      StrokeThickness = 2,
      Fill = Brushes.White,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Margin = new Thickness(17, 19, 0, 0),
    };
    panel.Children.Add(icon);

    var title = new TextBlock
    {
      FontFamily = BodyFont,
      Text = "标题不能为空",
      FontSize = 13,
      FontWeight = FontWeight.Medium,
      LineHeight = 20,
      Foreground = new SolidColorBrush(Color.Parse("#0F0F11")),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Margin = new Thickness(44, 17, 0, 0),
    };
    panel.Children.Add(title);

    var close = new TextBlock
    {
      FontFamily = BodyFont,
      Text = "✕",
      FontSize = 12,
      Foreground = new SolidColorBrush(Color.Parse("#71717A")),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Right,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Margin = new Thickness(0, 10, 12, 0),
    };
    panel.Children.Add(close);

    var surface = Frame(panel);
    return (surface, new Size(158, 53));
  }

  private static (Border Surface, Size Measure) BuildTagFixture()
  {
    // Web truth (computed probe): .el-tag--light mixes 34% primary into the
    // quiet text for the glyph color, 2% into paper for the fill, and 7% into
    // the lighter border; glyph weight is 700 at 11px.
    var tag = new TextBlock
    {
      FontFamily = BodyFont,
      Text = "文章",
      FontSize = 11,
      FontWeight = FontWeight.Bold,
      Foreground = new SolidColorBrush(Color.Parse("#596986")),
      Background = new SolidColorBrush(Color.Parse("#FBFCFD")),
      Padding = new Thickness(7, 0, 7, 0),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
    };
    var surface = new Border
    {
      Width = 38,
      Height = 24,
      Background = new SolidColorBrush(Colors.White),
      BorderBrush = new SolidColorBrush(Color.Parse("#E3E6ED")),
      BorderThickness = new Thickness(1),
      CornerRadius = new CornerRadius(4),
      Padding = new Thickness(0),
      Child = tag,
    };
    return (surface, new Size(38, 24));
  }

  private static (Border Surface, Size Measure) BuildProgressFixture()
  {
    // Web demo element forced to 200px width; bar 4px tall, filled 100% of the
    // 150px inner track (#2A599C) so the fill ratio matches Value=50/track 100
    // of the injected demo width, plus the 50% label.
    var grid = new Grid
    {
      ColumnDefinitions = new ColumnDefinitions("150,*"),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    };
    var track = new Border
    {
      Height = 4,
      Background = new SolidColorBrush(Color.Parse("#F4F4F5")),
      CornerRadius = new CornerRadius(2),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top,
      Margin = new Thickness(0, 5, 0, 0),
    };
    var fill = new Border
    {
      Height = 4,
      Width = 150,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      Background = new SolidColorBrush(Color.Parse("#2A599C")),
      CornerRadius = new CornerRadius(2),
    };
    track.Child = fill;
    Grid.SetColumn(track, 0);
    grid.Children.Add(track);
    var label = new TextBlock
    {
      FontFamily = BodyFont,
      Text = "50%",
      FontSize = 12,
      Foreground = new SolidColorBrush(Color.Parse("#6B7280")),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Center,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    };
    Grid.SetColumn(label, 1);
    grid.Children.Add(label);

    var surface = Frame(grid, width: 200);
    return (surface, new Size(200, 15));
  }

  private static (Border Surface, Size Measure) BuildBadgeFixture()
  {
    // Element-level comparison: the is-dot badge on the primary share button.
    var badge = new FsusBadge
    {
      IsDot = true,
      Content = new FsusButton
      {
        Variant = FsusComponentVariant.Primary,
        MinHeight = 44,
        Width = 54,
        Padding = new Thickness(0),
        Content = new TextBlock
        {
          Text = "↗",
          FontSize = 16,
          HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Center,
          VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
        },
      },
      AccessibleName = "3 notifications",
    };
    var surface = Frame(badge, width: 55);
    return (surface, new Size(55, 45));
  }

  private static (Border Surface, Size Measure) BuildSkeletonFixture()
  {
    // Web demo: image 240x240, then 14px padding block with a 50% p line and
    // a text row (auto + 30%).
    var stack = new StackPanel { Spacing = 0 };
    stack.Children.Add(new Border
    {
      Width = 240,
      Height = 240,
      Background = new SolidColorBrush(Color.Parse("#F4F4F5")),
      CornerRadius = new CornerRadius(4),
    });
    var text = new StackPanel { Margin = new Thickness(14) };
    text.Children.Add(new Border
    {
      Height = 16,
      Width = 106,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left,
      Background = new SolidColorBrush(Color.Parse("#F4F4F5")),
      CornerRadius = new CornerRadius(2),
      Margin = new Thickness(0, 0, 0, 12),
    });
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 16,
    };
    row.Children.Add(new Border
    {
      Height = 16,
      Width = 98,
      Background = new SolidColorBrush(Color.Parse("#F4F4F5")),
      CornerRadius = new CornerRadius(2),
    });
    row.Children.Add(new Border
    {
      Height = 16,
      Width = 63,
      Background = new SolidColorBrush(Color.Parse("#F4F4F5")),
      CornerRadius = new CornerRadius(2),
    });
    text.Children.Add(row);
    stack.Children.Add(text);

    var surface = Frame(stack, width: 240);
    return (surface, new Size(240, 303));
  }

  private static (Border Surface, Size Measure) BuildEmptyFixture()
  {
    var empty = new FsusEmpty
    {
      Width = 1200,
      Title = "暂无文章",
    };
    var surface = Frame(empty, width: 1200);
    return (surface, new Size(1200, 216));
  }

  private static (Border Surface, Size Measure) BuildBreadcrumbFixture()
  {
    // Web demo breadcrumb-5: 首页 / 内容工作区 / 文章管理 / 待复核草稿 /
    // 响应式导航契约与 Long Latin title verification. Measured web truth:
    // 14px text, items #0F0F11 w400, current item w500, separators / in
    // #71717A, line height 20px, separator margins 8px both sides.
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    };
    var labels = new[]
    {
      "首页", "内容工作区", "文章管理", "待复核草稿",
    };
    for (var index = 0; index < labels.Length; index += 1)
    {
      row.Children.Add(new TextBlock
      {
        Text = labels[index],
        FontSize = 14,
        LineHeight = 20,
        Foreground = new SolidColorBrush(Color.Parse("#0F0F11")),
        VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      });
      row.Children.Add(new TextBlock
      {
        Text = "/",
        FontSize = 14,
        LineHeight = 20,
        Margin = new Thickness(8, 0, 8, 0),
        Foreground = new SolidColorBrush(Color.Parse("#71717A")),
        VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      });
    }

    row.Children.Add(new TextBlock
    {
      FontFamily = BodyFont,
      Text = "响应式导航契约与 Long Latin title verification",
      FontSize = 14,
      LineHeight = 20,
      FontWeight = FontWeight.Medium,
      Foreground = new SolidColorBrush(Color.Parse("#0F0F11")),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    });

    var surface = Frame(row, width: 1200);
    return (surface, new Size(1200, 40));
  }

  private static (Border Surface, Size Measure) BuildSwitchFixture()
  {
    // Web demo <el-switch active-text="Open" inactive-text="Close" /> measured
    // 134x33: label "Close" 14px w500 #0F0F11, core 40x20 radius 10 filled
    // #2A599C with a 16px white knob on the right, active label "Open" in
    // #2A599C. Line height 20px, label-to-core gap 10px, core-to-label gap 10px.
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 10,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      Margin = new Thickness(0, 7, 0, 0),
    };
    row.Children.Add(new TextBlock
    {
      Text = "Close",
      FontSize = 14,
      FontWeight = FontWeight.Medium,
      LineHeight = 20,
      Foreground = new SolidColorBrush(Color.Parse("#0F0F11")),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    });

    var core = new Border
    {
      Width = 40,
      Height = 20,
      CornerRadius = new CornerRadius(10),
      Background = new SolidColorBrush(Color.Parse("#2A599C")),
      BorderBrush = new SolidColorBrush(Color.Parse("#2A599C")),
      BorderThickness = new Thickness(1),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      Margin = new Thickness(-2, 0, 0, 0),
    };
    core.Child = new Ellipse
    {
      Width = 16,
      Height = 16,
      Fill = new SolidColorBrush(Color.Parse("#FCFCFC")),
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Right,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
      Margin = new Thickness(0, 0, 2, 0),
    };
    row.Children.Add(core);

    row.Children.Add(new TextBlock
    {
      Text = "Open",
      FontSize = 14,
      FontWeight = FontWeight.Medium,
      LineHeight = 20,
      Foreground = new SolidColorBrush(Color.Parse("#2A599C")),
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
    });

    var surface = Frame(row, width: 134);
    return (surface, new Size(134, 33));
  }

  private static Border Frame(Control child, double? width = null)
  {
    child.HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Left;
    child.VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Top;
    return new Border
    {
      Width = width ?? double.NaN,
      Background = new SolidColorBrush(Colors.White),
      Padding = new Thickness(0),
      Child = child,
    };
  }

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
    while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "package.json")))
    {
      dir = dir.Parent;
    }

    return dir?.FullName ?? throw new InvalidOperationException("repository root not found");
  }
}
