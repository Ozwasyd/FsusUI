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

  [Fact]
  public void MutationFixturesKillAliasWebViewAndExistenceAligned()
  {
    var report = EvaluateMarkdownEditorShellMutations();
    Assert.All(report, mutation =>
    {
      Assert.False(mutation.Accepted);
      Assert.False(mutation.Equivalent);
    });
    Assert.Equal(
      ["wrong-name", "text-editor-alias", "existence-aligned", "webview-dependency"],
      report.Select(mutation => mutation.Kind).ToArray());
  }

  public readonly record struct MarkdownEditorShellMutation(
    string Kind,
    bool Equivalent,
    bool Accepted);

  public static MarkdownEditorShellMutation[] EvaluateMarkdownEditorShellMutations()
  {
    var editor = new FsusMarkdownEditor { CapabilityState = "partial" };
    var type = typeof(FsusMarkdownEditor);
    var wrongName = type.Name != "FsusMarkdownEditor";
    var alias =
      type.IsSubclassOf(typeof(FsusTextEditor)) || type == typeof(FsusTextEditor);
    var existenceAligned = editor.CapabilityState is "aligned" or "implemented";
    var webView = type.Assembly.GetTypes().Any(candidate =>
      candidate.Name.Contains("WebView", StringComparison.Ordinal) &&
      candidate.Name.Contains("Markdown", StringComparison.Ordinal));
    return
    [
      new("wrong-name", wrongName, wrongName),
      new("text-editor-alias", alias, alias),
      new("existence-aligned", existenceAligned, existenceAligned),
      new("webview-dependency", webView, webView),
    ];
  }
}
