using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class MarkdownEditorInteractionTraceTests
{
  [Fact]
  public void ExposesEditableNonLiveAutomationValue()
  {
    var editor = new FsusMarkdownEditor { Document = "Trace start" };
    var peer = ControlAutomationPeer.CreatePeerForElement(editor);
    var value = Assert.IsAssignableFrom<IValueProvider>(peer);

    Assert.Equal(AutomationControlType.Edit, peer.GetAutomationControlType());
    Assert.Equal(AutomationLiveSetting.Off, AutomationProperties.GetLiveSetting(editor));
    Assert.False(value.IsReadOnly);
    Assert.Equal("Trace start", value.Value);
    value.SetValue("Changed");
    Assert.Equal("Changed", editor.Document);

    editor.IsReadOnly = true;
    Assert.True(value.IsReadOnly);
    Assert.Throws<InvalidOperationException>(() => value.SetValue("Rejected"));
  }

  [Fact]
  public void ExposesAtomicProjectionEntryActionsWithoutTabStops()
  {
    var identity = new FsusMarkdownDocumentIdentity("atomic", 1);
    var editor = new FsusMarkdownEditor
    {
      Document = "`code`",
      DocumentIdentity = identity,
      Mode = FsusMarkdownEditorMode.Live,
    };
    var result = editor.CommitProjection(new FsusMarkdownProjectionSnapshot(
      identity,
      0,
      editor.Document,
      [new(
        "code-node",
        new FsusMarkdownSourceRange(0, editor.Document.Length),
        FsusMarkdownProjectionSpanKind.Atomic,
        "code",
        "inline-code")],
      editor.ProjectionFeatureRevision));

    Assert.True(result.Accepted);
    var peer = ControlAutomationPeer.CreatePeerForElement(editor);
    var actions = peer.GetChildren();
    Assert.NotNull(actions);
    Assert.Collection(
      actions!,
      before => Assert.Contains("enter-before", before.GetName()),
      after => Assert.Contains("enter-after", after.GetName()),
      source => Assert.Contains("edit-source", source.GetName()));
    Assert.All(actions, action =>
    {
      Assert.Equal(AutomationControlType.Button, action.GetAutomationControlType());
      Assert.False(action.IsKeyboardFocusable());
      Assert.False(string.IsNullOrWhiteSpace(action.GetProvider<IValueProvider>()?.Value));
      Assert.NotNull(action.GetProvider<IInvokeProvider>());
    });

    actions[0].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(new FsusMarkdownEditorSelection(0, 0), editor.TransactionStore.Selection);
    actions[1].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(
      new FsusMarkdownEditorSelection(editor.Document.Length, editor.Document.Length),
      editor.TransactionStore.Selection);
  }

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
