using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Overlay;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public partial class FsusCommandPalette : ContentControl, IFsusOverlayLifecycle
{
  public static readonly StyledProperty<IEnumerable<FsusNativeMenuItemModel>?> CommandTreeProperty =
    AvaloniaProperty.Register<FsusCommandPalette, IEnumerable<FsusNativeMenuItemModel>?>(
      nameof(CommandTree));

  public static readonly StyledProperty<IEnumerable<FsusCommandPaletteProvider>?> ProvidersProperty =
    AvaloniaProperty.Register<FsusCommandPalette, IEnumerable<FsusCommandPaletteProvider>?>(
      nameof(Providers));

  public static readonly StyledProperty<string> QueryProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(nameof(Query), string.Empty);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string?>(
      nameof(AccessibleName),
      "Command palette");

  public static readonly StyledProperty<string> SearchAccessibleNameProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(SearchAccessibleName),
      "Search commands");

  public static readonly StyledProperty<string> ResultsAccessibleNameProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(ResultsAccessibleName),
      "Command results");

  public static readonly StyledProperty<FsusCommandPaletteInitialSelection> InitialSelectionProperty =
    AvaloniaProperty.Register<FsusCommandPalette, FsusCommandPaletteInitialSelection>(
      nameof(InitialSelection),
      FsusCommandPaletteInitialSelection.FirstEnabled);

  public static readonly StyledProperty<string> SearchPlaceholderProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(SearchPlaceholder),
      "Search commands");

  public static readonly StyledProperty<string> BackLabelProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(nameof(BackLabel), "Back");

  public static readonly StyledProperty<string> EmptyTextProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(EmptyText),
      "No commands found");

  public static readonly StyledProperty<string> SearchingTextProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(SearchingText),
      "Searching commands");

  public static readonly StyledProperty<string> BusyTextProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(BusyText),
      "Running command");

  public static readonly StyledProperty<string> FailureTextProperty =
    AvaloniaProperty.Register<FsusCommandPalette, string>(
      nameof(FailureText),
      "Command failed");

  private readonly Grid layout = new();
  private readonly Border searchFrame = new();
  private readonly Grid navigationRow = new();
  private readonly Button backButton = new();
  private readonly TextBlock pathText = new();
  private readonly FsusInput searchInput = new();
  private readonly FsusVirtualList resultsList = new();
  private readonly TextBlock statusText = new();
  private readonly List<FsusNativeMenuItemModel> navigationPath = [];
  private readonly List<ResolvedEntry> resolvedEntries = [];
  private readonly List<FsusPlatformCommand> subscribedCommands = [];
  private CancellationTokenSource? searchCancellation;
  private CancellationTokenSource? executionCancellation;
  private FsusOverlayHost? overlayHost;
  private bool syncingQuery;
  private int searchVersion;

  public FsusCommandPalette()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-command-palette");
    Focusable = true;
    BuildVisualTree();
    SyncLabels();
    SyncState();
  }

  public event EventHandler<FsusCommandPaletteExecutedEventArgs>? CommandExecuted;

  public event EventHandler<FsusCommandPaletteFailedEventArgs>? Failed;

  public event EventHandler? Dismissed;

  public IEnumerable<FsusNativeMenuItemModel>? CommandTree
  {
    get => GetValue(CommandTreeProperty);
    set => SetValue(CommandTreeProperty, value);
  }

  public IEnumerable<FsusCommandPaletteProvider>? Providers
  {
    get => GetValue(ProvidersProperty);
    set => SetValue(ProvidersProperty, value);
  }

  public string Query
  {
    get => GetValue(QueryProperty);
    set => SetValue(QueryProperty, value ?? string.Empty);
  }

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string SearchAccessibleName
  {
    get => GetValue(SearchAccessibleNameProperty);
    set => SetValue(SearchAccessibleNameProperty, value);
  }

  public string ResultsAccessibleName
  {
    get => GetValue(ResultsAccessibleNameProperty);
    set => SetValue(ResultsAccessibleNameProperty, value);
  }

  public FsusCommandPaletteInitialSelection InitialSelection
  {
    get => GetValue(InitialSelectionProperty);
    set => SetValue(InitialSelectionProperty, value);
  }

  public string SearchPlaceholder
  {
    get => GetValue(SearchPlaceholderProperty);
    set => SetValue(SearchPlaceholderProperty, value);
  }

  public string BackLabel
  {
    get => GetValue(BackLabelProperty);
    set => SetValue(BackLabelProperty, value);
  }

  public string EmptyText
  {
    get => GetValue(EmptyTextProperty);
    set => SetValue(EmptyTextProperty, value);
  }

  public string SearchingText
  {
    get => GetValue(SearchingTextProperty);
    set => SetValue(SearchingTextProperty, value);
  }

  public string BusyText
  {
    get => GetValue(BusyTextProperty);
    set => SetValue(BusyTextProperty, value);
  }

  public string FailureText
  {
    get => GetValue(FailureTextProperty);
    set => SetValue(FailureTextProperty, value);
  }

  public Size OverlaySize { get; set; } = new(640, 480);

  public Rect ViewportBounds { get; set; } = new(0, 0, 1920, 1080);

  public FsusShortcutPlatform ShortcutPlatform { get; set; } =
    FsusShortcutPlatform.Auto;

  public FsusCommandPaletteState State { get; private set; } =
    FsusCommandPaletteState.Closed;

  public bool IsOpen => OverlayEntry is not null;

  public bool IsBusy =>
    State is FsusCommandPaletteState.Searching or FsusCommandPaletteState.Executing;

  public int SelectedIndex { get; private set; } = -1;

  public string SelectedCommandId =>
    SelectedIndex >= 0 && SelectedIndex < resolvedEntries.Count
      ? resolvedEntries[SelectedIndex].Result.CommandId
      : string.Empty;

  public string? FailureMessage { get; private set; }

  public IReadOnlyList<string> CurrentPath =>
    navigationPath.Select(ResolveHeader).ToArray();

  public IReadOnlyList<FsusCommandPaletteResult> Results =>
    resolvedEntries.Select((entry) => entry.Result).ToArray();

  public FsusOverlayEntry? OverlayEntry { get; private set; }

  public FsusOverlayEntry Open(FsusOverlayHost host, Control? invoker = null)
  {
    ArgumentNullException.ThrowIfNull(host);
    if (IsOpen)
    {
      return OverlayEntry!;
    }

    overlayHost = host;
    Width = OverlaySize.Width;
    Height = OverlaySize.Height;
    resultsList.ViewportSize = Math.Max(
      FsusTokens.DensityMenuItemYDouble,
      OverlaySize.Height - 140);
    var entry = host.Open(this, new FsusOverlayOptions
    {
      IsModal = true,
      CloseOnEscape = true,
      CloseOnPointerOutside = true,
      RestoreFocusTo = invoker,
      FocusScope = [searchInput, resultsList],
      OverlaySize = OverlaySize,
      ViewportBounds = ViewportBounds,
      Placement = FsusOverlayPlacement.Center,
    });
    _ = RefreshAsync();
    return entry;
  }

  public async ValueTask<FsusOverlayEntry> OpenAsync(
    FsusOverlayHost host,
    Control? invoker = null)
  {
    var wasOpen = IsOpen;
    var entry = Open(host, invoker);
    if (!wasOpen)
    {
      await AwaitCurrentSearchAsync();
    }

    return entry;
  }

  public ValueTask<bool> CloseAsync(
    FsusOverlayCloseReason reason = FsusOverlayCloseReason.Programmatic,
    CancellationToken cancellationToken = default) =>
    OverlayEntry is null || overlayHost is null
      ? ValueTask.FromResult(false)
      : overlayHost.CloseAsync(OverlayEntry, reason, cancellationToken);

  public async ValueTask SetQueryAsync(
    string? query,
    CancellationToken cancellationToken = default)
  {
    var normalized = query ?? string.Empty;
    syncingQuery = true;
    try
    {
      SetCurrentValue(QueryProperty, normalized);
      searchInput.Text = normalized;
    }
    finally
    {
      syncingQuery = false;
    }

    await RefreshAsync(cancellationToken);
  }

  public void BeginImeComposition() => searchInput.BeginImeComposition();

  public void UpdateImeComposition(string? text) =>
    searchInput.UpdateImeComposition(text);

  public void CommitImeComposition(string? text) =>
    searchInput.CommitImeComposition(text);

  public async ValueTask RefreshAsync(CancellationToken cancellationToken = default)
  {
    if (State == FsusCommandPaletteState.Executing)
    {
      return;
    }

    searchCancellation?.Cancel();
    searchCancellation?.Dispose();
    searchCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    var localCancellation = searchCancellation;
    var version = ++searchVersion;
    var query = Query.Trim();
    var providerList = navigationPath.Count == 0
      ? Providers?.ToArray() ?? []
      : [];

    SetState(
      providerList.Length > 0
        ? FsusCommandPaletteState.Searching
        : FsusCommandPaletteState.Ready);

    try
    {
      var entries = ResolveLocalEntries(query).ToList();
      if (providerList.Length > 0)
      {
        var providerResults = await Task.WhenAll(
          providerList.Select((provider) =>
            provider(query, localCancellation.Token).AsTask()));
        foreach (var command in providerResults.SelectMany((commands) => commands))
        {
          if (command.IsEffectivelyVisible && Matches(command, query))
          {
            entries.Add(ResolveProviderEntry(command));
          }
        }
      }

      if (
        localCancellation.IsCancellationRequested ||
        version != searchVersion)
      {
        return;
      }

      await OnUiThreadAsync(() =>
      {
        if (
          localCancellation.IsCancellationRequested ||
          version != searchVersion)
        {
          return;
        }

        ApplyResults(entries);
        FailureMessage = null;
        SetState(IsOpen ? FsusCommandPaletteState.Ready : FsusCommandPaletteState.Closed);
      });
    }
    catch (OperationCanceledException) when (localCancellation.IsCancellationRequested)
    {
      // A newer query or palette close owns the next visible state.
    }
    catch (Exception exception)
    {
      if (
        localCancellation.IsCancellationRequested ||
        version != searchVersion ||
        !IsOpen)
      {
        return;
      }

      await OnUiThreadAsync(() =>
      {
        ApplyResults([]);
        FailureMessage = exception.Message;
        SetState(FsusCommandPaletteState.Failed);
        Failed?.Invoke(
          this,
          new FsusCommandPaletteFailedEventArgs(
            FsusCommandPaletteFailureStage.Search,
            null,
            exception));
      });
    }
  }

  public ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (!IsOpen || searchInput.IsComposing)
    {
      return ValueTask.FromResult(false);
    }

    switch (key)
    {
      case Key.Down:
        MoveSelection(1);
        return ValueTask.FromResult(true);
      case Key.Up:
        MoveSelection(-1);
        return ValueTask.FromResult(true);
      case Key.Enter:
        return ActivateSelectedAsync();
      case Key.Escape:
        return CloseAsync(FsusOverlayCloseReason.Keyboard);
      default:
        return ValueTask.FromResult(false);
    }
  }

  public async ValueTask<bool> ActivateSelectedAsync(
    CancellationToken cancellationToken = default)
  {
    if (
      State == FsusCommandPaletteState.Executing ||
      SelectedIndex < 0 ||
      SelectedIndex >= resolvedEntries.Count)
    {
      return false;
    }

    var entry = resolvedEntries[SelectedIndex];
    if (!entry.Result.IsEnabled)
    {
      return false;
    }

    if (entry.Result.HasChildren)
    {
      navigationPath.Add(entry.Node);
      await SetQueryAsync(string.Empty, cancellationToken);
      return true;
    }

    if (entry.Command is null)
    {
      return false;
    }

    executionCancellation?.Cancel();
    executionCancellation?.Dispose();
    executionCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    var localCancellation = executionCancellation;
    SetState(FsusCommandPaletteState.Executing);

    try
    {
      if (!await entry.Command.ExecuteAsync(cancellationToken: localCancellation.Token))
      {
        await OnUiThreadAsync(() => SetState(FsusCommandPaletteState.Ready));
        return false;
      }

      return await OnUiThreadAsync(async () =>
      {
        CommandExecuted?.Invoke(
          this,
          new FsusCommandPaletteExecutedEventArgs(entry.Result));
        await CloseAsync();
        return true;
      });
    }
    catch (OperationCanceledException) when (localCancellation.IsCancellationRequested)
    {
      if (IsOpen)
      {
        await OnUiThreadAsync(() => SetState(FsusCommandPaletteState.Ready));
      }
      return false;
    }
    catch (Exception exception)
    {
      await OnUiThreadAsync(() =>
      {
        FailureMessage = exception.Message;
        SetState(FsusCommandPaletteState.Failed);
        Failed?.Invoke(
          this,
          new FsusCommandPaletteFailedEventArgs(
            FsusCommandPaletteFailureStage.Execution,
            entry.Result.CommandId,
            exception));
      });
      return false;
    }
  }

  public async ValueTask<bool> NavigateBackAsync(
    CancellationToken cancellationToken = default)
  {
    if (navigationPath.Count == 0 || State == FsusCommandPaletteState.Executing)
    {
      return false;
    }

    navigationPath.RemoveAt(navigationPath.Count - 1);
    await SetQueryAsync(string.Empty, cancellationToken);
    return true;
  }

  public void OnOverlayOpened(FsusOverlayEntry entry)
  {
    OverlayEntry = entry;
    SetState(FsusCommandPaletteState.Ready);
    if (TopLevel.GetTopLevel(this) is null)
    {
      return;
    }

    Dispatcher.UIThread.Post(
      () =>
      {
        if (IsOpen && TopLevel.GetTopLevel(this) is not null)
        {
          searchInput.Focus();
        }
      },
      DispatcherPriority.Input);
  }

  public void OnOverlayClosed(FsusOverlayCloseReason reason)
  {
    searchCancellation?.Cancel();
    executionCancellation?.Cancel();
    DetachCommandSubscriptions();
    OverlayEntry = null;
    overlayHost = null;
    navigationPath.Clear();
    resolvedEntries.Clear();
    SelectedIndex = -1;
    FailureMessage = null;
    SetState(FsusCommandPaletteState.Closed);
    Dismissed?.Invoke(this, EventArgs.Empty);
  }

  protected override void OnKeyDown(KeyEventArgs e)
  {
    base.OnKeyDown(e);
    if (e.Handled)
    {
      return;
    }

    var pending = HandleKeyAsync(e.Key);
    if (pending.IsCompleted)
    {
      e.Handled = pending.Result;
      return;
    }

    e.Handled = true;
    _ = CompleteKeyAsync(pending);
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (
      e.Handled ||
      !e.GetCurrentPoint(this).Properties.IsLeftButtonPressed)
    {
      return;
    }

    var container = e.Source as FsusVirtualListItemContainer ??
      (e.Source as Visual)?.GetVisualAncestors()
        .OfType<FsusVirtualListItemContainer>()
        .FirstOrDefault();
    if (container is null || container.Index < 0 || container.Index >= resolvedEntries.Count)
    {
      return;
    }

    SelectedIndex = container.Index;
    SyncSelection();
    e.Handled = true;
    _ = ActivateSelectedAsync();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == QueryProperty && !syncingQuery)
    {
      syncingQuery = true;
      searchInput.Text = Query;
      syncingQuery = false;
      if (IsOpen)
      {
        _ = RefreshAsync();
      }
    }
    else if (
      change.Property == CommandTreeProperty ||
      change.Property == ProvidersProperty)
    {
      navigationPath.Clear();
      if (IsOpen)
      {
        _ = RefreshAsync();
      }
    }
    else if (
      change.Property == AccessibleNameProperty ||
      change.Property == SearchAccessibleNameProperty ||
      change.Property == ResultsAccessibleNameProperty ||
      change.Property == SearchPlaceholderProperty ||
      change.Property == BackLabelProperty ||
      change.Property == EmptyTextProperty ||
      change.Property == SearchingTextProperty ||
      change.Property == BusyTextProperty ||
      change.Property == FailureTextProperty)
    {
      SyncLabels();
      SyncState();
    }
  }
}
