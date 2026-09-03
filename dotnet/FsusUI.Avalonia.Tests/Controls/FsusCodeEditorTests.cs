using Avalonia.Automation;
using Avalonia.Automation.Peers;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusCodeEditorTests
{
  [Fact]
  public void DocumentSwitchClearsHistoryAndChangeEventsIdentifyTheirOrigin()
  {
    var first = new FsusMarkdownDocumentIdentity("draft-a", 1);
    var second = new FsusMarkdownDocumentIdentity("draft-b", 1);
    var editor = new FsusCodeEditor();
    var events = new List<FsusCodeEditorDocumentChangedEventArgs>();
    editor.DocumentChanged += (_, args) => events.Add(args);

    editor.LoadDocument(first, "# First");
    editor.SelectOffsets(editor.Text.Length, editor.Text.Length);
    editor.PasteText("!");

    Assert.True(editor.CanUndo);
    Assert.Equal(FsusCodeEditorChangeOrigin.External, events[0].Origin);
    Assert.Equal(FsusCodeEditorChangeOrigin.User, events[1].Origin);
    Assert.Equal(first, events[1].DocumentIdentity);

    editor.LoadDocument(second, "# Second");

    Assert.False(editor.CanUndo);
    Assert.False(editor.Undo());
    Assert.Equal(second, editor.DocumentIdentity);
    Assert.Equal("# Second", editor.Text);
    Assert.Equal(FsusCodeEditorChangeOrigin.External, events[^1].Origin);
    Assert.Equal(second, events[^1].DocumentIdentity);

    editor.DocumentIdentity = new("draft-c", 1);
    Assert.Equal(FsusCodeEditorChangeOrigin.External, events[^1].Origin);
    Assert.Equal("draft-c", events[^1].DocumentIdentity.Id);
  }

  [Fact]
  public void PositionSelectionRevealAndViewTogglesUsePublicApiOnly()
  {
    var editor = new FsusCodeEditor
    {
      Text = "# Title\r\n中文 tab\tvalue\nfinal",
      WordWrap = true,
      ShowLineNumbers = true,
      TabWidth = 2,
    };

    var offset = editor.GetOffset(2, 4);
    Assert.Equal(new FsusCodeEditorPosition(offset, 2, 4), editor.GetPosition(offset));

    editor.SelectLineColumn(2, 1, 2, 3);
    Assert.Equal(new FsusCodeEditorSelection(editor.GetOffset(2, 1), editor.GetOffset(2, 3)), editor.Selection);

    var revealed = editor.RevealLineColumn(3, 3);
    Assert.Equal(3, revealed.Line);
    Assert.Equal(3, revealed.Column);
    Assert.Equal(revealed, editor.LastRevealedPosition);

    editor.WordWrap = false;
    editor.ShowLineNumbers = false;
    editor.TabWidth = 8;

    Assert.False(editor.WordWrap);
    Assert.False(editor.ShowLineNumbers);
    Assert.Equal(8, editor.TabWidth);
  }

  [Fact]
  public void FindReplaceNavigationWrapsAndMaintainsPreciseSelection()
  {
    var editor = new FsusCodeEditor
    {
      Text = "alpha beta alpha\nALPHA final",
    };

    Assert.Equal(3, editor.Find("alpha").Count);
    var first = Assert.IsType<FsusCodeEditorMatch>(editor.FindNext("alpha"));
    Assert.Equal(0, first.Start);
    Assert.Equal(new FsusCodeEditorSelection(0, 5), editor.Selection);

    var second = Assert.IsType<FsusCodeEditorMatch>(editor.FindNext("alpha"));
    Assert.Equal(11, second.Start);
    Assert.True(editor.ReplaceCurrent("gamma"));
    Assert.Equal("alpha beta gamma\nALPHA final", editor.Text);

    var previous = Assert.IsType<FsusCodeEditorMatch>(editor.FindPrevious("alpha"));
    Assert.Equal(0, previous.Start);
    Assert.Equal(2, editor.ReplaceAll("alpha", "delta"));
    Assert.Equal("delta beta gamma\ndelta final", editor.Text);
    Assert.True(editor.Undo());
    Assert.Equal("alpha beta gamma\nALPHA final", editor.Text);
    Assert.True(editor.Redo());
  }

  [Fact]
  public void MarkdownHighlightingAndCompositionAreBoundedToRequestedSourceEditing()
  {
    var editor = new FsusCodeEditor
    {
      Text = "# Heading\n- **bold** and `code` [link](https://fsus.dev)",
    };

    Assert.Contains(editor.HighlightSpans, span => span.Kind == FsusCodeEditorHighlightKind.Heading);
    Assert.Contains(editor.HighlightSpans, span => span.Kind == FsusCodeEditorHighlightKind.Emphasis);
    Assert.Contains(editor.HighlightSpans, span => span.Kind == FsusCodeEditorHighlightKind.InlineCode);
    Assert.Contains(editor.HighlightSpans, span => span.Kind == FsusCodeEditorHighlightKind.Link);

    editor.SelectOffsets(editor.Text.Length, editor.Text.Length);
    editor.BeginComposition();
    editor.UpdateComposition("nihao");
    Assert.True(editor.IsComposing);
    editor.CommitComposition("你好");

    Assert.False(editor.IsComposing);
    Assert.EndsWith("你好", editor.Text, StringComparison.Ordinal);
    Assert.True(editor.Undo());
    Assert.DoesNotContain("你好", editor.Text, StringComparison.Ordinal);

    editor.BeginComposition();
    editor.UpdateComposition("cancel me");
    Assert.True(editor.CancelComposition());
    Assert.False(editor.IsComposing);
    Assert.DoesNotContain("cancel me", editor.Text, StringComparison.Ordinal);

    editor.BeginComposition();
    editor.UpdateComposition("stale");
    editor.LoadDocument(new("replacement", 1), "# Replacement");
    Assert.False(editor.IsComposing);
    Assert.Equal("# Replacement", editor.Text);
  }

  [Fact]
  public void ClipboardFallbackCommandsAndAutomationMetadataExposeEditableState()
  {
    var editor = new FsusCodeEditor
    {
      AccessibleName = "Article source",
      Text = "copy replace",
    };
    editor.SelectOffsets(5, 12);
    editor.PasteText("paste");

    Assert.Equal("copy paste", editor.Text);
    Assert.True(editor.CanUndo);
    Assert.Equal(AutomationControlType.Edit, AutomationProperties.GetControlTypeOverride(editor));
    Assert.Equal("Article source", AutomationProperties.GetName(editor));
    Assert.Equal(AccessibilityView.Control, AutomationProperties.GetAccessibilityView(editor));
    Assert.Contains("line 1, column 11", AutomationProperties.GetItemStatus(editor));

    editor.IsEnabled = false;
    Assert.False(editor.CanCopy);
  }

  [Fact]
  public void LargeDocumentDeclaresBoundedRealizationAndCoordinateLookupRemainsExact()
  {
    var source = string.Join('\n', Enumerable.Range(1, 10_000).Select(index => $"line {index}"));
    var editor = new FsusCodeEditor { Text = source, WordWrap = false };

    Assert.True(editor.IsVirtualized);
    Assert.Equal(10_000, editor.LineCount);
    var position = editor.RevealLineColumn(9_500, 6);
    Assert.Equal(9_500, position.Line);
    Assert.Equal(6, position.Column);
    Assert.Equal(position.Offset, editor.GetOffset(9_500, 6));
  }
}
