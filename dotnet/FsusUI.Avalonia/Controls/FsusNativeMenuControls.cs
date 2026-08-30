using Avalonia;
using Avalonia.Automation;
using Avalonia.Controls;
using Avalonia.Input;
using System.ComponentModel;
using System.Runtime.CompilerServices;
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
  Application,
  File,
  Edit,
  View,
  Window,
  DockOpen,
  DockOpenRecent,
  DockClearRecent,
}

public enum FsusMenuItemToggleType
{
  None,
  CheckBox,
  Radio,
}

public static class FsusNativeMenuMetadata
{
  private static readonly ConditionalWeakTable<NativeMenuItem, Metadata> Items =
    new();

  public static FsusPlatformRole GetRole(NativeMenuItem item)
  {
    ArgumentNullException.ThrowIfNull(item);
    return Items.TryGetValue(item, out var metadata)
      ? metadata.Role
      : FsusPlatformRole.None;
  }

  public static string? GetCommandId(NativeMenuItem item)
  {
    ArgumentNullException.ThrowIfNull(item);
    return Items.TryGetValue(item, out var metadata)
      ? metadata.CommandId
      : null;
  }

  public static string GetAutomationName(NativeMenuItem item)
  {
    ArgumentNullException.ThrowIfNull(item);
    return Items.TryGetValue(item, out var metadata)
      ? metadata.AutomationName
      : item.Header ?? string.Empty;
  }

  internal static void Set(
    NativeMenuItem item,
    FsusPlatformRole role,
    string? commandId,
    string automationName)
  {
    Items.Remove(item);
    Items.Add(item, new Metadata(role, commandId, automationName));
  }

  private sealed record Metadata(
    FsusPlatformRole Role,
    string? CommandId,
    string AutomationName);
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
  private Func<bool>? isEnabledPredicate;
  private Func<bool>? isVisiblePredicate;
  private Func<object?, CancellationToken, ValueTask>? executeAsyncAction;

  public FsusPlatformCommand(string id, string label, FsusPlatformRole role = FsusPlatformRole.None)
  {
    ArgumentException.ThrowIfNullOrWhiteSpace(id);
    ArgumentException.ThrowIfNullOrWhiteSpace(label);
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

  public Func<object?, CancellationToken, ValueTask>? ExecuteAsyncAction
  {
    get => executeAsyncAction;
    set
    {
      if (executeAsyncAction != value)
      {
        executeAsyncAction = value;
        Notify(nameof(ExecuteAsyncAction));
      }
    }
  }

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

  public Func<bool>? IsEnabledPredicate
  {
    get => isEnabledPredicate;
    set
    {
      if (isEnabledPredicate != value)
      {
        isEnabledPredicate = value;
        Notify(nameof(IsEnabledPredicate));
      }
    }
  }

  public Func<bool>? IsVisiblePredicate
  {
    get => isVisiblePredicate;
    set
    {
      if (isVisiblePredicate != value)
      {
        isVisiblePredicate = value;
        Notify(nameof(IsVisiblePredicate));
      }
    }
  }

  public bool IsEffectivelyEnabled => CanExecute();

  public bool IsEffectivelyVisible => IsVisiblePredicate?.Invoke() ?? true;

  public bool CanExecute(object? parameter = null)
  {
    var arg = parameter ?? CommandParameter;
    return IsEnabled &&
      (IsEnabledPredicate?.Invoke() ?? true) &&
      (Command?.CanExecute(arg) ?? true);
  }

  public void Execute(object? parameter = null)
  {
    var arg = parameter ?? CommandParameter;
    if (!CanExecute(arg))
    {
      return;
    }

    if (ExecuteAction is not null)
    {
      ExecuteAction(arg);
    }
    else
    {
      Command?.Execute(arg);
    }
  }

  public async ValueTask<bool> ExecuteAsync(
    object? parameter = null,
    CancellationToken cancellationToken = default)
  {
    var arg = parameter ?? CommandParameter;
    if (!CanExecute(arg))
    {
      return false;
    }

    cancellationToken.ThrowIfCancellationRequested();
    if (ExecuteAsyncAction is not null)
    {
      await ExecuteAsyncAction(arg, cancellationToken);
    }
    else
    {
      Execute(arg);
    }

    return true;
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

  public string? AccessibleName { get; set; }

  public string? AccessibleDescription { get; set; }

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
      AccessibleName = command.Label,
      AccessibleDescription = command.Description,
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

public enum FsusNativeMenuProfile
{
  StandardDocumentWindow = 0,
  PreserveRoots = 1,
}

[Flags]
public enum FsusNativeMenuSynthesizedRoots
{
  None = 0,
  Application = 1 << 0,
  File = 1 << 1,
  Window = 1 << 2,
  Help = 1 << 3,
  All = Application | File | Window | Help,
}

public sealed record FsusNativeMenuOptions
{
  public static FsusNativeMenuOptions Default { get; } = new();

  public FsusNativeMenuProfile Profile { get; init; } =
    FsusNativeMenuProfile.StandardDocumentWindow;

  public FsusNativeMenuSynthesizedRoots SynthesizedRoots { get; init; } =
    FsusNativeMenuSynthesizedRoots.All;
}

public sealed class FsusNativeMenuBuilder : IDisposable
{
  private readonly List<Action> cleanupActions = [];

  public int ActiveSubscriptionCount => cleanupActions.Count;

  public NativeMenu Build(
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    return Build(rootModels, FsusNativeMenuOptions.Default, platform);
  }

  public NativeMenu Build(
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusNativeMenuOptions options,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(options);
    Dispose();
    var resolvedPlatform = ResolvePlatform(platform);
    var resolvedOptions = NormalizeOptions(options);
    var menu = new NativeMenu();

    var adaptedModels = AdaptForPlatform(rootModels, resolvedOptions, resolvedPlatform);
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
    AttachTo(topLevel, rootModels, FsusNativeMenuOptions.Default, platform);
  }

  public void AttachTo(
    TopLevel topLevel,
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusNativeMenuOptions options,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(topLevel);
    var menu = Build(rootModels, options, platform);
    NativeMenu.SetMenu(topLevel, menu);
  }

  public void AttachTo(
    Application app,
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    AttachTo(app, rootModels, FsusNativeMenuOptions.Default, platform);
  }

  public void AttachTo(
    Application app,
    IEnumerable<FsusNativeMenuItemModel> rootModels,
    FsusNativeMenuOptions options,
    FsusShortcutPlatform platform = FsusShortcutPlatform.Auto)
  {
    ArgumentNullException.ThrowIfNull(app);
    var menu = Build(rootModels, options, platform);
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

      var submenuItem = new NativeMenuItem
      {
        Header = model.Header,
        ToolTip = model.AccessibleDescription,
        Menu = subMenu,
      };
      FsusNativeMenuMetadata.Set(
        submenuItem,
        model.Role,
        model.Command?.Id ?? NullIfEmpty(model.Id),
        model.AccessibleName ?? model.Header ?? string.Empty);
      return submenuItem;
    }

    var item = new NativeMenuItem
    {
      Header = model.Header ?? model.Command?.Label,
      ToolTip = model.AccessibleDescription ?? model.Command?.Description,
      IsEnabled = model.Command?.IsEnabled ?? true,
      IsChecked = model.Command?.IsChecked ?? false,
      ToggleType = (MenuItemToggleType)(int)(model.Command?.ToggleType ?? FsusMenuItemToggleType.None),
      Gesture = model.Command?.Gesture?.ToKeyGesture(),
    };

    if (model.Command is not null)
    {
      var cmd = model.Command;
      var itemCommand = new ActionCommand(
        () => cmd.IsEnabled &&
          (cmd.Command?.CanExecute(cmd.CommandParameter) ?? true),
        _ => cmd.Execute());
      item.Command = itemCommand;
      FsusNativeMenuMetadata.Set(
        item,
        cmd.Role != FsusPlatformRole.None ? cmd.Role : model.Role,
        cmd.Id,
        model.AccessibleName ?? cmd.Label);

      EventHandler onStateChanged = (_, _) =>
      {
        itemCommand.RaiseCanExecuteChanged();
        item.Header = cmd.Label;
        item.IsEnabled = cmd.IsEnabled;
        item.IsChecked = cmd.IsChecked;
        item.ToggleType = (MenuItemToggleType)(int)cmd.ToggleType;
        item.Gesture = cmd.Gesture?.ToKeyGesture();
        item.ToolTip = cmd.Description;
        FsusNativeMenuMetadata.Set(
          item,
          cmd.Role != FsusPlatformRole.None ? cmd.Role : model.Role,
          cmd.Id,
          model.AccessibleName ?? cmd.Label);
      };

      cmd.StateChanged += onStateChanged;
      cleanupActions.Add(() => cmd.StateChanged -= onStateChanged);
    }
    else
    {
      FsusNativeMenuMetadata.Set(
        item,
        model.Role,
        NullIfEmpty(model.Id),
        model.AccessibleName ?? model.Header ?? string.Empty);
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
          ToolTip = $"Open recent item {recentPath}",
          Command = new ActionCommand(() => true, _ => model.OpenRecentAction?.Invoke(recentPath)),
        };
        FsusNativeMenuMetadata.Set(
          recentItem,
          FsusPlatformRole.FileOpenRecent,
          NullIfEmpty(model.Id),
          $"Open recent item {recentPath}");
        subMenu.Items.Add(recentItem);
      }

      if (model.ClearRecentAction is not null)
      {
        subMenu.Items.Add(new NativeMenuItemSeparator());
        var clearItem = new NativeMenuItem
        {
          Header = "Clear Recent",
          ToolTip = "Clear the recent items list",
          Command = new ActionCommand(() => true, _ => model.ClearRecentAction.Invoke()),
        };
        FsusNativeMenuMetadata.Set(
          clearItem,
          FsusPlatformRole.DockClearRecent,
          null,
          "Clear recent items");
        subMenu.Items.Add(clearItem);
      }
    }

    var recentGroup = new NativeMenuItem
    {
      Header = model.Header ?? "Open Recent",
      Menu = subMenu,
    };
    FsusNativeMenuMetadata.Set(
      recentGroup,
      model.Role,
      NullIfEmpty(model.Id),
      model.AccessibleName ?? model.Header ?? "Open Recent");
    return recentGroup;
  }

  private static string? NullIfEmpty(string value) =>
    string.IsNullOrWhiteSpace(value) ? null : value;

  private static FsusNativeMenuOptions NormalizeOptions(
    FsusNativeMenuOptions options)
  {
    return options with
    {
      Profile = Enum.IsDefined(typeof(FsusNativeMenuProfile), options.Profile)
        ? options.Profile
        : FsusNativeMenuProfile.StandardDocumentWindow,
      SynthesizedRoots =
        options.SynthesizedRoots & FsusNativeMenuSynthesizedRoots.All,
    };
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForPlatform(
    IEnumerable<FsusNativeMenuItemModel> roots,
    FsusNativeMenuOptions options,
    FsusShortcutPlatform platform)
  {
    if (options.Profile == FsusNativeMenuProfile.PreserveRoots)
    {
      return roots.Select(CloneModel);
    }

    if (platform == FsusShortcutPlatform.macOS)
    {
      return AdaptForMac(roots, options.SynthesizedRoots);
    }

    return AdaptForWindowsLinux(roots, options.SynthesizedRoots);
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForMac(
    IEnumerable<FsusNativeMenuItemModel> roots,
    FsusNativeMenuSynthesizedRoots synthesized)
  {
    var list = roots.Select(CloneModel).ToList();
    var appMenu = list.FirstOrDefault(IsApplicationMenu);
    if (appMenu is not null)
    {
      appMenu.Header ??= "Application";
      appMenu.AccessibleName ??= "Application menu";
      appMenu.Role = FsusPlatformRole.Application;
    }
    else if (synthesized.HasFlag(FsusNativeMenuSynthesizedRoots.Application))
    {
      appMenu = new FsusNativeMenuItemModel
      {
        Header = "Application",
        AccessibleName = "Application menu",
        Role = FsusPlatformRole.Application,
      };
      list.Insert(0, appMenu);
    }

    if (appMenu is not null)
    {
      var existingItems = appMenu.Items.ToList();
      var standaloneRoleItems = list
        .Where(item =>
          !ReferenceEquals(item, appMenu) &&
          IsMacApplicationRole(item.Role))
        .ToArray();
      foreach (var item in standaloneRoleItems)
      {
        existingItems.Add(item);
        list.Remove(item);
      }
      var customItems = existingItems
        .Where(item =>
          !item.IsSeparator &&
          item.Role is FsusPlatformRole.None or FsusPlatformRole.Application)
        .ToArray();
      appMenu.Items.Clear();

      AppendSeparated(
        appMenu.Items,
        [
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.About,
            "app.about",
            "About Application"),
        ]);
      AppendSeparated(
        appMenu.Items,
        [
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.Preferences,
            "app.preferences",
            "Preferences...",
            new FsusShortcutGesture(Key.OemComma, KeyModifiers.Control)),
        ]);
      AppendSeparated(appMenu.Items, customItems);
      AppendSeparated(
        appMenu.Items,
        [
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.Services,
            "app.services",
            "Services",
            createCommand: false),
        ]);
      AppendSeparated(
        appMenu.Items,
        [
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.Hide,
            "app.hide",
            "Hide Application",
            new FsusShortcutGesture(Key.H, KeyModifiers.Control)),
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.HideOthers,
            "app.hideOthers",
            "Hide Others",
            new FsusShortcutGesture(
              Key.H,
              KeyModifiers.Control | KeyModifiers.Alt)),
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.ShowAll,
            "app.showAll",
            "Show All",
            createCommand: false),
        ]);
      AppendSeparated(
        appMenu.Items,
        [
          ResolveRoleItem(
            existingItems,
            FsusPlatformRole.Quit,
            "app.quit",
            "Quit Application",
            new FsusShortcutGesture(Key.Q, KeyModifiers.Control)),
        ]);
    }

    NormalizeMacWindowMenu(list, synthesized);
    return SortTopLevelMenus(list, includeApplication: true);
  }

  private static IEnumerable<FsusNativeMenuItemModel> AdaptForWindowsLinux(
    IEnumerable<FsusNativeMenuItemModel> roots,
    FsusNativeMenuSynthesizedRoots synthesized)
  {
    var fileMenuAvailable = roots.Any(IsFileMenu) ||
      synthesized.HasFlag(FsusNativeMenuSynthesizedRoots.File);
    var helpMenuAvailable = roots.Any(IsHelpMenu) ||
      synthesized.HasFlag(FsusNativeMenuSynthesizedRoots.Help);

    if (!fileMenuAvailable || !helpMenuAvailable)
    {
      return AdaptConstrainedForWindowsLinux(roots);
    }

    var result = new List<FsusNativeMenuItemModel>();
    FsusNativeMenuItemModel? aboutItem = null;
    FsusNativeMenuItemModel? preferencesItem = null;
    FsusNativeMenuItemModel? quitItem = null;

    foreach (var root in roots)
    {
      if (IsApplicationMenu(root))
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

    var fileMenu = result.FirstOrDefault(IsFileMenu);
    if (fileMenu is null)
    {
      fileMenu = new FsusNativeMenuItemModel
      {
        Header = "File",
        AccessibleName = "File menu",
        Role = FsusPlatformRole.File,
      };
      result.Add(fileMenu);
    }
    else
    {
      fileMenu.Role = FsusPlatformRole.File;
      fileMenu.AccessibleName ??= "File menu";
    }

    if (preferencesItem is not null)
    {
      preferencesItem.Header = "Preferences";
      AppendSeparated(fileMenu.Items, [preferencesItem]);
    }

    var exitItem = quitItem ?? FsusNativeMenuItemModel.Action(
      new FsusPlatformCommand("app.exit", "Exit", FsusPlatformRole.Quit)
      {
        Gesture = new FsusShortcutGesture(Key.F4, KeyModifiers.Alt),
      });
    exitItem.Header = "Exit";
    AppendSeparated(fileMenu.Items, [exitItem]);

    var helpMenu = result.FirstOrDefault(IsHelpMenu);
    if (helpMenu is null)
    {
      helpMenu = new FsusNativeMenuItemModel { Header = "Help", Role = FsusPlatformRole.Help };
      result.Add(helpMenu);
    }
    helpMenu.Role = FsusPlatformRole.Help;
    helpMenu.AccessibleName ??= "Help menu";

    AppendSeparated(helpMenu.Items, [aboutItem ?? new FsusNativeMenuItemModel
    {
      Header = "About",
      AccessibleName = "About",
      Role = FsusPlatformRole.About,
    }]);

    NormalizeSeparators(fileMenu.Items);
    NormalizeSeparators(helpMenu.Items);
    return SortTopLevelMenus(result, includeApplication: false);
  }

  private static IEnumerable<FsusNativeMenuItemModel>
    AdaptConstrainedForWindowsLinux(IEnumerable<FsusNativeMenuItemModel> roots)
  {
    var result = new List<FsusNativeMenuItemModel>();
    foreach (var root in roots)
    {
      FsusNativeMenuItemModel? unusedAbout = null;
      FsusNativeMenuItemModel? unusedPreferences = null;
      FsusNativeMenuItemModel? unusedQuit = null;
      var filtered = FilterMenu(
        root,
        ref unusedAbout,
        ref unusedPreferences,
        ref unusedQuit,
        relocateAbout: false,
        relocatePreferencesQuit: false);
      if (filtered is not null)
      {
        result.Add(filtered);
      }
    }

    return SortTopLevelMenus(result, includeApplication: true);
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

      if (child.Items.Count > 0)
      {
        ExtractRoles(child, ref about, ref preferences, ref quit);
      }
    }
  }

  private static FsusNativeMenuItemModel? FilterMenu(
    FsusNativeMenuItemModel source,
    ref FsusNativeMenuItemModel? about,
    ref FsusNativeMenuItemModel? preferences,
    ref FsusNativeMenuItemModel? quit,
    bool relocateAbout = true,
    bool relocatePreferencesQuit = true)
  {
    if (source.Role is FsusPlatformRole.Services or
                       FsusPlatformRole.Hide or
                       FsusPlatformRole.HideOthers or
                       FsusPlatformRole.ShowAll or
                       FsusPlatformRole.WindowMinimize or
                       FsusPlatformRole.WindowZoom or
                       FsusPlatformRole.WindowClose or
                       FsusPlatformRole.WindowBringAllToFront)
    {
      return null;
    }

    if (relocateAbout && source.Role == FsusPlatformRole.About)
    {
      about ??= CloneModel(source);
      return null;
    }

    if (relocatePreferencesQuit && source.Role == FsusPlatformRole.Preferences)
    {
      preferences ??= CloneModel(source);
      return null;
    }

    if (relocatePreferencesQuit && source.Role == FsusPlatformRole.Quit)
    {
      quit ??= CloneModel(source);
      return null;
    }

    var copy = new FsusNativeMenuItemModel
    {
      Id = source.Id,
      Header = source.Header,
      AccessibleName = source.AccessibleName,
      AccessibleDescription = source.AccessibleDescription,
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
      var filtered = FilterMenu(
        item,
        ref about,
        ref preferences,
        ref quit,
        relocateAbout,
        relocatePreferencesQuit);
      if (filtered is not null)
      {
        copy.Items.Add(filtered);
      }
    }

    return copy;
  }

  private static void NormalizeMacWindowMenu(
    IList<FsusNativeMenuItemModel> menus,
    FsusNativeMenuSynthesizedRoots synthesized)
  {
    var windowMenu = menus.FirstOrDefault(IsWindowMenu);
    if (windowMenu is null)
    {
      if (!synthesized.HasFlag(FsusNativeMenuSynthesizedRoots.Window))
      {
        return;
      }

      windowMenu = new FsusNativeMenuItemModel
      {
        Header = "Window",
        AccessibleName = "Window menu",
        Role = FsusPlatformRole.Window,
      };
      menus.Add(windowMenu);
    }
    else
    {
      windowMenu.Header ??= "Window";
      windowMenu.AccessibleName ??= "Window menu";
      windowMenu.Role = FsusPlatformRole.Window;
    }

    var existingItems = windowMenu.Items.ToList();
    var customItems = existingItems
      .Where(item =>
        !item.IsSeparator &&
        !IsMacWindowRole(item.Role))
      .ToArray();
    var close = existingItems.FirstOrDefault(
      item => item.Role == FsusPlatformRole.WindowClose);
    windowMenu.Items.Clear();

    if (close is not null)
    {
      AppendSeparated(windowMenu.Items, [close]);
    }
    AppendSeparated(
      windowMenu.Items,
      [
        ResolveRoleItem(
          existingItems,
          FsusPlatformRole.WindowMinimize,
          "window.minimize",
          "Minimize",
          new FsusShortcutGesture(Key.M, KeyModifiers.Control)),
        ResolveRoleItem(
          existingItems,
          FsusPlatformRole.WindowZoom,
          "window.zoom",
          "Zoom",
          createCommand: false),
      ]);
    AppendSeparated(windowMenu.Items, customItems);
    AppendSeparated(
      windowMenu.Items,
      [
        ResolveRoleItem(
          existingItems,
          FsusPlatformRole.WindowBringAllToFront,
          "window.bringAllToFront",
          "Bring All to Front",
          createCommand: false),
      ]);
  }

  private static FsusNativeMenuItemModel ResolveRoleItem(
    IReadOnlyList<FsusNativeMenuItemModel> items,
    FsusPlatformRole role,
    string commandId,
    string label,
    FsusShortcutGesture? gesture = null,
    bool createCommand = true)
  {
    var existing = items.FirstOrDefault(item => item.Role == role);
    if (existing is not null)
    {
      existing.AccessibleName ??= existing.Header ?? existing.Command?.Label ?? label;
      if (role == FsusPlatformRole.Services && existing.Items.Count == 0)
      {
        existing.Items.Add(new FsusNativeMenuItemModel
        {
          Header = "No Services",
          AccessibleName = "No Services",
          Command = new FsusPlatformCommand(
            "app.services.empty",
            "No Services",
            FsusPlatformRole.Services)
          {
            IsEnabled = false,
          },
          Role = FsusPlatformRole.Services,
        });
      }
      return existing;
    }

    if (!createCommand)
    {
      var model = new FsusNativeMenuItemModel
      {
        Header = label,
        AccessibleName = label,
        Role = role,
      };
      if (role == FsusPlatformRole.Services)
      {
        model.Items.Add(new FsusNativeMenuItemModel
        {
          Header = "No Services",
          AccessibleName = "No Services",
          Command = new FsusPlatformCommand(
            "app.services.empty",
            "No Services",
            FsusPlatformRole.Services)
          {
            IsEnabled = false,
          },
          Role = FsusPlatformRole.Services,
        });
      }
      return model;
    }

    return FsusNativeMenuItemModel.Action(
      new FsusPlatformCommand(commandId, label, role)
      {
        Gesture = gesture,
      });
  }

  private static void AppendSeparated(
    IList<FsusNativeMenuItemModel> destination,
    IEnumerable<FsusNativeMenuItemModel> items)
  {
    var materialized = items.Where(item => !item.IsSeparator).ToArray();
    if (materialized.Length == 0)
    {
      return;
    }

    if (destination.Count > 0 && !destination[^1].IsSeparator)
    {
      destination.Add(FsusNativeMenuItemModel.Separator());
    }

    foreach (var item in materialized)
    {
      destination.Add(item);
    }
  }

  private static void NormalizeSeparators(IList<FsusNativeMenuItemModel> items)
  {
    for (var index = items.Count - 1; index >= 0; index--)
    {
      if (!items[index].IsSeparator)
      {
        continue;
      }

      if (index == 0 ||
          index == items.Count - 1 ||
          items[index - 1].IsSeparator)
      {
        items.RemoveAt(index);
      }
    }
  }

  private static IEnumerable<FsusNativeMenuItemModel> SortTopLevelMenus(
    IEnumerable<FsusNativeMenuItemModel> menus,
    bool includeApplication)
  {
    var materialized = menus
      .Where(menu => includeApplication || !IsApplicationMenu(menu))
      .ToArray();
    foreach (var menu in materialized)
    {
      NormalizeTopLevelRole(menu);
    }

    return materialized
      .Select((menu, index) => (Menu: menu, Index: index))
      .OrderBy(entry => TopLevelRank(entry.Menu, includeApplication))
      .ThenBy(entry => entry.Index)
      .Select(entry => entry.Menu)
      .ToArray();
  }

  private static void NormalizeTopLevelRole(
    FsusNativeMenuItemModel menu)
  {
    if (HeaderEquals(menu, "Application"))
    {
      menu.Role = FsusPlatformRole.Application;
    }
    else if (HeaderEquals(menu, "File"))
    {
      menu.Role = FsusPlatformRole.File;
    }
    else if (HeaderEquals(menu, "Edit"))
    {
      menu.Role = FsusPlatformRole.Edit;
    }
    else if (HeaderEquals(menu, "View"))
    {
      menu.Role = FsusPlatformRole.View;
    }
    else if (HeaderEquals(menu, "Window"))
    {
      menu.Role = FsusPlatformRole.Window;
    }
    else if (HeaderEquals(menu, "Help"))
    {
      menu.Role = FsusPlatformRole.Help;
    }
    menu.AccessibleName ??= $"{menu.Header} menu";
  }

  private static int TopLevelRank(
    FsusNativeMenuItemModel menu,
    bool includeApplication)
  {
    if (includeApplication && IsApplicationMenu(menu))
    {
      return 0;
    }
    if (IsFileMenu(menu))
    {
      return 10;
    }
    if (menu.Role == FsusPlatformRole.Edit ||
        HeaderEquals(menu, "Edit"))
    {
      return 20;
    }
    if (menu.Role == FsusPlatformRole.View ||
        HeaderEquals(menu, "View"))
    {
      return 30;
    }
    if (menu.Role == FsusPlatformRole.Window ||
        HeaderEquals(menu, "Window"))
    {
      return 50;
    }
    if (IsHelpMenu(menu))
    {
      return 60;
    }

    return 40;
  }

  private static bool IsApplicationMenu(FsusNativeMenuItemModel model) =>
    model.Role == FsusPlatformRole.Application ||
    HeaderEquals(model, "Application");

  private static bool IsMacApplicationRole(FsusPlatformRole role) =>
    role is FsusPlatformRole.About or
      FsusPlatformRole.Preferences or
      FsusPlatformRole.Services or
      FsusPlatformRole.Hide or
      FsusPlatformRole.HideOthers or
      FsusPlatformRole.ShowAll or
      FsusPlatformRole.Quit;

  private static bool IsMacWindowRole(FsusPlatformRole role) =>
    role is FsusPlatformRole.WindowMinimize or
      FsusPlatformRole.WindowZoom or
      FsusPlatformRole.WindowClose or
      FsusPlatformRole.WindowBringAllToFront;

  private static bool IsFileMenu(FsusNativeMenuItemModel model) =>
    model.Role == FsusPlatformRole.File ||
    HeaderEquals(model, "File");

  private static bool IsHelpMenu(FsusNativeMenuItemModel model) =>
    model.Role == FsusPlatformRole.Help ||
    HeaderEquals(model, "Help");

  private static bool IsWindowMenu(FsusNativeMenuItemModel model) =>
    model.Role == FsusPlatformRole.Window ||
    HeaderEquals(model, "Window");

  private static bool HeaderEquals(
    FsusNativeMenuItemModel model,
    string header) =>
    model.Header?.Equals(header, StringComparison.OrdinalIgnoreCase) == true;

  private static FsusNativeMenuItemModel CloneModel(
    FsusNativeMenuItemModel source)
  {
    var copy = new FsusNativeMenuItemModel
    {
      Id = source.Id,
      Header = source.Header,
      AccessibleName = source.AccessibleName,
      AccessibleDescription = source.AccessibleDescription,
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
      copy.Items.Add(CloneModel(item));
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

  private sealed class ActionCommand(Func<bool> canExecute, Action<object?> action)
    : ICommand
  {
    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => canExecute();

    public void Execute(object? parameter) => action(parameter);

    public void RaiseCanExecuteChanged() =>
      CanExecuteChanged?.Invoke(this, EventArgs.Empty);
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
          Gesture = cmd.Gesture?.ToKeyGesture(),
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
