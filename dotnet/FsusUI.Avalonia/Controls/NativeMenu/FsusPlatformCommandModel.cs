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
