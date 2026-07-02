using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Overlay;
using System.Runtime.CompilerServices;

namespace FsusUI.Avalonia.Tests.Controls;

public class FsusPickerPrimitiveTests
{
  [Fact]
  public async Task SelectFiltersKeyboardSelectsMultipleGroupedOptionsAndClears()
  {
    var host = new FsusOverlayHost();
    var changes = new List<IReadOnlyList<object?>>();
    var select = new KeyboardSelect
    {
      AccessibleName = "Reviewers",
      IsFilterable = true,
      IsMultiple = true,
      IsClearable = true,
      Placement = FsusAnchoredPlacement.BottomStart,
    };
    select.SelectionChanged += (_, args) => changes.Add(args.NewValue);

    var group = new FsusOptionGroup { Label = "People" };
    group.Options.Add(new FsusOption { Value = "aaron", Label = "Aaron", IsDisabled = true });
    group.Options.Add(new FsusOption { Value = "amy", Label = "Amy" });
    group.Options.Add(new FsusOption { Value = "alan", Label = "Alan" });
    select.OptionGroups.Add(group);
    select.Options.Add(new FsusOption { Value = "build", Label = "Build bot" });
    select.RefreshOptions();

    var opened = select.Open(host);
    Assert.True(select.IsOpen);
    Assert.Equal(FsusOverlayPlacement.BottomStart, opened.Placement);
    Assert.Contains("fsus-open", select.Classes);

    select.ApplyFilter("a");
    Assert.Equal(new[] { "Aaron", "Amy", "Alan" }, select.FilteredOptions.Select((option) => option.Label));
    Assert.Equal(1, select.HighlightedIndex);

    Assert.True(await select.PressAsync(Key.Enter));
    Assert.Equal(new object?[] { "amy" }, select.SelectedValues);

    Assert.True(await select.PressAsync(Key.Down));
    Assert.True(await select.PressAsync(Key.Enter));

    Assert.Equal(new object?[] { "amy", "alan" }, select.SelectedValues);
    Assert.Equal(new[] { "Amy", "Alan" }, select.SelectedLabels);
    Assert.Equal("amy", select.SelectedValue);
    Assert.Equal(new object?[] { "amy", "alan" }, changes.Last());
    Assert.Contains("fsus-multiple", select.Classes);
    Assert.Contains("fsus-filtered", select.Classes);
    Assert.Equal("Reviewers", AutomationProperties.GetName(select));
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(select));
    Assert.Equal("open multiple 2 selected", AutomationProperties.GetItemStatus(select));

    select.ClearSelection();

    Assert.Empty(select.SelectedValues);
    Assert.Null(select.SelectedValue);
    Assert.Contains("fsus-empty", select.Classes);
  }

  [Fact]
  public void SelectV2VirtualizesLargeOptionListsAndKeepsBudgetShape()
  {
    var select = new FsusSelectV2
    {
      AccessibleName = "Large account list",
      IsFilterable = true,
      VirtualizationThreshold = 100,
      VisibleOptionLimit = 24,
    };
    for (var index = 0; index < 1000; index++)
    {
      select.Options.Add(new FsusOption
      {
        Value = index,
        Label = $"Account {index:0000}",
      });
    }

    select.RefreshOptions();

    Assert.Equal(1000, select.TotalOptionCount);
    Assert.True(select.IsVirtualized);
    Assert.Equal(24, select.VirtualizedOptionCount);
    Assert.True(select.EstimatedRetainedOptionControls <= 32);
    Assert.Contains("fsus-virtualized", select.Classes);

    select.ScrollToOption(480);

    Assert.Equal(480, select.VirtualizedStartIndex);
    Assert.Equal("Account 0480", select.VirtualizedOptions.First().Label);

    select.ApplyFilter("0999");

    Assert.False(select.IsVirtualized);
    Assert.Single(select.FilteredOptions);
    Assert.Equal("Account 0999", select.FilteredOptions[0].Label);
  }

  [Fact]
  public async Task AutocompleteLoadsRemoteOptionsSelectsWithKeyboardAndClears()
  {
    var queries = new List<string>();
    var autocomplete = new KeyboardAutocomplete
    {
      AccessibleName = "Search city",
      IsClearable = true,
      RemoteSearchAsync = (query, _) =>
      {
        queries.Add(query);
        return ValueTask.FromResult<IEnumerable<FsusOption>>(
        [
          new FsusOption { Value = "sh", Label = "Shanghai" },
          new FsusOption { Value = "sz", Label = "Shenzhen" },
          new FsusOption { Value = "disabled", Label = "Sh disabled city", IsDisabled = true },
        ]);
      },
    };

    await autocomplete.TypeAsync("sh");

    Assert.Equal(new[] { "sh" }, queries);
    Assert.False(autocomplete.IsLoading);
    Assert.Equal(new[] { "Shanghai", "Shenzhen", "Sh disabled city" }, autocomplete.Suggestions.Select((option) => option.Label));
    Assert.Equal(0, autocomplete.HighlightedIndex);
    Assert.Contains("fsus-remote", autocomplete.Classes);

    Assert.True(await autocomplete.PressAsync(Key.Enter));

    Assert.Equal("sh", autocomplete.SelectedValue);
    Assert.Equal("Shanghai", autocomplete.SelectedLabel);
    Assert.Equal("Shanghai", AutomationProperties.GetName(autocomplete));
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(autocomplete));
    Assert.Equal("closed 1 selected", AutomationProperties.GetItemStatus(autocomplete));

    autocomplete.ClearSelection();

    Assert.Null(autocomplete.SelectedValue);
    Assert.Equal(string.Empty, autocomplete.FilterText);
    Assert.Contains("fsus-empty", autocomplete.Classes);
  }

  [Fact]
  public async Task CascaderPanelNavigatesHierarchicalPathAndSkipsDisabledNodes()
  {
    var selectedPaths = new List<IReadOnlyList<object?>>();
    var panel = new KeyboardCascaderPanel();
    panel.PathSelected += (_, args) => selectedPaths.Add(args.SelectedValues);
    panel.Nodes.Add(new FsusCascaderNode("asia", "Asia")
    {
      Children =
      {
        new FsusCascaderNode("cn", "China")
        {
          Children =
          {
            new FsusCascaderNode("locked", "Locked city") { IsDisabled = true },
            new FsusCascaderNode("sh", "Shanghai"),
          },
        },
      },
    });
    panel.Nodes.Add(new FsusCascaderNode("europe", "Europe"));
    panel.RefreshColumns();

    Assert.Single(panel.Columns);
    Assert.True(panel.NavigateTo("asia"));
    Assert.Equal(new object?[] { "asia" }, panel.ActivePathValues);
    Assert.Equal(2, panel.Columns.Count);

    Assert.True(panel.NavigateTo("cn"));
    Assert.Equal(new object?[] { "asia", "cn" }, panel.ActivePathValues);
    Assert.Equal(3, panel.Columns.Count);
    Assert.Equal(1, panel.HighlightedIndexes.Last());

    Assert.True(await panel.PressAsync(Key.Enter));

    Assert.Equal(new object?[] { "asia", "cn", "sh" }, panel.SelectedPathValues);
    Assert.Equal("sh", panel.SelectedValue);
    Assert.Equal("Asia / China / Shanghai", panel.SelectedLabel);
    Assert.Equal(new object?[] { "asia", "cn", "sh" }, selectedPaths.Last());
    Assert.Equal(AutomationControlType.Tree, AutomationProperties.GetControlTypeOverride(panel));
    Assert.Equal("selected depth 3", AutomationProperties.GetItemStatus(panel));

    var cascader = new FsusCascader { AccessibleName = "Region", Panel = panel };
    cascader.SelectPath(["asia", "cn", "sh"]);

    Assert.Equal("sh", cascader.SelectedValue);
    Assert.Equal(new object?[] { "asia", "cn", "sh" }, cascader.SelectedPathValues);
    Assert.Equal("Region", AutomationProperties.GetName(cascader));
    Assert.Equal(AutomationControlType.ComboBox, AutomationProperties.GetControlTypeOverride(cascader));
  }

  [Fact]
  public void PickerThemeVisualAndPerformanceBaselinesCoverStable27()
  {
    var pickers = ReadControlTheme("Pickers.axaml");
    foreach (var selector in new[]
    {
      "fsus|FsusSelect",
      "fsus|FsusSelectV2",
      "fsus|FsusOption",
      "fsus|FsusOptionGroup",
      "fsus|FsusAutocomplete",
      "fsus|FsusCascader",
      "fsus|FsusCascaderPanel",
    })
    {
      Assert.Contains(selector, pickers);
    }

    Assert.Contains("FsusThemePickerSurfaceBrush", pickers);
    Assert.Contains("FsusMotionDurationEffective", pickers);
    Assert.Contains("FsusDensityControlDefaultY", pickers);

    var theme = ReadTheme("FsusTheme.axaml");
    Assert.Contains("Controls/Pickers.axaml", theme);

    var visualFixture = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "visual",
      "fixtures",
      "visual-comparisons.json"));
    Assert.Contains("picker-stable27-web-avalonia", visualFixture);

    var performanceMeasurements = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "tests",
      "conformance",
      "performance",
      "avalonia-measurements.json"));
    Assert.Contains("picker-virtualized-list-stable27", performanceMeasurements);

    var performanceBudgets = File.ReadAllText(Path.Combine(
      RepositoryRoot(),
      "spec",
      "components",
      "avalonia-stable-performance-budgets.json"));
    Assert.Contains("\"id\": \"picker-virtualized-list\"", performanceBudgets);
  }

  private sealed class KeyboardSelect : FsusSelect
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardAutocomplete : FsusAutocomplete
  {
    public ValueTask<bool> PressAsync(Key key) => HandleKeyAsync(key);
  }

  private sealed class KeyboardCascaderPanel : FsusCascaderPanel
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
