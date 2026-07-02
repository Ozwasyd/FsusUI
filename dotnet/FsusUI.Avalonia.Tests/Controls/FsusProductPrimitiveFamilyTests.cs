using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusProductPrimitiveFamilyTests
{
  [Fact]
  public async Task SettingsPrimitivesExposeReusableStateAndKeyboardFlows()
  {
    var section = new FsusSettingsSection
    {
      AccessibleName = "Workspace settings",
      Title = "Display",
      Description = "Generic settings section",
      IsDense = true,
      IsLoading = true,
    };
    section.ApplyViewport(390);
    section.Items.Add(new FsusSettingsMetadataItem("language", "Language", "中文 English"));

    var nav = new KeyboardSettingsSectionNav
    {
      AccessibleName = "Settings sections",
    };
    nav.Items.Add(new FsusSettingsNavItem("profile", "Profile"));
    nav.Items.Add(new FsusSettingsNavItem("danger", "Danger zone"));
    nav.SelectKey("profile");

    Assert.Equal("loading", section.StateName);
    Assert.True(section.IsMobile);
    Assert.Contains("fsus-dense", section.Classes);
    Assert.Single(section.Items);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(section));
    Assert.Equal("Workspace settings", AutomationProperties.GetName(section));
    Assert.Equal("loading, dense, mobile, 1 items", AutomationProperties.GetItemStatus(section));

    Assert.True(await nav.PressAsync(Key.Down));
    Assert.Equal("danger", nav.FocusedKey);
    Assert.Equal("danger", nav.SelectedKey);

    var danger = new FsusDangerZone
    {
      AccessibleName = "Risk area",
      Title = "Remove resource",
      Severity = FsusRiskSeverity.Danger,
    };
    var confirm = new FsusTypedConfirmField
    {
      RequiredText = "DELETE",
    };

    Assert.False(confirm.Confirm("delete"));
    Assert.True(confirm.Confirm("DELETE"));
    Assert.True(confirm.IsConfirmed);
    Assert.Equal(FsusRiskSeverity.Danger, danger.Severity);

    _ = new FsusSettingsSectionHeader { Title = "General" };
    _ = new FsusSettingsFormSection { Title = "Profile form" };
    _ = new FsusSettingsResourceList { EmptyText = "No resources" };
    _ = new FsusSettingsMetadataRow();
    _ = new FsusInlineActions();
    _ = new FsusDestructiveActionPanel { ActionLabel = "Delete" };
    _ = new FsusRiskNotice { Severity = FsusRiskSeverity.Warning };
  }

  [Fact]
  public async Task MetricPrimitivesHandleDenseLongTextErrorAndCopyableDetails()
  {
    var metrics = new FsusMetricList
    {
      AccessibleName = "Metric list",
      IsDense = true,
      ErrorMessage = "Unavailable",
    };
    metrics.Items.Add(new FsusMetricItem("delivery", "Delivery rate", "99.9%", Trend: "up"));
    metrics.Items.Add(new FsusMetricItem("latency", "Latency with a very long localized label 指标", "42 ms"));

    var distribution = new FsusDistributionList
    {
      AccessibleName = "Distribution",
      MaxValue = 200,
    };
    distribution.Rows.Add(new FsusDistributionBarRow("success", "Success", 150));

    var diagnostics = new KeyboardDiagnosticsList
    {
      AccessibleName = "Diagnostics",
    };
    diagnostics.Items.Add(new FsusDiagnosticsItem("a", "Healthy", FsusStatusTone.Success));
    diagnostics.Items.Add(new FsusDiagnosticsItem("b", "Investigate", FsusStatusTone.Warning));

    var detail = new FsusCopyableDetail
    {
      Label = "Trace id",
      Value = "abc-123",
    };

    Assert.Equal("error", metrics.StateName);
    Assert.Contains("fsus-dense", metrics.Classes);
    Assert.Equal(2, metrics.Items.Count);
    Assert.Equal(0.75d, distribution.Rows[0].Ratio);
    Assert.True(await diagnostics.PressAsync(Key.Down));
    Assert.Equal("b", diagnostics.FocusedKey);
    Assert.Equal("abc-123", detail.Copy());
    Assert.True(detail.WasCopied);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(metrics));

    _ = new FsusKpiGroup();
    _ = new FsusKeyValueGrid();
    _ = new FsusKeyValueItem("region", "Region", "Global");
    _ = new FsusStatusSummary { Tone = FsusStatusTone.Info };
  }

  [Fact]
  public async Task InboxPrimitivesHandleMobileSplitPaneKeyboardAndEmptyStates()
  {
    var layout = new FsusInboxLayout
    {
      AccessibleName = "Inbox",
      IsDense = true,
    };
    layout.ApplyViewport(390);

    var list = new KeyboardConversationList
    {
      AccessibleName = "Work queue",
    };
    list.Items.Add(new FsusConversationListItem("alpha", "Alpha conversation", "Unread", IsUnread: true));
    list.Items.Add(new FsusConversationListItem("beta", "Beta conversation with a long localized preview 内容", "Read"));
    list.SelectKey("alpha");

    var thread = new FsusThreadPanel
    {
      AccessibleName = "Thread",
    };
    thread.Timeline.Bubbles.Add(new FsusMessageBubble("m1", "agent", "Hello"));
    thread.Timeline.Bubbles.Add(new FsusMessageBubble("m2", "visitor", "你好"));
    thread.Composer.IsDisabled = true;

    Assert.True(layout.IsMobile);
    Assert.Equal(FsusInboxPane.List, layout.MobilePane);
    Assert.Contains("fsus-dense", layout.Classes);
    Assert.True(await list.PressAsync(Key.Down));
    Assert.Equal("beta", list.SelectedKey);
    Assert.Equal("mobile, list pane, dense", AutomationProperties.GetItemStatus(layout));
    Assert.Equal(2, thread.Timeline.Bubbles.Count);
    Assert.True(thread.Composer.IsDisabled);

    _ = new FsusInboxSplitPane();
    _ = new FsusConversationContextBar { Title = "Context" };
    _ = new FsusInboxEmptyState { Title = "No conversations" };
  }

  [Fact]
  public void ProductPrimitiveThemesVisualAndAutomationBaselinesCoverStable39()
  {
    var theme = ReadControlTheme("ProductPrimitives.axaml");
    Assert.Contains("fsus|FsusSettingsSection", theme);
    Assert.Contains("fsus|FsusMetricList", theme);
    Assert.Contains("fsus|FsusInboxLayout", theme);
    Assert.Contains("FsusThemeProductPrimitiveSurfaceBrush", theme);
    Assert.Contains("FsusMotionDurationEffective", theme);

    var rootTheme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/ProductPrimitives.axaml", rootTheme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("settings-primitives-stable39-web-avalonia", visualFixture);
    Assert.Contains("metric-primitives-stable39-web-avalonia", visualFixture);
    Assert.Contains("inbox-primitives-stable39-web-avalonia", visualFixture);

    var accessibilityEvidence = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "accessibility",
      "automation-snapshots.json"));
    Assert.Contains("settings-primitives-stable39", accessibilityEvidence);
    Assert.Contains("metric-primitives-stable39", accessibilityEvidence);
    Assert.Contains("inbox-primitives-stable39", accessibilityEvidence);
  }

  private sealed class KeyboardSettingsSectionNav : FsusSettingsSectionNav
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardDiagnosticsList : FsusDiagnosticsList
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardConversationList : FsusConversationList
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private static string ReadControlTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      "Controls",
      fileName));

  private static string ReadTheme(string fileName) =>
    File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "dotnet",
      "FsusUI.Avalonia.Themes",
      "Themes",
      fileName));

  private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
  {
    var candidates = new[]
    {
      Path.GetDirectoryName(sourceFile) ?? string.Empty,
      Directory.GetCurrentDirectory(),
      AppContext.BaseDirectory,
      Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
    };

    foreach (var candidate in candidates)
    {
      var directory = new DirectoryInfo(candidate);
      while (directory is not null)
      {
        if (
          Directory.Exists(Path.Combine(directory.FullName, ".git")) ||
          File.Exists(Path.Combine(directory.FullName, "dotnet", "FsusUI.Avalonia.slnx")))
        {
          return directory.FullName;
        }

        directory = directory.Parent;
      }
    }

    throw new InvalidOperationException("Could not locate repository root.");
  }
}
