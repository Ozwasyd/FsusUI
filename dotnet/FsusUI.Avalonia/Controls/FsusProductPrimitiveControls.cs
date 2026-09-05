using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;

namespace FsusUI.Avalonia.Controls;

public enum FsusRiskSeverity
{
  Info,
  Warning,
  Danger,
}

public enum FsusStatusTone
{
  Neutral,
  Info,
  Success,
  Warning,
  Danger,
}

public enum FsusInboxPane
{
  List,
  Thread,
  Split,
}

public sealed record FsusSettingsNavItem(string Key, string Label);

public sealed record FsusSettingsMetadataItem(
  string Key,
  string Label,
  string Value);

public sealed record FsusMetricItem(
  string Key,
  string Label,
  string Value,
  string Trend = "");

public sealed record FsusDistributionBarRow(
  string Key,
  string Label,
  double Value,
  double MaxValue = 200d)
{
  public double Ratio => MaxValue <= 0d ? 0d : Math.Clamp(Value / MaxValue, 0d, 1d);
}

public sealed record FsusKeyValueItem(
  string Key,
  string Label,
  string Value);

public sealed record FsusDiagnosticsItem(
  string Key,
  string Label,
  FsusStatusTone Tone);

public sealed record FsusConversationListItem(
  string Key,
  string Title,
  string Preview,
  bool IsUnread = false,
  bool IsDisabled = false);

public sealed record FsusMessageBubble(
  string Key,
  string Author,
  string Text);

public abstract class FsusProductPrimitiveControl : ContentControl
{
  private string accessibleName = string.Empty;
  private string title = string.Empty;
  private string description = string.Empty;
  private bool isLoading;
  private string errorMessage = string.Empty;
  private bool isDense;
  private bool isMobile;

  protected FsusProductPrimitiveControl(string baseClass)
  {
    FsusComponentClasses.SetBaseClasses(this, baseClass);
    Focusable = true;
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

  public string Title
  {
    get => title;
    set
    {
      title = value;
      SyncState();
    }
  }

  public string Description
  {
    get => description;
    set
    {
      description = value;
      SyncState();
    }
  }

  public bool IsLoading
  {
    get => isLoading;
    set
    {
      isLoading = value;
      SyncState();
    }
  }

  public string ErrorMessage
  {
    get => errorMessage;
    set
    {
      errorMessage = value;
      SyncState();
    }
  }

  public bool IsDense
  {
    get => isDense;
    set
    {
      isDense = value;
      SyncState();
    }
  }

  public bool IsMobile
  {
    get => isMobile;
    private set
    {
      isMobile = value;
      SyncState();
    }
  }

  public FsusLayoutBreakpoint Breakpoint { get; private set; } = FsusLayoutBreakpoint.Lg;

  public string StateName =>
    !string.IsNullOrWhiteSpace(errorMessage) ? "error" : isLoading ? "loading" : "ready";

  protected virtual AutomationControlType ControlType => AutomationControlType.Group;

  protected virtual int ItemCount => 0;

  public void ApplyViewport(double viewportWidth)
  {
    Breakpoint = FsusLayoutMetrics.ResolveBreakpoint(viewportWidth);
    IsMobile = Breakpoint is FsusLayoutBreakpoint.Xs or FsusLayoutBreakpoint.Sm;
  }

  protected virtual void SyncState()
  {
    FsusComponentClasses.Ensure(this, "fsus-loading", StateName == "loading");
    FsusComponentClasses.Ensure(this, "fsus-error", StateName == "error");
    FsusComponentClasses.Ensure(this, "fsus-dense", isDense);
    FsusComponentClasses.Ensure(this, "fsus-mobile", isMobile);
    FsusComponentClasses.Ensure(this, "fsus-desktop", !isMobile);
    FsusLayoutMetrics.SyncBreakpointClasses(this, Breakpoint);
    AutomationProperties.SetName(this, FsusComponentClasses.ResolveName(accessibleName, title));
    AutomationProperties.SetControlTypeOverride(this, ControlType);
    AutomationProperties.SetItemStatus(this, BuildStatus());
  }

  protected virtual string BuildStatus() =>
    $"{StateName}, {(IsDense ? "dense" : "default")}, {(IsMobile ? "mobile" : "desktop")}, {ItemCount.ToString(CultureInfo.InvariantCulture)} items";
}

public class FsusSettingsSectionHeader : FsusProductPrimitiveControl
{
  public FsusSettingsSectionHeader()
    : base("fsus-settings-section-header")
  {
  }
}

public class FsusSettingsSection : FsusProductPrimitiveControl
{
  public FsusSettingsSection()
    : base("fsus-settings-section")
  {
    Items.CollectionChanged += (_, _) => SyncState();
  }

  public ObservableCollection<FsusSettingsMetadataItem> Items { get; } = [];

  protected override int ItemCount => Items.Count;
}

public class FsusSettingsFormSection : FsusSettingsSection
{
  public FsusSettingsFormSection()
  {
    FsusComponentClasses.SetBaseClasses(this, "fsus-settings-form-section");
  }
}

public class FsusSettingsResourceList : FsusProductPrimitiveControl
{
  public FsusSettingsResourceList()
    : base("fsus-settings-resource-list")
  {
  }

  public string EmptyText { get; set; } = string.Empty;
  public Collection<FsusSettingsMetadataItem> Items { get; } = [];
  protected override int ItemCount => Items.Count;
}

public class FsusSettingsMetadataRow : FsusProductPrimitiveControl
{
  public FsusSettingsMetadataRow()
    : base("fsus-settings-metadata-row")
  {
  }

  public Collection<FsusSettingsMetadataItem> Items { get; } = [];
  protected override int ItemCount => Items.Count;
}

public class FsusInlineActions : FsusProductPrimitiveControl
{
  public FsusInlineActions()
    : base("fsus-inline-actions")
  {
  }
}

public class FsusDangerZone : FsusProductPrimitiveControl
{
  public FsusDangerZone()
    : base("fsus-danger-zone")
  {
  }

  public FsusRiskSeverity Severity { get; set; } = FsusRiskSeverity.Danger;
}

public class FsusDestructiveActionPanel : FsusProductPrimitiveControl
{
  public FsusDestructiveActionPanel()
    : base("fsus-destructive-action-panel")
  {
  }

  public string ActionLabel { get; set; } = string.Empty;
}

public class FsusRiskNotice : FsusProductPrimitiveControl
{
  public FsusRiskNotice()
    : base("fsus-risk-notice")
  {
  }

  public FsusRiskSeverity Severity { get; set; } = FsusRiskSeverity.Warning;
}

public class FsusTypedConfirmField : FsusProductPrimitiveControl
{
  public FsusTypedConfirmField()
    : base("fsus-typed-confirm-field")
  {
  }

  public string RequiredText { get; set; } = string.Empty;

  public bool IsConfirmed { get; private set; }

  public bool Confirm(string? value)
  {
    IsConfirmed = string.Equals(value, RequiredText, StringComparison.Ordinal);
    SyncState();
    return IsConfirmed;
  }
}

public class FsusSettingsSectionNav : FsusProductPrimitiveControl
{
  public FsusSettingsSectionNav()
    : base("fsus-settings-section-nav")
  {
  }

  public Collection<FsusSettingsNavItem> Items { get; } = [];
  public string SelectedKey { get; private set; } = string.Empty;
  public string FocusedKey { get; private set; } = string.Empty;
  protected override int ItemCount => Items.Count;
  protected override AutomationControlType ControlType => AutomationControlType.List;

  public void SelectKey(string key)
  {
    if (!Items.Any((item) => item.Key == key))
    {
      return;
    }

    SelectedKey = key;
    FocusedKey = key;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    var next = FsusProductPrimitiveKeyboard.Move(
      FocusedKey,
      Items.Select((item) => item.Key).ToList(),
      key);
    if (next is null)
    {
      return ValueTask.FromResult(false);
    }

    SelectKey(next);
    return ValueTask.FromResult(true);
  }
}

public class FsusMetricList : FsusProductPrimitiveControl
{
  public FsusMetricList()
    : base("fsus-metric-list")
  {
  }

  public Collection<FsusMetricItem> Items { get; } = [];
  protected override int ItemCount => Items.Count;
  protected override AutomationControlType ControlType => AutomationControlType.List;
}

public class FsusDistributionList : FsusProductPrimitiveControl
{
  public FsusDistributionList()
    : base("fsus-distribution-list")
  {
  }

  public double MaxValue { get; set; } = 100d;
  public Collection<FsusDistributionBarRow> Rows { get; } = [];
  protected override int ItemCount => Rows.Count;
  protected override AutomationControlType ControlType => AutomationControlType.List;
}

public class FsusKpiGroup : FsusProductPrimitiveControl
{
  public FsusKpiGroup()
    : base("fsus-kpi-group")
  {
    Items.CollectionChanged += OnItemsChanged;
  }

  public ObservableCollection<FsusMetricItem> Items { get; } = [];
  protected override int ItemCount => Items.Count;

  protected override void SyncState()
  {
    base.SyncState();
    BuildVisualTree();
  }

  private void OnItemsChanged(object? sender, NotifyCollectionChangedEventArgs eventArgs)
  {
    SyncState();
  }

  private void BuildVisualTree()
  {
    var panel = new UniformGrid
    {
      Columns = IsMobile ? 1 : Math.Max(1, Math.Min(4, Items.Count)),
      Rows = IsMobile ? 0 : 1,
      Margin = new Thickness(0),
    };
    panel.Classes.Add("fsus-kpi-group");

    foreach (var item in Items)
    {
      var content = new StackPanel
      {
        Spacing = FsusTokens.Space1Thickness.Top,
        VerticalAlignment = VerticalAlignment.Top,
      };
      var label = new FsusText
      {
        Text = item.Label,
        IsTruncated = true,
        Variant = FsusTextVariant.Muted,
      };
      label.Classes.Add("fsus-metric-label");
      content.Children.Add(label);

      var value = new FsusText
      {
        Text = item.Value,
        IsTruncated = true,
        Variant = FsusTextVariant.Strong,
      };
      value.Classes.Add("fsus-metric-value");
      content.Children.Add(value);
      panel.Children.Add(content);
    }

    Content = panel;
  }
}

public class FsusKeyValueGrid : FsusProductPrimitiveControl
{
  public FsusKeyValueGrid()
    : base("fsus-key-value-grid")
  {
  }

  public Collection<FsusKeyValueItem> Items { get; } = [];
  protected override int ItemCount => Items.Count;
}

public class FsusStatusSummary : FsusProductPrimitiveControl
{
  public FsusStatusSummary()
    : base("fsus-status-summary")
  {
  }

  public FsusStatusTone Tone { get; set; } = FsusStatusTone.Neutral;
}

public class FsusDiagnosticsList : FsusProductPrimitiveControl
{
  public FsusDiagnosticsList()
    : base("fsus-diagnostics-list")
  {
  }

  public Collection<FsusDiagnosticsItem> Items { get; } = [];
  public string FocusedKey { get; private set; } = string.Empty;
  protected override int ItemCount => Items.Count;
  protected override AutomationControlType ControlType => AutomationControlType.List;

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    if (string.IsNullOrWhiteSpace(FocusedKey) && Items.Count > 0)
    {
      FocusedKey = Items[0].Key;
    }

    var next = FsusProductPrimitiveKeyboard.Move(
      FocusedKey,
      Items.Select((item) => item.Key).ToList(),
      key);
    if (next is null)
    {
      return ValueTask.FromResult(false);
    }

    FocusedKey = next;
    SyncState();
    return ValueTask.FromResult(true);
  }
}

public class FsusCopyableDetail : FsusProductPrimitiveControl
{
  public FsusCopyableDetail()
    : base("fsus-copyable-detail")
  {
  }

  public string Label { get; set; } = string.Empty;
  public string Value { get; set; } = string.Empty;
  public bool WasCopied { get; private set; }
  public bool IsDisabled
  {
    get => !IsEnabled;
    set
    {
      IsEnabled = !value;
      SyncState();
    }
  }

  public string Copy()
  {
    if (IsDisabled)
    {
      return string.Empty;
    }

    WasCopied = true;
    SyncState();
    return Value;
  }

  protected override void SyncState()
  {
    base.SyncState();
    FsusComponentClasses.Ensure(this, "fsus-disabled", IsDisabled);
  }

  protected override string BuildStatus() =>
    $"{base.BuildStatus()}, {(IsDisabled ? "disabled" : "available")}";
}

public class FsusInboxLayout : FsusProductPrimitiveControl
{
  public FsusInboxLayout()
    : base("fsus-inbox-layout")
  {
  }

  public FsusInboxPane MobilePane { get; set; } = FsusInboxPane.List;

  protected override string BuildStatus() =>
    $"{(IsMobile ? "mobile" : "desktop")}, {MobilePane.ToString().ToLower(CultureInfo.InvariantCulture)} pane, {(IsDense ? "dense" : "default")}";
}

public class FsusInboxSplitPane : FsusProductPrimitiveControl
{
  public FsusInboxSplitPane()
    : base("fsus-inbox-split-pane")
  {
  }
}

public class FsusConversationList : FsusProductPrimitiveControl
{
  public FsusConversationList()
    : base("fsus-conversation-list")
  {
  }

  public Collection<FsusConversationListItem> Items { get; } = [];
  public string SelectedKey { get; private set; } = string.Empty;
  public string FocusedKey { get; private set; } = string.Empty;
  protected override int ItemCount => Items.Count;
  protected override AutomationControlType ControlType => AutomationControlType.List;

  public void SelectKey(string key)
  {
    var item = Items.FirstOrDefault((candidate) => candidate.Key == key);
    if (item is null || item.IsDisabled)
    {
      return;
    }

    SelectedKey = key;
    FocusedKey = key;
    SyncState();
  }

  protected ValueTask<bool> HandleKeyAsync(Key key)
  {
    var enabledKeys = Items
      .Where((item) => !item.IsDisabled)
      .Select((item) => item.Key)
      .ToList();
    var next = FsusProductPrimitiveKeyboard.Move(FocusedKey, enabledKeys, key);
    if (next is null)
    {
      return ValueTask.FromResult(false);
    }

    SelectKey(next);
    return ValueTask.FromResult(true);
  }
}

public class FsusConversationContextBar : FsusProductPrimitiveControl
{
  public FsusConversationContextBar()
    : base("fsus-conversation-context-bar")
  {
  }
}

public class FsusThreadPanel : FsusProductPrimitiveControl
{
  public FsusThreadPanel()
    : base("fsus-thread-panel")
  {
  }

  public FsusMessageTimeline Timeline { get; } = new();
  public FsusReplyComposerShell Composer { get; } = new();
}

public class FsusMessageTimeline : FsusProductPrimitiveControl
{
  public FsusMessageTimeline()
    : base("fsus-message-timeline")
  {
  }

  public Collection<FsusMessageBubble> Bubbles { get; } = [];
  protected override int ItemCount => Bubbles.Count;
}

public class FsusReplyComposerShell : FsusProductPrimitiveControl
{
  public FsusReplyComposerShell()
    : base("fsus-reply-composer-shell")
  {
  }

  public bool IsDisabled { get; set; }
}

public class FsusInboxEmptyState : FsusProductPrimitiveControl
{
  public FsusInboxEmptyState()
    : base("fsus-inbox-empty-state")
  {
  }
}

internal static class FsusProductPrimitiveKeyboard
{
  public static string? Move(string focusedKey, IReadOnlyList<string> keys, Key key)
  {
    if (keys.Count == 0)
    {
      return null;
    }

    var index = keys.ToList().FindIndex((candidate) => candidate == focusedKey);
    if (index < 0)
    {
      index = 0;
    }

    var next = key switch
    {
      Key.Down or Key.Right => Math.Min(keys.Count - 1, index + 1),
      Key.Up or Key.Left => Math.Max(0, index - 1),
      Key.Home => 0,
      Key.End => keys.Count - 1,
      _ => -1,
    };

    return next < 0 ? null : keys[next];
  }
}
