using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusDocumentTabCloseReason
{
  Programmatic,
  CloseButton,
  MiddleClick,
  Keyboard,
}

public enum FsusDocumentTabReorderSource
{
  Programmatic,
  Pointer,
  Keyboard,
}

public sealed class FsusDocumentTabCloseRequestedEventArgs(
  FsusDocumentTab document,
  FsusDocumentTabCloseReason reason) : EventArgs
{
  public string Key { get; } = document.Key;
  public FsusDocumentTab Document { get; } = document;
  public FsusDocumentTabCloseReason Reason { get; } = reason;
  public bool Cancel { get; set; }
}

public sealed class FsusDocumentTabReorderedEventArgs(
  FsusDocumentTab document,
  int oldIndex,
  int newIndex,
  FsusDocumentTabReorderSource source) : EventArgs
{
  public string Key { get; } = document.Key;
  public FsusDocumentTab Document { get; } = document;
  public int OldIndex { get; } = oldIndex;
  public int NewIndex { get; } = newIndex;
  public FsusDocumentTabReorderSource Source { get; } = source;
}

public sealed class FsusDocumentTabContextRequestedEventArgs(
  FsusDocumentTab document,
  FsusTreeInteractionSource source,
  Rect anchorBounds,
  Control anchor) : EventArgs
{
  public string Key { get; } = document.Key;
  public FsusDocumentTab Document { get; } = document;
  public FsusTreeInteractionSource InteractionSource { get; } = source;
  public Rect AnchorBounds { get; } = anchorBounds;
  public Control Anchor { get; } = anchor;
}

public class FsusDocumentTab : FsusTabPane
{
  public static readonly StyledProperty<bool> IsDirtyProperty =
    AvaloniaProperty.Register<FsusDocumentTab, bool>(nameof(IsDirty));

  public static readonly StyledProperty<bool> IsClosableProperty =
    AvaloniaProperty.Register<FsusDocumentTab, bool>(nameof(IsClosable), true);

  public static readonly StyledProperty<string?> CloseAccessibleNameProperty =
    AvaloniaProperty.Register<FsusDocumentTab, string?>(nameof(CloseAccessibleName));

  private Button? closeButton;
  private Point pointerOrigin;
  private bool pointerDragCandidate;
  private bool pointerDragMoved;

  internal FsusDocumentTabs? ParentDocumentTabs { get; set; }
  internal NavigationMethod FocusNavigationMethod { get; private set; }

  public FsusDocumentTab()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-document-tab");
    SyncDocumentState();
  }

  public bool IsDirty
  {
    get => GetValue(IsDirtyProperty);
    set => SetValue(IsDirtyProperty, value);
  }

  public bool IsClosable
  {
    get => GetValue(IsClosableProperty);
    set => SetValue(IsClosableProperty, value);
  }

  public string? CloseAccessibleName
  {
    get => GetValue(CloseAccessibleNameProperty);
    set => SetValue(CloseAccessibleNameProperty, value);
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    if (closeButton is not null)
    {
      closeButton.Click -= OnCloseButtonClick;
    }

    base.OnApplyTemplate(e);
    closeButton = e.NameScope.Find<Button>("PART_CloseButton");
    if (closeButton is not null)
    {
      closeButton.Click += OnCloseButtonClick;
      FsusNativeTitleBar.SetIsNoDrag(closeButton, true);
    }
    SyncDocumentState();
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    var point = e.GetCurrentPoint(this);
    if (
      !e.Handled &&
      IsEnabled &&
      point.Properties.IsMiddleButtonPressed &&
      ParentDocumentTabs is not null)
    {
      ParentDocumentTabs.RequestClose(Key, FsusDocumentTabCloseReason.MiddleClick);
      e.Handled = true;
      return;
    }

    if (
      !e.Handled &&
      IsEnabled &&
      point.Properties.IsRightButtonPressed &&
      ParentDocumentTabs is not null)
    {
      ParentDocumentTabs.RequestDocumentContext(
        Key,
        FsusTreeInteractionSource.Pointer);
      e.Handled = true;
      return;
    }

    if (
      !e.Handled &&
      IsEnabled &&
      point.Properties.IsLeftButtonPressed &&
      ParentDocumentTabs is not null)
    {
      pointerOrigin = e.GetPosition(ParentDocumentTabs);
      pointerDragCandidate = true;
      pointerDragMoved = false;
      e.Pointer.Capture(this);
    }

    base.OnPointerPressed(e);
    if (!IsEnabled || ParentDocumentTabs is null)
    {
      return;
    }

    point = e.GetCurrentPoint(this);
  }

  protected override void OnPointerMoved(PointerEventArgs e)
  {
    base.OnPointerMoved(e);
    if (!pointerDragCandidate || ParentDocumentTabs is null)
    {
      return;
    }

    var position = e.GetPosition(ParentDocumentTabs);
    pointerDragMoved |=
      Math.Abs(position.X - pointerOrigin.X) >= 6d ||
      Math.Abs(position.Y - pointerOrigin.Y) >= 6d;
    FsusComponentClasses.Ensure(this, "fsus-dragging", pointerDragMoved);
  }

  protected override void OnPointerReleased(PointerReleasedEventArgs e)
  {
    base.OnPointerReleased(e);
    if (pointerDragCandidate && pointerDragMoved && ParentDocumentTabs is not null)
    {
      ParentDocumentTabs.CompletePointerReorder(
        Key,
        e.GetPosition(ParentDocumentTabs));
      e.Handled = true;
    }

    pointerDragCandidate = false;
    pointerDragMoved = false;
    FsusComponentClasses.Ensure(this, "fsus-dragging", false);
    e.Pointer.Capture(null);
  }

  protected override void OnGotFocus(FocusChangedEventArgs e)
  {
    base.OnGotFocus(e);
    if (ReferenceEquals(e.NewFocusedElement, this))
    {
      FocusNavigationMethod = e.NavigationMethod;
    }
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (
      !e.Handled &&
      e.Key is global::Avalonia.Input.Key.F10 or global::Avalonia.Input.Key.Apps &&
      (e.Key == global::Avalonia.Input.Key.Apps ||
       e.KeyModifiers.HasFlag(KeyModifiers.Shift)) &&
      ParentDocumentTabs?.RequestDocumentContext(
        Key,
        FsusTreeInteractionSource.Keyboard) == true)
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusDocumentTabAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == IsDirtyProperty ||
      change.Property == IsClosableProperty ||
      change.Property == CloseAccessibleNameProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncDocumentState();
    }
  }

  internal void SyncDocumentState()
  {
    FsusComponentClasses.Ensure(this, "fsus-dirty", IsDirty);
    FsusComponentClasses.Ensure(this, "fsus-closable", IsClosable);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.TabItem);
    AutomationProperties.SetItemStatus(
      this,
      string.Join(
        ", ",
        IsSelected ? "selected" : "available",
        IsDirty ? "unsaved changes" : "saved",
        IsClosable ? "closable" : "not closable"));
    AutomationProperties.SetHelpText(
      this,
      IsDirty ? "This document has unsaved changes." : string.Empty);

    if (closeButton is not null)
    {
      closeButton.IsVisible = IsClosable;
      closeButton.IsEnabled = IsClosable && IsEnabled;
      AutomationProperties.SetName(
        closeButton,
        CloseAccessibleName ??
          $"Close {FsusComponentClasses.ResolveName(null, Header)}");
      AutomationProperties.SetControlTypeOverride(closeButton, AutomationControlType.Button);
      AutomationProperties.SetHelpText(
        closeButton,
        IsDirty ? "Close document with unsaved changes" : "Close document");
    }
  }

  private void OnCloseButtonClick(object? sender, RoutedEventArgs e)
  {
    ParentDocumentTabs?.RequestClose(Key, FsusDocumentTabCloseReason.CloseButton);
    e.Handled = true;
  }

  private sealed class FsusDocumentTabAutomationPeer(FsusDocumentTab owner)
    : ControlAutomationPeer(owner), ISelectionItemProvider
  {
    public bool IsSelected => owner.IsSelected;

    public ISelectionProvider SelectionContainer =>
      owner.ParentDocumentTabs is null
        ? null!
        : (ISelectionProvider)CreatePeerForElement(owner.ParentDocumentTabs);

    public void AddToSelection() => Select();

    public void RemoveFromSelection()
    {
      // Document tabs preserve a single active document while enabled tabs exist.
    }

    public void Select()
    {
      if (owner.IsEnabled)
      {
        owner.ParentDocumentTabs?.SelectKey(owner.Key);
      }
    }
  }
}

public class FsusDocumentTabs : FsusTabs
{
  public static readonly StyledProperty<double> HeaderScrollStepProperty =
    AvaloniaProperty.Register<FsusDocumentTabs, double>(nameof(HeaderScrollStep), 120d);

  private ScrollViewer? headerScrollViewer;
  private ContentPresenter? selectedContentHost;
  private bool isReordering;
  private string requestedSelectedKey = string.Empty;

  public FsusDocumentTabs()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-document-tabs");
    if (Panes is INotifyCollectionChanged observable)
    {
      observable.CollectionChanged += OnDocumentsChanged;
    }
    SelectionChanged += OnDocumentSelectionChanged;
    SyncDocumentAutomation();
  }

  public event EventHandler<FsusDocumentTabCloseRequestedEventArgs>? CloseRequested;
  public event EventHandler<FsusDocumentTabReorderedEventArgs>? Reordered;
  public event EventHandler<FsusDocumentTabContextRequestedEventArgs>? DocumentContextRequested;

  public IReadOnlyList<FsusDocumentTab> Documents => Panes.OfType<FsusDocumentTab>().ToArray();

  public double HeaderScrollStep
  {
    get => GetValue(HeaderScrollStepProperty);
    set => SetValue(HeaderScrollStepProperty, value);
  }

  public bool CanScrollBackward => headerScrollViewer?.Offset.X > 0d;

  public bool CanScrollForward =>
    headerScrollViewer is not null &&
    headerScrollViewer.Offset.X < headerScrollViewer.Extent.Width - headerScrollViewer.Viewport.Width;

  public double HeaderExtentWidth => headerScrollViewer?.Extent.Width ?? 0d;

  public double HeaderViewportWidth => headerScrollViewer?.Viewport.Width ?? 0d;

  public double HeaderScrollOffset => headerScrollViewer?.Offset.X ?? 0d;

  public void AddDocument(FsusDocumentTab document)
  {
    ArgumentNullException.ThrowIfNull(document);
    if (Panes.Any((pane) => pane.Key == document.Key))
    {
      throw new ArgumentException(
        $"A document with key '{document.Key}' already exists.",
        nameof(document));
    }
    Panes.Add(document);
  }

  public new void SelectKey(string key)
  {
    if (Documents.Any((document) => document.Key == key && document.IsEnabled))
    {
      requestedSelectedKey = key;
    }
    base.SelectKey(key);
    RevealActiveDocument();
  }

  public bool RequestClose(
    string key,
    FsusDocumentTabCloseReason reason = FsusDocumentTabCloseReason.Programmatic)
  {
    var document = Documents.FirstOrDefault((candidate) => candidate.Key == key);
    if (document is null || !document.IsEnabled || !document.IsClosable)
    {
      return false;
    }

    var request = new FsusDocumentTabCloseRequestedEventArgs(document, reason);
    CloseRequested?.Invoke(this, request);
    if (request.Cancel)
    {
      AutomationProperties.SetItemStatus(
        this,
        $"close cancelled for {FsusComponentClasses.ResolveName(null, document.Header)}");
      return false;
    }

    var oldIndex = Panes.IndexOf(document);
    var wasSelected = document.Key == SelectedKey;
    Panes.Remove(document);
    if (wasSelected)
    {
      var fallback = Documents.Count == 0
        ? null
        : Documents[Math.Min(oldIndex, Documents.Count - 1)];
      if (fallback is not null)
      {
        SelectKey(fallback.Key);
        fallback.Focus(NavigationMethod.Tab);
      }
    }

    SyncDocumentAutomation();
    return true;
  }

  public bool ReorderDocument(
    string key,
    int newIndex,
    FsusDocumentTabReorderSource source = FsusDocumentTabReorderSource.Programmatic)
  {
    var document = Documents.FirstOrDefault((candidate) => candidate.Key == key);
    if (document is null)
    {
      return false;
    }

    var oldIndex = Panes.IndexOf(document);
    var normalizedIndex = Math.Clamp(newIndex, 0, Math.Max(0, Panes.Count - 1));
    if (oldIndex == normalizedIndex)
    {
      return false;
    }

    var selectedKey = SelectedKey;
    var wasFocused = document.IsFocused;
    var focusNavigationMethod = document.FocusNavigationMethod;
    isReordering = true;
    try
    {
      Panes.RemoveAt(oldIndex);
      Panes.Insert(normalizedIndex, document);
    }
    finally
    {
      isReordering = false;
    }

    if (!string.IsNullOrEmpty(selectedKey))
    {
      SelectKey(selectedKey);
    }
    if (TopLevel.GetTopLevel(document) is not null)
    {
      // Reattachment invalidates styling. Retire the old template before queued layout.
      document.ApplyStyling();
      document.ApplyTemplate();
    }
    if (wasFocused)
    {
      document.Focus(focusNavigationMethod);
    }
    Reordered?.Invoke(
      this,
      new FsusDocumentTabReorderedEventArgs(
        document,
        oldIndex,
        normalizedIndex,
        source));
    SyncDocumentAutomation();
    return true;
  }

  public bool CycleDocuments(bool reverse = false)
  {
    var enabled = Documents.Where((document) => document.IsEnabled).ToList();
    if (enabled.Count <= 1)
    {
      return false;
    }

    var currentIndex = enabled.FindIndex((document) => document.Key == SelectedKey);
    if (currentIndex < 0)
    {
      currentIndex = 0;
    }
    var nextIndex = reverse
      ? (currentIndex - 1 + enabled.Count) % enabled.Count
      : (currentIndex + 1) % enabled.Count;
    SelectKey(enabled[nextIndex].Key);
    enabled[nextIndex].Focus(NavigationMethod.Tab);
    return true;
  }

  public bool ScrollHeaders(bool forward)
  {
    if (headerScrollViewer is null)
    {
      return false;
    }

    var delta = Math.Max(1d, HeaderScrollStep) * (forward ? 1d : -1d);
    var maximum = Math.Max(0d, headerScrollViewer.Extent.Width - headerScrollViewer.Viewport.Width);
    var nextOffset = Math.Clamp(headerScrollViewer.Offset.X + delta, 0d, maximum);
    if (nextOffset.Equals(headerScrollViewer.Offset.X))
    {
      return false;
    }
    headerScrollViewer.Offset = new Vector(nextOffset, headerScrollViewer.Offset.Y);
    SyncOverflowState();
    return true;
  }

  public bool RequestDocumentContext(
    string key,
    FsusTreeInteractionSource source)
  {
    var document = Documents.FirstOrDefault(
      (candidate) => candidate.Key == key && candidate.IsEnabled);
    if (document is null)
    {
      return false;
    }

    var origin = document.TranslatePoint(default, this) ?? default;
    var bounds = new Rect(origin, document.Bounds.Size);
    DocumentContextRequested?.Invoke(
      this,
      new FsusDocumentTabContextRequestedEventArgs(
        document,
        source,
        bounds,
        document));
    return true;
  }

  protected override void OnApplyTemplate(TemplateAppliedEventArgs e)
  {
    if (headerScrollViewer is not null)
    {
      headerScrollViewer.ScrollChanged -= OnHeaderScrollChanged;
    }
    base.OnApplyTemplate(e);
    selectedContentHost = e.NameScope.Find<ContentPresenter>("PART_SelectedContentHost");
    headerScrollViewer = e.NameScope.Find<ScrollViewer>("PART_HeaderScrollViewer");
    if (headerScrollViewer is not null)
    {
      headerScrollViewer.ScrollChanged += OnHeaderScrollChanged;
    }
    if (string.IsNullOrEmpty(requestedSelectedKey))
    {
      requestedSelectedKey = SelectedKey;
    }
    if (!string.IsNullOrEmpty(requestedSelectedKey))
    {
      base.SelectKey(requestedSelectedKey);
    }
    foreach (var document in Documents)
    {
      document.SyncDocumentState();
    }
    SyncOverflowState();
    RevealActiveDocument();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (change.Property == TemplateProperty && selectedContentHost is not null)
    {
      // A detached presenter can still own the document body after retemplating.
      // Release that visual child without changing the document's Content.
      // Retire its template first so null content cannot rebuild or recycle a child.
      selectedContentHost.ContentTemplate = null;
      selectedContentHost.Content = null;
      selectedContentHost.UpdateChild();
      selectedContentHost = null;
    }
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    Dispatcher.UIThread.Post(() =>
    {
      if (!string.IsNullOrEmpty(requestedSelectedKey))
      {
        base.SelectKey(requestedSelectedKey);
        foreach (var document in Documents)
        {
          document.SyncDocumentState();
        }
        RevealActiveDocument();
      }
    }, DispatcherPriority.Loaded);
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    var platformModifier =
      e.KeyModifiers.HasFlag(KeyModifiers.Control) ||
      e.KeyModifiers.HasFlag(KeyModifiers.Meta);
    if (!e.Handled && e.Key == Key.Tab && platformModifier)
    {
      e.Handled = CycleDocuments(e.KeyModifiers.HasFlag(KeyModifiers.Shift));
      if (e.Handled)
      {
        return;
      }
    }

    base.OnKeyDown(e);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusDocumentTabsAutomationPeer(this);

  internal void CompletePointerReorder(string key, Point position)
  {
    var documents = Documents;
    var targetIndex = documents.Count - 1;
    for (var index = 0; index < documents.Count; index++)
    {
      var origin = documents[index].TranslatePoint(default, this);
      if (origin is not null && position.X < origin.Value.X + (documents[index].Bounds.Width / 2d))
      {
        targetIndex = index;
        break;
      }
    }
    ReorderDocument(key, targetIndex, FsusDocumentTabReorderSource.Pointer);
  }

  private void OnDocumentsChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    if (e.OldItems is not null)
    {
      foreach (var document in e.OldItems.OfType<FsusDocumentTab>())
      {
        document.ParentDocumentTabs = null;
      }
    }
    if (e.NewItems is not null)
    {
      foreach (var document in e.NewItems.OfType<FsusDocumentTab>())
      {
        document.ParentDocumentTabs = this;
        document.SyncDocumentState();
      }
    }
    if (e.Action == NotifyCollectionChangedAction.Reset)
    {
      foreach (var document in Documents)
      {
        document.ParentDocumentTabs = this;
      }
    }

    if (!isReordering)
    {
      SyncDocumentAutomation();
    }
    (ControlAutomationPeer.FromElement(this) as FsusDocumentTabsAutomationPeer)
      ?.InvalidateOwnedChildren();
  }

  private void OnDocumentSelectionChanged(
    object? sender,
    FsusNavigationSelectionChangedEventArgs e)
  {
    foreach (var document in Documents)
    {
      document.SyncDocumentState();
    }
    RevealActiveDocument();
    SyncDocumentAutomation();
  }

  private void RevealActiveDocument()
  {
    var selected = Documents.FirstOrDefault((document) => document.Key == SelectedKey);
    if (selected is null)
    {
      return;
    }

    Dispatcher.UIThread.Post(() =>
    {
      selected.BringIntoView();
      SyncOverflowState();
    }, DispatcherPriority.Loaded);
  }

  private void OnHeaderScrollChanged(object? sender, ScrollChangedEventArgs e) =>
    SyncOverflowState();

  private void SyncOverflowState()
  {
    var hasOverflow = headerScrollViewer is not null &&
      headerScrollViewer.Extent.Width > headerScrollViewer.Viewport.Width;
    FsusComponentClasses.Ensure(this, "fsus-overflow", hasOverflow);
    FsusComponentClasses.Ensure(this, "fsus-can-scroll-backward", CanScrollBackward);
    FsusComponentClasses.Ensure(this, "fsus-can-scroll-forward", CanScrollForward);
  }

  private void SyncDocumentAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tab);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Polite);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrEmpty(SelectedKey)
        ? $"{Documents.Count.ToString(CultureInfo.InvariantCulture)} documents"
        : $"active {SelectedKey}, {Documents.Count.ToString(CultureInfo.InvariantCulture)} documents");
    for (var index = 0; index < Documents.Count; index++)
    {
      AutomationProperties.SetPositionInSet(Documents[index], index + 1);
      AutomationProperties.SetSizeOfSet(Documents[index], Documents.Count);
    }
  }

  private sealed class FsusDocumentTabsAutomationPeer(FsusDocumentTabs owner)
    : ControlAutomationPeer(owner), ISelectionProvider
  {
    public bool CanSelectMultiple => false;
    public bool IsSelectionRequired => owner.Documents.Any((document) => document.IsEnabled);

    public IReadOnlyList<AutomationPeer> GetSelection()
    {
      var selected = owner.Documents.FirstOrDefault(
        (document) => document.Key == owner.SelectedKey);
      return selected is null ? [] : [CreatePeerForElement(selected)];
    }

    internal void InvalidateOwnedChildren() => InvalidateChildren();
  }
}
