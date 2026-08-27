using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Localization;
using FsusUI.Avalonia.Themes;

namespace FsusUI.Avalonia.Demo.Gallery;

public sealed record FsusGalleryScreenshotScenario(
  FsusThemeVariant Variant,
  bool HighContrast,
  FsusDensity Density);

public sealed record FsusGalleryRoute(
  string Route,
  string ComponentId,
  string Title,
  IReadOnlyList<string> StateCoverage,
  IReadOnlyList<FsusGalleryScreenshotScenario> ScreenshotScenarios,
  Func<Control> CreatePage);

public static class FsusAvaloniaGalleryRegistry
{
  private static readonly string[] RequiredStateCoverage =
  [
    "default",
    "disabled",
    "loading",
    "invalid",
    "selected",
    "empty",
    "error",
    "long-text",
    "cjk-text",
    "dense",
    "mobile-width",
    "keyboard-focused",
    "high-contrast",
  ];

  public static IReadOnlyList<FsusGalleryRoute> StableRoutes { get; } =
  [
    Entry("button", "Button"),
    Entry("icon-text", "Icon and text"),
    Entry("input", "Input"),
    Entry("selection", "Selection"),
    Entry("form", "Form"),
    Entry("display", "Display"),
    Entry("layout", "Layout"),
    Entry("navigation", "Navigation"),
    Entry("modal-panel", "Modal panel"),
    Entry("anchored-overlay", "Anchored overlay"),
    Entry("service-helper", "Service helper"),
    Entry("picker", "Picker"),
    Entry("date-time", "Date and time"),
    Entry("value-picker", "Value picker"),
    Entry("upload-transfer", "Upload and transfer"),
    Entry("data-display", "Data display"),
    Entry("media-decorative", "Media and decorative"),
    Entry("data-table", "Data table"),
    Entry("virtualization", "Virtualization"),
    Entry("tree", "Tree"),
    Entry("text-viewer", "Text viewer"),
    Entry("text-editor", "Text editor"),
    Entry("markdown-editor", "Markdown editor"),
    Entry("public-shell", "Public shell"),
    Entry("product-primitives", "Product primitives"),
    Entry("perception-challenge", "Perception challenge"),
    Entry("locale-formatting", "Locale formatting"),
  ];

  private static FsusGalleryRoute Entry(string componentId, string title) =>
    new(
      $"/stable/{componentId}",
      componentId,
      title,
      RequiredStateCoverage,
      BuildScreenshotScenarios(),
      () => BuildGalleryPage(componentId, title));

  private static IReadOnlyList<FsusGalleryScreenshotScenario> BuildScreenshotScenarios()
  {
    var scenarios = new List<FsusGalleryScreenshotScenario>();
    foreach (var density in new[] { FsusDensity.Compact, FsusDensity.Default, FsusDensity.Spacious })
    {
      scenarios.Add(new FsusGalleryScreenshotScenario(FsusThemeVariant.Light, false, density));
      scenarios.Add(new FsusGalleryScreenshotScenario(FsusThemeVariant.Dark, false, density));
      scenarios.Add(new FsusGalleryScreenshotScenario(FsusThemeVariant.Light, true, density));
    }

    return scenarios;
  }

  private static Control BuildGalleryPage(string componentId, string title)
  {
    var panel = new StackPanel
    {
      Spacing = 12,
    };
    panel.Classes.Add("fsus-gallery-page");
    panel.Children.Add(new TextBlock
    {
      Text = title,
      FontSize = 22,
      FontWeight = global::Avalonia.Media.FontWeight.Bold,
    });
    panel.Children.Add(new TextBlock
    {
      Text = "Default, disabled, loading, invalid, selected, empty, error, long text, CJK text, dense, mobile-width, keyboard-focused, and high-contrast states.",
      TextWrapping = global::Avalonia.Media.TextWrapping.Wrap,
    });

    AddRepresentativeControls(panel, componentId);
    return panel;
  }

  private static void AddRepresentativeControls(StackPanel panel, string componentId)
  {
    switch (componentId)
    {
      case "text-viewer":
        var viewer = new FsusTextViewer { AccessibleName = "Gallery text" };
        viewer.Blocks.Add(new FsusTextContentBlock(FsusTextBlockKind.Heading, "长文本 Long localized heading", 1));
        panel.Children.Add(viewer);
        break;
      case "text-editor":
        panel.Children.Add(new FsusTextEditor { AccessibleName = "Gallery editor" });
        break;
      case "markdown-editor":
        panel.Children.Add(
          new FsusMarkdownEditor
          {
            Document = "# Gallery\n\n中文 markdown editor shell",
            DocumentIdentity = new FsusMarkdownDocumentIdentity("gallery-doc", 1),
            Mode = FsusMarkdownEditorMode.Source,
            Chrome = FsusMarkdownEditorChrome.Framed,
            StatusDensity = FsusMarkdownEditorStatusDensity.Minimal,
            CapabilityState = "partial",
          });
        break;
      case "public-shell":
        var shell = new FsusPublicShell { Brand = "Fsus", ActiveNav = "home" };
        shell.NavigationItems.Add(new FsusPublicShellNavigationItem("home", "Home", "/"));
        panel.Children.Add(shell);
        break;
      case "product-primitives":
        panel.Children.Add(new FsusSettingsSection { Title = "Settings", AccessibleName = "Settings" });
        panel.Children.Add(new FsusMetricList { AccessibleName = "Metrics" });
        panel.Children.Add(new FsusInboxLayout { AccessibleName = "Inbox" });
        break;
      case "perception-challenge":
        AddPerceptionCharacterStates(panel);
        break;
      case "upload-transfer":
        var upload = new FsusUpload { AccessibleName = "Gallery upload" };
        upload.AddItem("sample.pdf", 2048, "application/pdf");
        var dropZone = new FsusDropZone
        {
          AccessibleName = "Gallery drop zone",
          Instruction = "拖放文件或点击选择 / Drag files here or click to browse",
          HelpText = "PDF, PNG, CSV up to 25MB",
          Accepts = ".pdf, .png, .csv",
        };
        panel.Children.Add(upload);
        panel.Children.Add(dropZone);
        break;
      case "locale-formatting":
        var provider = FsusAvaloniaLocaleProvider.CreateDefault();
        provider.SetCulture("zh-cn");
        panel.Children.Add(new FsusLocalizedText(provider) { Key = "el.select.noData" });
        break;
      default:
        panel.Children.Add(new FsusButton { Content = "Default action" });
        panel.Children.Add(new FsusButton { Content = "Loading action", IsLoading = true });
        panel.Children.Add(new FsusInput { AccessibleName = "Invalid input", IsInvalid = true, Text = "中文 long localized input label" });
        break;
    }
  }

  private static void AddPerceptionCharacterStates(StackPanel panel)
  {
    var states = new (string Name, FsusPerceptionChallengeState State, string Error)[]
    {
      ("loading", FsusPerceptionChallengeState.Loading, string.Empty),
      ("ready", FsusPerceptionChallengeState.Ready, string.Empty),
      ("verifying", FsusPerceptionChallengeState.Verifying, string.Empty),
      ("retryable", FsusPerceptionChallengeState.Retryable, "That response was not accepted. 请重试。"),
      ("reissue", FsusPerceptionChallengeState.Reissue, string.Empty),
      ("expired", FsusPerceptionChallengeState.Expired, string.Empty),
      ("unavailable", FsusPerceptionChallengeState.Unavailable, string.Empty),
      ("disabled", FsusPerceptionChallengeState.Disabled, string.Empty),
    };

    foreach (var (name, state, error) in states)
    {
      var challenge = new FsusPerceptionCharacterChallenge
      {
        AccessibleName = $"Character recognition challenge: {name}",
        ChallengeId = $"character-gallery-{name}",
        Prompt = "请输入图像中显示的字符 / Enter the visible characters",
        Description = "Audio is available only after user activation. Long CJK + Latin copy wraps at narrow widths.",
        State = state,
        ErrorMessage = error,
      };
      if (state != FsusPerceptionChallengeState.Unavailable)
      {
        challenge.Media = CreatePerceptionCharacterMedia();
      }

      panel.Children.Add(new StackPanel
      {
        Spacing = 6,
        Children =
        {
          new TextBlock { Text = name, FontWeight = FontWeight.SemiBold },
          challenge,
        },
      });
    }
  }

  private static FsusPerceptionCharacterMedia CreatePerceptionCharacterMedia()
  {
    var drawing = new DrawingGroup();
    drawing.Children.Add(new GeometryDrawing
    {
      Brush = new SolidColorBrush(Color.Parse("#172033")),
      Geometry = new RectangleGeometry(new Rect(0, 0, 240, 80)),
    });
    var glyphBrush = new SolidColorBrush(Color.Parse("#EAF2FF"));
    foreach (var rectangle in new[]
    {
      new Rect(24, 18, 28, 44),
      new Rect(72, 18, 28, 44),
      new Rect(124, 18, 28, 44),
      new Rect(172, 18, 44, 12),
      new Rect(172, 36, 38, 12),
    })
    {
      drawing.Children.Add(new GeometryDrawing
      {
        Brush = glyphBrush,
        Geometry = new RectangleGeometry(rectangle),
      });
    }

    return new FsusPerceptionCharacterMedia(
      new FsusPerceptionCharacterRasterMedia(
        new DrawingImage { Drawing = drawing },
        240,
        80,
        "Characters to transcribe"),
      new FsusPerceptionCharacterAudioMedia(
        new Uri("https://example.invalid/final-audio.mp3"),
        "Spoken characters to transcribe"));
  }
}
