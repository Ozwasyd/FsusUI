using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Presenters;
using Avalonia.Input;
using Avalonia.Input.Platform;
using Avalonia.Input.TextInput;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;

namespace FsusUI.Avalonia.Controls;

public partial class FsusMarkdownEditor
{
  private sealed class MarkdownEditorAutomationPeer(FsusMarkdownEditor owner)
    : ControlAutomationPeer(owner), IValueProvider
  {
    private FsusMarkdownEditor Editor => (FsusMarkdownEditor)Owner;

    public bool IsReadOnly => Editor.IsReadOnly || !Editor.IsEnabled;

    public string Value => Editor.Document;

    public void RefreshChildren() => InvalidateChildren();

    public void SetValue(string? value)
    {
      if (Editor.IsReadOnly || !Editor.IsEnabled)
      {
        throw new InvalidOperationException("The Markdown editor cannot accept edits.");
      }
      Editor.Document = value ?? string.Empty;
    }

    protected override IReadOnlyList<AutomationPeer>? GetChildrenCore()
    {
      var atomicSpans = Editor.projection.Snapshot?.Spans
        .Where(span => span.Kind == FsusMarkdownProjectionSpanKind.Atomic)
        .ToArray() ?? [];
      if (atomicSpans.Length == 0)
      {
        return null;
      }

      if (Editor.projectionView is { } view)
      {
        var visible = view.VisibleSourceRange;
        atomicSpans = atomicSpans
          .Where(span =>
            span.SourceRange.End >= visible.Start &&
            span.SourceRange.Start <= visible.End)
          .ToArray();
      }
      return atomicSpans
        .Take(AutomationAtomicNodeBudget)
        .Select(span => (AutomationPeer)new AtomicNodeAutomationPeer(
          new AtomicNodeControl(Editor, span)))
        .ToArray();
    }
  }

  private sealed class AtomicNodeControl(
    FsusMarkdownEditor owner,
    FsusMarkdownProjectionSpan span) : Control
  {
    public FsusMarkdownEditor Editor { get; } = owner;

    public FsusMarkdownProjectionSpan Span { get; } = span;

    public void MoveTo(int sourceOffset, bool sourceMode)
    {
      SetSelection(new(sourceOffset, sourceOffset));
      if (sourceMode)
      {
        Editor.Mode = FsusMarkdownEditorMode.Source;
      }
      _ = Editor.Focus();
      Editor.SyncAutomationState();
    }

    public void SelectSource()
    {
      SetSelection(new(
        Span.SourceRange.Start,
        Span.SourceRange.End));
      _ = Editor.Focus();
      Editor.SyncAutomationState();
    }

    public void CopySource()
    {
      SelectSource();
      var clipboard = TopLevel.GetTopLevel(Editor)?.Clipboard;
      Editor.PendingAtomicCopy = TrySetAtomicClipboardTextAsync(
        clipboard is null ? null : clipboard.SetTextAsync,
        Editor.store.Value[Span.SourceRange.Start..Span.SourceRange.End]);
    }

    private void SetSelection(FsusMarkdownEditorSelection selection)
    {
      if (Editor.inputOwner is not null)
      {
        Editor.SetNativeSelection(selection);
        return;
      }
      var previous = Editor.store.Selection;
      if (Editor.store.SetSelection(selection) && Editor.store.Selection != previous)
      {
        Editor.SelectionChange?.Invoke(Editor, new(Editor.store.Revision, Editor.store.Selection));
        Editor.UpdateProjectionSelection();
      }
    }

    public void Delete()
    {
      if (Editor.IsReadOnly || !Editor.IsEnabled)
      {
        return;
      }
      _ = Editor.DispatchTransaction(new FsusMarkdownEditorTransaction(
        [new FsusMarkdownEditorChange(
          Span.SourceRange.Start,
          Span.SourceRange.End,
          string.Empty)],
        Selection: new FsusMarkdownEditorSelection(
          Span.SourceRange.Start,
          Span.SourceRange.Start),
        Origin: "command",
        DocumentIdentity: Editor.store.Identity));
      _ = Editor.Focus();
    }
  }

  private sealed class AtomicNodeAutomationPeer
    : ControlAutomationPeer, IValueProvider
  {
    public AtomicNodeAutomationPeer(AtomicNodeControl owner) : base(owner)
    {
      AutomationProperties.SetAccessibilityView(owner, AccessibilityView.Content);
      AutomationProperties.SetControlTypeOverride(owner, AutomationControlType.Group);
      AutomationProperties.SetName(
        owner,
        owner.Span.SemanticKind ?? "Markdown atomic node");
      AutomationProperties.SetHelpText(owner, owner.Span.DisplayText);
      AutomationProperties.SetItemStatus(
        owner,
        $"atomic; source={owner.Span.SourceRange.Start}:{owner.Span.SourceRange.End}");
      owner.Focusable = false;
      owner.IsHitTestVisible = false;
    }

    private AtomicNodeControl Node => (AtomicNodeControl)Owner;

    public bool IsReadOnly => true;

    public string Value => Node.Span.DisplayText;

    public void SetValue(string? value) =>
      throw new InvalidOperationException("Atomic Markdown nodes are read-only.");

    protected override IReadOnlyList<AutomationPeer> GetChildrenCore() =>
    [
      Action("enter-before", () => Node.MoveTo(Node.Span.SourceRange.Start, false)),
      Action("enter-after", () => Node.MoveTo(Node.Span.SourceRange.End, false)),
      Action("edit-source", () => Node.MoveTo(Node.Span.SourceRange.Start, true)),
      Action("select-source", Node.SelectSource),
      Action("copy", Node.CopySource),
      Action("delete", Node.Delete),
    ];

    private AutomationPeer Action(string action, Action invoke)
    {
      var control = new AtomicActionControl(invoke)
      {
        Focusable = false,
        IsHitTestVisible = false,
      };
      AutomationProperties.SetAccessibilityView(control, AccessibilityView.Control);
      AutomationProperties.SetControlTypeOverride(control, AutomationControlType.Button);
      AutomationProperties.SetName(control, action);
      AutomationProperties.SetHelpText(control, Node.Span.DisplayText);
      AutomationProperties.SetItemStatus(control, action);
      return new AtomicActionAutomationPeer(control);
    }
  }

  private sealed class AtomicActionControl(Action invoke) : Control
  {
    public void Invoke() => invoke();
  }

  private sealed class AtomicActionAutomationPeer(
    AtomicActionControl owner) : ControlAutomationPeer(owner), IInvokeProvider
  {
    public void Invoke() => owner.Invoke();
  }
}
