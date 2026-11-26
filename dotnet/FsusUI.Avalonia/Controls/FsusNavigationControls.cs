using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusNavigationSelectionChangedEventArgs(string selectedKey) : EventArgs
{
  public string SelectedKey { get; } = selectedKey;
}

public sealed class FsusNavigationActivatedEventArgs(string key) : EventArgs
{
  public string Key { get; } = key;
}

public sealed class FsusTabPaneContextEventArgs(
  string paneKey,
  FsusTabPane pane,
  FsusTreeInteractionSource source) : RoutedEventArgs(FsusTabs.PaneContextRequestedEvent)
{
  public string PaneKey { get; } = paneKey;
  public FsusTabPane Pane { get; } = pane;
  public FsusTreeInteractionSource InteractionSource { get; } = source;
}

public class FsusTabs : TabControl
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusTabs, string?>(nameof(AccessibleName));

  private readonly ObservableCollection<FsusTabPane> panes = [];
  private bool paneSelectionCommitPending;

  public FsusTabs()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tabs");
    Focusable = true;
    panes.CollectionChanged += OnPanesChanged;
    base.SelectionChanged += OnBaseSelectionChanged;
    ItemsSource = panes;
    SyncAutomation();
  }

  public new event EventHandler<FsusNavigationSelectionChangedEventArgs>? SelectionChanged;

  public static readonly RoutedEvent<FsusTabPaneContextEventArgs> PaneContextRequestedEvent =
    RoutedEvent.Register<FsusTabs, FsusTabPaneContextEventArgs>(
      nameof(PaneContextRequested),
      RoutingStrategies.Bubble);

  public event EventHandler<FsusTabPaneContextEventArgs>? PaneContextRequested
  {
    add => AddHandler(PaneContextRequestedEvent, value);
    remove => RemoveHandler(PaneContextRequestedEvent, value);
  }

  public IList<FsusTabPane> Panes => panes;

  public string SelectedKey { get; private set; } = string.Empty;

  public string FocusedKey { get; private set; } = string.Empty;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void SelectKey(string key)
  {
    var pane = panes.FirstOrDefault((candidate) => candidate.Key == key);
    if (pane is null || !pane.IsEnabled)
    {
      SyncPanes();
      return;
    }

    SelectedKey = pane.Key;
    FocusedKey = pane.Key;
    SelectedItem = pane;
    SyncPanes();
    SelectionChanged?.Invoke(this, new FsusNavigationSelectionChangedEventArgs(pane.Key));
  }

  protected void HandleKey(Key key)
  {
    if (panes.Count == 0)
    {
      return;
    }

    var current = panes.FirstOrDefault((pane) => pane.Key == FocusedKey);
    var currentIndex = Math.Max(0, current is null ? -1 : panes.IndexOf(current));
    var next = key switch
    {
      Key.Right => FindEnabledFrom(currentIndex + 1, 1),
      Key.Left => FindEnabledFrom(currentIndex - 1, -1),
      Key.Home => panes.FirstOrDefault((pane) => pane.IsEnabled),
      Key.End => panes.LastOrDefault((pane) => pane.IsEnabled),
      _ => null,
    };

    if (next is not null)
    {
      SelectKey(next.Key);
    }
  }

  public bool RequestPaneContext(string key, FsusTreeInteractionSource source)
  {
    var pane = panes.FirstOrDefault((candidate) => candidate.Key == key);
    if (pane is null || !pane.IsEnabled)
    {
      return false;
    }

    FocusedKey = pane.Key;
    RaiseEvent(new FsusTabPaneContextEventArgs(pane.Key, pane, source));
    return true;
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Handled || panes.Count == 0)
    {
      return;
    }

    var contextRequested = e.Key switch
    {
      Key.F10 when e.KeyModifiers.HasFlag(KeyModifiers.Shift) => true,
      Key.Apps => true,
      _ => false,
    };

    if (contextRequested && RequestPaneContext(FocusedKey, FsusTreeInteractionSource.Keyboard))
    {
      e.Handled = true;
    }
  }

  private void OnBaseSelectionChanged(
    object? sender,
    global::Avalonia.Controls.SelectionChangedEventArgs e)
  {
    if (SelectedItem is not FsusTabPane pane || !pane.IsEnabled)
    {
      return;
    }

    if (pane.Key == SelectedKey)
    {
      SyncPanes();
      return;
    }

    SelectedKey = pane.Key;
    FocusedKey = pane.Key;
    SyncPanes();
    SelectionChanged?.Invoke(
      this,
      new FsusNavigationSelectionChangedEventArgs(pane.Key));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == AccessibleNameProperty)
    {
      SyncAutomation();
    }
  }

  private FsusTabPane? FindEnabledFrom(int startIndex, int direction)
  {
    for (var index = startIndex; index >= 0 && index < panes.Count; index += direction)
    {
      if (panes[index].IsEnabled)
      {
        return panes[index];
      }
    }

    return null;
  }

  private void OnPanesChanged(object? sender, NotifyCollectionChangedEventArgs e)
  {
    var firstEnabled = panes.FirstOrDefault((pane) => pane.IsEnabled);
    if (firstEnabled is null)
    {
      SelectedKey = string.Empty;
      FocusedKey = string.Empty;
    }
    else
    {
      if (!panes.Any((pane) => pane.Key == SelectedKey && pane.IsEnabled))
      {
        SelectedKey = firstEnabled.Key;
      }

      if (!panes.Any((pane) => pane.Key == FocusedKey && pane.IsEnabled))
      {
        FocusedKey = SelectedKey;
      }
    }

    // Normalize incoming selection before realization can replace the active pane.
    // Existing containers must still wait for ItemsSource to process the change.
    if (e.NewItems is not null &&
        e.Action is NotifyCollectionChangedAction.Add or NotifyCollectionChangedAction.Replace)
    {
      var selectedPane = panes.FirstOrDefault(
        (pane) => pane.Key == SelectedKey && pane.IsEnabled);
      foreach (var pane in e.NewItems.OfType<FsusTabPane>())
      {
        if (!ReferenceEquals(pane, selectedPane) && pane.IsSelected)
        {
          pane.IsSelected = false;
        }
      }
    }

    // ItemsSource has not processed this notification yet. IsSelected can reenter
    // its selection model, so commit pane state with SelectedItem below.
    SyncAutomation();
    SchedulePaneSelectionCommit();
  }

  private void SchedulePaneSelectionCommit()
  {
    if (paneSelectionCommitPending)
    {
      return;
    }

    paneSelectionCommitPending = true;
    Dispatcher.UIThread.Post(() =>
    {
      paneSelectionCommitPending = false;
      var selectedPane = panes.FirstOrDefault(
        (pane) => pane.Key == SelectedKey && pane.IsEnabled);
      if (!ReferenceEquals(SelectedItem, selectedPane))
      {
        SelectedItem = selectedPane;
      }
      foreach (var pane in panes)
      {
        pane.IsSelected = pane.Key == SelectedKey;
      }
    });
  }

  private void SyncPanes()
  {
    foreach (var pane in panes)
    {
      pane.IsSelected = pane.Key == SelectedKey;
      pane.SyncState();
    }

    SyncAutomation();
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tab);
    AutomationProperties.SetItemStatus(this, string.IsNullOrWhiteSpace(SelectedKey) ? string.Empty : "selected");
  }
}

public class FsusTabPane : TabItem
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusTabPane, string>(nameof(Key), string.Empty);

  public FsusTabPane()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-tab-pane");
    Focusable = true;
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (string.IsNullOrEmpty(Key) ||
      !e.GetCurrentPoint(this).Properties.IsRightButtonPressed)
    {
      return;
    }

    var owner = FindOwningTabs(this);
    if (owner is null || !owner.RequestPaneContext(Key, FsusTreeInteractionSource.Pointer))
    {
      return;
    }

    e.Handled = true;
  }

  private static FsusTabs? FindOwningTabs(Visual visual)
  {
    var parent = visual.GetVisualParent();
    while (parent is not null)
    {
      if (parent is FsusTabs tabs)
      {
        return tabs;
      }

      parent = parent.GetVisualParent();
    }

    return null;
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsEnabledProperty ||
      change.Property == IsSelectedProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-selected", IsSelected);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Tab);
    AutomationProperties.SetItemStatus(
      this,
      IsSelected ? "selected" : IsEnabled ? "available" : "disabled");
  }
}
