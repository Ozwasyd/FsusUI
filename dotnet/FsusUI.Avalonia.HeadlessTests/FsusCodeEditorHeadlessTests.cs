using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Input.Platform;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Security.Cryptography;
using System.Text.Json;

namespace FsusUI.Avalonia.HeadlessTests;

[CollectionDefinition("FsusCodeEditorTheme", DisableParallelization = true)]
public sealed class FsusCodeEditorThemeCollection;

[Collection("FsusCodeEditorTheme")]
public class FsusCodeEditorHeadlessTests
{
  private const string Source =
    "# Release notes\n\n" +
    "Ship the **native editor** with `precise navigation`.\n\n" +
    "- Search the source\n" +
    "- Preserve 中文 IME input\n" +
    "- Keep [the contract](https://fsus.dev) explicit\n\n" +
    "> Status: ready for review\n" +
    "This deliberately long review note keeps the full Markdown source visible while the editor wraps a continuation line without shifting its gutter, selection, or exact source coordinates.\n";

  [AvaloniaFact]
  public void NativeInputAndPublicWorkflowCoverTypingCompositionSearchHistoryAndIdentity()
  {
    var identity = new FsusMarkdownDocumentIdentity("release-notes", 7);
    var editor = CreateEditor();
    editor.LoadDocument(identity, Source);
    var origins = new List<FsusCodeEditorChangeOrigin>();
    editor.DocumentChanged += (_, args) => origins.Add(args.Origin);

    var window = Mount(editor, FsusThemeVariant.Light);
    var input = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());
    Assert.True(input.AcceptsReturn);
    Assert.True(input.AcceptsTab);
    Assert.False(input.IsUndoEnabled);
    Assert.Equal("Release notes source", AutomationProperties.GetName(editor));
    Assert.Equal("Release notes source", AutomationProperties.GetName(input));

    editor.SelectOffsets(Source.Length, Source.Length);
    Assert.True(input.Focus());
    window.KeyTextInput("Ready.");
    Dispatcher.UIThread.RunJobs();
    Assert.EndsWith("Ready.", editor.Text, StringComparison.Ordinal);
    Assert.Equal(FsusCodeEditorChangeOrigin.User, origins[^1]);

    editor.BeginComposition();
    editor.UpdateComposition("nihao");
    Assert.True(editor.IsComposing);
    editor.CommitComposition("你好");
    Assert.False(editor.IsComposing);
    Assert.EndsWith("Ready.你好", editor.Text, StringComparison.Ordinal);

    var first = Assert.IsType<FsusCodeEditorMatch>(editor.FindNext("source"));
    Assert.Equal(first.Start, editor.Selection.Start);
    Assert.Equal(first.Start + first.Length, editor.Selection.End);
    Assert.Equal(first.Start, input.SelectionStart);
    Assert.Equal(first.Start + first.Length, input.SelectionEnd);
    Assert.True(editor.ReplaceCurrent("document"));
    Assert.Contains("Search the document", editor.Text, StringComparison.Ordinal);
    var selected = editor.RevealLineColumn(5, 3);
    editor.SelectLineColumn(5, 3, 5, 9);
    Assert.Equal(5, selected.Line);
    Assert.Equal(3, selected.Column);
    Assert.Equal(selected.Offset, editor.Selection.Start);

    Assert.True(editor.Undo());
    Assert.DoesNotContain("Search the document", editor.Text, StringComparison.Ordinal);
    Assert.True(editor.Redo());

    var peer = Assert.IsAssignableFrom<IValueProvider>(
      ControlAutomationPeer.CreatePeerForElement(editor));
    Assert.False(peer.IsReadOnly);
    Assert.Equal(editor.Text, peer.Value);

    editor.LoadDocument(new("other-document", 1), "# Independent\n");
    Assert.False(editor.CanUndo);
    Assert.False(editor.Undo());
    Assert.Equal("# Independent\n", editor.Text);
    Assert.Equal(FsusCodeEditorChangeOrigin.External, origins[^1]);
    window.Close();
  }

  [AvaloniaFact]
  public void LargeDocumentRevealScrollAndViewTogglesStayWithinRealizationBudget()
  {
    var source = string.Join(
      '\n',
      Enumerable.Range(1, 10_000).Select(index => $"line {index}: payload"));
    var editor = CreateEditor();
    editor.LoadDocument(new("large", 1), source);
    var window = Mount(editor, FsusThemeVariant.Light);

    Assert.True(editor.IsVirtualized);
    Assert.Equal(10_000, editor.LineCount);
    var position = editor.RevealLineColumn(9_500, 6);
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(position.Offset, editor.GetOffset(9_500, 6));
    Assert.InRange(editor.RealizedLineCount, 1, 200);

    var captured = editor.CaptureScrollPosition();
    editor.RestoreScrollPosition(captured);
    Dispatcher.UIThread.RunJobs();
    Assert.Equal(captured.AnchorLine, editor.CaptureScrollPosition().AnchorLine);

    editor.WordWrap = false;
    editor.ShowLineNumbers = false;
    editor.TabWidth = 8;
    Dispatcher.UIThread.RunJobs();
    Assert.False(editor.WordWrap);
    Assert.False(editor.ShowLineNumbers);
    Assert.Equal(8, editor.TabWidth);
    Assert.InRange(editor.RealizedLineCount, 1, 200);
    window.Close();
  }

  [AvaloniaFact]
  public async Task NativeKeyboardHistoryAndClipboardCommandsUseTheMountedInputOwner()
  {
    var editor = CreateEditor();
    editor.LoadDocument(new("clipboard", 1), "copy target");
    var window = Mount(editor, FsusThemeVariant.Light);
    var input = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());

    editor.SelectOffsets(editor.Text.Length, editor.Text.Length);
    Assert.True(input.Focus());
    window.KeyTextInput("!");
    Assert.Equal("copy target!", editor.Text);
    window.KeyPress(Key.Z, RawInputModifiers.Control, PhysicalKey.Z, "z");
    Assert.Equal("copy target", editor.Text);
    window.KeyPress(
      Key.Z,
      RawInputModifiers.Control | RawInputModifiers.Shift,
      PhysicalKey.Z,
      "Z");
    Assert.Equal("copy target!", editor.Text);

    editor.SelectOffsets(0, 4);
    await editor.CopyAsync();
    Assert.Equal("copy", await window.Clipboard!.TryGetTextAsync());
    await editor.CutAsync();
    Assert.Equal(" target!", editor.Text);
    editor.SelectOffsets(editor.Text.Length, editor.Text.Length);
    await editor.PasteAsync();
    Assert.Equal(" target!copy", editor.Text);
    window.Close();
  }

  [AvaloniaFact]
  public void HeadlessSkiaRendersThemeAndViewMatrixAndWritesManifest()
  {
    var outputRoot =
      HeadlessVisualEvidence.CreateOutputDirectory("code-editor");
    var captures = new List<RenderCapture>();

    foreach (var (theme, highContrast) in new[]
      {
        (FsusThemeVariant.Light, false),
        (FsusThemeVariant.Dark, false),
        (FsusThemeVariant.Dark, true),
      })
    {
      foreach (var (state, wrap, lineNumbers) in new[]
        {
          ("wrapped-lines", true, true),
          ("unwrapped-no-lines", false, false),
        })
      {
        var editor = CreateEditor();
        editor.WordWrap = wrap;
        editor.ShowLineNumbers = lineNumbers;
        editor.LoadDocument(new("render", 1), Source);
        _ = editor.FindNext("native editor");
        var window = Mount(editor, theme, highContrast);
        editor.Focus();
        Dispatcher.UIThread.RunJobs();

        var themeName = highContrast ? "highcontrast" : theme.ToString().ToLowerInvariant();
        var fileName = $"issue-645-code-editor-{themeName}-{state}.png";
        var outputPath = Path.Combine(outputRoot, fileName);
        using var bitmap = new RenderTargetBitmap(new PixelSize(760, 400), new Vector(96, 96));
        bitmap.Render(Assert.IsType<Border>(window.Content));
        using (var stream = File.Create(outputPath))
        {
          bitmap.Save(stream);
        }
        var bytes = File.ReadAllBytes(outputPath);
        Assert.True(bytes.Length > 2_000);
        captures.Add(new(
          fileName,
          Convert.ToHexStringLower(SHA256.HashData(bytes)),
          themeName,
          state,
          wrap,
          lineNumbers,
          bitmap.PixelSize.Width,
          bitmap.PixelSize.Height));
        window.Close();
      }
    }

    Assert.Equal(6, captures.Count);
    Assert.Equal(6, captures.Select(capture => capture.Sha256).Distinct().Count());
    Assert.All(captures, capture =>
      Assert.True(File.Exists(Path.Combine(outputRoot, capture.File))));
    var manifestPath = Path.Combine(
      outputRoot,
      "issue-645-avalonia-code-editor-render-manifest.json");
    File.WriteAllText(
      manifestPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 645,
          generatedBy =
            "FsusCodeEditorHeadlessTests.HeadlessSkiaRendersThemeAndViewMatrixAndWritesManifest",
          evidenceClass = "local-headless-render",
          renderer = "Avalonia headless Skia",
          captures,
          limitations =
            "These are deterministic local Skia renders, not physical-display or operating-system accessibility sessions.",
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");
  }

  [AvaloniaFact]
  public void LocalAutomationAndCompositionSimulationWritesAccurateReceipt()
  {
    var editor = CreateEditor();
    editor.LoadDocument(new("automation", 1), Source);
    var window = Mount(editor, FsusThemeVariant.Light);
    var input = Assert.Single(editor.GetVisualDescendants().OfType<TextBox>());
    var peer = Assert.IsAssignableFrom<IValueProvider>(
      ControlAutomationPeer.CreatePeerForElement(editor));

    editor.SelectOffsets(editor.Text.Length, editor.Text.Length);
    editor.BeginComposition();
    editor.UpdateComposition("kana");
    var composingStatus = editor.IsComposing;
    editor.CommitComposition("かな");

    var reportPath = Path.Combine(
      HeadlessVisualEvidence.CreateOutputDirectory("code-editor"),
      "issue-645-avalonia-code-editor-automation-report.json");
    File.WriteAllText(
      reportPath,
      JsonSerializer.Serialize(
        new
        {
          schemaVersion = 1,
          issue = 645,
          generatedBy =
            "FsusCodeEditorHeadlessTests.LocalAutomationAndCompositionSimulationWritesAccurateReceipt",
          evidenceClass = "local-headless-automation-and-composition-simulation",
          nativeInputOwner = new
          {
            count = editor.GetVisualDescendants().OfType<TextBox>().Count(),
            input.AcceptsReturn,
            input.AcceptsTab,
            input.IsUndoEnabled,
          },
          automation = new
          {
            name = AutomationProperties.GetName(editor),
            itemStatus = AutomationProperties.GetItemStatus(editor),
            controlType = AutomationProperties.GetControlTypeOverride(editor).ToString(),
            valuePattern = true,
            peer.IsReadOnly,
          },
          composition = new
          {
            composingStatus,
            committed = editor.Text.EndsWith("かな", StringComparison.Ordinal),
          },
          relatedInteractionTest =
            "NativeInputAndPublicWorkflowCoverTypingCompositionSearchHistoryAndIdentity",
          limitations =
            "The test uses Avalonia's production TextBox in the headless backend and exercises the public composition lifecycle. It does not claim a real Windows TSF, macOS input method, Linux IBus, UIA, VoiceOver, AT-SPI, or physical keyboard session.",
        },
        new JsonSerializerOptions { WriteIndented = true }) + "\n");

    Assert.True(composingStatus);
    Assert.EndsWith("かな", editor.Text, StringComparison.Ordinal);
    Assert.Equal(editor.Text, peer.Value);
    Assert.True(File.Exists(reportPath));
    window.Close();
  }

  private static FsusCodeEditor CreateEditor() => new()
  {
    Width = 700,
    Height = 320,
    AccessibleName = "Release notes source",
    WordWrap = true,
    ShowLineNumbers = true,
    TabWidth = 4,
  };

  private static Window Mount(
    FsusCodeEditor editor,
    FsusThemeVariant theme,
    bool highContrast = false)
  {
    var window = new Window
    {
      Width = 760,
      Height = 400,
      ShowInTaskbar = false,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      Variant = theme,
      HighContrast = highContrast,
      MotionMode = FsusMotionMode.Reduced,
    });
    window.RequestedThemeVariant = theme == FsusThemeVariant.Dark
      ? global::Avalonia.Styling.ThemeVariant.Dark
      : global::Avalonia.Styling.ThemeVariant.Light;
    var surface = new Border
    {
      Width = 760,
      Height = 400,
      Padding = new Thickness(30, 36),
      Child = editor,
    };
    window.Content = surface;
    window.Show();
    Assert.True(window.TryFindResource(FsusThemeResourceKeys.BackgroundBrush, out var background));
    surface.Background = Assert.IsAssignableFrom<IBrush>(background);
    window.Measure(new Size(760, 400));
    window.Arrange(new Rect(0, 0, 760, 400));
    surface.Measure(new Size(760, 400));
    surface.Arrange(new Rect(0, 0, 760, 400));
    Dispatcher.UIThread.RunJobs();
    return window;
  }

  private static string FindRepositoryRoot()
  {
    for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
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

  private sealed record RenderCapture(
    string File,
    string Sha256,
    string Theme,
    string State,
    bool WordWrap,
    bool ShowLineNumbers,
    int Width,
    int Height);
}
