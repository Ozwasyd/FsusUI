using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class MarkdownEditorInteractionTraceTests
{
  [Fact]
  public void ConstructsNativeEditorAndRecordsPublicTrace()
  {
    var editor = new FsusMarkdownEditor
    {
      Document = "# Title",
      DocumentIdentity = new FsusMarkdownDocumentIdentity("doc", 1),
    };
    editor.TryRunCommand("bold");
    Assert.Equal("# Title", editor.Document);
    Assert.Equal("partial", editor.CapabilityState);
  }
}
