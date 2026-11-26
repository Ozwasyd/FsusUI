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

public partial class FsusCommandPalette
{
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
