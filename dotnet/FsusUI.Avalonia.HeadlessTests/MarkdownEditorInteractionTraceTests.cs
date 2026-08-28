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
    Assert.Equal("aligned", editor.CapabilityState);
  }

  [Fact]
  public void PreservesComplexRawSourceAndIdentityAcrossNativeCommandTrace()
  {
    const string source = "\uFEFF# 标题\r\n\u200F🚀 hidden-marker";
    var identity = new FsusMarkdownDocumentIdentity("mapped-document", 7);
    var editor = new FsusMarkdownEditor
    {
      Document = source,
      DocumentIdentity = identity,
    };

    editor.TryRunCommand("bold");

    Assert.Equal(source, editor.Document);
    Assert.Same(identity, editor.DocumentIdentity);
    Assert.Equal(identity, editor.TransactionStore.Identity);
    Assert.Equal("aligned", editor.CapabilityState);
  }
}
