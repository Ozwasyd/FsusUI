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

public enum FsusStepStatus
{
  Wait,
  Process,
  Finish,
  Error,
  Success,
}

public class FsusBreadcrumb : ContentControl
{
  public static readonly StyledProperty<string?> AccessibleNameProperty =
    AvaloniaProperty.Register<FsusBreadcrumb, string?>(nameof(AccessibleName));

  private readonly List<FsusBreadcrumbItem> items = [];

  public FsusBreadcrumb()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-breadcrumb");
    SyncState();
  }

  public event EventHandler<FsusNavigationActivatedEventArgs>? Activated;

  public IList<FsusBreadcrumbItem> Items => items;

  public string? AccessibleName
  {
    get => GetValue(AccessibleNameProperty);
    set => SetValue(AccessibleNameProperty, value);
  }

  public void Activate(string key)
  {
    var item = items.FirstOrDefault((candidate) => candidate.Key == key);
    SyncState();
    if (item is null || !item.IsEnabled || item.IsCurrent)
    {
      return;
    }

    Activated?.Invoke(this, new FsusNavigationActivatedEventArgs(key));
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == AccessibleNameProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    AutomationProperties.SetName(this, AccessibleName ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    foreach (var item in items)
    {
      item.SyncState();
    }
  }
}

public class FsusBreadcrumbItem : ContentControl
{
  public static readonly StyledProperty<string> KeyProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, string>(nameof(Key), string.Empty);

  public static readonly StyledProperty<object?> HeaderProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, object?>(nameof(Header));

  public static readonly StyledProperty<bool> IsCurrentProperty =
    AvaloniaProperty.Register<FsusBreadcrumbItem, bool>(nameof(IsCurrent));

  public FsusBreadcrumbItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-breadcrumb-item");
    SyncState();
  }

  public string Key
  {
    get => GetValue(KeyProperty);
    set => SetValue(KeyProperty, value);
  }

  public object? Header
  {
    get => GetValue(HeaderProperty);
    set => SetValue(HeaderProperty, value);
  }

  public bool IsCurrent
  {
    get => GetValue(IsCurrentProperty);
    set => SetValue(IsCurrentProperty, value);
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == KeyProperty ||
      change.Property == HeaderProperty ||
      change.Property == IsCurrentProperty ||
      change.Property == IsEnabledProperty)
    {
      SyncState();
    }
  }

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-current", IsCurrent);
    FsusComponentClasses.Ensure(this, "fsus-disabled", !IsEnabled);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(null, Header));
    AutomationProperties.SetItemStatus(this, IsCurrent ? "current" : "link");
  }
}

public class FsusPageHeader : ContentControl
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusPageHeader, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusPageHeader, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusPageHeader, object?>(nameof(IconContent));

  public static readonly StyledProperty<FsusBreadcrumb?> BreadcrumbProperty =
    AvaloniaProperty.Register<FsusPageHeader, FsusBreadcrumb?>(nameof(Breadcrumb));

  public static readonly StyledProperty<object?> ActionContentProperty =
    AvaloniaProperty.Register<FsusPageHeader, object?>(nameof(ActionContent));

  public FsusPageHeader()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-page-header");
    SyncState();
  }

  public event EventHandler? BackRequested;

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public FsusBreadcrumb? Breadcrumb
  {
    get => GetValue(BreadcrumbProperty);
    set => SetValue(BreadcrumbProperty, value);
  }

  public object? ActionContent
  {
    get => GetValue(ActionContentProperty);
    set => SetValue(ActionContentProperty, value);
  }

  public void RequestBack() => BackRequested?.Invoke(this, EventArgs.Empty);

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == BreadcrumbProperty ||
      change.Property == ActionContentProperty)
    {
      SyncState();
    }
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-breadcrumb", Breadcrumb is not null);
    FsusComponentClasses.Ensure(this, "fsus-has-action", ActionContent is not null);
    AutomationProperties.SetName(this, Title ?? string.Empty);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
  }
}

public class FsusSteps : ContentControl
{
  public static readonly StyledProperty<int> ActiveIndexProperty =
    AvaloniaProperty.Register<FsusSteps, int>(nameof(ActiveIndex));

  private readonly List<FsusStep> items = [];

  public FsusSteps()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-steps");
    SyncAutomation();
  }

  public IList<FsusStep> Items => items;

  public int ActiveIndex
  {
    get => GetValue(ActiveIndexProperty);
    set => SetValue(ActiveIndexProperty, value);
  }

  public void RefreshStepStatus()
  {
    for (var index = 0; index < items.Count; index++)
    {
      var step = items[index];
      step.EffectiveStatus = step.Status ?? ResolveStatus(index);
      step.SyncState();
    }

    SyncAutomation();
  }

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (change.Property == ActiveIndexProperty)
    {
      RefreshStepStatus();
    }
  }

  private FsusStepStatus ResolveStatus(int index)
  {
    if (index < ActiveIndex)
    {
      return FsusStepStatus.Finish;
    }

    return index == ActiveIndex ? FsusStepStatus.Process : FsusStepStatus.Wait;
  }

  private void SyncAutomation()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
  }
}

public class FsusStep : ContentControl
{
  public static readonly StyledProperty<string?> TitleProperty =
    AvaloniaProperty.Register<FsusStep, string?>(nameof(Title));

  public static readonly StyledProperty<string?> DescriptionProperty =
    AvaloniaProperty.Register<FsusStep, string?>(nameof(Description));

  public static readonly StyledProperty<object?> IconContentProperty =
    AvaloniaProperty.Register<FsusStep, object?>(nameof(IconContent));

  public static readonly StyledProperty<FsusStepStatus?> StatusProperty =
    AvaloniaProperty.Register<FsusStep, FsusStepStatus?>(nameof(Status));

  public FsusStep()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-step");
    SyncState();
  }

  public string? Title
  {
    get => GetValue(TitleProperty);
    set => SetValue(TitleProperty, value);
  }

  public string? Description
  {
    get => GetValue(DescriptionProperty);
    set => SetValue(DescriptionProperty, value);
  }

  public object? IconContent
  {
    get => GetValue(IconContentProperty);
    set => SetValue(IconContentProperty, value);
  }

  public FsusStepStatus? Status
  {
    get => GetValue(StatusProperty);
    set => SetValue(StatusProperty, value);
  }

  public FsusStepStatus EffectiveStatus { get; internal set; } = FsusStepStatus.Wait;

  protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
  {
    base.OnPropertyChanged(change);

    if (
      change.Property == TitleProperty ||
      change.Property == DescriptionProperty ||
      change.Property == IconContentProperty ||
      change.Property == StatusProperty)
    {
      EffectiveStatus = Status ?? EffectiveStatus;
      SyncState();
    }
  }

  internal void SyncState()
  {
    foreach (var className in new[]
    {
      "fsus-step-wait",
      "fsus-step-process",
      "fsus-step-finish",
      "fsus-step-error",
      "fsus-step-success",
    })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-step-{StatusName(EffectiveStatus)}", true);
    FsusComponentClasses.Ensure(this, "fsus-has-description", !string.IsNullOrWhiteSpace(Description));
    FsusComponentClasses.Ensure(this, "fsus-has-icon", IconContent is not null);
    AutomationProperties.SetName(this, Title ?? string.Empty);
    AutomationProperties.SetItemStatus(this, StatusName(EffectiveStatus));
  }

  private static string StatusName(FsusStepStatus status) =>
    status.ToString().ToLower(CultureInfo.InvariantCulture);
}
