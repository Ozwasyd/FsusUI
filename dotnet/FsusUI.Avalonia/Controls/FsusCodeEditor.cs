using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Input.Platform;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Globalization;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public class FsusCodeEditor : TemplatedControl
{
  public static readonly StyledProperty<string> TextProperty =
    AvaloniaProperty.Register<FsusCodeEditor, string>(nameof(Text), string.Empty);

  public static readonly StyledProperty<FsusMarkdownDocumentIdentity?> DocumentIdentityProperty =
    AvaloniaProperty.Register<FsusCodeEditor, FsusMarkdownDocumentIdentity?>(nameof(DocumentIdentity));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusCodeEditor, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<bool> IsReadOnlyProperty =
    AvaloniaProperty.Register<FsusCodeEditor, bool>(nameof(IsReadOnly));

  public static readonly StyledProperty<bool> WordWrapProperty =
    AvaloniaProperty.Register<FsusCodeEditor, bool>(nameof(WordWrap), true);

  public static readonly StyledProperty<bool> ShowLineNumbersProperty =
    AvaloniaProperty.Register<FsusCodeEditor, bool>(nameof(ShowLineNumbers), true);

  public static readonly StyledProperty<int> TabWidthProperty =
    AvaloniaProperty.Register<FsusCodeEditor, int>(nameof(TabWidth), 4);

  private FsusMarkdownEditorTransactionStore store =
    new(new FsusMarkdownDocumentIdentity("doc", 0));
  private FsusCodeEditorDocumentMap documentMap =
    FsusCodeEditorDocumentMap.Create(string.Empty);
  private IReadOnlyList<FsusCodeEditorHighlightSpan> highlightSpans = [];
  private IReadOnlyList<FsusCodeEditorMatch> matches = [];
  private string findQuery = string.Empty;
  private bool findMatchCase;
  private ContentPresenter? contentPresenter;
  private Grid? nativeSurface;
  private TextBox? inputOwner;
  private ScrollViewer? inputScrollViewer;
  private FsusCodeEditorPresentation? presentation;
  private bool synchronizingText;
  private bool synchronizingInput;
  private FsusCodeEditorScrollPosition? pendingScrollPosition;
  private CompositionState? composition;

  public FsusCodeEditor()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-code-editor");
    Focusable = true;
    UndoCommand = new RelayCommand(_ => Undo(), _ => CanUndo);
    RedoCommand = new RelayCommand(_ => Redo(), _ => CanRedo);
    CopyCommand = new AsyncRelayCommand(_ => CopyAsync(), _ => CanCopy);
    CutCommand = new AsyncRelayCommand(_ => CutAsync(), _ => CanCut);
    PasteCommand = new AsyncRelayCommand(_ => PasteAsync(), _ => CanPaste);
    SyncAutomation();
  }

  public event EventHandler<FsusCodeEditorDocumentChangedEventArgs>? DocumentChanged;

  public event EventHandler<FsusCodeEditorSelectionChangedEventArgs>? SelectionChanged;

  public ICommand UndoCommand { get; }

  public ICommand RedoCommand { get; }

  public ICommand CopyCommand { get; }

  public ICommand CutCommand { get; }

  public ICommand PasteCommand { get; }

  public string Text
  {
    get => GetValue(TextProperty);
    set => SetValue(TextProperty, value ?? string.Empty);
  }

  public FsusMarkdownDocumentIdentity? DocumentIdentity
  {
    get => GetValue(DocumentIdentityProperty);
    set => SetValue(DocumentIdentityProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public bool IsReadOnly
  {
    get => GetValue(IsReadOnlyProperty);
    set => SetValue(IsReadOnlyProperty, value);
  }

  public bool WordWrap
  {
    get => GetValue(WordWrapProperty);
    set => SetValue(WordWrapProperty, value);
  }

  public bool ShowLineNumbers
  {
    get => GetValue(ShowLineNumbersProperty);
    set => SetValue(ShowLineNumbersProperty, value);
  }

  public int TabWidth
  {
    get => GetValue(TabWidthProperty);
    set => SetValue(TabWidthProperty, value);
  }

  public FsusCodeEditorSelection Selection =>
    new(store.Selection.Start, store.Selection.End);

  public FsusCodeEditorPosition CaretPosition =>
    documentMap.GetPosition(store.Selection.End);

  public FsusCodeEditorPosition LastRevealedPosition { get; private set; } = new(0, 1, 1);

  public IReadOnlyList<FsusCodeEditorHighlightSpan> HighlightSpans => highlightSpans;

  public IReadOnlyList<FsusCodeEditorMatch> Matches => matches;

  public int CurrentMatchIndex { get; private set; } = -1;

  public int LineCount => documentMap.LineCount;

  public bool IsVirtualized => LineCount > 200;

  public int FirstRealizedLine { get; private set; } = 1;

  public int LastRealizedLine { get; private set; } = 1;

  public int RealizedLineCount => LastRealizedLine - FirstRealizedLine + 1;

  public int Revision => store.Revision;

  public bool IsComposing => composition is not null;

  public bool CanUndo => !IsReadOnly && IsEnabled && store.History.CanUndo;

  public bool CanRedo => !IsReadOnly && IsEnabled && store.History.CanRedo;

  public bool CanCopy => IsEnabled && store.Selection.Start != store.Selection.End;

  public bool CanCut => CanCopy && !IsReadOnly && IsEnabled;

  public bool CanPaste => !IsReadOnly && IsEnabled;

  public void LoadDocument(FsusMarkdownDocumentIdentity identity, string? text)
  {
    ArgumentNullException.ThrowIfNull(identity);
    ClearCompositionState();
    var value = text ?? string.Empty;
    synchronizingText = true;
    try
    {
      SetCurrentValue(DocumentIdentityProperty, identity);
      SetCurrentValue(TextProperty, value);
    }
    finally
    {
      synchronizingText = false;
    }
    store.SwitchDocument(identity, value);
    DocumentStateChanged();
    RaiseDocumentChanged(FsusCodeEditorChangeOrigin.External);
  }

  public FsusCodeEditorPosition GetPosition(int offset) => documentMap.GetPosition(offset);

  public int GetOffset(int line, int column) => documentMap.GetOffset(line, column);

  public FsusCodeEditorPosition RevealOffset(int offset)
  {
    var position = documentMap.GetPosition(offset);
    LastRevealedPosition = position;
    if (inputOwner is not null)
    {
      var selectionStart = inputOwner.SelectionStart;
      var selectionEnd = inputOwner.SelectionEnd;
      inputOwner.ScrollToLine(position.Line - 1);
      inputOwner.CaretIndex = selectionEnd;
      inputOwner.SelectionStart = selectionStart;
      inputOwner.SelectionEnd = selectionEnd;
      Dispatcher.UIThread.Post(SyncScrollState);
    }
    return position;
  }

  public FsusCodeEditorPosition RevealLineColumn(int line, int column) =>
    RevealOffset(documentMap.GetOffset(line, column));

  public void SelectOffsets(int start, int end)
  {
    ValidateSelection(start, end);
    SetSelection(new(start, end));
  }

  public void SelectLineColumn(
    int startLine,
    int startColumn,
    int endLine,
    int endColumn)
  {
    SelectOffsets(
      documentMap.GetOffset(startLine, startColumn),
      documentMap.GetOffset(endLine, endColumn));
  }

  public IReadOnlyList<FsusCodeEditorMatch> Find(string query, bool matchCase = false)
  {
    findQuery = query ?? string.Empty;
    findMatchCase = matchCase;
    matches = BuildMatches(store.Value, findQuery, findMatchCase);
    CurrentMatchIndex = -1;
    SyncAutomation();
    return matches;
  }

  public FsusCodeEditorMatch? FindNext(string query, bool matchCase = false)
  {
    EnsureFind(query, matchCase);
    if (matches.Count == 0)
    {
      return null;
    }
    var index = matches
      .Select((match, matchIndex) => (match, matchIndex))
      .FirstOrDefault(item => item.match.Start >= store.Selection.End)
      .matchIndex;
    if (index == 0 && matches[0].Start < store.Selection.End)
    {
      index = 0;
    }
    return ActivateMatch(index);
  }

  public FsusCodeEditorMatch? FindPrevious(string query, bool matchCase = false)
  {
    EnsureFind(query, matchCase);
    if (matches.Count == 0)
    {
      return null;
    }
    var before = matches
      .Select((match, matchIndex) => (match, matchIndex))
      .Where(item => item.match.Start < store.Selection.Start)
      .LastOrDefault();
    var index = before.match is null ? matches.Count - 1 : before.matchIndex;
    return ActivateMatch(index);
  }

  public bool ReplaceCurrent(string? replacement)
  {
    if (!CanPaste || CurrentMatchIndex < 0 || CurrentMatchIndex >= matches.Count)
    {
      return false;
    }
    var match = matches[CurrentMatchIndex];
    if (store.Selection.Start != match.Start || store.Selection.End != match.Start + match.Length)
    {
      return false;
    }
    var insert = replacement ?? string.Empty;
    if (!ApplyUserChanges(
      [new(match.Start, match.Start + match.Length, insert)],
      new(match.Start + insert.Length, match.Start + insert.Length),
      "command"))
    {
      return false;
    }
    Find(findQuery, findMatchCase);
    return true;
  }

  public int ReplaceAll(string query, string? replacement, bool matchCase = false)
  {
    if (!CanPaste)
    {
      return 0;
    }
    var found = BuildMatches(store.Value, query, matchCase);
    if (found.Count == 0)
    {
      Find(query, matchCase);
      return 0;
    }
    var insert = replacement ?? string.Empty;
    var changes = found
      .Select(match => new FsusMarkdownEditorChange(
        match.Start,
        match.Start + match.Length,
        insert))
      .ToArray();
    var finalOffset = found[^1].Start + insert.Length +
      (found.Count - 1) * (insert.Length - found[0].Length);
    if (!ApplyUserChanges(changes, new(finalOffset, finalOffset), "command"))
    {
      return 0;
    }
    Find(query, matchCase);
    return found.Count;
  }

  public bool Undo()
  {
    if (!CanUndo)
    {
      return false;
    }
    var result = store.Undo();
    return result.Accepted && ApplyStoreResult(FsusCodeEditorChangeOrigin.User);
  }

  public bool Redo()
  {
    if (!CanRedo)
    {
      return false;
    }
    var result = store.Redo();
    return result.Accepted && ApplyStoreResult(FsusCodeEditorChangeOrigin.User);
  }

  public async Task CopyAsync()
  {
    if (!CanCopy)
    {
      return;
    }
    if (inputOwner is not null)
    {
      inputOwner.Copy();
      return;
    }
    var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
    if (clipboard is not null)
    {
      await clipboard.SetTextAsync(store.Value[store.Selection.Start..store.Selection.End]);
    }
  }

  public async Task CutAsync()
  {
    if (!CanCut)
    {
      return;
    }
    await CopyAsync();
    _ = ApplyUserChanges(
      [new(store.Selection.Start, store.Selection.End, string.Empty)],
      new(store.Selection.Start, store.Selection.Start),
      "command");
  }

  public async Task PasteAsync()
  {
    if (!CanPaste)
    {
      return;
    }
    var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
    if (clipboard is null)
    {
      return;
    }
    PasteText(await clipboard.TryGetTextAsync());
  }

  public void PasteText(string? text)
  {
    if (!CanPaste)
    {
      return;
    }
    var insert = text ?? string.Empty;
    _ = ApplyUserChanges(
      [new(store.Selection.Start, store.Selection.End, insert)],
      new(store.Selection.Start + insert.Length, store.Selection.Start + insert.Length),
      "paste");
  }

  public FsusCodeEditorScrollPosition CaptureScrollPosition()
  {
    var offset = inputScrollViewer?.Offset ?? default;
    var anchorLine = Math.Clamp(
      (int)Math.Floor(offset.Y / Math.Max(1, FontSize * 1.5)) + 1,
      1,
      LineCount);
    return new(offset.X, offset.Y, anchorLine);
  }

  public void RestoreScrollPosition(FsusCodeEditorScrollPosition position)
  {
    ArgumentNullException.ThrowIfNull(position);
    if (position.AnchorLine < 1 || position.AnchorLine > LineCount ||
      position.HorizontalOffset < 0 || position.VerticalOffset < 0)
    {
      throw new ArgumentOutOfRangeException(nameof(position));
    }
    pendingScrollPosition = position;
    ApplyPendingScrollPosition();
  }

  public void BeginComposition()
  {
    if (!CanPaste || composition is not null)
    {
      return;
    }
    composition = new(store.Value, store.Selection);
    FsusComponentClasses.Ensure(this, "fsus-composing", true);
  }

  public void UpdateComposition(string? text)
  {
    if (!CanPaste)
    {
      return;
    }
    BeginComposition();
    if (composition is null)
    {
      return;
    }
    var insert = text ?? string.Empty;
    var preview = composition.Value
      .Remove(composition.Selection.Start, composition.Selection.End - composition.Selection.Start)
      .Insert(composition.Selection.Start, insert);
    synchronizingText = true;
    try
    {
      SetCurrentValue(TextProperty, preview);
    }
    finally
    {
      synchronizingText = false;
    }
    documentMap = FsusCodeEditorDocumentMap.Create(preview);
    SynchronizeInput(preview, new(
      composition.Selection.Start + insert.Length,
      composition.Selection.Start + insert.Length));
    UpdatePresentation();
  }

  public void CommitComposition(string? text)
  {
    if (!CanPaste)
    {
      return;
    }
    BeginComposition();
    if (composition is null)
    {
      return;
    }
    var baseline = composition;
    composition = null;
    FsusComponentClasses.Ensure(this, "fsus-composing", false);
    if (store.Value != baseline.Value || store.Selection != baseline.Selection)
    {
      store.SwitchDocument(CurrentIdentity, baseline.Value, baseline.Selection);
    }
    var insert = text ?? string.Empty;
    _ = ApplyUserChanges(
      [new(baseline.Selection.Start, baseline.Selection.End, insert)],
      new(
        baseline.Selection.Start + insert.Length,
        baseline.Selection.Start + insert.Length),
      "input");
  }

  public bool CancelComposition()
  {
    if (composition is null)
    {
      return false;
    }
    ClearCompositionState();
    synchronizingText = true;
    try
    {
      SetCurrentValue(TextProperty, store.Value);
    }
    finally
    {
      synchronizingText = false;
    }
    DocumentStateChanged();
    return true;
  }

  protected override AutomationPeer OnCreateAutomationPeer() => new CodeEditorAutomationPeer(this);

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    base.OnApplyTemplate(e);
    contentPresenter = e.NameScope.Find<ContentPresenter>("PART_Content");
    BuildNativeSurface();
    DocumentStateChanged();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == DocumentIdentityProperty && !synchronizingText)
    {
      if (composition is not null)
      {
        _ = CancelComposition();
      }
      store.SwitchDocument(CurrentIdentity, Text);
      DocumentStateChanged();
      RaiseDocumentChanged(FsusCodeEditorChangeOrigin.External);
    }
    else if (change.Property == TextProperty && !synchronizingText && store.Value != Text)
    {
      ClearCompositionState();
      _ = store.ApplyExternalValue(Text, "reset");
      DocumentStateChanged();
      RaiseDocumentChanged(FsusCodeEditorChangeOrigin.External);
    }
    else if (change.Property == WordWrapProperty ||
      change.Property == ShowLineNumbersProperty ||
      change.Property == TabWidthProperty ||
      change.Property == IsReadOnlyProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == AccessibleNameProperty ||
      change.Property == FontFamilyProperty ||
      change.Property == FontSizeProperty ||
      change.Property == FontStyleProperty ||
      change.Property == FontWeightProperty ||
      change.Property == FontStretchProperty ||
      change.Property == ForegroundProperty)
    {
      if (TabWidth is < 1 or > 16)
      {
        SetCurrentValue(TabWidthProperty, Math.Clamp(TabWidth, 1, 16));
      }
      if ((change.Property == IsReadOnlyProperty || change.Property == IsEnabledProperty) &&
        (!CanPaste && composition is not null))
      {
        _ = CancelComposition();
      }
      UpdateNativeConfiguration();
      UpdatePresentation();
      SyncAutomation();
    }
  }

  private FsusMarkdownDocumentIdentity CurrentIdentity =>
    DocumentIdentity ?? new FsusMarkdownDocumentIdentity("doc", 0);

  private void ClearCompositionState()
  {
    composition = null;
    FsusComponentClasses.Ensure(this, "fsus-composing", false);
  }

  private void BuildNativeSurface()
  {
    if (contentPresenter is null)
    {
      return;
    }
    if (nativeSurface is not null)
    {
      contentPresenter.Content = nativeSurface;
      return;
    }

    inputOwner = new TextBox
    {
      AcceptsReturn = true,
      AcceptsTab = true,
      Background = Brushes.Transparent,
      BorderThickness = new Thickness(0),
      IsUndoEnabled = false,
      UndoLimit = 0,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Stretch,
    };
    inputOwner.TextChanged += OnInputTextChanged;
    inputOwner.KeyDown += OnInputKeyDown;
    inputOwner.KeyUp += OnInputSelectionChanged;
    inputOwner.PointerReleased += OnInputSelectionChanged;
    inputOwner.GotFocus += OnInputSelectionChanged;

    presentation = new FsusCodeEditorPresentation
    {
      IsHitTestVisible = false,
      HorizontalAlignment = global::Avalonia.Layout.HorizontalAlignment.Stretch,
      VerticalAlignment = global::Avalonia.Layout.VerticalAlignment.Stretch,
    };
    presentation.RealizedLinesChanged += OnRealizedLinesChanged;

    nativeSurface = new Grid();
    nativeSurface.Children.Add(inputOwner);
    nativeSurface.Children.Add(presentation);
    contentPresenter.Content = nativeSurface;
    UpdateNativeConfiguration();
    Dispatcher.UIThread.Post(AttachInputScrollViewer);
  }

  private void AttachInputScrollViewer()
  {
    if (inputOwner is null)
    {
      return;
    }
    inputOwner.ApplyTemplate();
    var next = inputOwner.GetVisualDescendants().OfType<ScrollViewer>().FirstOrDefault();
    if (ReferenceEquals(next, inputScrollViewer))
    {
      ApplyPendingScrollPosition();
      return;
    }
    if (inputScrollViewer is not null)
    {
      inputScrollViewer.ScrollChanged -= OnInputScrollChanged;
    }
    inputScrollViewer = next;
    if (inputScrollViewer is not null)
    {
      inputScrollViewer.ScrollChanged += OnInputScrollChanged;
    }
    ApplyPendingScrollPosition();
    SyncScrollState();
  }

  private void OnInputScrollChanged(object? sender, ScrollChangedEventArgs args) => SyncScrollState();

  private void SyncScrollState() => UpdatePresentation();

  private void UpdateNativeConfiguration()
  {
    if (inputOwner is null || presentation is null)
    {
      return;
    }
    var gutterWidth = ShowLineNumbers ? CalculateGutterWidth() : 0;
    inputOwner.IsReadOnly = IsReadOnly;
    inputOwner.TextWrapping = WordWrap ? TextWrapping.Wrap : TextWrapping.NoWrap;
    inputOwner.Padding = new Thickness(gutterWidth, 0, 0, 0);
    inputOwner.FontFamily = FontFamily;
    inputOwner.FontSize = FontSize;
    inputOwner.FontStyle = FontStyle;
    inputOwner.FontWeight = FontWeight;
    inputOwner.FontStretch = FontStretch;
    inputOwner.Foreground = Brushes.Transparent;
    inputOwner.CaretBrush = Brushes.Transparent;
    inputOwner.SelectionBrush = Brushes.Transparent;
    inputOwner.SelectionForegroundBrush = Brushes.Transparent;
    ScrollViewer.SetHorizontalScrollBarVisibility(
      inputOwner,
      WordWrap ? ScrollBarVisibility.Disabled : ScrollBarVisibility.Auto);
    ScrollViewer.SetVerticalScrollBarVisibility(inputOwner, ScrollBarVisibility.Auto);
    presentation.FontFamily = FontFamily;
    presentation.FontSize = FontSize;
    presentation.FontStyle = FontStyle;
    presentation.FontWeight = FontWeight;
    presentation.FontStretch = FontStretch;
    presentation.Foreground = Foreground;
    AutomationProperties.SetName(
      inputOwner,
      FsusComponentClasses.ResolveName(AccessibleName, "Code editor"));
    AutomationProperties.SetAccessibilityView(inputOwner, AccessibilityView.Raw);
    AutomationProperties.SetControlTypeOverride(inputOwner, AutomationControlType.Edit);
  }

  private double CalculateGutterWidth()
  {
    var digits = Math.Max(2, LineCount.ToString(CultureInfo.InvariantCulture).Length);
    return Math.Ceiling(digits * FontSize * 0.65 + FontSize * 1.5);
  }

  private void OnInputTextChanged(object? sender, TextChangedEventArgs args)
  {
    if (synchronizingInput || inputOwner is null || IsReadOnly)
    {
      return;
    }
    var next = inputOwner.Text ?? string.Empty;
    if (next == store.Value)
    {
      return;
    }
    var change = CreateMinimalChange(store.Value, next);
    var selection = new FsusMarkdownEditorSelection(
      inputOwner.SelectionStart,
      inputOwner.SelectionEnd);
    var direction = change.Insert.Length == 0 ? "backward" : "forward";
    var transaction = new FsusMarkdownEditorTransaction(
      [change],
      History: "merge",
      Origin: "input",
      Selection: selection,
      DocumentIdentity: store.Identity);
    var result = store.Dispatch(transaction, new(direction));
    if (result.Accepted)
    {
      _ = ApplyStoreResult(FsusCodeEditorChangeOrigin.User);
    }
  }

  private void OnInputSelectionChanged(object? sender, RoutedEventArgs args)
  {
    if (synchronizingInput || inputOwner is null)
    {
      return;
    }
    var previous = store.Selection;
    var next = new FsusMarkdownEditorSelection(
      inputOwner.SelectionStart,
      inputOwner.SelectionEnd);
    if (store.SetSelection(next) && previous != store.Selection)
    {
      RaiseSelectionChanged();
      UpdatePresentation();
    }
  }

  private void OnInputKeyDown(object? sender, KeyEventArgs args)
  {
    if (!args.KeyModifiers.HasFlag(KeyModifiers.Control))
    {
      return;
    }
    if (args.Key == Key.Z)
    {
      _ = args.KeyModifiers.HasFlag(KeyModifiers.Shift) ? Redo() : Undo();
      args.Handled = true;
    }
    else if (args.Key == Key.Y)
    {
      _ = Redo();
      args.Handled = true;
    }
  }

  private bool ApplyUserChanges(
    IReadOnlyList<FsusMarkdownEditorChange> changes,
    FsusMarkdownEditorSelection selection,
    string origin)
  {
    var result = store.Dispatch(new(
      changes,
      History: "separate",
      Origin: origin,
      Selection: selection,
      DocumentIdentity: store.Identity));
    return result.Accepted && ApplyStoreResult(FsusCodeEditorChangeOrigin.User);
  }

  private bool ApplyStoreResult(FsusCodeEditorChangeOrigin origin)
  {
    synchronizingText = true;
    try
    {
      SetCurrentValue(TextProperty, store.Value);
    }
    finally
    {
      synchronizingText = false;
    }
    DocumentStateChanged();
    RaiseDocumentChanged(origin);
    return true;
  }

  private void DocumentStateChanged()
  {
    documentMap = FsusCodeEditorDocumentMap.Create(store.Value);
    if (!string.IsNullOrEmpty(findQuery))
    {
      matches = BuildMatches(store.Value, findQuery, findMatchCase);
      CurrentMatchIndex = -1;
    }
    SynchronizeInput(store.Value, store.Selection);
    UpdateNativeConfiguration();
    UpdatePresentation();
    SyncAutomation();
    RaiseSelectionChanged();
  }

  private void SynchronizeInput(string value, FsusMarkdownEditorSelection selection)
  {
    if (inputOwner is null)
    {
      return;
    }
    synchronizingInput = true;
    try
    {
      inputOwner.Text = value;
      inputOwner.CaretIndex = selection.End;
      inputOwner.SelectionStart = selection.Start;
      inputOwner.SelectionEnd = selection.End;
    }
    finally
    {
      synchronizingInput = false;
    }
  }

  private void SetSelection(FsusMarkdownEditorSelection selection)
  {
    var previous = store.Selection;
    _ = store.SetSelection(selection);
    SynchronizeInput(store.Value, store.Selection);
    if (previous != store.Selection)
    {
      RaiseSelectionChanged();
      UpdatePresentation();
    }
  }

  private void UpdatePresentation()
  {
    var displayedValue = Text;
    var displayedSelection = Selection;
    if (composition is not null)
    {
      var replacedLength = composition.Selection.End - composition.Selection.Start;
      var insertedLength = displayedValue.Length - (composition.Value.Length - replacedLength);
      var previewCaret = composition.Selection.Start + Math.Max(0, insertedLength);
      displayedSelection = new(previewCaret, previewCaret);
    }
    var offset = inputScrollViewer?.Offset ?? default;
    var approximateFirst = Math.Clamp(
      (int)Math.Floor(offset.Y / Math.Max(1, FontSize * 1.5)) + 1 - 8,
      1,
      LineCount);
    var last = Math.Min(LineCount, approximateFirst + 199);
    var from = documentMap.GetLineStart(approximateFirst);
    var to = documentMap.GetLineEnd(last);
    highlightSpans = FsusMarkdownSourceHighlighter.Highlight(displayedValue, from, to);
    if (presentation is null)
    {
      return;
    }
    this.TryFindResource("FsusThemeFocusBrush", out var accent);
    this.TryFindResource("FsusThemeMutedTextBrush", out var muted);
    presentation.Update(
      displayedValue,
      documentMap,
      displayedSelection,
      highlightSpans,
      offset,
      WordWrap,
      TabWidth,
      ShowLineNumbers,
      accent as IBrush,
      muted as IBrush);
  }

  private void OnRealizedLinesChanged(
    object? sender,
    FsusCodeEditorRealizedLinesChangedEventArgs args)
  {
    FirstRealizedLine = args.FirstLine;
    LastRealizedLine = args.LastLine;
    if (RealizedLineCount > args.Limit)
    {
      throw new InvalidOperationException("Code editor realized-line budget exceeded.");
    }
    SyncAutomation();
  }

  private void ApplyPendingScrollPosition()
  {
    if (pendingScrollPosition is null || inputScrollViewer is null || inputOwner is null)
    {
      return;
    }
    var pending = pendingScrollPosition;
    pendingScrollPosition = null;
    inputOwner.ScrollToLine(pending.AnchorLine - 1);
    inputScrollViewer.Offset = new Vector(pending.HorizontalOffset, pending.VerticalOffset);
    Dispatcher.UIThread.Post(() =>
    {
      if (inputScrollViewer is not null)
      {
        inputScrollViewer.Offset = new Vector(pending.HorizontalOffset, pending.VerticalOffset);
        SyncScrollState();
      }
    });
  }

  private FsusCodeEditorMatch ActivateMatch(int index)
  {
    CurrentMatchIndex = Math.Clamp(index, 0, matches.Count - 1);
    var match = matches[CurrentMatchIndex];
    SelectOffsets(match.Start, match.Start + match.Length);
    RevealOffset(match.Start);
    SyncAutomation();
    return match;
  }

  private void EnsureFind(string query, bool matchCase)
  {
    if (!string.Equals(findQuery, query, StringComparison.Ordinal) ||
      findMatchCase != matchCase)
    {
      Find(query, matchCase);
    }
  }

  private static IReadOnlyList<FsusCodeEditorMatch> BuildMatches(
    string source,
    string query,
    bool matchCase)
  {
    if (string.IsNullOrEmpty(query))
    {
      return [];
    }
    var comparison = matchCase ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
    var matches = new List<FsusCodeEditorMatch>();
    var offset = 0;
    while (offset <= source.Length - query.Length)
    {
      var found = source.IndexOf(query, offset, comparison);
      if (found < 0)
      {
        break;
      }
      matches.Add(new(found, query.Length, matches.Count));
      offset = found + Math.Max(1, query.Length);
    }
    return matches;
  }

  private static FsusMarkdownEditorChange CreateMinimalChange(string before, string after)
  {
    var prefix = 0;
    while (prefix < before.Length && prefix < after.Length && before[prefix] == after[prefix])
    {
      prefix += 1;
    }
    var beforeSuffix = before.Length;
    var afterSuffix = after.Length;
    while (beforeSuffix > prefix && afterSuffix > prefix &&
      before[beforeSuffix - 1] == after[afterSuffix - 1])
    {
      beforeSuffix -= 1;
      afterSuffix -= 1;
    }
    return new(prefix, beforeSuffix, after[prefix..afterSuffix]);
  }

  private void ValidateSelection(int start, int end)
  {
    if (start < 0 || end < start || end > store.Value.Length)
    {
      throw new ArgumentOutOfRangeException(nameof(start));
    }
  }

  private void RaiseDocumentChanged(FsusCodeEditorChangeOrigin origin) =>
    DocumentChanged?.Invoke(this, new(store.Identity, store.Value, origin, store.Revision));

  private void RaiseSelectionChanged() =>
    SelectionChanged?.Invoke(this, new(Selection, CaretPosition));

  private void SyncAutomation()
  {
    var name = FsusComponentClasses.ResolveName(AccessibleName, "Code editor");
    var caret = CaretPosition;
    var status =
      $"line {caret.Line.ToString(CultureInfo.InvariantCulture)}, " +
      $"column {caret.Column.ToString(CultureInfo.InvariantCulture)}, " +
      $"{LineCount.ToString(CultureInfo.InvariantCulture)} lines, " +
      $"{matches.Count.ToString(CultureInfo.InvariantCulture)} matches";
    AutomationProperties.SetName(this, name);
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Edit);
    AutomationProperties.SetItemStatus(this, status);
    if (inputOwner is not null)
    {
      AutomationProperties.SetName(inputOwner, name);
      AutomationProperties.SetItemStatus(inputOwner, status);
    }
    FsusComponentClasses.Ensure(this, "fsus-wrap", WordWrap);
    FsusComponentClasses.Ensure(this, "fsus-line-numbers", ShowLineNumbers);
    FsusComponentClasses.Ensure(this, "fsus-readonly", IsReadOnly);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    FsusComponentClasses.Ensure(this, "fsus-virtualized", IsVirtualized);
  }

  private sealed record CompositionState(
    string Value,
    FsusMarkdownEditorSelection Selection);

  private sealed class RelayCommand(
    Action<object?> execute,
    Predicate<object?> canExecute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute(parameter);

    public void Execute(object? parameter) => execute(parameter);
  }

  private sealed class AsyncRelayCommand(
    Func<object?, Task> execute,
    Predicate<object?> canExecute) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute(parameter);

    public async void Execute(object? parameter) => await execute(parameter);
  }

  private sealed class CodeEditorAutomationPeer(FsusCodeEditor owner)
    : ControlAutomationPeer(owner), IValueProvider
  {
    private FsusCodeEditor Editor => (FsusCodeEditor)Owner;

    public bool IsReadOnly => Editor.IsReadOnly;

    public string Value => Editor.Text;

    public void SetValue(string? value)
    {
      if (!Editor.CanPaste)
      {
        throw new InvalidOperationException("The code editor cannot accept edits.");
      }
      _ = Editor.ApplyUserChanges(
        [new FsusMarkdownEditorChange(0, Editor.Text.Length, value ?? string.Empty)],
        new FsusMarkdownEditorSelection((value ?? string.Empty).Length, (value ?? string.Empty).Length),
        "command");
    }
  }
}
