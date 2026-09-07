using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Layout;
using System.Collections.ObjectModel;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public sealed class FsusPageChangedEventArgs(int oldPage, int newPage) : EventArgs
{
  public int OldPage { get; } = oldPage;
  public int NewPage { get; } = newPage;
}

public sealed class FsusPageSizeChangedEventArgs(int oldPageSize, int newPageSize) : EventArgs
{
  public int OldPageSize { get; } = oldPageSize;
  public int NewPageSize { get; } = newPageSize;
}

public class FsusPagination : ContentControl
{
  private int total;
  private int pageSize = 10;
  private int currentPage = 1;
  private bool isDisabled;

  public FsusPagination()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-pagination");
    Focusable = true;
    SyncState();
  }

  public event EventHandler<FsusPageChangedEventArgs>? PageChanged;
  public event EventHandler<FsusPageSizeChangedEventArgs>? PageSizeChanged;

  public string? AccessibleName { get; set; }

  public int Total
  {
    get => total;
    set
    {
      total = Math.Max(0, value);
      currentPage = ClampPage(currentPage);
      SyncState();
    }
  }

  public int PageSize
  {
    get => pageSize;
    set
    {
      pageSize = Math.Max(1, value);
      currentPage = ClampPage(currentPage);
      SyncState();
    }
  }

  public int CurrentPage
  {
    get => currentPage;
    set
    {
      currentPage = ClampPage(value);
      SyncState();
    }
  }

  public bool IsDisabled
  {
    get => isDisabled;
    set
    {
      isDisabled = value;
      SyncState();
    }
  }

  public int PageCount => Math.Max(1, (int)Math.Ceiling(Total / (double)Math.Max(1, PageSize)));

  public bool SetPage(int page)
  {
    if (IsDisabled)
    {
      return false;
    }

    var nextPage = ClampPage(page);
    if (nextPage == CurrentPage)
    {
      return true;
    }

    var oldPage = CurrentPage;
    currentPage = nextPage;
    SyncState();
    PageChanged?.Invoke(this, new FsusPageChangedEventArgs(oldPage, CurrentPage));
    return true;
  }

  public bool SetPageSize(int size)
  {
    if (IsDisabled)
    {
      return false;
    }

    var nextSize = Math.Max(1, size);
    if (nextSize == PageSize)
    {
      return true;
    }

    var oldSize = PageSize;
    pageSize = nextSize;
    currentPage = ClampPage(CurrentPage);
    SyncState();
    PageSizeChanged?.Invoke(this, new FsusPageSizeChangedEventArgs(oldSize, PageSize));
    return true;
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (IsDisabled)
    {
      return ValueTask.FromResult(false);
    }

    return key switch
    {
      Key.Right => ValueTask.FromResult(SetPage(CurrentPage + 1)),
      Key.Left => ValueTask.FromResult(SetPage(CurrentPage - 1)),
      _ => ValueTask.FromResult(false),
    };
  }

  private int ClampPage(int page) => Math.Clamp(page, 1, PageCount);

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
    FsusComponentClasses.Ensure(this, "fsus-first-page", CurrentPage <= 1);
    FsusComponentClasses.Ensure(this, "fsus-last-page", CurrentPage >= PageCount);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, CurrentPage));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(
      this,
      $"page {CurrentPage.ToString(CultureInfo.InvariantCulture)} of {PageCount.ToString(CultureInfo.InvariantCulture)}, size {PageSize.ToString(CultureInfo.InvariantCulture)}, total {Total.ToString(CultureInfo.InvariantCulture)}");
  }
}

public class FsusPaginationBar : ContentControl
{
  private FsusPagination? pagination;

  public FsusPaginationBar()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-pagination-bar");
    SyncState();
  }

  public FsusPagination? Pagination
  {
    get => pagination;
    set
    {
      pagination = value;
      SyncState();
    }
  }

  public int CurrentPage => Pagination?.CurrentPage ?? 1;
  public int PageSize => Pagination?.PageSize ?? 10;

  private void SyncState()
  {
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, $"page {CurrentPage.ToString(CultureInfo.InvariantCulture)}");
  }
}

public class FsusDescriptionsItem : ContentControl
{
  public FsusDescriptionsItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-descriptions-item");
    SyncState();
  }

  public FsusDescriptionsItem(string label, object? value) : this()
  {
    Label = label;
    Value = value;
    SyncState();
  }

  public string Label { get; set; } = string.Empty;
  public object? Value { get; set; }
  public string DisplayText => $"{Label}: {Value}";

  internal void SyncState()
  {
    AutomationProperties.SetName(this, DisplayText);
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
  }
}

public class FsusDescriptions : ContentControl
{
  public FsusDescriptions()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-descriptions");
    Items.CollectionChanged += (_, _) => SyncState();
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public int Column { get; set; } = 3;
  public bool Border { get; set; }
  public int ResolvedColumnCount { get; private set; } = 3;
  public ObservableCollection<FsusDescriptionsItem> Items { get; } = [];

  public void RefreshLayout(double availableWidth)
  {
    ResolvedColumnCount = availableWidth < 480d ? 1 : Math.Max(1, Column);
    if (IsMeasureValid)
    {
      ResolvedColumnCount = Math.Min(ResolvedColumnCount, Math.Max(1, (int)Math.Floor(availableWidth / 160d)));
    }

    foreach (var item in Items)
    {
      item.SyncState();
    }

    SyncState();
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-bordered", Border);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Items.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Group);
    AutomationProperties.SetItemStatus(this, $"{Items.Count.ToString(CultureInfo.InvariantCulture)} descriptions");
    BuildVisualTree();
  }

  private void BuildVisualTree()
  {
    var panel = new UniformGrid
    {
      Columns = ResolvedColumnCount,
      Rows = 0,
    };
    panel.Classes.Add("fsus-descriptions-grid");
    foreach (var item in Items)
    {
      var row = new Grid { ColumnSpacing = FsusTokens.Space2Thickness.Left };
      row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Auto));
      row.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));

      var label = new FsusText
      {
        Text = item.Label,
        IsTruncated = true,
        Variant = FsusTextVariant.Muted,
      };
      label.Classes.Add("fsus-description-label");
      var value = new FsusText
      {
        Text = item.Value?.ToString() ?? string.Empty,
        IsTruncated = true,
        Variant = FsusTextVariant.Body,
      };
      value.Classes.Add("fsus-description-value");
      Grid.SetColumn(label, 0);
      Grid.SetColumn(value, 1);
      row.Children.Add(label);
      row.Children.Add(value);
      panel.Children.Add(row);
    }

    Content = panel;
  }
}

public enum FsusTimelinePlacement
{
  Left,
  Right,
  Alternate,
}

public enum FsusTimelineStatus
{
  Default,
  Info,
  Success,
  Warning,
  Danger,
}

public sealed record FsusResolvedTimelineItem(FsusTimelineItem Item, string PlacementName);

public class FsusTimelineItem : ContentControl
{
  public FsusTimelineItem()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-timeline-item");
    SyncState();
  }

  public FsusTimelineItem(string content) : this()
  {
    Content = content;
    SyncState();
  }

  public string Timestamp { get; set; } = string.Empty;
  public FsusTimelineStatus Status { get; set; } = FsusTimelineStatus.Default;

  internal void SyncState()
  {
    foreach (var className in new[] { "fsus-default", "fsus-info", "fsus-success", "fsus-warning", "fsus-danger" })
    {
      FsusComponentClasses.Ensure(this, className, false);
    }

    FsusComponentClasses.Ensure(this, $"fsus-{StatusName(Status)}", true);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(Timestamp, Content));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.ListItem);
    AutomationProperties.SetItemStatus(this, StatusName(Status));
  }

  internal static string StatusName(FsusTimelineStatus status) =>
    status switch
    {
      FsusTimelineStatus.Info => "info",
      FsusTimelineStatus.Success => "success",
      FsusTimelineStatus.Warning => "warning",
      FsusTimelineStatus.Danger => "danger",
      _ => "default",
    };
}

public class FsusTimeline : ContentControl
{
  private readonly List<FsusResolvedTimelineItem> resolvedItems = [];

  public FsusTimeline()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-timeline");
    SyncState();
  }

  public string? AccessibleName { get; set; }
  public FsusTimelinePlacement Placement { get; set; } = FsusTimelinePlacement.Left;
  public Collection<FsusTimelineItem> Items { get; } = [];
  public IReadOnlyList<FsusResolvedTimelineItem> ResolvedItems => resolvedItems.AsReadOnly();

  public void RefreshItems()
  {
    resolvedItems.Clear();
    for (var index = 0; index < Items.Count; index++)
    {
      var item = Items[index];
      item.SyncState();
      resolvedItems.Add(new FsusResolvedTimelineItem(item, ResolvePlacement(index)));
    }

    SyncState();
  }

  private string ResolvePlacement(int index) =>
    Placement switch
    {
      FsusTimelinePlacement.Right => "right",
      FsusTimelinePlacement.Alternate => index % 2 == 0 ? "left" : "right",
      _ => "left",
    };

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-left", Placement == FsusTimelinePlacement.Left);
    FsusComponentClasses.Ensure(this, "fsus-right", Placement == FsusTimelinePlacement.Right);
    FsusComponentClasses.Ensure(this, "fsus-alternate", Placement == FsusTimelinePlacement.Alternate);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, Items.Count));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.List);
    AutomationProperties.SetItemStatus(this, $"{Items.Count.ToString(CultureInfo.InvariantCulture)} timeline items");
  }
}

public class FsusStatistic : ContentControl
{
  private string? accessibleName;
  private string title = string.Empty;
  private decimal value;
  private string prefix = string.Empty;
  private string suffix = string.Empty;
  private Func<decimal, string>? formatter;

  public FsusStatistic()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-statistic");
    SyncState();
  }

  public string? AccessibleName
  {
    get => accessibleName;
    set
    {
      accessibleName = value;
      SyncState();
    }
  }

  public string Title
  {
    get => title;
    set
    {
      title = value;
      SyncState();
    }
  }

  public decimal Value
  {
    get => value;
    set
    {
      this.value = value;
      SyncState();
    }
  }

  public string Prefix
  {
    get => prefix;
    set
    {
      prefix = value;
      SyncState();
    }
  }

  public string Suffix
  {
    get => suffix;
    set
    {
      suffix = value;
      SyncState();
    }
  }

  public Func<decimal, string>? Formatter
  {
    get => formatter;
    set
    {
      formatter = value;
      SyncState();
    }
  }

  public string DisplayText => $"{Prefix}{(Formatter?.Invoke(Value) ?? Value.ToString(CultureInfo.InvariantCulture))}{Suffix}";

  private void SyncState()
  {
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName ?? Title, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
    AutomationProperties.SetItemStatus(this, DisplayText);
  }
}

public class FsusCountdown : ContentControl
{
  private bool completedRaised;

  public FsusCountdown()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-countdown");
    NowProvider = () => DateTimeOffset.UtcNow;
    SyncState();
  }

  public event EventHandler<EventArgs>? Completed;

  public string? AccessibleName { get; set; }
  public DateTimeOffset Target { get; set; }
  public Func<DateTimeOffset> NowProvider { get; set; }
  public TimeSpan Remaining { get; private set; }
  public string DisplayText => Remaining.ToString(@"hh\:mm\:ss", CultureInfo.InvariantCulture);

  public void Tick()
  {
    Remaining = Target - NowProvider();
    if (Remaining < TimeSpan.Zero)
    {
      Remaining = TimeSpan.Zero;
    }

    if (Remaining == TimeSpan.Zero && !completedRaised)
    {
      completedRaised = true;
      Completed?.Invoke(this, EventArgs.Empty);
    }

    SyncState();
  }

  private void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-complete", Remaining == TimeSpan.Zero && Target != default);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(AccessibleName, DisplayText));
    AutomationProperties.SetControlTypeOverride(this, AutomationControlType.Text);
    AutomationProperties.SetItemStatus(this, Remaining == TimeSpan.Zero && Target != default ? "complete" : DisplayText);
  }
}
