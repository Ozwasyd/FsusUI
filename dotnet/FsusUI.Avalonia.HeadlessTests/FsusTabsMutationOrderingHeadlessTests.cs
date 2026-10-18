using Avalonia.Controls;
using Avalonia.Headless.XUnit;
using Avalonia.Markup.Xaml.Styling;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;
using FsusUI.Avalonia.Themes;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using Xunit;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTabsMutationOrderingHeadlessTests(ITestOutputHelper output)
{
  [AvaloniaTheory]
  [InlineData(false, false)]
  [InlineData(false, true)]
  [InlineData(true, false)]
  [InlineData(true, true)]
  public void RemovingSelectedPaneProcessesItemsBeforeSelectingFallback(bool mounted, bool removeLast)
  {
    var events = new List<string>();
    var tabs = new FsusDocumentTabs();
    var first = new FsusDocumentTab { Key = "first", Header = "First" };
    var second = new FsusDocumentTab { Key = "second", Header = "Second" };
    tabs.Panes.Add(first);
    tabs.Panes.Add(second);
    tabs.SelectKey(removeLast ? "second" : "first");
    var window = mounted ? Mount(tabs) : null;
    window?.Show();
    Dispatcher.UIThread.RunJobs();
    Observe(tabs, events, first, second);

    try
    {
      if (mounted)
      {
        Assert.Equal(2, tabs.GetVisualDescendants().OfType<FsusDocumentTab>().Count());
      }
      events.Add("remove:start");
      tabs.Panes.RemoveAt(removeLast ? 1 : 0);
      events.Add("remove:return");
      Dispatcher.UIThread.RunJobs();

      var remaining = removeLast ? first : second;
      Assert.Same(remaining, tabs.SelectedItem);
      Assert.Equal(0, tabs.SelectedIndex);
      Assert.Equal(remaining.Key, tabs.SelectedKey);
      Assert.Equal(remaining.Key, tabs.FocusedKey);
      Assert.True(remaining.IsSelected);
      Assert.Contains("items:Remove", events);
    }
    finally
    {
      output.WriteLine(string.Join(Environment.NewLine, events));
      window?.Close();
    }
  }

  [AvaloniaTheory]
  [InlineData(false, false)]
  [InlineData(false, true)]
  [InlineData(true, false)]
  [InlineData(true, true)]
  public void TwoDocumentReorderPreservesActiveDocument(bool mounted, bool moveLast)
  {
    var tabs = new FsusDocumentTabs();
    var first = new FsusDocumentTab { Key = "first", Header = "First" };
    var second = new FsusDocumentTab { Key = "second", Header = "Second" };
    tabs.AddDocument(first);
    tabs.AddDocument(second);
    var active = moveLast ? second : first;
    tabs.SelectKey(active.Key);
    var window = mounted ? Mount(tabs) : null;
    window?.Show();
    Dispatcher.UIThread.RunJobs();

    try
    {
      if (mounted)
      {
        Assert.Equal(2, tabs.GetVisualDescendants().OfType<FsusDocumentTab>().Count());
      }
      Assert.True(tabs.ReorderDocument(active.Key, moveLast ? 0 : 1));
      Dispatcher.UIThread.RunJobs();

      Assert.Equal(new[] { second, first }, tabs.Documents);
      Assert.Same(active, tabs.SelectedItem);
      Assert.Equal(moveLast ? 0 : 1, tabs.SelectedIndex);
      Assert.Equal(active.Key, tabs.SelectedKey);
      Assert.True(active.IsSelected);
      Assert.False((moveLast ? first : second).IsSelected);
    }
    finally
    {
      window?.Close();
    }
  }

  private static Window Mount(Control content)
  {
    var window = new Window { Content = content, Width = 400, Height = 200 };
    window.Styles.Add(new StyleInclude(new Uri("avares://FsusUI.Avalonia.HeadlessTests"))
    {
      Source = new Uri("avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml"),
    });
    new FsusThemeManager().Apply(window.Resources, new FsusThemeOptions
    {
      MotionMode = FsusMotionMode.Reduced,
    });
    return window;
  }

  [AvaloniaFact]
  public void AddRemoveResetAndImmediateSelectionRecordRealNotificationOrder()
  {
    var tabs = new FsusTabs();
    var events = new List<string>();
    var first = new FsusTabPane { Key = "first", Header = "First" };
    var second = new FsusTabPane { Key = "second", Header = "Second" };
    Observe(tabs, events, first, second);
    var selectionCounts = new List<(int Source, int View)>();
    foreach (var pane in new[] { first, second })
    {
      pane.PropertyChanged += (_, e) =>
      {
        if (e.Property == FsusTabPane.IsSelectedProperty)
        {
          selectionCounts.Add((tabs.Panes.Count, tabs.ItemCount));
        }
      };
    }

    try
    {
      events.Add("add:first:start");
      tabs.Panes.Add(first);
      events.Add("add:first:return");
      tabs.Panes.Add(second);
      events.Add("select:second:start");
      tabs.SelectKey("second");
      events.Add("select:second:return");
      tabs.Panes.Remove(first);
      events.Add("remove:first:return");
      tabs.Panes.Clear();
      events.Add("reset:return");
      tabs.Panes.Add(first);
      tabs.SelectKey("first");
      Dispatcher.UIThread.RunJobs();

      Assert.Same(first, tabs.SelectedItem);
      Assert.Equal("first", tabs.SelectedKey);
      Assert.Contains("items:Add", events);
      Assert.Contains("items:Remove", events);
      Assert.Contains("items:Reset", events);
      Assert.NotEmpty(selectionCounts);
      Assert.All(selectionCounts, counts => Assert.Equal(counts.Source, counts.View));
    }
    finally
    {
      output.WriteLine(string.Join(Environment.NewLine, events));
    }
  }

  [AvaloniaFact]
  public void AddingPreselectedDisabledAndMovedPanesPreservesKeyedSelection()
  {
    var tabs = new FsusTabs();
    var first = new FsusTabPane { Key = "first" };
    var disabled = new FsusTabPane { Key = "disabled", IsEnabled = false };
    tabs.Panes.Add(first);
    tabs.Panes.Add(disabled);
    tabs.SelectKey("first");
    var second = new FsusTabPane { Key = "second", IsSelected = true };
    tabs.Panes.Add(second);
    Dispatcher.UIThread.RunJobs();

    Assert.Equal("first", tabs.SelectedKey);
    Assert.Same(first, tabs.SelectedItem);
    Assert.False(second.IsSelected);
    tabs.SelectKey("disabled");
    tabs.SelectKey("missing");
    Assert.Same(first, tabs.SelectedItem);

    ((ObservableCollection<FsusTabPane>)tabs.Panes).Move(0, 2);
    Dispatcher.UIThread.RunJobs();
    Assert.Same(first, tabs.SelectedItem);
    Assert.Equal(2, tabs.SelectedIndex);

    tabs.Panes.Clear();
    tabs.Panes.Add(disabled);
    Dispatcher.UIThread.RunJobs();
    Assert.Empty(tabs.SelectedKey);
    Assert.Empty(tabs.FocusedKey);
  }

  [AvaloniaFact]
  public void PendingMutationsAcrossUnloadAndRemountKeepLatestSelectionAndOneSubscription()
  {
    var tabs = new FsusDocumentTabs();
    var first = new FsusDocumentTab { Key = "first", Header = "First" };
    var second = new FsusDocumentTab { Key = "second", Header = "Second" };
    tabs.AddDocument(first);
    tabs.AddDocument(second);
    var window = Mount(tabs);
    window.Show();
    Dispatcher.UIThread.RunJobs();

    try
    {
      var selections = new List<string>();
      tabs.SelectionChanged += (_, e) => selections.Add(e.SelectedKey);
      second.IsSelected = true;
      Assert.Equal(new[] { "second" }, selections);
      Assert.Equal("second", tabs.SelectedKey);
      Assert.Same(second, tabs.SelectedItem);

      window.Content = null;
      tabs.Panes.Clear();
      tabs.Panes.Add(first);
      tabs.Panes.Add(second);
      tabs.SelectKey("second");
      tabs.SelectKey("first");
      selections.Clear();
      window.Content = tabs;
      Dispatcher.UIThread.RunJobs();

      Assert.Same(first, tabs.SelectedItem);
      Assert.Equal("first", tabs.SelectedKey);
      Assert.Equal(new[] { "first" }, selections);
      selections.Clear();
      second.IsSelected = true;
      Assert.Equal(new[] { "second" }, selections);
      Assert.Same(second, tabs.SelectedItem);
      Assert.True(second.IsSelected);
      Assert.False(first.IsSelected);

      tabs.Panes.Clear();
      window.Content = null;
      Dispatcher.UIThread.RunJobs();
      Assert.Null(tabs.SelectedItem);
      Assert.Empty(tabs.SelectedKey);
      Assert.Empty(tabs.FocusedKey);
      tabs.Panes.Add(first);
      window.Content = tabs;
      Dispatcher.UIThread.RunJobs();
      Assert.Same(first, tabs.SelectedItem);
      Assert.True(first.IsSelected);
    }
    finally
    {
      window.Close();
    }
  }

  private static void Observe(FsusTabs tabs, List<string> events, params FsusTabPane[] panes)
  {
    ((INotifyCollectionChanged)tabs.Items).CollectionChanged += (_, e) =>
      events.Add($"items:{e.Action}");
    ((INotifyCollectionChanged)tabs.Panes).CollectionChanged += (_, e) =>
      events.Add($"panes:{e.Action}");
    ((TabControl)tabs).SelectionChanged += (_, _) =>
      events.Add($"base:selected:{tabs.SelectedIndex}:{tabs.SelectedKey}");
    tabs.SelectionChanged += (_, e) => events.Add($"fsus:selected:{e.SelectedKey}");
    foreach (var pane in panes)
    {
      pane.PropertyChanged += (_, e) =>
      {
        if (e.Property == FsusTabPane.IsSelectedProperty)
        {
          events.Add($"pane:{pane.Key}:{pane.IsSelected}:index={tabs.SelectedIndex}:count={tabs.ItemCount}");
        }
      };
    }
  }
}
