using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

/// <summary>
/// Cross-platform visual parity evidence for the second batch: the markdown
/// editor live surface and the code editor. Each case mirrors the Web demo
/// fixture so the captured artifact is comparable with the Playwright capture
/// of the same page. PNGs land under
/// tests/conformance/visual/artifacts/screenshots/avalonia/.
/// </summary>
public class FsusVueParityBatch2EvidenceTests
{
  public static TheoryData<string> ParityCases => new()
  {
    "markdown-editor", "icon-text", "layout", "divider",
  };

  [AvaloniaTheory]
  [MemberData(nameof(ParityCases))]
  public void Batch2FamiliesRenderToConformanceArtifacts(string componentId)
  {
    var (surface, measure) = componentId switch
    {
      "markdown-editor" => BuildMarkdownEditorFixture(),
      "icon-text" => BuildLinkFixture(),
      "layout" => BuildRowColFixture(),
      "divider" => BuildDividerFixture(),
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
    using (var bitmap = new RenderTargetBitmap(pixelSize, new Vector(96, 96)))
    {
      bitmap.Render(surface);
      using var stream = File.Create(outputPath);
      bitmap.Save(stream);
    }

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

  private static (Border Surface, Size Measure) BuildMarkdownEditorFixture()
  {
    const string source =
      "# FsusUI 2.4 发布说明\n\n" +
      "- 统一事务模型：value、selection、history 全部走单一 transaction store。\n" +
      "- Live 模式：语法 marker reveal 与 caret/scroll 稳定性达标。\n" +
      "- Avalonia 端：FsusMarkdownEditor 共享同一 source 事务合同。\n\n" +
      "> 兼容 Element Plus 公共 API，主题 token 保持 `--el-*` 优先。\n";

    var editor = new FsusMarkdownEditor
    {
      Width = 820,
      Height = 186,
      MinHeight = 0,
      Padding = new Thickness(16),
      Document = source,
      DocumentIdentity = new FsusMarkdownDocumentIdentity("parity-md", 1),
      Mode = FsusMarkdownEditorMode.Source,
      Chrome = FsusMarkdownEditorChrome.Embedded,
      StatusDensity = FsusMarkdownEditorStatusDensity.None,
      FontSize = 16,
      FontFamily = new FontFamily("ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"),
    };
    CommitSpans(editor, source);
    _ = editor.DispatchTransaction(new FsusMarkdownEditorTransaction(
      [],
      History: "skip",
      Origin: "programmatic",
      DocumentIdentity: editor.TransactionStore.Identity,
      Selection: new FsusMarkdownEditorSelection(source.Length, source.Length)));
    var surface = Frame(editor);
    return (surface, new Size(820, 186));
  }

  private static (Border Surface, Size Measure) BuildLinkFixture()
  {
    var row = new StackPanel
    {
      Orientation = global::Avalonia.Layout.Orientation.Horizontal,
      Spacing = 12,
    };
    foreach (var variant in new[]
    {
      FsusComponentVariant.Default,
      FsusComponentVariant.Primary,
      FsusComponentVariant.Success,
      FsusComponentVariant.Warning,
      FsusComponentVariant.Danger,
      FsusComponentVariant.Info,
    })
    {
      row.Children.Add(new FsusLink
      {
        Variant = variant,
        Content = variant.ToString(),
      });
    }
    var surface = Frame(row, width: 420);
    return (surface, new Size(420, 68));
  }

  private static (Border Surface, Size Measure) BuildRowColFixture()
  {
    var row = new FsusRow
    {
      Gap = FsusLayoutGap.Md,
      Width = 1220,
    };
    // Host-owned span geometry: FsusCol exposes WidthRatio and the host applies
    // the ratio (platform difference registered in docs/avalonia layout docs).
    foreach (var _ in new int[4])
    {
      row.Children.Add(new FsusCol
      {
        Span = 6,
        Width = 1220 * 6 / 24d - 15,
        Content = new Border
        {
          Background = new SolidColorBrush(Color.Parse("#E7ECF2")),
          CornerRadius = new CornerRadius(4),
          Height = 44,
          Child = new TextBlock
          {
            Text = "6",
            HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Center,
            VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Center,
          },
        },
      });
    }
    var surface = Frame(row, width: 1240);
    return (surface, new Size(1240, 92));
  }

  private static (Border Surface, Size Measure) BuildDividerFixture()
  {
    var stack = new StackPanel
    {
      Width = 1220,
    };
    stack.Children.Add(new FsusDivider
    {
      Title = "Section",
    });
    stack.Children.Add(new TextBlock { Text = "Divider body content.", Margin = new Thickness(0, 12) });
    stack.Children.Add(new FsusDivider());
    var surface = Frame(stack, width: 1240);
    return (surface, new Size(1240, 150));
  }

  private static void CommitSpans(FsusMarkdownEditor editor, string source)
  {
    var heading = source.IndexOf("FsusUI 2.4 发布说明", StringComparison.Ordinal);
    var bullet1 = source.IndexOf("统一事务模型", StringComparison.Ordinal);
    var bullet2 = source.IndexOf("Live 模式", StringComparison.Ordinal);
    var bullet3 = source.IndexOf("Avalonia 端", StringComparison.Ordinal);
    var quote = source.IndexOf("兼容 Element Plus", StringComparison.Ordinal);
    var code = source.IndexOf("--el-*", StringComparison.Ordinal);
    var spans = new List<FsusMarkdownProjectionSpan>
    {
      new("p-h-marker", new FsusMarkdownSourceRange(0, 1), FsusMarkdownProjectionSpanKind.HiddenMarker, string.Empty),
      new("p-h-text", new FsusMarkdownSourceRange(1, heading + "FsusUI 2.4 发布说明".Length - 1), FsusMarkdownProjectionSpanKind.Text, source[1..(heading + "FsusUI 2.4 发布说明".Length - 1)], "heading"),
    };
    var bullets = new (int start, string text)[3];
    bullets[0] = (bullet1, "统一事务模型：value、selection、history 全部走单一 transaction store。");
    bullets[1] = (bullet2, "Live 模式：语法 marker reveal 与 caret/scroll 稳定性达标。");
    bullets[2] = (bullet3, "Avalonia 端：FsusMarkdownEditor 共享同一 source 事务合同。");
    foreach (var (start, text) in bullets)
    {
      var markerStart = source.LastIndexOf("- ", start, StringComparison.Ordinal);
      spans.Add(new($"p-l-marker-{start}", new FsusMarkdownSourceRange(markerStart, markerStart + 2), FsusMarkdownProjectionSpanKind.HiddenMarker, string.Empty));
      spans.Add(new($"p-l-text-{start}", new FsusMarkdownSourceRange(start, start + text.Length), FsusMarkdownProjectionSpanKind.Text, text, "list"));
    }

    var quoteMarker = source.LastIndexOf("> ", quote, StringComparison.Ordinal);
    spans.Add(new("p-q-marker", new FsusMarkdownSourceRange(quoteMarker, quoteMarker + 2), FsusMarkdownProjectionSpanKind.HiddenMarker, string.Empty));
    spans.Add(new("p-q-text", new FsusMarkdownSourceRange(quote, code - 2), FsusMarkdownProjectionSpanKind.Text, source[quote..(code - 2)], "quote"));
    spans.Add(new("p-code-marker", new FsusMarkdownSourceRange(code - 1, code), FsusMarkdownProjectionSpanKind.HiddenMarker, string.Empty));
    spans.Add(new("p-code-text", new FsusMarkdownSourceRange(code, code + 6), FsusMarkdownProjectionSpanKind.Text, "--el-*", "code"));
    spans.Add(new("p-code-close", new FsusMarkdownSourceRange(code + 6, code + 7), FsusMarkdownProjectionSpanKind.HiddenMarker, string.Empty));
    spans.Add(new("p-tail", new FsusMarkdownSourceRange(code + 7, source.Length), FsusMarkdownProjectionSpanKind.Text, source[(code + 7)..], "paragraph"));

    var commit = editor.CommitProjection(new FsusMarkdownProjectionSnapshot(
      editor.TransactionStore.Identity,
      editor.TransactionStore.Revision,
      source,
      spans));
    Assert.True(commit.Accepted, commit.Reason ?? "projection rejected");
  }

  private static Border Frame(Control child, double? width = null) =>
    new()
    {
      Width = width ?? double.NaN,
      Background = new SolidColorBrush(Colors.White),
      Child = child,
    };

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
