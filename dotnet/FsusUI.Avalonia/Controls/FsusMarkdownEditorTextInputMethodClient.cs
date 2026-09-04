using Avalonia;
using Avalonia.Input.TextInput;
using Avalonia.Visuals;

namespace FsusUI.Avalonia.Controls;

/// <summary>
/// Observes the hosted text input's native IME session without replacing it.
/// The decorator forwards every <see cref="TextInputMethodClient"/> member to
/// the inner client (Avalonia's TextBox implementation keeps preedit rendering
/// and caret geometry authority) and mirrors <c>SetPreeditText</c> transitions
/// into <see cref="PreeditTextChanged"/> so the control can drive the shared
/// native event machine: composition start/update/end, freeze of structural
/// transforms, and stale-commit rejection. No timers are involved; the control
/// flushes pending composition-end on the next observed input event.
/// </summary>
internal sealed class FsusMarkdownEditorTextInputMethodClient : TextInputMethodClient
{
  private readonly TextInputMethodClient inner;

  public FsusMarkdownEditorTextInputMethodClient(TextInputMethodClient inner)
  {
    this.inner = inner ?? throw new ArgumentNullException(nameof(inner));
    this.inner.TextViewVisualChanged += (_, _) => RaiseTextViewVisualChanged();
    this.inner.CursorRectangleChanged += (_, _) => RaiseCursorRectangleChanged();
    this.inner.SurroundingTextChanged += (_, _) => RaiseSurroundingTextChanged();
    this.inner.SelectionChanged += (_, _) => RaiseSelectionChanged();
    this.inner.ResetRequested += (_, _) => RequestReset();
    this.inner.InputPaneActivationRequested += (_, _) => RaiseInputPaneActivationRequested();
  }

  /// <summary>
  /// Raised after the platform updated the preedit buffer. A non-empty text
  /// starts or continues composition; null or empty text ends it. The cursor
  /// offset is the caret position inside the preedit string when provided.
  /// </summary>
  public event Action<string?, int?>? PreeditTextChanged;

  public override Visual TextViewVisual => inner.TextViewVisual;

  public override bool SupportsPreedit => inner.SupportsPreedit;

  public override bool SupportsSurroundingText => inner.SupportsSurroundingText;

  public override string SurroundingText => inner.SurroundingText;

  public override Rect CursorRectangle => inner.CursorRectangle;

  public override TextSelection Selection
  {
    get => inner.Selection;
    set => inner.Selection = value;
  }

  public override void SetPreeditText(string? preeditText) =>
    SetPreeditText(preeditText, null);

  public override void SetPreeditText(string? preeditText, int? cursorPos)
  {
    inner.SetPreeditText(preeditText, cursorPos);
    PreeditTextChanged?.Invoke(preeditText, cursorPos);
  }

  public override void ExecuteContextMenuAction(ContextMenuAction action) =>
    inner.ExecuteContextMenuAction(action);

  /// <summary>
  /// Asks the platform IME to drop any in-progress preedit (document switch,
  /// external reset, focus loss). The inner client's ResetRequested plumbing
  /// performs the actual platform reset.
  /// </summary>
  public void RequestImeReset() => RequestReset();
}
