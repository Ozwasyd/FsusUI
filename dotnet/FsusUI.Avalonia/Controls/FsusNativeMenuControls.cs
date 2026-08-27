using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows.Input;

namespace FsusUI.Avalonia.Controls;

public enum FsusPlatformRole
{
  None,
  About,
  Preferences,
  Services,
  Hide,
  HideOthers,
  ShowAll,
  Quit,
  FileNew,
  FileOpen,
  FileOpenRecent,
  FileSave,
  FileSaveAs,
  FileExport,
  FileClose,
  EditUndo,
  EditRedo,
  EditCut,
  EditCopy,
  EditPaste,
  EditSelectAll,
  WindowMinimize,
  WindowZoom,
  WindowClose,
  WindowBringAllToFront,
  Help,
}

public enum FsusMenuItemToggleType
{
  None,
  CheckBox,
  Radio,
}

public class FsusPlatformCommand : INotifyPropertyChanged
{
  private string label;
  private FsusShortcutGesture? gesture;
  private bool isEnabled = true;
  private bool isChecked;
  private FsusMenuItemToggleType toggleType;
  private FsusPlatformRole role;
  private string? category;
  private string? description;
  private string? iconKey;

  public FsusPlatformCommand(string id, string label, FsusPlatformRole role = FsusPlatformRole.None)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(id);
    Id = id;
    this.label = label;
    this.role = role;
  }

  public event PropertyChangedEventHandler? PropertyChanged;

  public event EventHandler? StateChanged;

  public string Id { get; }

  public string Label
  {
    get => label;
    set
    {
      if (label != value)
      {
        label = value;
        Notify(nameof(Label));
      }
    }
  }

  public FsusShortcutGesture? Gesture
  {
    get => gesture;
    set
    {
      if (gesture != value)
      {
        gesture = value;
        Notify(nameof(Gesture));
      }
    }
  }

  public bool IsEnabled
  {
    get => isEnabled;
    set
    {
      if (isEnabled != value)
      {
        isEnabled = value;
        Notify(nameof(IsEnabled));
      }
    }
  }

  public bool IsChecked
  {
    get => isChecked;
    set
    {
      if (isChecked != value)
      {
        isChecked = value;
        Notify(nameof(IsChecked));
      }
    }
  }

  public FsusMenuItemToggleType ToggleType
  {
    get => toggleType;
    set
    {
      if (toggleType != value)
      {
        toggleType = value;
        Notify(nameof(ToggleType));
      }
    }
  }

  public FsusPlatformRole Role
  {
    get => role;
    set
    {
      if (role != value)
      {
        role = value;
        Notify(nameof(Role));
      }
    }
  }

  public ICommand? Command { get; set; }

  public Action<object?>? ExecuteAction { get; set; }

  public object? CommandParameter { get; set; }

  public string? Category
  {
    get => category;
    set
    {
      if (category != value)
      {
        category = value;
        Notify(nameof(Category));
      }
    }
  }

  public string? Description
  {
    get => description;
    set
    {
      if (description != value)
      {
        description = value;
        Notify(nameof(Description));
      }
    }
  }

  public string? IconKey
  {
    get => iconKey;
    set
    {
      if (iconKey != value)
      {
        iconKey = value;
        Notify(nameof(IconKey));
      }
    }
  }

  public void Execute(object? parameter = null)
  {
    if (!IsEnabled)
    {
      return;
    }

    var arg = parameter ?? CommandParameter;
    ExecuteAction?.Invoke(arg);
    Command?.Execute(arg);
  }

  public void NotifyStateChanged()
  {
    StateChanged?.Invoke(this, EventArgs.Empty);
  }

  private void Notify(string propertyName)
  {
    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    StateChanged?.Invoke(this, EventArgs.Empty);
  }
}

public class FsusNativeMenuItemModel
{
  public string Id { get; set; } = string.Empty;

  public string? Header { get; set; }

  public FsusPlatformCommand? Command { get; set; }

  public FsusPlatformRole Role { get; set; }

  public bool IsSeparator { get; set; }

  public bool IsRecentGroup { get; set; }

  public IList<string> RecentItems { get; } = new List<string>();

  public Action<string>? OpenRecentAction { get; set; }

  public Action? ClearRecentAction { get; set; }

  public IList<FsusNativeMenuItemModel> Items { get; } = new List<FsusNativeMenuItemModel>();

  public bool IsEnabled => Command?.IsEnabled ?? true;

  public bool IsChecked => Command?.IsChecked ?? false;

  public FsusShortcutGesture? Gesture => Command?.Gesture;

  public static FsusNativeMenuItemModel Action(FsusPlatformCommand command)
  {
    ArgumentNullException.ThrowIfNull(command);
    return new FsusNativeMenuItemModel
    {
      Id = command.Id,
      Header = command.Label,
      Command = command,
      Role = command.Role,
    };
  }

  public static FsusNativeMenuItemModel SubMenu(string header, params FsusNativeMenuItemModel[] items) =>
    SubMenu(header, FsusPlatformRole.None, items);

  public static FsusNativeMenuItemModel SubMenu(
    string header,
    FsusPlatformRole role,
    params FsusNativeMenuItemModel[] items)
  {
    var model = new FsusNativeMenuItemModel
    {
      Header = header,
      Role = role,
    };
    foreach (var item in items)
    {
      model.Items.Add(item);
    }
    return model;
  }

  public static FsusNativeMenuItemModel Separator() =>
    new() { IsSeparator = true };

  public static FsusNativeMenuItemModel RecentGroup(
    string header,
    IEnumerable<string> recentItems,
    Action<string>? openAction = null,
    Action? clearAction = null)
  {
    var model = new FsusNativeMenuItemModel
    {
      Header = header,
      IsRecentGroup = true,
      Role = FsusPlatformRole.FileOpenRecent,
      OpenRecentAction = openAction,
      ClearRecentAction = clearAction,
    };
    foreach (var item in recentItems)
    {
      model.RecentItems.Add(item);
    }
    return model;
  }
}

public sealed class FsusNativeMenuBuilder : IDisposable
{
  private readonly List<Action> cleanupActions = [];

  public NativeMenu Build(
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    Dispose();
    var resolvedPlatform = ResolvePlatform(platform);
    var menu = new NativeMenu();

    var adaptedModels = AdaptForPlatform(rootModels, resolvedPlatform);
    foreach (var model in adaptedModels)
    {
      var nativeItem = BuildItem(model, resolvedPlatform);
      if (nativeItem is not null)
      {
        menu.Items.Add(nativeItem);
      }
    }

    return menu;
  }

  public void AttachTo(
    TopLevel topLevel,
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(topLevel);
    var menu = Build(rootModels, platform);
    NativeMenu.SetMenu(topLevel, menu);
  }

  public void AttachTo(
    Application app,
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(app);
    var menu = Build(rootModels, platform);
    NativeMenu.SetMenu(app, menu);
  }

  public void Dispose()
  {
    foreach (var cleanup in cleanupActions)
    {
      cleanup();
    }
    cleanupActions.Clear();
  }

  private NativeMenuItemBase? BuildItem(
    FsusNativeMenuItemModel model,
    FsusShortcutPlatform platform)
  {
    if (model.IsSeparator)
    {
      return new NativeMenuItemSeparator();
    }

    if (model.IsRecentGroup)
    {
      return BuildRecentSubmenu(model, platform);
    }

    if (model.Items.Count > 0)
    {
      var subMenu = new NativeMenu();
      foreach (var child in model.Items)
      {
        var nativeChild = BuildItem(child, platform);
        if (nativeChild is not null)
        {
          subMenu.Items.Add(nativeChild);
        }
      }

      return new NativeMenuItem
      {
        Header = model.Header,
        Menu = subMenu,
      };
    }

    var item = new NativeMenuItem
    {
      Header = model.Header ?? model.Command?.Label,
      IsEnabled = model.Command?.IsEnabled ?? true,
      IsChecked = model.Command?.IsChecked ?? false,
      ToggleType = (MenuItemToggleType)(int)(model.Command?.ToggleType ?? FsusMenuItemToggleType.None),
      Gesture = model.Command?.Gesture?.ToKeyGesture(),
    };

    if (model.Command is not null)
    {
      var cmd = model.Command;
      item.Command = new ActionCommand(_ => cmd.Execute());

      EventHandler onStateChanged = (_, _) =>
      {
        item.Header = cmd.Label;
        item.IsEnabled = cmd.IsEnabled;
        item.IsChecked = cmd.IsChecked;
        item.ToggleType = (MenuItemToggleType)(int)cmd.ToggleType;
        item.Gesture = cmd.Gesture?.ToKeyGesture();
      };

      cmd.StateChanged += onStateChanged;
      cleanupActions.Add(() => cmd.StateChanged -= onStateChanged);
    }

    return item;
  }

  private NativeMenuItem BuildRecentSubmenu(
    FsusNativeMenuItemModel model,
    FsusShortcutPlatform platform)
  {
    var subMenu = new NativeMenu();

    if (model.RecentItems.Count == 0)
    {
      subMenu.Items.Add(new NativeMenuItem
      {
        Header = "No Recent Items",
        IsEnabled = false,
      });
    }
    else
    {
      foreach (var file in model.RecentItems)
      {
        var recentPath = file;
        var recentItem = new NativeMenuItem
        {
          Header = recentPath,
          Command = new ActionCommand(_ => model.OpenRecentAction?.Invoke(recentPath)),
        };
        subMenu.Items.Add(recentItem);
      }

      if (model.ClearRecentAction is not null)
      {
        subMenu.Items.Add(new NativeMenuItemSeparator());
        subMenu.Items.Add(new NativeMenuItem
        {
          Header = "Clear Recent",
          Command = new ActionCommand(_ => model.ClearRecentAction.Invoke()),
        });
      }
    }

    return new NativeMenuItem
    {
      Header = model.Header ?? "Open Recent",
      Menu = subMenu,
    };
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForPlatform(
    IEnumerable<FsusNativeMenuItemModel> roots,
    FsusShortcutPlatform platform)
  {
    if (platform == FsusShortcutPlatform.macOS)
    {
      return AdaptForMac(roots);
    }

    return AdaptForWindowsLinux(roots);
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForMac(
    IEnumerable<FsusNativeMenuItemModel> roots)
  {
    var list = roots.ToList();

    var hasAppMenu = list.Any(r => r.Header?.Equals("Application", StringComparison.OrdinalIgnoreCase) == true ||
                                   r.Role == FsusPlatformRole.About);
    if (!hasAppMenu)
    {
      var appMenu = new FsusNativeMenuItemModel
      {
        Header = "Application",
        Role = FsusPlatformRole.About,
      };

      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "About Application",
        Role = FsusPlatformRole.About,
      });
      appMenu.Items.Add(FsusNativeMenuItemModel.Separator());
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Preferences...",
        Role = FsusPlatformRole.Preferences,
        Command = new FsusPlatformCommand("app.preferences", "Preferences...", FsusPlatformRole.Preferences)
        {
          Gesture = new FsusShortcutGesture(Key.OemComma, KeyModifiers.Control),
        },
      });
      appMenu.Items.Add(FsusNativeMenuItemModel.Separator());
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Services",
        Role = FsusPlatformRole.Services,
      });
      appMenu.Items.Add(FsusNativeMenuItemModel.Separator());
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Hide Application",
        Role = FsusPlatformRole.Hide,
        Command = new FsusPlatformCommand("app.hide", "Hide Application", FsusPlatformRole.Hide)
        {
          Gesture = new FsusShortcutGesture(Key.H, KeyModifiers.Control),
        },
      });
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Hide Others",
        Role = FsusPlatformRole.HideOthers,
        Command = new FsusPlatformCommand("app.hideOthers", "Hide Others", FsusPlatformRole.HideOthers)
        {
          Gesture = new FsusShortcutGesture(Key.H, KeyModifiers.Control | KeyModifiers.Alt),
        },
      });
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Show All",
        Role = FsusPlatformRole.ShowAll,
      });
      appMenu.Items.Add(FsusNativeMenuItemModel.Separator());
      appMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Quit Application",
        Role = FsusPlatformRole.Quit,
        Command = new FsusPlatformCommand("app.quit", "Quit Application", FsusPlatformRole.Quit)
        {
          Gesture = new FsusShortcutGesture(Key.Q, KeyModifiers.Control),
        },
      });

      list.Insert(0, appMenu);
    }

    return list;
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForWindowsLinux(
    IEnumerable<FsusNativeMenuItemModel> roots)
  {
    var result = new List<FsusNativeMenuItemModel>();
    FsusNativeMenuItemModel? aboutItem = null;
    FsusNativeMenuItemModel? preferencesItem = null;
    FsusNativeMenuItemModel? quitItem = null;

    foreach (var root in roots)
    {
      if (root.Role == FsusPlatformRole.About || root.Header?.Equals("Application", StringComparison.OrdinalIgnoreCase) == true)
      {
        ExtractRoles(root, ref aboutItem, ref preferencesItem, ref quitItem);
        continue;
      }

      var filtered = FilterMenu(root, ref aboutItem, ref preferencesItem, ref quitItem);
      if (filtered is not null)
      {
        result.Add(filtered);
      }
    }

    var fileMenu = result.FirstOrDefault(m => m.Header?.Equals("File", StringComparison.OrdinalIgnoreCase) == true);
    if (fileMenu is not null)
    {
      if (preferencesItem is not null)
      {
        fileMenu.Items.Add(FsusNativeMenuItemModel.Separator());
        fileMenu.Items.Add(new FsusNativeMenuItemModel
        {
          Header = "Preferences",
          Command = preferencesItem.Command,
          Role = FsusPlatformRole.Preferences,
        });
      }

      fileMenu.Items.Add(FsusNativeMenuItemModel.Separator());
      fileMenu.Items.Add(new FsusNativeMenuItemModel
      {
        Header = "Exit",
        Command = quitItem?.Command ?? new FsusPlatformCommand("app.exit", "Exit", FsusPlatformRole.Quit)
        {
          Gesture = new FsusShortcutGesture(Key.F4, KeyModifiers.Alt),
        },
        Role = FsusPlatformRole.Quit,
      });
    }

    var helpMenu = result.FirstOrDefault(m => m.Header?.Equals("Help", StringComparison.OrdinalIgnoreCase) == true);
    if (helpMenu is null)
    {
      helpMenu = new FsusNativeMenuItemModel { Header = "Help", Role = FsusPlatformRole.Help };
      result.Add(helpMenu);
    }

    helpMenu.Items.Add(FsusNativeMenuItemModel.Separator());
    helpMenu.Items.Add(aboutItem ?? new FsusNativeMenuItemModel
    {
      Header = "About",
      Role = FsusPlatformRole.About,
    });

    return result;
  }

  private static void ExtractRoles(
    FsusNativeMenuItemModel menu,
    ref FsusNativeMenuItemModel? about,
    ref FsusNativeMenuItemModel? preferences,
    ref FsusNativeMenuItemModel? quit)
  {
    foreach (var child in menu.Items)
    {
      if (child.Role == FsusPlatformRole.About && about is null)
      {
        about = child;
      }
      else if (child.Role == FsusPlatformRole.Preferences && preferences is null)
      {
        preferences = child;
      }
      else if (child.Role == FsusPlatformRole.Quit && quit is null)
      {
        quit = child;
      }
    }
  }

  private static FsusNativeMenuItemModel? FilterMenu(
    FsusNativeMenuItemModel source,
    ref FsusNativeMenuItemModel? about,
    ref FsusNativeMenuItemModel? preferences,
    ref FsusNativeMenuItemModel? quit)
  {
    if (source.Role is FsusPlatformRole.Services or
                       FsusPlatformRole.Hide or
                       FsusPlatformRole.HideOthers or
                       FsusPlatformRole.ShowAll)
    {
      return null;
    }

    var copy = new FsusNativeMenuItemModel
    {
      Id = source.Id,
      Header = source.Header,
      Command = source.Command,
      Role = source.Role,
      IsSeparator = source.IsSeparator,
      IsRecentGroup = source.IsRecentGroup,
      OpenRecentAction = source.OpenRecentAction,
      ClearRecentAction = source.ClearRecentAction,
    };

    foreach (var recent in source.RecentItems)
    {
      copy.RecentItems.Add(recent);
    }

    foreach (var item in source.Items)
    {
      var filtered = FilterMenu(item, ref about, ref preferences, ref quit);
      if (filtered is not null)
      {
        copy.Items.Add(filtered);
      }
    }

    return copy;
  }

  private static FsusShortcutPlatform ResolvePlatform(FsusShortcutPlatform platform)
  {
    if (platform != FsusShortcutPlatform.Auto)
    {
      return platform;
    }

    if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
    {
      return FsusShortcutPlatform.macOS;
    }

    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
    {
      return FsusShortcutPlatform.Windows;
    }

    return FsusShortcutPlatform.Linux;
  }

  private sealed class ActionCommand(Action<object?> action) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;

    public void Execute(object? parameter) => action(parameter);
  }
}

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
        menu.Items.Add(new NativeMenuItem
        {
          Header = path,
          Command = new ActionCommand(_ => openRecentAction?.Invoke(path)),
        });
      }

      if (clearRecentAction is not null)
      {
        menu.Items.Add(new NativeMenuItemSeparator());
        menu.Items.Add(new NativeMenuItem
        {
          Header = "Clear Recent",
          Command = new ActionCommand(_ => clearRecentAction()),
        });
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
        menu.Items.Add(new NativeMenuItem
        {
          Header = cmd.Label,
          IsEnabled = cmd.IsEnabled,
          Command = new ActionCommand(_ => cmd.Execute()),
        });
      }
    }

    return menu;
  }

  private sealed class ActionCommand(Action<object?> action) : ICommand
  {
    public event EventHandler? CanExecuteChanged
    {
      add { }
      remove { }
    }

    public bool CanExecute(object? parameter) => true;

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
      if (string.IsNullOrEmpty(trimmed) ||
          cmd.Label.Contains(trimmed, StringComparison.OrdinalIgnoreCase) ||
          (cmd.Category?.Contains(trimmed, StringComparison.OrdinalIgnoreCase) == true) ||
          (cmd.Description?.Contains(trimmed, StringComparison.OrdinalIgnoreCase) == true))
      {
        results.Add(new FsusCommandPaletteItem(
          cmd.Id,
          cmd.Label,
          cmd.Category,
          cmd.Description,
          cmd.Gesture?.ToDisplayText(platform) ?? string.Empty,
          cmd.IsEnabled,
          cmd.Execute));
      }
    }

    return results;
  }
}
