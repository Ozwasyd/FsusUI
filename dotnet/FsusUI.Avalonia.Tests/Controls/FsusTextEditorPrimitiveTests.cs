using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusTextEditorPrimitiveTests
{
  [Fact]
  public async Task TextEditorHandlesTypingSelectionPasteUndoRedoAndPreviewSync()
  {
    var editor = new KeyboardTextEditor
    {
      AccessibleName = "Article editor",
      PreviewDebounce = TimeSpan.Zero,
      SplitPreviewEnabled = true,
    };

    editor.TypeText("# Draft");
    editor.Select(2, 5);
    editor.Paste("Release notes");
    editor.TypeText("\n- Fixed layout");

    Assert.Equal("# Release notes\n- Fixed layout", editor.Text);
    Assert.Equal(new FsusTextSelection(30, 0), editor.Selection);
    Assert.Equal(3, editor.UndoDepth);
    Assert.Equal(0, editor.RedoDepth);
    Assert.True(editor.IsPreviewUpdatePending);

    Assert.True(await editor.SyncPreviewAsync());

    Assert.False(editor.IsPreviewUpdatePending);
    Assert.Equal(2, editor.Preview.RenderedBlocks.Count);
    Assert.Equal(FsusTextBlockKind.Heading, editor.Preview.RenderedBlocks[0].Kind);
    Assert.Equal(FsusTextBlockKind.ListItem, editor.Preview.RenderedBlocks[1].Kind);
    Assert.Equal(AutomationControlType.Edit, AutomationProperties.GetControlTypeOverride(editor));
    Assert.Equal("Article editor", AutomationProperties.GetName(editor));
    Assert.Equal("ready, 30 chars, selection 30-30, preview synced", AutomationProperties.GetItemStatus(editor));

    Assert.True(await editor.PressAsync(Key.Z, KeyModifiers.Control));
    Assert.Equal("# Release notes", editor.Text);
    Assert.Equal(1, editor.RedoDepth);

    Assert.True(await editor.PressAsync(Key.Y, KeyModifiers.Control));
    Assert.Equal("# Release notes\n- Fixed layout", editor.Text);
    Assert.Equal(0, editor.RedoDepth);
  }

  [Fact]
  public async Task TextEditorCompositionCommitsAsSingleUndoUnitAndSupportsCancellation()
  {
    var editor = new FsusTextEditor
    {
      PreviewDebounce = TimeSpan.Zero,
    };
    editor.TypeText("Hello ");

    editor.BeginComposition();
    editor.UpdateComposition("ni");

    Assert.True(editor.IsComposing);
    Assert.Equal("Hello ni", editor.Text);
    Assert.Equal(1, editor.UndoDepth);

    editor.CommitComposition("你");

    Assert.False(editor.IsComposing);
    Assert.Equal("Hello 你", editor.Text);
    Assert.Equal(2, editor.UndoDepth);
    Assert.True(editor.IsPreviewUpdatePending);

    using var cancellation = new CancellationTokenSource();
    cancellation.Cancel();

    Assert.False(await editor.SyncPreviewAsync(cancellation.Token));
    Assert.True(editor.LastPreviewCanceled);
    Assert.Equal("canceled", editor.PreviewStateName);
    Assert.True(editor.IsPreviewUpdatePending);

    Assert.True(await editor.SyncPreviewAsync());
    Assert.Equal("ready", editor.PreviewStateName);
    Assert.Single(editor.Preview.RenderedBlocks);
  }

  [Fact]
  public async Task TextEditorScrollSyncDoesNotCreatePreviewFeedbackLoops()
  {
    var editor = new FsusTextEditor
    {
      PreviewDebounce = TimeSpan.Zero,
      SplitPreviewEnabled = true,
    };
    for (var index = 0; index < 400; index++)
    {
      editor.TypeText($"Paragraph {index}\n");
    }

    Assert.True(await editor.SyncPreviewAsync());
    var previewUpdateCount = editor.PreviewUpdateCount;

    editor.ScrollEditorToBlock(320);

    Assert.Equal(320, editor.EditorScrollBlockIndex);
    Assert.Equal(320, editor.Preview.VisibleBlockStartIndex);
    Assert.Equal(previewUpdateCount, editor.PreviewUpdateCount);

    editor.ScrollPreviewToBlock(120);

    Assert.Equal(120, editor.EditorScrollBlockIndex);
    Assert.Equal(120, editor.Preview.VisibleBlockStartIndex);
    Assert.Equal(previewUpdateCount, editor.PreviewUpdateCount);
    Assert.Equal(1, editor.SuppressedPreviewFeedbackLoopCount);
  }

  [Fact]
  public async Task TextEditorKeyboardDisabledReadonlyAndConformanceMetadataCoverStable37()
  {
    var editor = new KeyboardTextEditor
    {
      PreviewDebounce = TimeSpan.Zero,
    };
    editor.TypeText("abc");

    Assert.True(await editor.PressAsync(Key.Left));
    Assert.Equal(new FsusTextSelection(2, 0), editor.Selection);
    Assert.True(await editor.PressAsync(Key.Right));
    Assert.Equal(new FsusTextSelection(3, 0), editor.Selection);

    editor.IsReadOnly = true;
    editor.TypeText("!");
    editor.Paste("?");
    Assert.False(await editor.PressAsync(Key.Z, KeyModifiers.Control));
    Assert.Equal("abc", editor.Text);

    editor.IsReadOnly = false;
    editor.IsEnabled = false;
    editor.TypeText("!");
    Assert.Equal("abc", editor.Text);

    var textEditor = ReadControlTheme("TextEditor.axaml");
    Assert.Contains("fsus|FsusTextEditor", textEditor);
    Assert.Contains("FsusThemeTextEditorSurfaceBrush", textEditor);
    Assert.Contains("fsus-split-preview", textEditor);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/TextEditor.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("text-editor-stable37-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("text-editor-stable37", accessibilityEvidence);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"text-editor\"", performanceBudgets);
  }

  private sealed class KeyboardTextEditor : FsusTextEditor
  {
    public ValueTask<bool> PressAsync(Key key, KeyModifiers modifiers = KeyModifiers.None) =>
      HandleKeyAsync(key, modifiers);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
