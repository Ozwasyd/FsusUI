using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTabsHeadlessTests
{
  [AvaloniaFact]
  public void TabsSkipDisabledPanesAndSupportArrowHomeEndNavigation()
  {
    var selectedKeys = new List<string>();
    var tabs = new KeyboardTabs
    {
      AccessibleName = "Article sections",
    };
    tabs.SelectionChanged += (_, args) => selectedKeys.Add(args.SelectedKey);
    tabs.Panes.Add(new FsusTabPane { Key = "overview", Header = "Overview" });
    tabs.Panes.Add(new FsusTabPane
    {
      Key = "activity",
      Header = "Activity",
      IsEnabled = false,
    });
    tabs.Panes.Add(new FsusTabPane { Key = "settings", Header = "Settings" });
    tabs.Panes.Add(new FsusTabPane { Key = "history", Header = "History" });

    tabs.SelectKey("overview");
    tabs.Press(Key.Right);
    tabs.Press(Key.End);
    tabs.Press(Key.Home);

    Assert.Contains("fsus-tabs", tabs.Classes);
    Assert.Equal("overview", tabs.SelectedKey);
    Assert.Equal(
      new[] { "overview", "settings", "history", "overview" },
      selectedKeys);
    Assert.Equal("overview", tabs.FocusedKey);
    Assert.True(tabs.Panes[0].IsSelected);
    Assert.False(tabs.Panes[1].IsSelected);
    Assert.Contains("fsus-disabled", tabs.Panes[1].Classes);
    Assert.Equal("Article sections", AutomationProperties.GetName(tabs));
    Assert.Equal(
      AutomationControlType.Tab,
      AutomationProperties.GetControlTypeOverride(tabs.Panes[0]));
    Assert.Equal(
      "selected",
      AutomationProperties.GetItemStatus(tabs.Panes[0]));
  }

  [AvaloniaFact]
  public void TabPaneContextRequestRaisesTypedEventWithoutChangingSelection()
  {
    var tabs = new FsusTabs();
    tabs.Panes.Add(new FsusTabPane { Key = "overview", Header = "Overview" });
    tabs.Panes.Add(new FsusTabPane
    {
      Key = "activity",
      Header = "Activity",
      IsEnabled = false,
    });
    tabs.SelectKey("overview");

    var requests = new List<FsusTabPaneContextEventArgs>();
    tabs.PaneContextRequested += (_, args) => requests.Add(args);
    var selections = new List<FsusNavigationSelectionChangedEventArgs>();
    tabs.SelectionChanged += (_, args) => selections.Add(args);

    Assert.True(
      tabs.RequestPaneContext(
        "overview",
        FsusTreeInteractionSource.Pointer));
    var request = Assert.Single(requests);
    Assert.Equal("overview", request.PaneKey);
    Assert.Equal(FsusTreeInteractionSource.Pointer, request.InteractionSource);
    Assert.Equal("overview", tabs.SelectedKey);
    Assert.Equal("overview", tabs.FocusedKey);
    Assert.Empty(selections);

    Assert.False(
      tabs.RequestPaneContext(
        "activity",
        FsusTreeInteractionSource.Pointer));
    Assert.False(
      tabs.RequestPaneContext(
        "missing",
        FsusTreeInteractionSource.Pointer));
    Assert.Single(requests);
    Assert.Empty(selections);
  }

  private sealed class KeyboardTabs : FsusTabs
  {
    public void Press(Key key) => HandleKey(key);
  }
}
