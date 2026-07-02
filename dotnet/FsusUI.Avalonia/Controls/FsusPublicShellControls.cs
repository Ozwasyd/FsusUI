using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Input;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusPublicShellActiveNavMotion
{
  None,
  Indicator,
}

public enum FsusResponsiveCollectionRenderStrategy
{
  LazyBranch,
  ShowBoth,
  DesktopOnly,
  CompactOnly,
}

public sealed record FsusPublicShellNavigationItem(
  string Key,
  string Label,
  string Href);

public sealed record FsusPublicShellNavigationState(
  string Key,
  string Label,
  string Href,
  bool IsActive,
  bool IsFocused);

public sealed record FsusResponsiveCollectionItem(
  string Key,
  string Label,
  object? Value = null);

public class FsusSiteHeader : ContentControl
{
  private string accessibleName = "Site header";
  private string navAccessibleName = "Primary navigation";
  private bool isSticky = true;
  private object? brandContent;
  private object? desktopNavigationContent;
  private object? desktopActionsContent;
  private object? mobilePrimaryActionsContent;
  private object? mobileSecondaryActionsContent;

  public FsusSiteHeader()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-site-header");
    SyncState();
  }

  public string AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public string NavAccessibleName
  {
    get => navAccessibleName;
    set
    {
      navAccessibleName = value;
      SyncState();
    }
  }

  public bool IsSticky
  {
    get => isSticky;
    set
    {
      isSticky = value;
      SyncState();
    }
  }

  public object? BrandContent
  {
    get => brandContent;
    set
    {
      brandContent = value;
      SyncState();
    }
  }

  public object? DesktopNavigationContent
  {
    get => desktopNavigationContent;
    set
    {
      desktopNavigationContent = value;
      SyncState();
    }
  }

  public object? DesktopActionsContent
  {
    get => desktopActionsContent;
    set
    {
      desktopActionsContent = value;
      SyncState();
    }
  }

  public object? MobilePrimaryActionsContent
  {
    get => mobilePrimaryActionsContent;
    set
    {
      mobilePrimaryActionsContent = value;
      SyncState();
    }
  }

  public object? MobileSecondaryActionsContent
  {
    get => mobileSecondaryActionsContent;
    set
    {
      mobileSecondaryActionsContent = value;
      SyncState();
    }
  }

  public bool HasBrand => BrandContent is not null;

  public bool HasDesktopNavigation => DesktopNavigationContent is not null;

  public bool HasDesktopActions => DesktopActionsContent is not null;

  public bool HasMobilePrimaryActions => MobilePrimaryActionsContent is not null;

  public bool HasMobileSecondaryActions => MobileSecondaryActionsContent is not null;

  internal void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-sticky", isSticky);
    FsusComponentClasses.Ensure(this, "fsus-has-brand", HasBrand);
    FsusComponentClasses.Ensure(this, "fsus-has-desktop-nav", HasDesktopNavigation);
    FsusComponentClasses.Ensure(this, "fsus-has-desktop-actions", HasDesktopActions);
    FsusComponentClasses.Ensure(this, "fsus-has-mobile-primary", HasMobilePrimaryActions);
    FsusComponentClasses.Ensure(this, "fsus-has-mobile-secondary", HasMobileSecondaryActions);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{RegionCount().ToString(CultureInfo.InvariantCulture)} regions, nav {navAccessibleName}");
  }

  private int RegionCount()
  {
    var count = 0;
    if (HasBrand)
    {
      count++;
    }

    if (HasDesktopNavigation)
    {
      count++;
    }

    if (HasDesktopActions)
    {
      count++;
    }

    if (HasMobilePrimaryActions)
    {
      count++;
    }

    if (HasMobileSecondaryActions)
    {
      count++;
    }

    return count;
  }
}

public class FsusPublicShell : ContentControl
{
  private readonly List<FsusPublicShellNavigationState> desktopNavigationItems = [];
  private readonly List<FsusPublicShellNavigationState> mobileNavigationItems = [];
  private readonly List<string> keyboardOrder = [];
  private string accessibleName = "Public shell";
  private string brand = string.Empty;
  private string brandHref = "/";
  private string activeNav = string.Empty;
  private string authLabel = string.Empty;
  private string authHref = string.Empty;
  private bool sticky = true;

  public FsusPublicShell()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-public-shell");
    Focusable = true;
    SyncState();
  }

  public FsusSiteHeader Header { get; } = new();

  public Collection<FsusPublicShellNavigationItem> NavigationItems { get; } = [];

  public IReadOnlyList<FsusPublicShellNavigationState> DesktopNavigationItems =>
    desktopNavigationItems.AsReadOnly();

  public IReadOnlyList<FsusPublicShellNavigationState> MobileNavigationItems =>
    mobileNavigationItems.AsReadOnly();

  public IReadOnlyList<string> KeyboardOrder => keyboardOrder.AsReadOnly();

  public string AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public string Brand
  {
    get => brand;
    set
    {
      brand = value;
      SyncState();
    }
  }

  public string BrandHref
  {
    get => brandHref;
    set
    {
      brandHref = value;
      SyncState();
    }
  }

  public string ActiveNav
  {
    get => activeNav;
    set
    {
      activeNav = value;
      SyncState();
    }
  }

  public FsusPublicShellActiveNavMotion ActiveNavMotion { get; set; }

  public string AuthLabel
  {
    get => authLabel;
    set
    {
      authLabel = value;
      SyncState();
    }
  }

  public string AuthHref
  {
    get => authHref;
    set
    {
      authHref = value;
      SyncState();
    }
  }

  public bool Sticky
  {
    get => sticky;
    set
    {
      sticky = value;
      SyncState();
    }
  }

  public FsusLayoutBreakpoint Breakpoint { get; private set; } = FsusLayoutBreakpoint.Lg;

  public bool IsMobile { get; private set; }

  public bool HasActiveNavIndicator { get; private set; }

  public string FocusedNavigationKey { get; private set; } = string.Empty;

  public void ApplyViewport(double viewportWidth)
  {
    Breakpoint = FsusLayoutMetrics.ResolveBreakpoint(viewportWidth);
    IsMobile = Breakpoint is FsusLayoutBreakpoint.Xs or FsusLayoutBreakpoint.Sm;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (NavigationItems.Count == 0)
    {
      return ValueTask.FromResult(false);
    }

    var currentIndex = Math.Max(
      0,
      NavigationItems.ToList().FindIndex((item) => item.Key == FocusedNavigationKey));
    var nextIndex = key switch
    {
      Key.Right or Key.Down => Math.Min(NavigationItems.Count - 1, currentIndex + 1),
      Key.Left or Key.Up => Math.Max(0, currentIndex - 1),
      Key.Home => 0,
      Key.End => NavigationItems.Count - 1,
      _ => -1,
    };

    if (nextIndex < 0)
    {
      return ValueTask.FromResult(false);
    }

    FocusedNavigationKey = NavigationItems[nextIndex].Key;
    SyncState();
    return ValueTask.FromResult(true);
  }

  private void SyncState()
  {
    if (NavigationItems.Count > 0 &&
      !NavigationItems.Any((item) => item.Key == FocusedNavigationKey))
    {
      FocusedNavigationKey = NavigationItems.Any((item) => item.Key == activeNav)
        ? activeNav
        : NavigationItems[0].Key;
    }

    desktopNavigationItems.Clear();
    mobileNavigationItems.Clear();
    foreach (var item in NavigationItems)
    {
      var state = new FsusPublicShellNavigationState(
        item.Key,
        item.Label,
        item.Href,
        item.Key == activeNav,
        item.Key == FocusedNavigationKey);
      desktopNavigationItems.Add(state);
      mobileNavigationItems.Add(state);
    }

    HasActiveNavIndicator =
      ActiveNavMotion == FsusPublicShellActiveNavMotion.Indicator &&
      NavigationItems.Any((item) => item.Key == activeNav);

    keyboardOrder.Clear();
    keyboardOrder.Add("brand");
    keyboardOrder.AddRange(NavigationItems.Select((item) => item.Key));
    if (HasAuthLink)
    {
      keyboardOrder.Add("auth");
    }

    Header.AccessibleName = "Site header";
    Header.IsSticky = sticky;
    Header.BrandContent = string.IsNullOrWhiteSpace(brand) ? null : brand;
    Header.DesktopNavigationContent =
      desktopNavigationItems.Count == 0 ? null : desktopNavigationItems.AsReadOnly();
    Header.DesktopActionsContent = HasAuthLink ? authLabel : null;
    Header.MobilePrimaryActionsContent = IsMobile && HasAuthLink ? authLabel : null;
    Header.MobileSecondaryActionsContent =
      IsMobile && mobileNavigationItems.Count > 0 ? mobileNavigationItems.AsReadOnly() : null;

    FsusLayoutMetrics.SyncBreakpointClasses(this, Breakpoint);
    FsusComponentClasses.Ensure(this, "fsus-mobile", IsMobile);
    FsusComponentClasses.Ensure(this, "fsus-desktop", !IsMobile);
    FsusComponentClasses.Ensure(this, "fsus-active-indicator", HasActiveNavIndicator);
    FsusComponentClasses.Ensure(this, "fsus-has-auth", HasAuthLink);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsMobile ? "mobile" : "desktop")}, active {ActiveLabel()}, {NavigationItems.Count.ToString(CultureInfo.InvariantCulture)} nav items");
  }

  private bool HasAuthLink =>
    !string.IsNullOrWhiteSpace(authLabel) &&
    !string.IsNullOrWhiteSpace(authHref);

  private string ActiveLabel() =>
    string.IsNullOrWhiteSpace(activeNav) ? "none" : activeNav;
}

public class FsusResponsiveCollection : ContentControl
{
  private readonly List<string> visibleItemKeys = [];
  private string accessibleName = "Responsive collection";

  public FsusResponsiveCollection()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-responsive-collection");
    Focusable = true;
    SyncState();
  }

  public Collection<FsusResponsiveCollectionItem> Items { get; } = [];

  public IReadOnlyList<string> VisibleItemKeys => visibleItemKeys.AsReadOnly();

  public string AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public FsusResponsiveCollectionRenderStrategy RenderStrategy { get; set; } =
    FsusResponsiveCollectionRenderStrategy.LazyBranch;

  public bool? Compact { get; set; }

  public double CompactBreakpoint { get; set; } = 640d;

  public FsusLayoutBreakpoint Breakpoint { get; private set; } = FsusLayoutBreakpoint.Lg;

  public bool IsCompact { get; private set; }

  public bool IsDesktopBranchMounted { get; private set; }

  public bool IsCompactBranchMounted { get; private set; }

  public string FocusedKey { get; private set; } = string.Empty;

  public void ApplyViewport(double viewportWidth)
  {
    Breakpoint = FsusLayoutMetrics.ResolveBreakpoint(viewportWidth);
    IsCompact = Compact ?? viewportWidth < CompactBreakpoint;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (Items.Count == 0)
    {
      return ValueTask.FromResult(false);
    }

    var currentIndex = Math.Max(0, Items.ToList().FindIndex((item) => item.Key == FocusedKey));
    var nextIndex = key switch
    {
      Key.Down or Key.Right => Math.Min(Items.Count - 1, currentIndex + 1),
      Key.Up or Key.Left => Math.Max(0, currentIndex - 1),
      Key.Home => 0,
      Key.End => Items.Count - 1,
      _ => -1,
    };

    if (nextIndex < 0)
    {
      return ValueTask.FromResult(false);
    }

    FocusedKey = Items[nextIndex].Key;
    SyncState();
    return ValueTask.FromResult(true);
  }

  private void SyncState()
  {
    visibleItemKeys.Clear();
    visibleItemKeys.AddRange(Items.Select((item) => item.Key));

    if (Items.Count > 0 && !Items.Any((item) => item.Key == FocusedKey))
    {
      FocusedKey = Items[0].Key;
    }

    switch (RenderStrategy)
    {
      case FsusResponsiveCollectionRenderStrategy.ShowBoth:
        IsDesktopBranchMounted = true;
        IsCompactBranchMounted = true;
        break;
      case FsusResponsiveCollectionRenderStrategy.DesktopOnly:
        IsDesktopBranchMounted = true;
        IsCompactBranchMounted = false;
        IsCompact = false;
        break;
      case FsusResponsiveCollectionRenderStrategy.CompactOnly:
        IsDesktopBranchMounted = false;
        IsCompactBranchMounted = true;
        IsCompact = true;
        break;
      default:
        if (IsCompact)
        {
          IsCompactBranchMounted = true;
        }
        else
        {
          IsDesktopBranchMounted = true;
        }

        break;
    }

    FsusLayoutMetrics.SyncBreakpointClasses(this, Breakpoint);
    FsusComponentClasses.Ensure(this, "fsus-compact", IsCompact);
    FsusComponentClasses.Ensure(this, "fsus-desktop", !IsCompact);
    FsusComponentClasses.Ensure(this, "fsus-desktop-mounted", IsDesktopBranchMounted);
    FsusComponentClasses.Ensure(this, "fsus-compact-mounted", IsCompactBranchMounted);
    AutomationProperties.SetName(this, accessibleName);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    AutomationProperties.SetItemStatus(
      this,
      $"{(IsCompact ? "compact" : "desktop")}, {Items.Count.ToString(CultureInfo.InvariantCulture)} items, focus {FocusedLabel()}");
  }

  private string FocusedLabel() =>
    string.IsNullOrWhiteSpace(FocusedKey) ? "none" : FocusedKey;
}
