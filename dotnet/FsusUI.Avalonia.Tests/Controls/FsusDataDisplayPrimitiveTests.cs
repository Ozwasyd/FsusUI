using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusDataDisplayPrimitiveTests
{
  [Fact]
  public async Task PaginationChangesPageSizeClampsAndHonorsDisabledState()
  {
    var pages = new List<int>();
    var sizes = new List<int>();
    var pagination = new KeyboardPagination
    {
      AccessibleName = "Issue pages",
      Total = 105,
      PageSize = 10,
      CurrentPage = 1,
    };
    pagination.PageChanged += (_, args) => pages.Add(args.NewPage);
    pagination.PageSizeChanged += (_, args) => sizes.Add(args.NewPageSize);

    Assert.Equal(11, pagination.PageCount);
    Assert.True(pagination.SetPage(4));
    Assert.True(pagination.SetPageSize(20));

    Assert.Equal(6, pagination.PageCount);
    Assert.Equal(4, pagination.CurrentPage);
    Assert.Equal(new[] { 4 }, pages);
    Assert.Equal(new[] { 20 }, sizes);

    Assert.True(await pagination.PressAsync(Key.Right));
    Assert.Equal(5, pagination.CurrentPage);

    pagination.IsDisabled = true;

    Assert.False(await pagination.PressAsync(Key.Right));
    Assert.False(pagination.SetPage(6));
    Assert.Contains("fsus-disabled", pagination.Classes);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(pagination));
    Assert.Equal("Issue pages", AutomationProperties.GetName(pagination));
    Assert.Equal("page 5 of 6, size 20, total 105", AutomationProperties.GetItemStatus(pagination));

    var bar = new FsusPaginationBar { Pagination = pagination };
    Assert.Equal(5, bar.CurrentPage);
    Assert.Equal(20, bar.PageSize);
  }

  [Fact]
  public void DescriptionsAndTimelineResolveResponsiveLayoutAndAutomation()
  {
    var descriptions = new FsusDescriptions
    {
      AccessibleName = "Release metadata",
      Column = 3,
      Border = true,
    };
    descriptions.Items.Add(new FsusDescriptionsItem("Version", "1.2.3"));
    descriptions.Items.Add(new FsusDescriptionsItem("Channel", "Stable"));
    descriptions.Items.Add(new FsusDescriptionsItem("Owner", "Core"));

    descriptions.RefreshLayout(360);

    Assert.Equal(1, descriptions.ResolvedColumnCount);
    Assert.Contains("fsus-bordered", descriptions.Classes);

    descriptions.RefreshLayout(960);

    Assert.Equal(3, descriptions.ResolvedColumnCount);
    Assert.Equal("Version: 1.2.3", descriptions.Items[0].DisplayText);
    Assert.Equal(AutomationControlType.Group, AutomationProperties.GetControlTypeOverride(descriptions));

    var timeline = new FsusTimeline
    {
      AccessibleName = "Release timeline",
      Placement = FsusTimelinePlacement.Alternate,
    };
    timeline.Items.Add(new FsusTimelineItem("Queued") { Timestamp = "09:00", Status = FsusTimelineStatus.Info });
    timeline.Items.Add(new FsusTimelineItem("Built") { Timestamp = "09:30", Status = FsusTimelineStatus.Success });
    timeline.Items.Add(new FsusTimelineItem("Failed retry") { Timestamp = "09:45", Status = FsusTimelineStatus.Danger });
    timeline.RefreshItems();

    Assert.Equal(new[] { "left", "right", "left" }, timeline.ResolvedItems.Select((item) => item.PlacementName));
    Assert.Contains("fsus-alternate", timeline.Classes);
    Assert.Contains("fsus-danger", timeline.Items[2].Classes);
    Assert.Equal(AutomationControlType.List, AutomationProperties.GetControlTypeOverride(timeline));
    Assert.Equal("3 timeline items", AutomationProperties.GetItemStatus(timeline));
  }

  [Fact]
  public void StatisticFormatsValuesAndCountdownUsesDeterministicClock()
  {
    var statistic = new FsusStatistic
    {
      AccessibleName = "Revenue",
      Title = "Revenue",
      Value = 1234.5m,
      Prefix = "$",
      Suffix = " USD",
      Formatter = (value) => value.ToString("N1", System.Globalization.CultureInfo.InvariantCulture),
    };

    Assert.Equal("$1,234.5 USD", statistic.DisplayText);
    Assert.Equal(AutomationControlType.Text, AutomationProperties.GetControlTypeOverride(statistic));
    Assert.Equal("Revenue", AutomationProperties.GetName(statistic));

    var now = new DateTimeOffset(2026, 7, 2, 12, 0, 0, TimeSpan.Zero);
    var completed = 0;
    var countdown = new FsusCountdown
    {
      AccessibleName = "Release window",
      Target = now.AddSeconds(90),
      NowProvider = () => now,
    };
    countdown.Completed += (_, _) => completed++;

    countdown.Tick();

    Assert.Equal(TimeSpan.FromSeconds(90), countdown.Remaining);
    Assert.Equal("00:01:30", countdown.DisplayText);

    now = now.AddSeconds(90);
    countdown.Tick();

    Assert.Equal(TimeSpan.Zero, countdown.Remaining);
    Assert.Equal("00:00:00", countdown.DisplayText);
    Assert.Equal(1, completed);
    Assert.Contains("fsus-complete", countdown.Classes);
    Assert.Equal("complete", AutomationProperties.GetItemStatus(countdown));
  }

  [Fact]
  public void DataDisplayThemeVisualAndTimingBaselinesCoverStable31()
  {
    var dataDisplay = ReadControlTheme("DataDisplay.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusPagination",
      "fsus|FsusPaginationBar",
      "fsus|FsusDescriptions",
      "fsus|FsusDescriptionsItem",
      "fsus|FsusTimeline",
      "fsus|FsusTimelineItem",
      "fsus|FsusStatistic",
      "fsus|FsusCountdown",
    })
    {
      Assert.Contains(selector, dataDisplay);
    }

    Assert.Contains("FsusThemeDataDisplaySurfaceBrush", dataDisplay);
    Assert.Contains("FsusMotionDurationEffective", dataDisplay);
    Assert.Contains("FsusDensityControlDefaultY", dataDisplay);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/DataDisplay.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("data-display-stable31-web-avalonia", visualFixture);
    Assert.Contains("data-display-stable31-compact-web-avalonia", visualFixture);
  }

  private sealed class KeyboardPagination : FsusPagination
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
