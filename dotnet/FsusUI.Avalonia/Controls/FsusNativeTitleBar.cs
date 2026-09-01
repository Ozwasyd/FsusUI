using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Presenters;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.VisualTree;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusDesktopPlatform
{
  Auto,
  Windows,
  MacOS,
  Linux,
}

public enum FsusNativeWindowAction
{
  Minimize,
  Maximize,
  Restore,
  Close,
}

public sealed class FsusNativeWindowActionEventArgs(
  FsusNativeWindowAction action,
  WindowState previousState,
  WindowState currentState,
  FsusDesktopPlatform platform) : EventArgs
{
  public FsusNativeWindowAction Action { get; } = action;
  public WindowState PreviousState { get; } = previousState;
  public WindowState CurrentState { get; } = currentState;
  public FsusDesktopPlatform Platform { get; } = platform;
}

public class FsusNativeTitleBar : ContentControl, IDisposable
{
  public static readonly AttachedProperty<bool> IsNoDragProperty =
    AvaloniaProperty.RegisterAttached<FsusNativeTitleBar, Control, bool>(
      "IsNoDrag",
      false);

  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, string?>(
      nameof(AccessibleName),
      "Window title bar");

  public static readonly StyledProperty<string> DocumentTitleProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, string>(
      nameof(DocumentTitle),
      string.Empty);

  public static readonly StyledProperty<string?> DocumentPathProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, string?>(nameof(DocumentPath));

  public static readonly StyledProperty<object?> StatusProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, object?>(nameof(Status));

  public static readonly StyledProperty<object?> LeadingActionsProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, object?>(nameof(LeadingActions));

  public static readonly StyledProperty<object?> TrailingActionsProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, object?>(nameof(TrailingActions));

  public static readonly StyledProperty<bool> WindowControlsVisibleProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, bool>(
      nameof(WindowControlsVisible),
      true);

  public static readonly StyledProperty<bool> CanMinimizeProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, bool>(nameof(CanMinimize), true);

  public static readonly StyledProperty<bool> CanMaximizeProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, bool>(nameof(CanMaximize), true);

  public static readonly StyledProperty<bool> CanCloseProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, bool>(nameof(CanClose), true);

  public static readonly StyledProperty<bool> UseExtendedClientAreaProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, bool>(
      nameof(UseExtendedClientArea),
      true);

  public static readonly StyledProperty<FsusDesktopPlatform> PlatformProperty =
    AvaloniaProperty.Register<FsusNativeTitleBar, FsusDesktopPlatform>(
      nameof(Platform),
      FsusDesktopPlatform.Auto);

  public static readonly DirectProperty<FsusNativeTitleBar, bool> IsMaximizedProperty =
    AvaloniaProperty.RegisterDirect<FsusNativeTitleBar, bool>(
      nameof(IsMaximized),
      (owner) => owner.IsMaximized);

  public static readonly DirectProperty<FsusNativeTitleBar, bool> IsFullScreenProperty =
    AvaloniaProperty.RegisterDirect<FsusNativeTitleBar, bool>(
      nameof(IsFullScreen),
      (owner) => owner.IsFullScreen);

  private readonly Grid rootGrid = new();
  private readonly ContentPresenter leadingPresenter = new();
  private readonly Grid titlePanel = new();
  private readonly TextBlock titleText = new();
  private readonly TextBlock pathText = new();
  private readonly ContentPresenter statusPresenter = new();
  private readonly ContentPresenter trailingPresenter = new();
  private readonly StackPanel windowActions = new();
  private readonly Button minimizeButton = new();
  private readonly Button maximizeButton = new();
  private readonly Button closeButton = new();
  private Window? attachedWindow;
  private bool isMaximized;
  private bool isFullScreen;
  private bool disposed;

  public FsusNativeTitleBar()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-native-title-bar");
    Focusable = false;
    BuildVisualTree();
    SyncState();
  }

  public event EventHandler<FsusNativeWindowActionEventArgs>? WindowActionInvoked;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public string DocumentTitle
  {
    get => GetValue(DocumentTitleProperty);
    set => SetValue(DocumentTitleProperty, value);
  }

  public string? DocumentPath
  {
    get => GetValue(DocumentPathProperty);
    set => SetValue(DocumentPathProperty, value);
  }

  public object? Status
  {
    get => GetValue(StatusProperty);
    set => SetValue(StatusProperty, value);
  }

  public object? LeadingActions
  {
    get => GetValue(LeadingActionsProperty);
    set => SetValue(LeadingActionsProperty, value);
  }

  public object? TrailingActions
  {
    get => GetValue(TrailingActionsProperty);
    set => SetValue(TrailingActionsProperty, value);
  }

  public bool WindowControlsVisible
  {
    get => GetValue(WindowControlsVisibleProperty);
    set => SetValue(WindowControlsVisibleProperty, value);
  }

  public bool CanMinimize
  {
    get => GetValue(CanMinimizeProperty);
    set => SetValue(CanMinimizeProperty, value);
  }

  public bool CanMaximize
  {
    get => GetValue(CanMaximizeProperty);
    set => SetValue(CanMaximizeProperty, value);
  }

  public bool CanClose
  {
    get => GetValue(CanCloseProperty);
    set => SetValue(CanCloseProperty, value);
  }

  public bool UseExtendedClientArea
  {
    get => GetValue(UseExtendedClientAreaProperty);
    set => SetValue(UseExtendedClientAreaProperty, value);
  }

  public FsusDesktopPlatform Platform
  {
    get => GetValue(PlatformProperty);
    set => SetValue(PlatformProperty, value);
  }

  public FsusDesktopPlatform EffectivePlatform => Platform == FsusDesktopPlatform.Auto
    ? OperatingSystem.IsMacOS()
      ? FsusDesktopPlatform.MacOS
      : OperatingSystem.IsWindows()
        ? FsusDesktopPlatform.Windows
        : FsusDesktopPlatform.Linux
    : Platform;

  public bool IsMaximized
  {
    get => isMaximized;
    private set => SetAndRaise(IsMaximizedProperty, ref isMaximized, value);
  }

  public bool IsFullScreen
  {
    get => isFullScreen;
    private set => SetAndRaise(IsFullScreenProperty, ref isFullScreen, value);
  }

  public Window? AttachedWindow => attachedWindow;

  public static bool GetIsNoDrag(Control control) => control.GetValue(IsNoDragProperty);

  public static void SetIsNoDrag(Control control, bool value) =>
    control.SetValue(IsNoDragProperty, value);

  public void AttachTo(Window window)
  {
    ArgumentNullException.ThrowIfNull(window);
    ThrowIfDisposed();
    if (ReferenceEquals(attachedWindow, window))
    {
      ConfigureWindowChrome();
      SyncWindowState();
      return;
    }

    Detach();
    attachedWindow = window;
    attachedWindow.PropertyChanged += OnWindowPropertyChanged;
    attachedWindow.ActualThemeVariantChanged += OnWindowActualThemeVariantChanged;
    ConfigureWindowChrome();
    SyncWindowState();
  }

  public void Detach()
  {
    if (attachedWindow is null)
    {
      return;
    }

    attachedWindow.PropertyChanged -= OnWindowPropertyChanged;
    attachedWindow.ActualThemeVariantChanged -= OnWindowActualThemeVariantChanged;
    attachedWindow = null;
    IsMaximized = false;
    IsFullScreen = false;
    SyncState();
  }

  public bool InvokeWindowAction(FsusNativeWindowAction action)
  {
    if (attachedWindow is null)
    {
      return false;
    }

    var previousState = attachedWindow.WindowState;
    switch (action)
    {
      case FsusNativeWindowAction.Minimize when CanMinimize:
        attachedWindow.WindowState = WindowState.Minimized;
        break;
      case FsusNativeWindowAction.Maximize when CanMaximize:
        attachedWindow.WindowState = WindowState.Maximized;
        break;
      case FsusNativeWindowAction.Restore when CanMaximize:
        attachedWindow.WindowState = WindowState.Normal;
        break;
      case FsusNativeWindowAction.Close when CanClose:
        attachedWindow.Close();
        break;
      default:
        return false;
    }

    SyncWindowState();
    WindowActionInvoked?.Invoke(
      this,
      new FsusNativeWindowActionEventArgs(
        action,
        previousState,
        attachedWindow?.WindowState ?? previousState,
        EffectivePlatform));
    return true;
  }

  public void Dispose()
  {
    if (disposed)
    {
      return;
    }
    disposed = true;
    Detach();
    GC.SuppressFinalize(this);
  }

  protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
  {
    base.OnAttachedToVisualTree(e);
    if (attachedWindow is null && TopLevel.GetTopLevel(this) is Window window)
    {
      AttachTo(window);
    }
  }

  protected override void OnPointerPressed(PointerPressedEventArgs e)
  {
    base.OnPointerPressed(e);
    if (
      e.Handled ||
      attachedWindow is null ||
      !e.GetCurrentPoint(this).Properties.IsLeftButtonPressed ||
      IsNoDragSource(e.Source as Visual))
    {
      return;
    }

    if (e.ClickCount == 2 && CanMaximize && !IsFullScreen)
    {
      InvokeWindowAction(
        IsMaximized
          ? FsusNativeWindowAction.Restore
          : FsusNativeWindowAction.Maximize);
      e.Handled = true;
      return;
    }

    attachedWindow.BeginMoveDrag(e);
    e.Handled = true;
  }

  protected override AutomationPeer OnCreateAutomationPeer() =>
    new ControlAutomationPeer(this);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);
    if (
      change.Property == AccessibleNameProperty ||
      change.Property == DocumentTitleProperty ||
      change.Property == DocumentPathProperty ||
      change.Property == StatusProperty ||
      change.Property == LeadingActionsProperty ||
      change.Property == TrailingActionsProperty ||
      change.Property == WindowControlsVisibleProperty ||
      change.Property == CanMinimizeProperty ||
      change.Property == CanMaximizeProperty ||
      change.Property == CanCloseProperty ||
      change.Property == PlatformProperty)
    {
      SyncState();
    }
    else if (change.Property == UseExtendedClientAreaProperty)
    {
      ConfigureWindowChrome();
    }
  }

  private void BuildVisualTree()
  {
    rootGrid.Classes.Add("fsus-native-title-bar-layout");
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    rootGrid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));

    leadingPresenter.Classes.Add("fsus-title-bar-leading");
    SetIsNoDrag(leadingPresenter, true);

    titlePanel.Classes.Add("fsus-title-bar-document");
    titlePanel.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
    titlePanel.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
    titlePanel.ColumnSpacing = 8;
    titlePanel.ClipToBounds = true;
    titleText.Classes.Add("fsus-title-bar-title");
    titleText.MaxLines = 1;
    titleText.TextTrimming = TextTrimming.CharacterEllipsis;
    pathText.Classes.Add("fsus-title-bar-path");
    pathText.MaxLines = 1;
    pathText.TextTrimming = TextTrimming.CharacterEllipsis;
    Grid.SetColumn(pathText, 1);
    titlePanel.Children.Add(titleText);
    titlePanel.Children.Add(pathText);

    statusPresenter.Classes.Add("fsus-title-bar-status");
    AutomationProperties.SetLiveSetting(statusPresenter, AutomationLiveSetting.Polite);

    trailingPresenter.Classes.Add("fsus-title-bar-trailing");
    SetIsNoDrag(trailingPresenter, true);

    windowActions.Classes.Add("fsus-title-bar-window-actions");
    windowActions.Orientation = Orientation.Horizontal;
    SetIsNoDrag(windowActions, true);
    ConfigureWindowButton(
      minimizeButton,
      "PART_MinimizeButton",
      "Minimize window",
      "−",
      FsusNativeWindowAction.Minimize);
    ConfigureWindowButton(
      maximizeButton,
      "PART_MaximizeButton",
      "Maximize window",
      "□",
      FsusNativeWindowAction.Maximize);
    ConfigureWindowButton(
      closeButton,
      "PART_CloseButton",
      "Close window",
      "×",
      FsusNativeWindowAction.Close);
    closeButton.Classes.Add("fsus-title-bar-close");
    windowActions.Children.Add(minimizeButton);
    windowActions.Children.Add(maximizeButton);
    windowActions.Children.Add(closeButton);

    Grid.SetColumn(leadingPresenter, 0);
    Grid.SetColumn(titlePanel, 1);
    Grid.SetColumn(statusPresenter, 2);
    Grid.SetColumn(trailingPresenter, 3);
    Grid.SetColumn(windowActions, 4);
    rootGrid.Children.Add(leadingPresenter);
    rootGrid.Children.Add(titlePanel);
    rootGrid.Children.Add(statusPresenter);
    rootGrid.Children.Add(trailingPresenter);
    rootGrid.Children.Add(windowActions);
    base.Content = rootGrid;
  }

  private void ConfigureWindowButton(
    Button button,
    string name,
    string accessibleName,
    string glyph,
    FsusNativeWindowAction action)
  {
    button.Name = name;
    button.Content = glyph;
    button.Classes.Add("fsus-title-bar-window-action");
    button.Focusable = true;
    SetIsNoDrag(button, true);
    AutomationProperties.SetName(button, accessibleName);
    AutomationProperties.SetControlTypeOverride(button, AutomationControlType.Button);
    button.Click += (_, e) =>
    {
      InvokeWindowAction(
        action == FsusNativeWindowAction.Maximize && IsMaximized
          ? FsusNativeWindowAction.Restore
          : action);
      e.Handled = true;
    };
  }

  private void ConfigureWindowChrome()
  {
    if (attachedWindow is null || !UseExtendedClientArea)
    {
      return;
    }

    attachedWindow.ExtendClientAreaToDecorationsHint = true;
    attachedWindow.ExtendClientAreaTitleBarHeightHint =
      double.IsFinite(Height) && Height > 0d ? Height : 40d;
  }

  private void OnWindowPropertyChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
  {
    if (
      e.Property == Window.WindowStateProperty ||
      e.Property == Window.RequestedThemeVariantProperty)
    {
      SyncWindowState();
    }
  }

  private void OnWindowActualThemeVariantChanged(object? sender, EventArgs e) =>
    SyncWindowState();

  private void SyncWindowState()
  {
    var state = attachedWindow?.WindowState ?? WindowState.Normal;
    IsMaximized = state == WindowState.Maximized;
    IsFullScreen = state == WindowState.FullScreen;
    SyncState();
  }

  private void SyncState()
  {
    leadingPresenter.Content = LeadingActions;
    leadingPresenter.IsVisible = LeadingActions is not null;
    if (LeadingActions is Control leadingControl)
    {
      SetIsNoDrag(leadingControl, true);
    }
    titleText.Text = DocumentTitle;
    pathText.Text = DocumentPath ?? string.Empty;
    pathText.IsVisible = !string.IsNullOrWhiteSpace(DocumentPath);
    statusPresenter.Content = Status;
    statusPresenter.IsVisible = Status is not null;
    trailingPresenter.Content = TrailingActions;
    trailingPresenter.IsVisible = TrailingActions is not null;
    if (TrailingActions is Control trailingControl)
    {
      SetIsNoDrag(trailingControl, true);
    }

    windowActions.IsVisible = WindowControlsVisible;
    minimizeButton.IsVisible = CanMinimize;
    maximizeButton.IsVisible = CanMaximize && !IsFullScreen;
    closeButton.IsVisible = CanClose;
    maximizeButton.Content = IsMaximized ? "❐" : "□";
    AutomationProperties.SetName(
      maximizeButton,
      IsMaximized ? "Restore window" : "Maximize window");

    foreach (var platformClass in new[]
    {
      "fsus-platform-windows",
      "fsus-platform-macos",
      "fsus-platform-linux",
    })
    {
      FsusComponentClasses.Ensure(this, platformClass, false);
    }
    FsusComponentClasses.Ensure(
      this,
      EffectivePlatform switch
      {
        FsusDesktopPlatform.Windows => "fsus-platform-windows",
        FsusDesktopPlatform.MacOS => "fsus-platform-macos",
        _ => "fsus-platform-linux",
      },
      true);
    FsusComponentClasses.Ensure(this, "fsus-maximized", IsMaximized);
    FsusComponentClasses.Ensure(this, "fsus-fullscreen", IsFullScreen);

    var isDark = attachedWindow?.ActualThemeVariant == ThemeVariant.Dark;
    FsusComponentClasses.Ensure(this, "fsus-theme-dark", isDark);
    FsusComponentClasses.Ensure(this, "fsus-theme-light", !isDark);
    AutomationProperties.SetName(this, AccessibleName ?? "Window title bar");
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.TitleBar);
    AutomationProperties.SetItemStatus(
      this,
      string.Join(
        ", ",
        string.IsNullOrWhiteSpace(DocumentTitle) ? "untitled" : DocumentTitle,
        EffectivePlatform.ToString().ToLower(CultureInfo.InvariantCulture),
        IsFullScreen ? "fullscreen" : IsMaximized ? "maximized" : "normal"));
    AutomationProperties.SetName(
      titleText,
      string.IsNullOrWhiteSpace(DocumentTitle) ? "Untitled document" : DocumentTitle);
    AutomationProperties.SetName(pathText, DocumentPath ?? string.Empty);
  }

  private bool IsNoDragSource(Visual? source)
  {
    for (var current = source; current is not null; current = current.GetVisualParent())
    {
      if (current is Control control && GetIsNoDrag(control))
      {
        return true;
      }
      if (ReferenceEquals(current, this))
      {
        break;
      }
    }
    return false;
  }

  private void ThrowIfDisposed()
  {
    ObjectDisposedException.ThrowIf(disposed, this);
  }
}
