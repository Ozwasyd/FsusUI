using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using FsusUI.Avalonia.Themes;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusThemeMode
{
  Light,
  Dark,
  System,
}

public enum FsusThemeModeToggleVisibility
{
  Always,
  Desktop,
  Mobile,
}

public enum FsusThemeModeToggleVariant
{
  Segmented,
  MenuButton,
}

public sealed class FsusThemeModeChangedEventArgs(FsusThemeMode mode) : EventArgs
{
  public FsusThemeMode Mode { get; } = mode;
}

public sealed record FsusThemeModeToggleLabels
{
  public string? Light { get; init; }
  public string? Dark { get; init; }
  public string? System { get; init; }
  public string? LightShort { get; init; }
  public string? DarkShort { get; init; }
  public string? SystemShort { get; init; }
}

public class FsusThemeModeToggle : ContentControl
{
  private static readonly FsusThemeMode[] ModeOrder =
  [
    FsusThemeMode.Light,
    FsusThemeMode.Dark,
    FsusThemeMode.System,
  ];

  private readonly IResourceDictionary resources;
  private string accessibleName = "Theme mode";
  private FsusThemeMode currentMode = FsusThemeMode.System;
  private bool compact;
  private FsusThemeModeToggleLabels labels = new();

  public FsusThemeModeToggle()
    : this(new FsusThemeManager(), new ResourceDictionary())
  {
  }

  public FsusThemeModeToggle(
    FsusThemeManager manager,
    IResourceDictionary resources)
  {
    ThemeManager = manager;
    this.resources = resources;
    SetBaseClasses();
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusThemeModeChangedEventArgs>? ModeChanged;

  public FsusThemeManager ThemeManager { get; }

  public string AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public FsusThemeMode CurrentMode => currentMode;

  public bool Compact
  {
    get => compact;
    set
    {
      compact = value;
      SyncState();
    }
  }

  public FsusThemeModeToggleVisibility Visibility { get; set; } =
    FsusThemeModeToggleVisibility.Always;

  public FsusThemeModeToggleVariant Variant { get; set; } =
    FsusThemeModeToggleVariant.Segmented;

  public FsusThemeModeToggleLabels Labels
  {
    get => labels;
    set
    {
      labels = value;
      SyncState();
    }
  }

  public IReadOnlyList<string> VisibleLabels =>
    ModeOrder.Select(ResolveLabel).ToArray();

  public void SetMode(FsusThemeMode mode)
  {
    if (!Enum.IsDefined(mode))
    {
      mode = FsusThemeMode.System;
    }

    currentMode = mode;
    ThemeManager.Apply(resources, BuildOptions(mode));
    SyncState();
    ModeChanged?.Invoke(this, new FsusThemeModeChangedEventArgs(mode));
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    var index = Array.IndexOf(ModeOrder, currentMode);
    if (index < 0)
    {
      index = 0;
    }

    var nextIndex = key switch
    {
      Key.Right or Key.Down => (index + 1) % ModeOrder.Length,
      Key.Left or Key.Up => (index + ModeOrder.Length - 1) % ModeOrder.Length,
      Key.Home => 0,
      Key.End => ModeOrder.Length - 1,
      _ => -1,
    };

    if (nextIndex < 0)
    {
      return ValueTask.FromResult(false);
    }

    SetMode(ModeOrder[nextIndex]);
    return ValueTask.FromResult(true);
  }

  private FsusThemeOptions BuildOptions(FsusThemeMode mode)
  {
    var current = ThemeManager.CurrentOptions;
    return mode switch
    {
      FsusThemeMode.Light => current with
      {
        Variant = FsusThemeVariant.Light,
        FollowSystemTheme = false,
      },
      FsusThemeMode.Dark => current with
      {
        Variant = FsusThemeVariant.Dark,
        FollowSystemTheme = false,
      },
      _ => current with
      {
        FollowSystemTheme = true,
      },
    };
  }

  private void SyncState()
  {
    Ensure("fsus-compact", compact);
    Ensure("fsus-visibility-desktop", Visibility == FsusThemeModeToggleVisibility.Desktop);
    Ensure("fsus-visibility-mobile", Visibility == FsusThemeModeToggleVisibility.Mobile);
    Ensure("fsus-variant-menu-button", Variant == FsusThemeModeToggleVariant.MenuButton);
    Ensure("fsus-mode-light", currentMode == FsusThemeMode.Light);
    Ensure("fsus-mode-dark", currentMode == FsusThemeMode.Dark);
    Ensure("fsus-mode-system", currentMode == FsusThemeMode.System);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{ModeName(currentMode)}, {VisibleLabels.Count.ToString(CultureInfo.InvariantCulture)} modes");
  }

  private string ResolveLabel(FsusThemeMode mode) =>
    mode switch
    {
      FsusThemeMode.Light => compact
        ? labels.LightShort ?? "Light"
        : labels.Light ?? "Light",
      FsusThemeMode.Dark => compact
        ? labels.DarkShort ?? "Dark"
        : labels.Dark ?? "Dark",
      _ => compact
        ? labels.SystemShort ?? "System"
        : labels.System ?? "System",
    };

  private static string ModeName(FsusThemeMode mode) =>
    mode.ToString().ToLower(CultureInfo.InvariantCulture);

  private void SetBaseClasses()
  {
    Ensure("fsus-control", true);
    Ensure("fsus-theme-mode-toggle", true);
  }

  private void Ensure(string className, bool enabled)
  {
    if (enabled)
    {
      if (!Classes.Contains(className))
      {
        Classes.Add(className);
      }
    }
    else
    {
      Classes.Remove(className);
    }
  }
}
