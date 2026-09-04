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
    Assert.Equal("Markdown editor", peer.GetName());
    Assert.Equal(AutomationLiveSetting.Off, AutomationProperties.GetLiveSetting(editor));
    Assert.False(value.IsReadOnly);
    Assert.Equal("Trace start", value.Value);
    Assert.Contains("multiline=true", peer.GetItemStatus());
    Assert.Contains("selection=11:11", peer.GetItemStatus());
    value.SetValue("Changed");
    Assert.Equal("Changed", editor.Document);
    Assert.Contains("caret=7", peer.GetItemStatus());

    editor.IsReadOnly = true;
    Assert.True(value.IsReadOnly);
    Assert.Contains("readonly=true", peer.GetItemStatus());
    Assert.Throws<InvalidOperationException>(() => value.SetValue("Rejected"));

    editor.IsReadOnly = false;
    editor.IsEnabled = false;
    Assert.True(value.IsReadOnly);
    Assert.Contains("disabled=true", peer.GetItemStatus());
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
    var atomic = Assert.Single(peer.GetChildren()!);
    Assert.Equal(AutomationControlType.Group, atomic.GetAutomationControlType());
    Assert.Equal("inline-code", atomic.GetName());
    Assert.Equal("code", atomic.GetProvider<IValueProvider>()?.Value);
    Assert.Contains("source=0:6", atomic.GetItemStatus());
    var actions = atomic.GetChildren()!;
    Assert.Equal(
      ["enter-before", "enter-after", "edit-source", "select-source", "delete"],
      actions.Select(action => action.GetName()).ToArray());
    Assert.All(actions, action =>
    {
      Assert.Equal(AutomationControlType.Button, action.GetAutomationControlType());
      Assert.False(action.IsKeyboardFocusable());
      Assert.NotNull(action.GetProvider<IInvokeProvider>());
    });

    actions[0].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(new FsusMarkdownEditorSelection(0, 0), editor.TransactionStore.Selection);
    actions[1].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(
      new FsusMarkdownEditorSelection(editor.Document.Length, editor.Document.Length),
      editor.TransactionStore.Selection);
    actions[3].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(
      new FsusMarkdownEditorSelection(0, editor.Document.Length),
      editor.TransactionStore.Selection);
    actions[2].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(FsusMarkdownEditorMode.Source, editor.Mode);
    editor.Mode = FsusMarkdownEditorMode.Live;
    actions[4].GetProvider<IInvokeProvider>()!.Invoke();
    Assert.Equal(string.Empty, editor.Document);
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
