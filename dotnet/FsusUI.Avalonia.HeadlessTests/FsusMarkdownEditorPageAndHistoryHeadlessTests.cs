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
using System.Runtime.InteropServices;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusMarkdownEditorPageAndHistoryHeadlessTests
{
  [AvaloniaFact]
  public void ScrollFloorAndProgrammaticPositionSurviveDocumentSwitch()
  {
    var (window, surface, editor) = CreateEditor(FsusThemeVariant.Light);
    try
    {
      const string firstDocument = "# One paragraph document";
      editor.Document = firstDocument;
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      editor.ScrollContentFloor = 240;
      Dispatcher.UIThread.RunJobs();
      Arrange(window, surface);

      Assert.True(editor.ScrollExtentHeight > editor.ScrollViewportHeight + 120);
      editor.ScrollPosition = new Vector(0, 120);
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(120, editor.ScrollPosition.Y, 1);

      // Switch documents and restore the per-document scroll position like a
      // desktop tab host would; the capability must survive the switch.
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-b", 1);
      editor.Document = "# Second document body";
      Dispatcher.UIThread.RunJobs();
      editor.ScrollPosition = new Vector(0, 90);
      Dispatcher.UIThread.RunJobs();
      Assert.Equal(90, editor.ScrollPosition.Y, 1);
      Assert.Equal("doc-b", editor.TransactionStore.Identity.Id);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void ScrollFloorOffByDefaultKeepsPlainExtent()
  {
    var (window, surface, editor) = CreateEditor(FsusThemeVariant.Light);
    try
    {
      editor.Document = "short";
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc", 1);
      Dispatcher.UIThread.RunJobs();
      Arrange(window, surface);

      Assert.Equal(0, editor.ScrollContentFloor);
      Assert.True(editor.ScrollExtentHeight <= editor.ScrollViewportHeight + 0.5);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void SwitchingBackToADocumentRestoresItsUndoChain()
  {
    var (window, surface, editor) = CreateEditor(FsusThemeVariant.Light);
    try
    {
      const string firstDocument = "# Alpha body";
      editor.Document = firstDocument;
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      Dispatcher.UIThread.RunJobs();

      var alphaStore = editor.TransactionStore;
      _ = editor.DispatchTransaction(new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(firstDocument.Length, firstDocument.Length, " edited")],
        History: "separate",
        Origin: "input",
        DocumentIdentity: alphaStore.Identity));
      Assert.True(alphaStore.History.CanUndo);
      Assert.Equal("# Alpha body edited", editor.Document);

      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-b", 1);
      editor.Document = "# Beta body";
      Dispatcher.UIThread.RunJobs();
      Assert.False(editor.TransactionStore.History.CanUndo);

      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      editor.Document = "# Alpha body edited";
      Dispatcher.UIThread.RunJobs();
      Assert.True(editor.TransactionStore.History.CanUndo);

      var undone = editor.Undo();
      Assert.True(undone.Accepted);
      Assert.Equal(firstDocument, editor.Document);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void ExternalResetClearsHistoryAndInvalidatesArchivedChain()
  {
    var (window, surface, editor) = CreateEditor(FsusThemeVariant.Light);
    try
    {
      editor.Document = "# Alpha body";
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      Dispatcher.UIThread.RunJobs();
      _ = editor.DispatchTransaction(new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(12, 12, " edited")],
        History: "separate",
        Origin: "input",
        DocumentIdentity: editor.TransactionStore.Identity));
      Assert.True(editor.TransactionStore.History.CanUndo);

      // External hard reset on the same identity clears the live history and
      // must also invalidate the archived chain for that document.
      editor.Document = "# Alpha replaced externally";
      Dispatcher.UIThread.RunJobs();
      Assert.False(editor.TransactionStore.History.CanUndo);

      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-b", 1);
      editor.Document = "# Beta body";
      Dispatcher.UIThread.RunJobs();
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("doc-a", 1);
      editor.Document = "# Alpha replaced externally";
      Dispatcher.UIThread.RunJobs();
      Assert.False(editor.TransactionStore.History.CanUndo);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void HistorySnapshotRejectsMismatchedIdentityAndValue()
  {
    var identity = new FsusMarkdownDocumentIdentity("doc-a", 1);
    var store = new FsusMarkdownEditorTransactionStore(identity, "hello");
    _ = store.Dispatch(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(5, 5, " world")],
      History: "separate",
      Origin: "programmatic",
      DocumentIdentity: identity));
    var snapshot = store.CaptureHistory();
    Assert.Equal("hello world", snapshot.Value);
    Assert.Equal(1, snapshot.Undo.Count);

    Assert.False(new FsusMarkdownEditorTransactionStore(identity, "different").TryRestoreHistory(snapshot));
    Assert.False(
      new FsusMarkdownEditorTransactionStore(new FsusMarkdownDocumentIdentity("doc-b", 1), "hello world")
        .TryRestoreHistory(snapshot));

    var restored = new FsusMarkdownEditorTransactionStore(identity, "hello world");
    Assert.True(restored.TryRestoreHistory(snapshot));
    Assert.True(restored.History.CanUndo);
    var result = restored.Undo();
    Assert.True(result.Accepted);
    Assert.Equal("hello", result.Value);
  }

  [AvaloniaFact]
  public void MergedInputHistoryRestoresStepwiseUndo()
  {
    var identity = new FsusMarkdownDocumentIdentity("doc", 1);
    var store = new FsusMarkdownEditorTransactionStore(identity, "ab");
    _ = store.Dispatch(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(2, 2, "c")],
      History: "merge",
      Origin: "input",
      DocumentIdentity: identity,
      Selection: new FsusMarkdownEditorSelection(3, 3)));
    _ = store.Dispatch(new FsusMarkdownEditorTransaction(
      [new FsusMarkdownEditorChange(3, 3, "d")],
      History: "merge",
      Origin: "input",
      DocumentIdentity: identity,
      Selection: new FsusMarkdownEditorSelection(4, 4)));
    var snapshot = store.CaptureHistory();

    var restored = new FsusMarkdownEditorTransactionStore(identity, "abcd");
    Assert.True(restored.TryRestoreHistory(snapshot));
    var undo = restored.Undo();
    Assert.True(undo.Accepted);
    Assert.Equal("abc", undo.Value);
  }

  [AvaloniaFact]
  public void ProseProjectionRendersSemanticTypographyEvidence()
  {
    var (window, surface, editor) = CreateEditor(FsusThemeVariant.Light);
    try
    {
      const string source = "# Welcome\n\nA **bold** move and `var code` plus a [link](https://example.com).\n\n> quiet quote line\n\n- first bullet item";
      editor.Document = source;
      editor.DocumentIdentity = new FsusMarkdownDocumentIdentity("prose", 1);
      editor.Mode = FsusMarkdownEditorMode.Live;
      Dispatcher.UIThread.RunJobs();
      Arrange(window, surface);

      var spans = BuildSpans(source);
      var commit = editor.CommitProjection(new FsusMarkdownProjectionSnapshot(
        editor.TransactionStore.Identity,
        editor.TransactionStore.Revision,
        source,
        spans));
      Assert.True(commit.Accepted, commit.Reason ?? "projection rejected");
      Dispatcher.UIThread.RunJobs();

      var projectionView = Assert.Single(
        editor.GetVisualDescendants(),
        candidate => candidate.GetType().Name == "FsusMarkdownEditorProjectionView");
      Assert.IsType<FsusMarkdownEditorProjectionView>(projectionView);

      var outputRoot = Path.Combine(
        FindRepositoryRoot(),
        "dotnet",
        "FsusUI.Avalonia.HeadlessTests",
        "TestResults",
        "markdown-prose-evidence");
      Directory.CreateDirectory(outputRoot);
      var outputPath = Path.Combine(outputRoot, "markdown-prose-light.png");
      using (var bitmap = new RenderTargetBitmap(new PixelSize(680, 360), new Vector(96, 96)))
      {
        bitmap.Render(surface);
        using var stream = File.Create(outputPath);
        bitmap.Save(stream);
      }

      Assert.True(new FileInfo(outputPath).Length > 2_000);
      AssertProsePixels(outputPath);
      window.Close();
    }
    finally
    {
      window.Close();
    }
  }

  private static void AssertProsePixels(string pngPath)
  {
    using var bitmap = new Bitmap(pngPath);
    using var buffer = new WriteableBitmap(
      bitmap.PixelSize,
      new Vector(96, 96),
      global::Avalonia.Platform.PixelFormat.Bgra8888,
      global::Avalonia.Platform.AlphaFormat.Premul);
    using var framebuffer = buffer.Lock();
    bitmap.CopyPixels(framebuffer);
    var pixels = new byte[framebuffer.RowBytes * bitmap.PixelSize.Height];
    Marshal.Copy(framebuffer.Address, pixels, 0, pixels.Length);
    var linkFound = false;
    for (var y = 0; y < bitmap.PixelSize.Height && !linkFound; y += 1)
    {
      for (var x = 0; x < bitmap.PixelSize.Width; x += 1)
      {
        var offset = (y * (int)framebuffer.RowBytes) + (x * 4);
        // Scholarly Blue #2A599C with tolerance for anti-aliasing; BGRA order.
        if (Math.Abs(pixels[offset + 2] - 0x2A) < 40 &&
          Math.Abs(pixels[offset + 1] - 0x59) < 40 &&
          Math.Abs(pixels[offset] - 0x9C) < 40)
        {
          linkFound = true;
          break;
        }
      }
    }
    Assert.True(linkFound, "the projection must paint the link span in Scholarly Blue.");
  }

  private static IReadOnlyList<FsusMarkdownProjectionSpan> BuildSpans(string source)
  {
    var headingText = source.IndexOf("Welcome", StringComparison.Ordinal);
    var headingEnd = headingText + "Welcome".Length;
    var boldText = source.IndexOf("bold", StringComparison.Ordinal);
    var codeText = source.IndexOf("var code", StringComparison.Ordinal);
    var linkText = source.IndexOf("[link]", StringComparison.Ordinal);
    var sentenceEnd = source.IndexOf(".\n", StringComparison.Ordinal);
    var quoteMarker = source.IndexOf("\n> ", StringComparison.Ordinal);
    var listMarker = source.IndexOf("\n- ", StringComparison.Ordinal);
    var quoteText = source.IndexOf("quiet quote line", StringComparison.Ordinal);
    var listText = source.IndexOf("first bullet item", StringComparison.Ordinal);
    return
    [
      new("h-marker", new FsusMarkdownSourceRange(0, 1), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("h-text", new FsusMarkdownSourceRange(1, headingEnd), FsusMarkdownProjectionSpanKind.Text, source[1..headingEnd], "heading"),
      new("p-para", new FsusMarkdownSourceRange(headingEnd + 2, boldText - 2), FsusMarkdownProjectionSpanKind.Text, source[(headingEnd + 2)..(boldText - 2)], "paragraph"),
      new("strong-marker", new FsusMarkdownSourceRange(boldText - 2, boldText), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("strong-text", new FsusMarkdownSourceRange(boldText, boldText + 4), FsusMarkdownProjectionSpanKind.Text, "bold", "strong"),
      new("strong-close", new FsusMarkdownSourceRange(boldText + 4, boldText + 6), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("p-mid", new FsusMarkdownSourceRange(boldText + 6, codeText - 1), FsusMarkdownProjectionSpanKind.Text, source[(boldText + 6)..(codeText - 1)], "paragraph"),
      new("code-marker", new FsusMarkdownSourceRange(codeText - 1, codeText), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("code-text", new FsusMarkdownSourceRange(codeText, codeText + 8), FsusMarkdownProjectionSpanKind.Text, "var code", "code"),
      new("code-close", new FsusMarkdownSourceRange(codeText + 8, codeText + 9), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("p-tail", new FsusMarkdownSourceRange(codeText + 9, linkText), FsusMarkdownProjectionSpanKind.Text, source[(codeText + 9)..linkText], "paragraph"),
      new("link-open", new FsusMarkdownSourceRange(linkText, linkText + 1), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("link-text", new FsusMarkdownSourceRange(linkText + 1, linkText + 5), FsusMarkdownProjectionSpanKind.Text, "link", "link"),
      new("link-target", new FsusMarkdownSourceRange(linkText + 5, sentenceEnd), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("p-end", new FsusMarkdownSourceRange(sentenceEnd, sentenceEnd + 1), FsusMarkdownProjectionSpanKind.Text, ".", "paragraph"),
      new("quote-marker", new FsusMarkdownSourceRange(quoteMarker, quoteMarker + 3), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("quote-text", new FsusMarkdownSourceRange(quoteMarker + 3, quoteMarker + 3 + "quiet quote line".Length), FsusMarkdownProjectionSpanKind.Text, "quiet quote line", "quote"),
      new("list-marker", new FsusMarkdownSourceRange(listMarker, listMarker + 3), FsusMarkdownProjectionSpanKind.HiddenMarker, ""),
      new("list-text", new FsusMarkdownSourceRange(listMarker + 3, listMarker + 3 + "first bullet item".Length), FsusMarkdownProjectionSpanKind.Text, "first bullet item", "list"),
    ];
  }

  private static (Window Window, Border Surface, FsusMarkdownEditor Editor) CreateEditor(
    FsusThemeVariant variant)
  {
    var editor = new FsusMarkdownEditor
    {
      Width = 560,
      Height = 260,
    };
    var surface = new Border
    {
      Width = 620,
      Height = 320,
      Padding = new Thickness(30),
      Child = editor,
    };
    var window = new Window
    {
      Width = 620,
      Height = 320,
      Content = surface,
      ShowInTaskbar = false,
    };
    AttachTheme(window, surface, variant);
    window.Show();
    Dispatcher.UIThread.RunJobs();
    return (window, surface, editor);
  }

  private static void Arrange(Window window, Border surface)
  {
    window.Measure(new Size(window.Width, window.Height));
    window.Arrange(new Rect(0, 0, window.Width, window.Height));
    surface.Arrange(new Rect(0, 0, surface.Width, surface.Height));
    Dispatcher.UIThread.RunJobs();
  }

  private static void AttachTheme(
    Window window,
    Border surface,
    FsusThemeVariant variant)
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
    surface.Background = new SolidColorBrush(Colors.White);
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
