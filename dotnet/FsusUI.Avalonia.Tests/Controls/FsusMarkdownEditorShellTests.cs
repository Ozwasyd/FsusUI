using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusMarkdownEditorShellTests
{
  [Fact]
  public void MarkdownEditorExposesPublicShellWithoutTextEditorAlias()
  {
    var editor = new FsusMarkdownEditor
    {
      Document = "# Title",
      DocumentIdentity = new FsusMarkdownDocumentIdentity("doc", 1),
      Mode = FsusMarkdownEditorMode.Source,
      Chrome = FsusMarkdownEditorChrome.Framed,
      StatusDensity = FsusMarkdownEditorStatusDensity.Minimal,
      CapabilityState = "partial",
    };

    Assert.Equal("# Title", editor.Document);
    Assert.Equal("doc", editor.DocumentIdentity?.Id);
    Assert.Equal(FsusMarkdownEditorMode.Source, editor.Mode);
    Assert.True(editor.TryRunCommand("bold"));
    Assert.False(typeof(FsusMarkdownEditor).IsSubclassOf(typeof(FsusTextEditor)));
    Assert.NotEqual(typeof(FsusTextEditor), typeof(FsusMarkdownEditor));
  }
}
