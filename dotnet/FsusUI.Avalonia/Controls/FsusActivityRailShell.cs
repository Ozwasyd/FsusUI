using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Metadata;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusActivityRailInteractionSource
{
  Programmatic,
  Pointer,
  Keyboard,
}

public enum FsusContextualPaneResizeReason
{
  Programmatic,
  Pointer,
  Keyboard,
  Reset,
  BoundsCoercion,
}

public sealed class FsusActivitySectionActivatedEventArgs(
  string key,
  string previousKey,
  bool isPaneOpen,
  FsusActivityRailInteractionSource interactionSource) : EventArgs
{
  public string Key { get; } = key;
  public string PreviousKey { get; } = previousKey;
  public bool IsPaneOpen { get; } = isPaneOpen;
  public FsusActivityRailInteractionSource InteractionSource { get; } = interactionSource;
}

public sealed class FsusContextualPaneResizedEventArgs(
  double oldWidth,
  double newWidth,
  FsusContextualPaneResizeReason reason,
  bool isCompleted) : EventArgs
{
  public double OldWidth { get; } = oldWidth;
  public double NewWidth { get; } = newWidth;
  public FsusContextualPaneResizeReason Reason { get; } = reason;
  public bool IsCompleted { get; } = isCompleted;
}

public class FsusActivityRailSection : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusActivityRailSection, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<string> HeaderProperty =
    AvaloniaProperty.Register<FsusActivityRailSection, string>(nameof(Header), string.Empty);

  public static readonly StyledProperty<object?> IconProperty =
    AvaloniaProperty.Register<FsusActivityRailSection, object?>(nameof(Icon));

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusActivityRailSection, string?>(nameof(AccessibleName));

  public static readonly StyledProperty<bool> IsSelectedProperty =
    AvaloniaProperty.Register<FsusActivityRailSection, bool>(nameof(IsSelected));

  internal FsusActivityRailShell? ParentShell { get; set; }

  public FsusActivityRailSection()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-activity-rail-section");
    Focusable = true;
    Template = CreateDefaultTemplate();
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public string Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public object? Icon
  {
    get => GetValue(IconProperty);
    set => SetValue(IconProperty, value);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public bool IsSelected
  {
    get => GetValue(IsSelectedProperty);
    internal set => SetValue(IsSelectedProperty, value);
  }

  [Content]
  public new object? Content
  {
    get => base.Content;
    set => base.Content = value;
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (
      e.Handled ||
      !IsEnabled ||
      !e.GetCurrentPoint(this).Properties.IsLeftButtonPressed ||
      ParentShell is null)
    {
      return;
    }

    ParentShell.ActivateKey(Key, FsusActivityRailInteractionSource.Pointer);
    Focus(NavigationMethod.Pointer);
    e.Handled = true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    if (ParentShell is not null && ParentShell.HandleSectionKey(this, e.Key))
    {
      e.Handled = true;
      return;
    }

    base.OnKeyDown(e);
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusActivityRailSectionAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IconProperty ||
      change.Property == AccessibleNameProperty ||
      change.Property == IsSelectedProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }

    if (change.Property == IsSelectedProperty &&
        change.OldValue is bool oldSelection &&
        change.NewValue is bool newSelection)
    {
      (ControlAutomationPeer.FromElement(this) as FsusActivityRailSectionAutomationPeer)
        ?.RaiseSelectionChanged(oldSelection, newSelection);
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(
      this,
      FsusComponentClasses.ResolveName(
        AccessibleName,
        string.IsNullOrWhiteSpace(Header) ? Key : Header));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.TabItem);
    AutomationProperties.SetItemStatus(
      this,
      IsSelected
        ? ParentShell?.IsPaneOpen == true ? "selected, pane expanded" : "selected, pane collapsed"
        : IsEnabled ? "available" : "disabled");
  }

  private static IControlTemplate CreateDefaultTemplate()
  {
    return new FuncControlTemplate<FsusActivityRailSection>((section, _) =>
    {
      var border = new Border
      {
        Name = "PART_SectionBorder",
        HorizontalAlignment = HorizontalAlignment.Stretch,
        VerticalAlignment = VerticalAlignment.Stretch,
      };
      border[!Border.BackgroundProperty] = section[!BackgroundProperty];
      border[!Border.BorderBrushProperty] = section[!BorderBrushProperty];
      border[!Border.BorderThicknessProperty] = section[!BorderThicknessProperty];
      border[!Border.CornerRadiusProperty] = section[!CornerRadiusProperty];
      border[!Border.PaddingProperty] = section[!PaddingProperty];

      var iconPresenter = new ContentPresenter
      {
        Name = "PART_Icon",
        HorizontalAlignment = HorizontalAlignment.Center,
        VerticalAlignment = VerticalAlignment.Center,
      };
      iconPresenter[!ContentPresenter.ContentProperty] = section[!IconProperty];
      border.Child = iconPresenter;
      return border;
    });
  }

  private sealed class FsusActivityRailSectionAutomationPeer(FsusActivityRailSection owner)
    : ControlAutomationPeer(owner), ISelectionItemProvider
  {
    public bool IsSelected => owner.IsSelected;

    public ISelectionProvider SelectionContainer =>
      owner.ParentShell is null
        ? null!
        : (ISelectionProvider)CreatePeerForElement(owner.ParentShell);

    public void AddToSelection() => Select();

    public void RemoveFromSelection()
    {
      if (owner.IsSelected)
      {
        owner.ParentShell?.HidePane(FsusActivityRailInteractionSource.Programmatic);
      }
    }

    public void Select()
    {
      if (owner.IsEnabled)
      {
        owner.ParentShell?.ActivateKey(
          owner.Key,
          FsusActivityRailInteractionSource.Programmatic);
      }
    }

    internal void RaiseSelectionChanged(bool oldValue, bool newValue) =>
      RaisePropertyChangedEvent(
        SelectionItemPatternIdentifiers.IsSelectedProperty,
        oldValue,
        newValue);
  }
}

public class FsusActivityRailShell : ContentControl
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, string?>(
      nameof(AccessibleName),
      "Desktop activity rail");

  public static readonly StyledProperty<string> SelectedKeyProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, string>(
      nameof(SelectedKey),
      string.Empty);

  public static readonly StyledProperty<bool> IsPaneOpenProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, bool>(nameof(IsPaneOpen), true);

  public static readonly StyledProperty<double> ActivityRailWidthProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(
      nameof(ActivityRailWidth),
      52d);

  public static readonly StyledProperty<double> PaneWidthProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(nameof(PaneWidth), 280d);

  public static readonly StyledProperty<double> DefaultPaneWidthProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(
      nameof(DefaultPaneWidth),
      280d);

  public static readonly StyledProperty<double> MinPaneWidthProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(nameof(MinPaneWidth), 220d);

  public static readonly StyledProperty<double> MaxPaneWidthProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(nameof(MaxPaneWidth), 480d);

  public static readonly StyledProperty<double> KeyboardResizeStepProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, double>(
      nameof(KeyboardResizeStep),
      8d);

  public static readonly StyledProperty<object?> MainContentProperty =
    AvaloniaProperty.Register<FsusActivityRailShell, object?>(nameof(MainContent));

  private readonly ObservableCollection<FsusActivityRailSection> sections = [];
  private readonly Grid rootGrid = new();
  private readonly Border activityRail = new();
  private readonly StackPanel sectionHost = new();
  private readonly Border contextualPane = new();
  private readonly ContentPresenter contextualPanePresenter = new();
  private readonly PaneResizeThumb resizeThumb;
  private readonly ContentPresenter mainPresenter = new();
  private string activeKey = string.Empty;
  private bool isSyncingProperty;
  private double dragStartWidth;

  public FsusActivityRailShell()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-activity-rail-shell");
    Focusable = true;
    resizeThumb = new PaneResizeThumb(this);
    sections.CollectionChanged += OnSectionsChanged;
    BuildVisualTree();
    SyncState();
  }

  public event EventHandler<FsusActivitySectionActivatedEventArgs>? SectionActivated;

  public event EventHandler<FsusContextualPaneResizedEventArgs>? PaneResized;

  public ObservableCollection<FsusActivityRailSection> Sections => sections;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string SelectedKey
  {
    get => GetValue(SelectedKeyProperty);
    set => SetValue(SelectedKeyProperty, value);
  }

  public bool IsPaneOpen
  {
    get => GetValue(IsPaneOpenProperty);
    set => SetValue(IsPaneOpenProperty, value);
  }

  public double ActivityRailWidth
  {
    get => GetValue(ActivityRailWidthProperty);
    set => SetValue(ActivityRailWidthProperty, value);
  }

  public double PaneWidth
  {
    get => GetValue(PaneWidthProperty);
    set => SetValue(PaneWidthProperty, value);
  }

  public double DefaultPaneWidth
  {
    get => GetValue(DefaultPaneWidthProperty);
    set => SetValue(DefaultPaneWidthProperty, value);
  }

  public double MinPaneWidth
  {
    get => GetValue(MinPaneWidthProperty);
    set => SetValue(MinPaneWidthProperty, value);
  }

  public double MaxPaneWidth
  {
    get => GetValue(MaxPaneWidthProperty);
    set => SetValue(MaxPaneWidthProperty, value);
  }

  public double KeyboardResizeStep
  {
    get => GetValue(KeyboardResizeStepProperty);
    set => SetValue(KeyboardResizeStepProperty, value);
  }

  [Content]
  public object? MainContent
  {
    get => GetValue(MainContentProperty);
    set => SetValue(MainContentProperty, value);
  }

  public FsusActivityRailSection? ActiveSection =>
    sections.FirstOrDefault((section) => section.Key == activeKey);

  public void ActivateKey(
    string key,
    FsusActivityRailInteractionSource source = FsusActivityRailInteractionSource.Programmatic)
  {
    var section = sections.FirstOrDefault(
      (candidate) => candidate.Key == key && candidate.IsEnabled);
    if (section is null)
    {
      return;
    }

    var previousKey = activeKey;
    if (activeKey == section.Key)
    {
      SetPaneOpen(!IsPaneOpen);
    }
    else
    {
      activeKey = section.Key;
      SetSelectedKey(section.Key);
      SetPaneOpen(true);
    }

    SyncState();
    SectionActivated?.Invoke(
      this,
      new FsusActivitySectionActivatedEventArgs(
        section.Key,
        previousKey,
        IsPaneOpen,
        source));
  }

  public void ShowPane(
    FsusActivityRailInteractionSource source = FsusActivityRailInteractionSource.Programmatic)
  {
    if (ActiveSection is null || IsPaneOpen)
    {
      return;
    }

    SetPaneOpen(true);
    SyncState();
    SectionActivated?.Invoke(
      this,
      new FsusActivitySectionActivatedEventArgs(activeKey, activeKey, true, source));
  }

  public void HidePane(
    FsusActivityRailInteractionSource source = FsusActivityRailInteractionSource.Programmatic)
  {
    if (!IsPaneOpen)
    {
      return;
    }

    SetPaneOpen(false);
    SyncState();
    SectionActivated?.Invoke(
      this,
      new FsusActivitySectionActivatedEventArgs(activeKey, activeKey, false, source));
  }

  public double ResizePane(
    double requestedWidth,
    FsusContextualPaneResizeReason reason = FsusContextualPaneResizeReason.Programmatic,
    bool isCompleted = true)
  {
    var oldWidth = PaneWidth;
    var normalized = NormalizePaneWidth(requestedWidth);
    SetCurrentValue(PaneWidthProperty, normalized);
    SyncPaneGeometry();
    if (!oldWidth.Equals(normalized) || isCompleted)
    {
      PaneResized?.Invoke(
        this,
        new FsusContextualPaneResizedEventArgs(
          oldWidth,
          normalized,
          reason,
          isCompleted));
    }

    return normalized;
  }

  public double ResetPaneWidth()
  {
    return ResizePane(
      DefaultPaneWidth,
      FsusContextualPaneResizeReason.Reset,
      true);
  }

  public bool HandleSectionKey(FsusActivityRailSection section, Key key)
  {
    var enabled = sections.Where((candidate) => candidate.IsEnabled).ToList();
    if (enabled.Count == 0)
    {
      return false;
    }

    var currentIndex = enabled.IndexOf(section);
    FsusActivityRailSection? target = key switch
    {
      Key.Up => enabled[Math.Max(0, currentIndex - 1)],
      Key.Down => enabled[Math.Min(enabled.Count - 1, currentIndex + 1)],
      Key.Home => enabled[0],
      Key.End => enabled[^1],
      _ => null,
    };

    if (target is not null)
    {
      target.Focus(NavigationMethod.Directional);
      return true;
    }

    if (key is Key.Enter or Key.Space)
    {
      ActivateKey(section.Key, FsusActivityRailInteractionSource.Keyboard);
      return true;
    }

    return false;
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new FsusActivityRailShellAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (isSyncingProperty)
    {
      return;
    }

    if (change.Property == SelectedKeyProperty)
    {
      var section = sections.FirstOrDefault(
        (candidate) => candidate.Key == SelectedKey && candidate.IsEnabled);
      if (section is not null && section.Key != activeKey)
      {
        var previousKey = activeKey;
        activeKey = section.Key;
        SetPaneOpen(true);
        SyncState();
        SectionActivated?.Invoke(
          this,
          new FsusActivitySectionActivatedEventArgs(
            section.Key,
            previousKey,
            true,
            FsusActivityRailInteractionSource.Programmatic));
      }
      else
      {
        NormalizeSelection();
      }
    }
    else if (change.Property == IsPaneOpenProperty)
    {
      SyncState();
    }
    else if (
      change.Property == ActivityRailWidthProperty ||
      change.Property == PaneWidthProperty ||
      change.Property == MinPaneWidthProperty ||
      change.Property == MaxPaneWidthProperty ||
      change.Property == DefaultPaneWidthProperty)
    {
      var normalized = NormalizePaneWidth(PaneWidth);
      if (!PaneWidth.Equals(normalized))
      {
        ResizePane(
          PaneWidth,
          FsusContextualPaneResizeReason.BoundsCoercion,
          true);
      }
      else
      {
        SyncPaneGeometry();
      }
    }
    else if (
      change.Property == MainContentProperty ||
      change.Property == AccessibleNameProperty)
    {
      SyncState();
    }
  }

  private void BuildVisualTree()
  {
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));

    activityRail.Classes.Add("fsus-activity-rail");
    activityRail.Child = sectionHost;
    sectionHost.Spacing = 4;
    sectionHost.Margin = new Thickness(4);

    contextualPane.Classes.Add("fsus-contextual-pane");
    contextualPane.Child = contextualPanePresenter;

    resizeThumb.Classes.Add("fsus-contextual-pane-resizer");
    resizeThumb.Focusable = true;
    resizeThumb.Width = 8d;
    resizeThumb.Background = Brushes.Transparent;
    AutomationProperties.SetName(resizeThumb, "Resize contextual pane");
    AutomationProperties.SetHelpText(
      resizeThumb,
      "Use Left and Right Arrow to resize. Double-click to reset the width.");

    mainPresenter.Classes.Add("fsus-activity-main");

    Grid.SetColumn(activityRail, 0);
    Grid.SetColumn(contextualPane, 1);
    Grid.SetColumn(resizeThumb, 2);
    Grid.SetColumn(mainPresenter, 3);
    rootGrid.Children.Add(activityRail);
    rootGrid.Children.Add(contextualPane);
    rootGrid.Children.Add(resizeThumb);
    rootGrid.Children.Add(mainPresenter);
    base.Content = rootGrid;
  }

  private void OnSectionsChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    if (e.OldItems is not null)
    {
      foreach (FsusActivityRailSection section in e.OldItems)
      {
        section.ParentShell = null;
        sectionHost.Children.Remove(section);
      }
    }

    if (e.Action == NotifyCollectionChangedAction.Reset)
    {
      foreach (var section in sectionHost.Children.OfType<FsusActivityRailSection>())
      {
        section.ParentShell = null;
      }
      sectionHost.Children.Clear();
    }

    if (e.NewItems is not null)
    {
      var index = e.NewStartingIndex >= 0 ? e.NewStartingIndex : sectionHost.Children.Count;
      foreach (FsusActivityRailSection section in e.NewItems)
      {
        section.ParentShell = this;
        sectionHost.Children.Insert(Math.Min(index++, sectionHost.Children.Count), section);
      }
    }

    NormalizeSelection();
    (ControlAutomationPeer.FromElement(this) as FsusActivityRailShellAutomationPeer)
      ?.InvalidateOwnedChildren();
  }

  private void NormalizeSelection()
  {
    var selected = sections.FirstOrDefault(
      (section) => section.Key == activeKey && section.IsEnabled);
    selected ??= sections.FirstOrDefault((section) => section.IsEnabled);
    activeKey = selected?.Key ?? string.Empty;
    SetSelectedKey(activeKey);
    if (selected is null)
    {
      SetPaneOpen(false);
    }
    SyncState();
  }

  private void SetSelectedKey(string key)
  {
    isSyncingProperty = true;
    try
    {
      SetCurrentValue(SelectedKeyProperty, key);
    }
    finally
    {
      isSyncingProperty = false;
    }
  }

  private void SetPaneOpen(bool open)
  {
    isSyncingProperty = true;
    try
    {
      SetCurrentValue(IsPaneOpenProperty, open && ActiveSection is not null);
    }
    finally
    {
      isSyncingProperty = false;
    }
  }

  private double NormalizePaneWidth(double width)
  {
    var minimum = Math.Max(0d, MinPaneWidth);
    var maximum = Math.Max(minimum, MaxPaneWidth);
    return Math.Clamp(double.IsFinite(width) ? width : DefaultPaneWidth, minimum, maximum);
  }

  private void SyncPaneGeometry()
  {
    activityRail.Width = Math.Max(0d, ActivityRailWidth);
    contextualPane.Width = IsPaneOpen ? NormalizePaneWidth(PaneWidth) : 0d;
    contextualPane.IsVisible = IsPaneOpen;
    resizeThumb.IsVisible = IsPaneOpen;
  }

  private void SyncState()
  {
    foreach (var section in sections)
    {
      section.IsSelected = section.Key == activeKey;
      section.SyncState();
    }

    contextualPanePresenter.Content = ActiveSection?.Content;
    mainPresenter.Content = MainContent;
    FsusComponentClasses.Ensure(this, "fsus-pane-open", IsPaneOpen);
    FsusComponentClasses.Ensure(this, "fsus-pane-collapsed", !IsPaneOpen);
    SyncPaneGeometry();

    AutomationProperties.SetName(this, AccessibleName ?? "Desktop activity rail");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Pane);
    AutomationProperties.SetLiveSetting(this, AutomationLiveSetting.Polite);
    AutomationProperties.SetItemStatus(
      this,
      string.IsNullOrEmpty(activeKey)
        ? "no activity selected"
        : $"{activeKey}, pane {(IsPaneOpen ? "expanded" : "collapsed")}, " +
          $"{PaneWidth.ToString("0", CultureInfo.InvariantCulture)} pixels");
  }

  private sealed class PaneResizeThumb : Thumb
  {
    private readonly FsusActivityRailShell owner;
    private Point lastPointerPosition;
    private bool isPointerResizing;

    public PaneResizeThumb(FsusActivityRailShell owner)
    {
      this.owner = owner;
      IsHitTestVisible = true;
      Template = new FuncControlTemplate<Thumb>((thumb, _) =>
      {
        var border = new Border();
        border[!Border.BackgroundProperty] = thumb[!BackgroundProperty];
        return border;
      });
      DoubleTapped += OnDoubleTapped;
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
      base.OnPointerPressed(e);
      if (!e.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
      {
        return;
      }

      owner.dragStartWidth = owner.PaneWidth;
      lastPointerPosition = e.GetPosition(owner);
      isPointerResizing = true;
      e.Pointer.Capture(this);
      e.Handled = true;
    }

    protected override void OnPointerMoved(PointerEventArgs e)
    {
      base.OnPointerMoved(e);
      if (!isPointerResizing)
      {
        return;
      }

      var position = e.GetPosition(owner);
      owner.ResizePane(
        owner.PaneWidth + (position.X - lastPointerPosition.X),
        FsusContextualPaneResizeReason.Pointer,
        false);
      lastPointerPosition = position;
      e.Handled = true;
    }

    protected override void OnPointerReleased(PointerReleasedEventArgs e)
    {
      base.OnPointerReleased(e);
      if (!isPointerResizing)
      {
        return;
      }

      isPointerResizing = false;
      e.Pointer.Capture(null);
      owner.PaneResized?.Invoke(
        owner,
        new FsusContextualPaneResizedEventArgs(
          owner.dragStartWidth,
          owner.PaneWidth,
          FsusContextualPaneResizeReason.Pointer,
          true));
      e.Handled = true;
    }

    protected override void OnKeyDown(KeyEventArgs e)
    {
      var direction = e.Key switch
      {
        Key.Left => -1d,
        Key.Right => 1d,
        _ => 0d,
      };
      if (direction == 0d)
      {
        base.OnKeyDown(e);
        return;
      }

      var multiplier = e.KeyModifiers.HasFlag(KeyModifiers.Shift) ? 4d : 1d;
      owner.ResizePane(
        owner.PaneWidth + (direction * owner.KeyboardResizeStep * multiplier),
        FsusContextualPaneResizeReason.Keyboard,
        true);
      e.Handled = true;
    }

    private void OnDoubleTapped(object? sender, TappedEventArgs e)
    {
      owner.ResetPaneWidth();
      e.Handled = true;
    }
  }

  private sealed class FsusActivityRailShellAutomationPeer(FsusActivityRailShell owner)
    : ControlAutomationPeer(owner), ISelectionProvider
  {
    public bool CanSelectMultiple => false;
    public bool IsSelectionRequired => owner.sections.Any((section) => section.IsEnabled);

    public IReadOnlyList<AutomationPeer> GetSelection()
    {
      var selected = owner.ActiveSection;
      return selected is null ? [] : [CreatePeerForElement(selected)];
    }

    internal void InvalidateOwnedChildren() => InvalidateChildren();
  }
}
