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

public delegate ValueTask<IReadOnlyList<FsusPlatformCommand>> FsusCommandPaletteProvider(
  string query,
  CancellationToken cancellationToken);

public enum FsusCommandPaletteState
{
  Closed,
  Ready,
  Searching,
  Executing,
  Failed,
}

public enum FsusCommandPaletteFailureStage
{
  Search,
  Execution,
}

public enum FsusCommandPaletteInitialSelection
{
  FirstEnabled,
  None,
}

public sealed record FsusCommandPaletteResult(
  string CommandId,
  string Label,
  string? Description,
  string? Category,
  string? IconKey,
  string DisplayShortcut,
  bool IsEnabled,
  bool HasChildren);

public sealed class FsusCommandPaletteExecutedEventArgs(
  FsusCommandPaletteResult result) : EventArgs
{
  public FsusCommandPaletteResult Result { get; } = result;
}

public sealed class FsusCommandPaletteFailedEventArgs(
  FsusCommandPaletteFailureStage stage,
  string? commandId,
  Exception exception) : EventArgs
{
  public FsusCommandPaletteFailureStage Stage { get; } = stage;

  public string? CommandId { get; } = commandId;

  public Exception Exception { get; } = exception;
}

public class FsusCommandPalette : ContentControl, IFsusOverlayLifecycle
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

  private void BuildVisualTree()
  {
    layout.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    layout.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    layout.RowDefinitions.Add(new RowDefinition(GridLength.Star));
    layout.RowDefinitions.Add(new RowDefinition(GridLength.Auto));
    layout.RowSpacing = FsusTokens.Space2Thickness.Top;

    searchInput.Classes.Add("fsus-command-palette-search");
    searchInput.ValueChanged += (_, args) =>
    {
      if (syncingQuery)
      {
        return;
      }

      SetCurrentValue(QueryProperty, args.NewValue ?? string.Empty);
    };
    searchFrame.Classes.Add("fsus-command-palette-search-frame");
    searchFrame.Child = searchInput;

    navigationRow.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    navigationRow.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
    navigationRow.ColumnSpacing = FsusTokens.Space2Thickness.Left;
    backButton.Classes.Add("fsus-command-palette-back");
    backButton.Click += (_, _) => _ = NavigateBackAsync();
    pathText.Classes.Add("fsus-command-palette-path");
    pathText.VerticalAlignment = VerticalAlignment.Center;
    pathText.TextTrimming = TextTrimming.CharacterEllipsis;
    Grid.SetColumn(backButton, 0);
    Grid.SetColumn(pathText, 1);
    navigationRow.Children.Add(backButton);
    navigationRow.Children.Add(pathText);

    resultsList.Classes.Add("fsus-command-palette-results");
    resultsList.FixedItemSize = FsusTokens.DensityMenuItemYDouble;
    resultsList.ViewportSize = Math.Max(
      FsusTokens.DensityMenuItemYDouble,
      OverlaySize.Height - 140);
    resultsList.Overscan = 2;
    resultsList.AccessibleName = ResultsAccessibleName;
    resultsList.ContainerPrepared = SyncResultContainer;

    statusText.Classes.Add("fsus-command-palette-status");
    statusText.TextWrapping = TextWrapping.Wrap;
    AutomationProperties.SetLiveSetting(statusText, AutomationLiveSetting.Polite);
    AutomationProperties.SetAccessibilityView(statusText, AccessibilityView.Control);

    Grid.SetRow(searchFrame, 0);
    Grid.SetRow(navigationRow, 1);
    Grid.SetRow(resultsList, 2);
    Grid.SetRow(statusText, 3);
    layout.Children.Add(searchFrame);
    layout.Children.Add(navigationRow);
    layout.Children.Add(resultsList);
    layout.Children.Add(statusText);
    Content = layout;

    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Pane);
    AutomationProperties.SetAccessibilityView(this, AccessibilityView.Control);
  }

  private async ValueTask AwaitCurrentSearchAsync()
  {
    var observedVersion = searchVersion;
    while (
      IsOpen &&
      State == FsusCommandPaletteState.Searching &&
      observedVersion == searchVersion)
    {
      await Task.Yield();
    }
  }

  private static async ValueTask<T> OnUiThreadAsync<T>(Func<ValueTask<T>> action)
  {
    if (!ShouldInvokeOnDispatcher())
    {
      return await action();
    }

    var completion = new TaskCompletionSource<T>(
      TaskCreationOptions.RunContinuationsAsynchronously);
    Dispatcher.UIThread.Post(async () =>
    {
      try
      {
        completion.SetResult(await action());
      }
      catch (Exception exception)
      {
        completion.SetException(exception);
      }
    });
    return await completion.Task;
  }

  private static async ValueTask OnUiThreadAsync(Action action)
  {
    if (!ShouldInvokeOnDispatcher())
    {
      action();
      return;
    }

    await Dispatcher.UIThread.InvokeAsync(action);
  }

  private static bool ShouldInvokeOnDispatcher() =>
    Application.Current?.ApplicationLifetime is not null &&
    !Dispatcher.UIThread.CheckAccess();

  private IEnumerable<ResolvedEntry> ResolveLocalEntries(string query)
  {
    var nodes = navigationPath.Count == 0
      ? CommandTree ?? []
      : navigationPath[^1].Items;

    foreach (var node in nodes)
    {
      if (
        node.IsSeparator ||
        node.IsRecentGroup ||
        node.Command?.IsEffectivelyVisible == false)
      {
        continue;
      }

      var entry = ResolveNode(node);
      if (entry.Command is null && !entry.Result.HasChildren)
      {
        continue;
      }
      if (Matches(entry.Result, query))
      {
        yield return entry;
      }
    }
  }

  private ResolvedEntry ResolveNode(FsusNativeMenuItemModel node)
  {
    var command = node.Command;
    var label = ResolveHeader(node);
    var id = command?.Id;
    if (string.IsNullOrWhiteSpace(id))
    {
      id = string.IsNullOrWhiteSpace(node.Id)
        ? $"group:{string.Join("/", CurrentPath.Append(label))}"
        : node.Id;
    }

    var hasChildren = node.Items.Any((child) =>
      !child.IsSeparator &&
      !child.IsRecentGroup &&
      child.Command?.IsEffectivelyVisible != false);
    var enabled = command?.IsEffectivelyEnabled ?? hasChildren;
    return new ResolvedEntry(
      node,
      command,
      new FsusCommandPaletteResult(
        id,
        label,
        command?.Description ?? node.AccessibleDescription,
        command?.Category,
        command?.IconKey,
        command?.Gesture?.ToDisplayText(ShortcutPlatform) ?? string.Empty,
        enabled,
        hasChildren));
  }

  private ResolvedEntry ResolveProviderEntry(FsusPlatformCommand command)
  {
    var node = FsusNativeMenuItemModel.Action(command);
    return new ResolvedEntry(
      node,
      command,
      new FsusCommandPaletteResult(
        command.Id,
        command.Label,
        command.Description,
        command.Category,
        command.IconKey,
        command.Gesture?.ToDisplayText(ShortcutPlatform) ?? string.Empty,
        command.IsEffectivelyEnabled,
        false));
  }

  private static bool Matches(FsusPlatformCommand command, string query) =>
    Matches(
      new FsusCommandPaletteResult(
        command.Id,
        command.Label,
        command.Description,
        command.Category,
        command.IconKey,
        string.Empty,
        command.IsEffectivelyEnabled,
        false),
      query);

  private static bool Matches(FsusCommandPaletteResult result, string query) =>
    string.IsNullOrWhiteSpace(query) ||
    result.CommandId.Contains(query, StringComparison.OrdinalIgnoreCase) ||
    result.Label.Contains(query, StringComparison.OrdinalIgnoreCase) ||
    result.Description?.Contains(query, StringComparison.OrdinalIgnoreCase) == true ||
    result.Category?.Contains(query, StringComparison.OrdinalIgnoreCase) == true;

  private void ApplyResults(IReadOnlyList<ResolvedEntry> entries)
  {
    var selectedId = SelectedCommandId;
    resolvedEntries.Clear();
    resolvedEntries.AddRange(entries);

    var preservedIndex = string.IsNullOrWhiteSpace(selectedId)
      ? -1
      : resolvedEntries.FindIndex((entry) =>
        entry.Result.IsEnabled && entry.Result.CommandId == selectedId);
    SelectedIndex = preservedIndex >= 0
      ? preservedIndex
      : InitialSelection == FsusCommandPaletteInitialSelection.FirstEnabled
        ? resolvedEntries.FindIndex((entry) => entry.Result.IsEnabled)
        : -1;

    resultsList.ItemCount = resolvedEntries.Count;
    resultsList.ItemKeyProvider = (index) => resolvedEntries[index].Result.CommandId;
    resultsList.ItemProvider = BuildResultRow;
    resultsList.EmptyText = EmptyText;
    resultsList.RefreshWindow();
    AttachCommandSubscriptions();
    SyncSelection();
  }

  private Control BuildResultRow(int index)
  {
    var result = resolvedEntries[index].Result;
    var row = new Grid
    {
      ColumnSpacing = FsusTokens.Space2Thickness.Left,
      VerticalAlignment = VerticalAlignment.Center,
    };
    row.Classes.Add("fsus-command-palette-result-content");
    AutomationProperties.SetAccessibilityView(row, AccessibilityView.Raw);
    row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
    row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));

    var icon = new FsusIcon
    {
      IconKey = result.IconKey,
      IsDecorative = true,
      IsVisible = !string.IsNullOrWhiteSpace(result.IconKey),
      VerticalAlignment = VerticalAlignment.Center,
    };

    var copy = new StackPanel
    {
      Spacing = FsusTokens.Space1Thickness.Top,
      VerticalAlignment = VerticalAlignment.Center,
    };
    var label = new TextBlock
    {
      Text = result.Label,
      TextTrimming = TextTrimming.CharacterEllipsis,
    };
    label.Classes.Add("fsus-command-palette-result-label");
    copy.Children.Add(label);
    var metadata = string.Join(
      " · ",
      new[] { result.Category, result.Description }
        .Where((value) => !string.IsNullOrWhiteSpace(value)));
    if (!string.IsNullOrWhiteSpace(metadata))
    {
      var meta = new TextBlock
      {
        Text = metadata,
        TextTrimming = TextTrimming.CharacterEllipsis,
      };
      meta.Classes.Add("fsus-command-palette-result-meta");
      copy.Children.Add(meta);
    }

    var shortcut = new TextBlock
    {
      Text = result.DisplayShortcut,
      IsVisible = !string.IsNullOrWhiteSpace(result.DisplayShortcut),
      VerticalAlignment = VerticalAlignment.Center,
    };
    shortcut.Classes.Add("fsus-command-palette-result-shortcut");
    var nested = new TextBlock
    {
      Text = "›",
      IsVisible = result.HasChildren,
      VerticalAlignment = VerticalAlignment.Center,
    };
    nested.Classes.Add("fsus-command-palette-result-nested");

    Grid.SetColumn(icon, 0);
    Grid.SetColumn(copy, 1);
    Grid.SetColumn(shortcut, 2);
    Grid.SetColumn(nested, 3);
    row.Children.Add(icon);
    row.Children.Add(copy);
    row.Children.Add(shortcut);
    row.Children.Add(nested);
    return row;
  }

  private void MoveSelection(int direction)
  {
    if (resolvedEntries.Count == 0 || State == FsusCommandPaletteState.Executing)
    {
      return;
    }

    var index = SelectedIndex;
    for (var attempt = 0; attempt < resolvedEntries.Count; attempt++)
    {
      index = (index + direction + resolvedEntries.Count) % resolvedEntries.Count;
      if (resolvedEntries[index].Result.IsEnabled)
      {
        SelectedIndex = index;
        SyncSelection();
        return;
      }
    }
  }

  private void SyncSelection()
  {
    ScrollSelectedIntoView();
    foreach (var container in resultsList.RealizedContainers)
    {
      SyncResultContainer(container, container.Index);
    }

    SyncState();
  }

  private void SyncResultContainer(
    FsusVirtualListItemContainer container,
    int index)
  {
    if (index < 0 || index >= resolvedEntries.Count)
    {
      return;
    }

    var result = resolvedEntries[index].Result;
    var selected = index == SelectedIndex;
    FsusComponentClasses.Ensure(container, "fsus-command-palette-result", true);
    FsusComponentClasses.Ensure(container, "fsus-selected", selected);
    FsusComponentClasses.Ensure(container, "fsus-disabled", !result.IsEnabled);
    FsusComponentClasses.Ensure(container, "fsus-subcommand", result.HasChildren);
    AutomationProperties.SetName(container, result.Label);
    AutomationProperties.SetHelpText(
      container,
      string.Join(
        ", ",
        new[] { result.Category, result.Description, result.DisplayShortcut }
          .Where((value) => !string.IsNullOrWhiteSpace(value))));
    AutomationProperties.SetItemStatus(
      container,
      selected
        ? result.IsEnabled ? "selected" : "selected, disabled"
        : result.IsEnabled ? "available" : "disabled");
    AutomationProperties.SetPositionInSet(container, index + 1);
    AutomationProperties.SetSizeOfSet(container, resolvedEntries.Count);
  }

  private void ScrollSelectedIntoView()
  {
    if (SelectedIndex < 0 || resultsList.ItemCount == 0)
    {
      return;
    }

    var itemSize = Math.Max(1d, resultsList.FixedItemSize);
    var itemTop = SelectedIndex * itemSize;
    var itemBottom = itemTop + itemSize;
    if (itemTop < resultsList.ScrollOffset)
    {
      resultsList.ScrollToOffset(itemTop);
    }
    else if (itemBottom > resultsList.ScrollOffset + resultsList.ViewportSize)
    {
      resultsList.ScrollToOffset(itemBottom - resultsList.ViewportSize);
    }
  }

  private void AttachCommandSubscriptions()
  {
    DetachCommandSubscriptions();
    foreach (var command in resolvedEntries
      .Select((entry) => entry.Command)
      .Where((command) => command is not null)
      .Cast<FsusPlatformCommand>()
      .Distinct())
    {
      command.StateChanged += OnCommandStateChanged;
      subscribedCommands.Add(command);
    }
  }

  private void DetachCommandSubscriptions()
  {
    foreach (var command in subscribedCommands)
    {
      command.StateChanged -= OnCommandStateChanged;
    }
    subscribedCommands.Clear();
  }

  private void OnCommandStateChanged(object? sender, EventArgs e)
  {
    if (!IsOpen || State == FsusCommandPaletteState.Executing)
    {
      return;
    }

    if (Application.Current?.ApplicationLifetime is null)
    {
      _ = RefreshAsync();
      return;
    }

    Dispatcher.UIThread.Post(
      () =>
      {
        if (IsOpen)
        {
          _ = RefreshAsync();
        }
      },
      DispatcherPriority.Input);
  }

  private void SetState(FsusCommandPaletteState state)
  {
    State = state;
    searchInput.IsEnabled = state != FsusCommandPaletteState.Executing;
    SyncState();
  }

  private void SyncLabels()
  {
    searchInput.AccessibleName = SearchAccessibleName;
    searchInput.PlaceholderText = SearchPlaceholder;
    backButton.Content = BackLabel;
    AutomationProperties.SetName(backButton, BackLabel);
    resultsList.EmptyText = EmptyText;
    resultsList.AccessibleName = ResultsAccessibleName;
  }

  private void SyncState()
  {
    foreach (var className in new[]
    {
      "fsus-closed",
      "fsus-ready",
      "fsus-searching",
      "fsus-executing",
      "fsus-failed",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }
    FsusComponentClasses.Ensure(
      this,
      $"fsus-{State.ToString().ToLowerInvariant()}",
      true);
    FsusComponentClasses.Ensure(this, "fsus-empty", resolvedEntries.Count == 0);
    FsusComponentClasses.Ensure(this, "fsus-nested", navigationPath.Count > 0);

    navigationRow.IsVisible = navigationPath.Count > 0;
    backButton.IsVisible = navigationPath.Count > 0;
    pathText.Text = string.Join(" / ", CurrentPath);

    statusText.Text = State switch
    {
      FsusCommandPaletteState.Searching => SearchingText,
      FsusCommandPaletteState.Executing => BusyText,
      FsusCommandPaletteState.Failed => string.IsNullOrWhiteSpace(FailureMessage)
        ? FailureText
        : $"{FailureText}: {FailureMessage}",
      _ when resolvedEntries.Count == 0 => EmptyText,
      _ => $"{resolvedEntries.Count.ToString(CultureInfo.InvariantCulture)} commands",
    };
    AutomationProperties.SetName(this, AccessibleName ?? "Command palette");
    AutomationProperties.SetItemStatus(
      this,
      State == FsusCommandPaletteState.Closed
        ? "closed"
        : $"{State.ToString().ToLowerInvariant()}, {statusText.Text}");
  }

  private static string ResolveHeader(FsusNativeMenuItemModel node) =>
    node.Command?.Label ?? node.Header ?? node.Id;

  private static async Task CompleteKeyAsync(ValueTask<bool> pending) =>
    await pending;

  private sealed record ResolvedEntry(
    FsusNativeMenuItemModel Node,
    FsusPlatformCommand? Command,
    FsusCommandPaletteResult Result);
}
