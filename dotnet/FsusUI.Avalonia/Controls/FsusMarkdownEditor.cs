using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;

namespace FsusUI.Avalonia.Controls;

public enum FsusMarkdownEditorMode
{
  Source,
  Live,
  Split,
  Preview,
}

public enum FsusMarkdownEditorChrome
{
  Framed,
  Embedded,
  Minimal,
}

public enum FsusMarkdownEditorStatusDensity
{
  None,
  Minimal,
  Detailed,
}

public sealed record FsusMarkdownDocumentIdentity(string Id, int Epoch);

public class FsusMarkdownEditor : TemplatedControl
{
  public static readonly StyledProperty<string> DocumentProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(Document), string.Empty);

  public static readonly StyledProperty<FsusMarkdownDocumentIdentity?> DocumentIdentityProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownDocumentIdentity?>(nameof(DocumentIdentity));

  public static readonly StyledProperty<FsusMarkdownEditorMode> ModeProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorMode>(
      nameof(Mode),
      FsusMarkdownEditorMode.Source);

  public static readonly StyledProperty<bool> IsReadOnlyProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, bool>(nameof(IsReadOnly));

  public static readonly StyledProperty<string> ProfileProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(Profile), "markdown");

  public static readonly StyledProperty<FsusMarkdownEditorChrome> ChromeProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorChrome>(
      nameof(Chrome),
      FsusMarkdownEditorChrome.Framed);

  public static readonly StyledProperty<string?> LocaleProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string?>(nameof(Locale));

  public static readonly StyledProperty<FsusMarkdownEditorStatusDensity> StatusDensityProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, FsusMarkdownEditorStatusDensity>(
      nameof(StatusDensity),
      FsusMarkdownEditorStatusDensity.Minimal);

  public static readonly StyledProperty<string> CapabilityStateProperty =
    AvaloniaProperty.Register<FsusMarkdownEditor, string>(nameof(CapabilityState), "partial");

  private FsusMarkdownEditorTransactionStore store =
    new(new FsusMarkdownDocumentIdentity("doc", 0));

  public FsusMarkdownEditor()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-markdown-editor");
    Focusable = true;
  }

  public FsusMarkdownEditorTransactionStore TransactionStore => store;

  public FsusMarkdownEditorDispatchResult Dispatch(FsusMarkdownEditorTransaction transaction)
  {
    EnsureStore();
    var result = store.Dispatch(transaction);
    if (result.Accepted && result.Value != Document)
    {
      SetValue(DocumentProperty, result.Value);
    }
    return result;
  }

  public FsusMarkdownEditorDispatchResult UndoDocument()
  {
    EnsureStore();
    var result = store.Undo();
    if (result.Accepted)
    {
      SetValue(DocumentProperty, result.Value);
    }
    return result;
  }

  public FsusMarkdownEditorDispatchResult RedoDocument()
  {
    EnsureStore();
    var result = store.Redo();
    if (result.Accepted)
    {
      SetValue(DocumentProperty, result.Value);
    }
    return result;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == DocumentIdentityProperty)
    {
      var identity = DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);
      store = new FsusMarkdownEditorTransactionStore(identity, Document);
    }
    else if (change.Property == DocumentProperty && store.Value != Document)
    {
      store.Reset(Document);
    }
  }

  private void EnsureStore()
  {
    var identity = DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);
    if (!store.Identity.Equals(identity))
    {
      store = new FsusMarkdownEditorTransactionStore(identity, Document);
    }
  }

  public string Document
  {
    get => GetValue(DocumentProperty);
    set => SetValue(DocumentProperty, value);
  }

  public FsusMarkdownDocumentIdentity? DocumentIdentity
  {
    get => GetValue(DocumentIdentityProperty);
    set => SetValue(DocumentIdentityProperty, value);
  }

  public FsusMarkdownEditorMode Mode
  {
    get => GetValue(ModeProperty);
    set => SetValue(ModeProperty, value);
  }

  public bool IsReadOnly
  {
    get => GetValue(IsReadOnlyProperty);
    set => SetValue(IsReadOnlyProperty, value);
  }

  public string Profile
  {
    get => GetValue(ProfileProperty);
    set => SetValue(ProfileProperty, value);
  }

  public FsusMarkdownEditorChrome Chrome
  {
    get => GetValue(ChromeProperty);
    set => SetValue(ChromeProperty, value);
  }

  public string? Locale
  {
    get => GetValue(LocaleProperty);
    set => SetValue(LocaleProperty, value);
  }

  public FsusMarkdownEditorStatusDensity StatusDensity
  {
    get => GetValue(StatusDensityProperty);
    set => SetValue(StatusDensityProperty, value);
  }

  public string CapabilityState
  {
    get => GetValue(CapabilityStateProperty);
    set => SetValue(CapabilityStateProperty, value);
  }

  public bool TryRunCommand(string commandKey)
  {
    return !string.IsNullOrWhiteSpace(commandKey) && !IsReadOnly && IsEnabled;
  }
}
