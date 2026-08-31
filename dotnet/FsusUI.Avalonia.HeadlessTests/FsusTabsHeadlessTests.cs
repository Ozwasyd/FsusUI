using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;
using Avalonia.VisualTree;
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

  [AvaloniaFact]
  public void PanesCanBeClearedAndRebuiltWithoutSelectionModelReentrancy()
  {
    var tabs = new FsusTabs();
    tabs.Panes.Add(new FsusTabPane { Key = "first", Header = "First" });
    tabs.Panes.Add(new FsusTabPane { Key = "second", Header = "Second" });
    tabs.SelectKey("second");

    tabs.Panes.Clear();

    Assert.Empty(tabs.Panes);
    Assert.Equal(string.Empty, tabs.SelectedKey);
    Assert.Equal(string.Empty, tabs.FocusedKey);
    Assert.Null(tabs.SelectedItem);

    tabs.Panes.Add(new FsusTabPane { Key = "replacement", Header = "Replacement" });

    Assert.Equal("replacement", tabs.SelectedKey);
    Assert.Equal("replacement", tabs.FocusedKey);
    Assert.Equal(tabs.Panes[0], tabs.SelectedItem);
    Assert.True(tabs.Panes[0].IsSelected);
  }

  [AvaloniaFact]
  public void PanesRenderWithDefaultThemeInsideCustomScrollableStripHost()
  {
    var tabs = new FsusTabs();
    tabs.Panes.Add(new FsusTabPane { Key = "first", Header = "First" });
    tabs.Panes.Add(new FsusTabPane { Key = "second", Header = "Second" });
    tabs.Panes.Add(new FsusTabPane { Key = "third", Header = "Third" });
    var strip = new Grid
    {
      ColumnDefinitions = new ColumnDefinitions("*,Auto"),
    };
    var scrollHost = new ScrollViewer
    {
      HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
      VerticalScrollBarVisibility = ScrollBarVisibility.Disabled,
      Content = tabs,
    };
    var add = new Button
    {
      Content = "+",
      VerticalAlignment = VerticalAlignment.Top,
    };
    Grid.SetColumn(add, 1);
    strip.Children.Add(scrollHost);
    strip.Children.Add(add);
    var window = new Window
    {
      Width = 420,
      Height = 160,
      ShowInTaskbar = false,
      Content = strip,
    };
    window.Styles.Add(new FluentTheme());
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });

    window.Show();
    Dispatcher.UIThread.RunJobs();

    Assert.Equal(3, tabs.ItemCount);
    Assert.Equal(3, tabs.GetVisualDescendants().OfType<FsusTabPane>().Count());
    Assert.All(tabs.Panes, pane => Assert.True(pane.Bounds.Width > 0));
    var evidencePath = Environment.GetEnvironmentVariable(
      "FSUS_ISSUE_755_EVIDENCE");
    if (!string.IsNullOrWhiteSpace(evidencePath))
    {
      var frame = window.CaptureRenderedFrame();
      Assert.NotNull(frame);
      frame!.Save(evidencePath);
    }

    window.Close();
  }

  private sealed class KeyboardTabs : FsusTabs
  {
    public void Press(Key key) => HandleKey(key);
  }
}
