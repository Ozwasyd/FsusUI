using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusDockMenuContract
{
  public static bool IsSupported(FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    var resolved = platform == FsusShortcutPlatform.Auto
      ? (RuntimeInformation.IsOSPlatform(OSPlatform.OSX) ? FsusShortcutPlatform.macOS : FsusShortcutPlatform.Windows)
      : platform;

    return resolved == FsusShortcutPlatform.macOS;
  }

  public static NativeMenu? BuildDockMenu(
    IEnumerable<string> recentItems,
    Action<string>? openRecentAction = null,
    Action? clearRecentAction = null,
    IEnumerable<FsusPlatformCommand>? additionalCommands = null,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(recentItems);
    if (!IsSupported(platform))
    {
      return null;
    }

    var menu = new NativeMenu();
    var recents = recentItems.ToList();

    if (recents.Count > 0)
    {
      foreach (var item in recents)
      {
        var path = item;
        var recentItem = new NativeMenuItem
        {
          Header = path,
          ToolTip = $"Open recent item {path}",
          Command = new ActionCommand(() => true, _ => openRecentAction?.Invoke(path)),
        };
        FsusNativeMenuMetadata.Set(
          recentItem,
          FsusPlatformRole.DockOpenRecent,
          null,
          $"Open recent item {path}");
        menu.Items.Add(recentItem);
      }

      if (clearRecentAction is not null)
      {
        menu.Items.Add(new NativeMenuItemSeparator());
        var clearItem = new NativeMenuItem
        {
          Header = "Clear Recent",
          ToolTip = "Clear the recent items list",
          Command = new ActionCommand(() => true, _ => clearRecentAction()),
        };
        FsusNativeMenuMetadata.Set(
          clearItem,
          FsusPlatformRole.DockClearRecent,
          null,
          "Clear recent items");
        menu.Items.Add(clearItem);
      }
    }

    if (additionalCommands is not null)
    {
      if (menu.Items.Count > 0)
      {
        menu.Items.Add(new NativeMenuItemSeparator());
      }

      foreach (var cmd in additionalCommands)
      {
        var item = new NativeMenuItem
        {
          Header = cmd.Label,
          IsEnabled = cmd.IsEnabled,
          IsChecked = cmd.IsChecked,
          ToggleType = (MenuItemToggleType)(int)cmd.ToggleType,
          Gesture = cmd.Gesture?.ToNativeMenuKeyGesture(platform),
          ToolTip = cmd.Description,
          Command = new ActionCommand(
            () => cmd.IsEnabled &&
              (cmd.Command?.CanExecute(cmd.CommandParameter) ?? true),
            _ => cmd.Execute()),
        };
        FsusNativeMenuMetadata.Set(
          item,
          cmd.Role == FsusPlatformRole.None
            ? FsusPlatformRole.DockOpen
            : cmd.Role,
          cmd.Id,
          cmd.Label);
        menu.Items.Add(item);
      }
    }

    return menu;
  }

  public static NativeMenu? AttachTo(
    AvaloniaObject target,
    IEnumerable<string> recentItems,
    Action<string>? openRecentAction = null,
    Action? clearRecentAction = null,
    IEnumerable<FsusPlatformCommand>? additionalCommands = null,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(target);
    var menu = BuildDockMenu(
      recentItems,
      openRecentAction,
      clearRecentAction,
      additionalCommands,
      platform);
    if (menu is not null)
    {
      NativeDock.SetMenu(target, menu);
    }
    return menu;
  }

  private sealed class ActionCommand(Func<bool> canExecute, Action<object?> action)
    : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => canExecute();

    public void Execute(object? parameter) => action(parameter);
  }
}

public sealed class FsusDockMenuRouter
{
  private readonly Dictionary<string, Action<object?>> routes = new(StringComparer.OrdinalIgnoreCase);
  private readonly Dictionary<string, Action<object?>> windowlessRoutes = new(StringComparer.OrdinalIgnoreCase);

  public void RegisterRoute(string commandId, Action<object?> handler)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(commandId);
    ArgumentNullException.ThrowIfNull(handler);
    routes[commandId] = handler;
  }

  public void RegisterWindowlessRoute(string commandId, Action<object?> handler)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(commandId);
    ArgumentNullException.ThrowIfNull(handler);
    windowlessRoutes[commandId] = handler;
  }

  public bool Route(string commandId, object? parameter = null, bool hasActiveWindow = true)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(commandId);

    if (!hasActiveWindow && windowlessRoutes.TryGetValue(commandId, out var windowlessHandler))
    {
      windowlessHandler(parameter);
      return true;
    }

    if (routes.TryGetValue(commandId, out var handler))
    {
      handler(parameter);
      return true;
    }

    return false;
  }
}

public sealed class FsusCommandPaletteItem(
  string commandId,
  string label,
  string? category,
  string? description,
  string displayShortcut,
  bool isEnabled,
  Action<object?> executeAction)
{
  public string CommandId { get; } = commandId;

  public string Label { get; } = label;

  public string? Category { get; } = category;

  public string? Description { get; } = description;

  public string DisplayShortcut { get; } = displayShortcut;

  public bool IsEnabled { get; } = isEnabled;

  public void Execute(object? parameter = null) => executeAction(parameter);
}

public sealed class FsusCommandPaletteModel(IEnumerable<FsusPlatformCommand> commands)
{
  private readonly List<FsusPlatformCommand> commandList = commands.ToList();

  public IReadOnlyList<FsusPlatformCommand> Commands => commandList;

  public IReadOnlyList<FsusCommandPaletteItem> Search(
    string? query = null,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    var trimmed = query?.Trim() ?? string.Empty;
    var results = new List<FsusCommandPaletteItem>();

    foreach (var cmd in commandList)
    {
      if (cmd.IsEffectivelyVisible &&
          (string.IsNullOrEmpty(trimmed) ||
          cmd.Id.Contains(trimmed, StringComparison.OrdinalIgnoreCase) ||
          cmd.Label.Contains(trimmed, StringComparison.OrdinalIgnoreCase) ||
          (cmd.Category?.Contains(trimmed, StringComparison.OrdinalIgnoreCase) == true) ||
          (cmd.Description?.Contains(trimmed, StringComparison.OrdinalIgnoreCase) == true)))
      {
        results.Add(new FsusCommandPaletteItem(
          cmd.Id,
          cmd.Label,
          cmd.Category,
          cmd.Description,
          cmd.Gesture?.ToDisplayText(platform) ?? string.Empty,
          cmd.IsEffectivelyEnabled,
          cmd.Execute));
      }
    }

    return results;
  }
}
